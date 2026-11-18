/** @import { AppCommand, AppState, StoreEffect } from '../../types.d.ts' */

import { buildBackupPayload, formatBackupAgeLabel, prepareBackupMerge } from '../../core/backup.js';
import { buildArchiveZipBlob, parseArchiveFile, saveArchiveBlob } from '../archive-file.js';
import {
  chooseExportDirectory,
  ensureExportDirectoryPermission,
  forgetExportDirectory,
  getExportDirectoryName,
  supportsExportDirectory,
} from '../export-directory.js';
import {
  getLastBackupAt,
  inspectStorageStatus,
  loadAllAssetBlobs,
  mergeWithBlobs,
  replaceAllWithBlobs,
  setLastBackupAt,
} from '../storage-idb.js';
import { closeDialogById, confirmAction, notify } from './app-shell.js';
import { initTooltips, setTooltip } from './tooltip.js';

/**
 * Format byte sizes into readable Kio / Mio labels.
 * @param {number | null} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === null) return 'Indisponible';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Kio`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mio`;
}

/**
 * Build a labeled password input field with an accessible visibility toggle.
 * @param {{
 *   id: string;
 *   label: string;
 *   autocomplete: AutoFill;
 *   describedBy?: string;
 * }} opts
 * @returns {{ field: HTMLDivElement; input: HTMLInputElement; resetVisibility: () => void }}
 */
function createPasswordField({ id, label, autocomplete, describedBy }) {
  const field = document.createElement('div');
  field.className = 'cv-field';

  const lbl = document.createElement('label');
  lbl.className = 'cv-label';
  lbl.htmlFor = id;
  lbl.textContent = label;

  const row = document.createElement('div');
  row.className = 'lc-password-row';

  const input = document.createElement('input');
  input.type = 'password';
  input.id = id;
  input.className = 'cv-input';
  input.autocomplete = autocomplete;
  if (describedBy) {
    input.setAttribute('aria-describedby', describedBy);
  }

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon lc-password-toggle';
  toggleBtn.setAttribute('aria-pressed', 'false');
  toggleBtn.setAttribute('aria-label', `Afficher : ${label}`);
  setTooltip(toggleBtn, 'Afficher le mot de passe');

  const icon = document.createElement('i');
  icon.className = 'ph ph-eye cv-icon';
  icon.setAttribute('aria-hidden', 'true');
  toggleBtn.append(icon);

  /** @param {boolean} revealed */
  const setRevealed = (revealed) => {
    input.type = revealed ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', revealed ? `Masquer : ${label}` : `Afficher : ${label}`);
    setTooltip(toggleBtn, revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    icon.className = revealed ? 'ph ph-eye-slash cv-icon' : 'ph ph-eye cv-icon';
  };

  toggleBtn.addEventListener('click', () => {
    setRevealed(input.type === 'password');
  });

  row.append(input, toggleBtn);
  field.append(lbl, row);

  return {
    field,
    input,
    resetVisibility: () => setRevealed(false),
  };
}

/**
 * Wire the Backup & Storage modal (#modal-backup).
 * @param {{
 *   db: import('idb').IDBPDatabase;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   appVersion: string;
 *   onBeforeReplace?: () => void;
 * }} opts
 */
export function wireBackupModal({ db, store, appVersion, onBeforeReplace }) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-backup'));
  const body = document.getElementById('modal-backup-body');
  if (!modal || !body) return;
  const backupModal = modal;
  const modalBody = body;

  let renderSeq = 0;

  function renderModalBody() {
    const seq = ++renderSeq;
    const state = store.getState();

    const statsSection = document.createElement('section');
    statsSection.className = 'lc-backup-section';

    const statsHead = document.createElement('div');
    statsHead.className = 'lc-view-header';
    const statsTitle = document.createElement('h3');
    statsTitle.className = 'cv-h4';
    statsTitle.style.margin = '0';
    statsTitle.textContent = 'État du stockage local';

    const persistBadge = document.createElement('span');
    persistBadge.className = 'cv-badge cv-badge--info';
    const dot = document.createElement('span');
    dot.className = 'cv-badge__dot';
    const persistText = document.createTextNode('Stockage standard');
    persistBadge.append(dot, persistText);
    statsHead.append(statsTitle, persistBadge);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'lc-backup-stats';

    /** @type {Array<[string, string]>} */
    const statItems = [
      ['Projets', String(state.projects.length)],
      ['Tâches', String(state.tasks.length)],
      ['Notes', String(state.notes.length)],
      ['Tableaux blancs', String(state.whiteboards.length)],
      ['Images locales', String(state.assets.length)],
      ['Espace utilisé', 'Calcul en cours'],
      ['Quota estimé', 'Calcul en cours'],
      ['Dernière sauvegarde ZIP', 'Vérification'],
    ];

    /** @type {HTMLElement | null} */
    let usageValueEl = null;
    /** @type {HTMLElement | null} */
    let quotaValueEl = null;
    /** @type {HTMLElement | null} */
    let lastBackupValueEl = null;

    for (const [label, value] of statItems) {
      const box = document.createElement('div');
      box.className = 'lc-stat';
      const l = document.createElement('span');
      l.className = 'lc-stat__label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'lc-stat__value';
      v.textContent = value;
      if (label === 'Espace utilisé') usageValueEl = v;
      if (label === 'Quota estimé') quotaValueEl = v;
      if (label === 'Dernière sauvegarde ZIP') {
        v.id = 'stat-last-backup-age';
        lastBackupValueEl = v;
      }
      box.append(l, v);
      statsGrid.append(box);
    }

    /** @param {string | null} isoTimestamp */
    function updateLastBackupUi(isoTimestamp) {
      if (!lastBackupValueEl) return;
      lastBackupValueEl.textContent = formatBackupAgeLabel(isoTimestamp);
      if (isoTimestamp) {
        try {
          lastBackupValueEl.title = new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(isoTimestamp));
        } catch {
          lastBackupValueEl.title = isoTimestamp;
        }
      } else {
        lastBackupValueEl.removeAttribute('title');
      }
    }

    const persistSlot = document.createElement('div');
    statsSection.append(statsHead, statsGrid, persistSlot);

    void getLastBackupAt(db).then((isoTimestamp) => {
      if (seq !== renderSeq || !backupModal.open) return;
      updateLastBackupUi(isoTimestamp);
    });

    void inspectStorageStatus({ requestPersist: false }).then((storage) => {
      if (seq !== renderSeq || !backupModal.open) return;
      persistBadge.className = storage.persisted
        ? 'cv-badge cv-badge--success'
        : 'cv-badge cv-badge--info';
      persistText.nodeValue = storage.persisted ? 'Stockage persistant' : 'Stockage standard';
      if (usageValueEl) usageValueEl.textContent = formatBytes(storage.usageBytes);
      if (quotaValueEl) quotaValueEl.textContent = formatBytes(storage.quotaBytes);
      if (!storage.persisted && storage.supported && !state.readOnly) {
        const reqBtn = document.createElement('button');
        reqBtn.type = 'button';
        reqBtn.className = 'cv-btn cv-btn--sm';
        reqBtn.textContent = 'Demander la persistance au navigateur';
        reqBtn.addEventListener('click', async () => {
          const res = await inspectStorageStatus({ requestPersist: true });
          notify({
            status: res.persisted ? 'success' : 'info',
            title: res.persisted ? 'Persistance accordée' : 'Persistance non accordée',
            text: res.persisted
              ? 'Le navigateur protégera vos données locales contre l’effacement automatique.'
              : 'Le navigateur gère encore ce stockage comme standard. Pensez à exporter vos sauvegardes.',
          });
          renderModalBody();
        });
        persistSlot.replaceChildren(reqBtn);
      } else {
        persistSlot.replaceChildren();
      }
    });

    const directorySection = document.createElement('section');
    directorySection.className = 'lc-backup-section';
    const directoryTitle = document.createElement('h3');
    directoryTitle.className = 'cv-h4';
    directoryTitle.textContent = 'Dossier des exports';
    const directoryStatus = document.createElement('p');
    directoryStatus.className = 'cv-caption';
    directoryStatus.id = 'export-directory-status';
    directoryStatus.setAttribute('role', 'status');
    const directoryHint = document.createElement('p');
    directoryHint.className = 'cv-caption';
    directoryHint.textContent =
      'Les archives ZIP, notes Markdown, calendriers et images seront enregistrés dans ce dossier. Un fichier du même nom sera remplacé.';
    const chooseDirectoryBtn = document.createElement('button');
    chooseDirectoryBtn.type = 'button';
    chooseDirectoryBtn.className = 'cv-btn cv-btn--sm';
    chooseDirectoryBtn.id = 'btn-choose-export-directory';
    const forgetDirectoryBtn = document.createElement('button');
    forgetDirectoryBtn.type = 'button';
    forgetDirectoryBtn.className = 'cv-btn cv-btn--sm';
    forgetDirectoryBtn.id = 'btn-forget-export-directory';
    forgetDirectoryBtn.textContent = 'Retirer le dossier';
    function updateDirectoryUi() {
      const name = getExportDirectoryName();
      directoryStatus.textContent = name
        ? `Dossier choisi : ${name}`
        : 'Aucun dossier choisi : sélecteur de fichier ou téléchargement classique.';
      chooseDirectoryBtn.textContent = name ? 'Changer de dossier' : 'Choisir un dossier';
      forgetDirectoryBtn.hidden = !name;
    }
    updateDirectoryUi();
    chooseDirectoryBtn.addEventListener('click', async () => {
      chooseDirectoryBtn.disabled = true;
      try {
        const result = await chooseExportDirectory();
        updateDirectoryUi();
        if (!result.remembered)
          directoryStatus.textContent += ' (Choix valable pour cette session uniquement.)';
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          notify({
            status: 'danger',
            title: 'Dossier indisponible',
            text: 'Impossible de sélectionner ce dossier. Réessayez.',
          });
        }
      } finally {
        chooseDirectoryBtn.disabled = false;
      }
    });
    forgetDirectoryBtn.addEventListener('click', async () => {
      try {
        await forgetExportDirectory();
        updateDirectoryUi();
      } catch {
        notify({
          status: 'danger',
          title: 'Impossible de retirer le dossier',
          text: 'Réessayez. Les fichiers sur le disque sont conservés.',
        });
      }
    });
    directorySection.append(directoryTitle, directoryStatus);
    if (supportsExportDirectory()) {
      directorySection.append(directoryHint, chooseDirectoryBtn, forgetDirectoryBtn);
    } else {
      directoryStatus.textContent =
        'Ce navigateur ne permet pas de choisir un dossier pour les exports. Le téléchargement classique reste disponible.';
    }

    // Export section
    const exportSection = document.createElement('section');
    exportSection.className = 'lc-backup-section';
    const exportTitle = document.createElement('h3');
    exportTitle.className = 'cv-h4';
    exportTitle.style.margin = '0';
    exportTitle.textContent = 'Exporter une archive';
    const exportDesc = document.createElement('p');
    exportDesc.className = 'cv-caption';
    exportDesc.style.margin = '0';
    exportDesc.textContent =
      'Enregistre une archive ZIP contenant vos projets, tâches, notes, tableaux blancs et images locales (sélecteur de fichier natif ou téléchargement).';

    const encryptCheckLabel = document.createElement('label');
    encryptCheckLabel.className = 'cv-check';
    const encryptCheckbox = document.createElement('input');
    encryptCheckbox.type = 'checkbox';
    encryptCheckbox.id = 'chk-export-encrypt';
    const encryptCheckText = document.createElement('span');
    encryptCheckText.textContent = 'Protéger l’archive par un mot de passe (AES-GCM)';
    encryptCheckLabel.append(encryptCheckbox, encryptCheckText);

    const encryptFieldsWrap = document.createElement('div');
    encryptFieldsWrap.id = 'export-encrypt-fields';
    encryptFieldsWrap.className = 'lc-encrypt-fields';
    encryptFieldsWrap.hidden = true;

    const exportPasswordField = createPasswordField({
      id: 'input-export-password',
      label: 'Mot de passe de chiffrement',
      autocomplete: 'new-password',
      describedBy: 'export-encrypt-hint',
    });
    const exportConfirmField = createPasswordField({
      id: 'input-export-password-confirm',
      label: 'Confirmer le mot de passe',
      autocomplete: 'new-password',
    });

    const encryptHint = document.createElement('p');
    encryptHint.id = 'export-encrypt-hint';
    encryptHint.className = 'cv-hint';
    encryptHint.style.margin = '0';
    encryptHint.textContent =
      'Dérivation PBKDF2-SHA-256 (310 000 itérations) et chiffrement AES-256-GCM. Conservez ce mot de passe : aucune récupération n’est possible sans lui.';

    const exportEncryptError = document.createElement('span');
    exportEncryptError.id = 'export-encrypt-error';
    exportEncryptError.className = 'cv-error';
    exportEncryptError.hidden = true;
    exportEncryptError.setAttribute('aria-live', 'polite');
    const exportErrIcon = document.createElement('i');
    exportErrIcon.className = 'ph ph-warning-circle cv-icon';
    exportErrIcon.setAttribute('aria-hidden', 'true');
    const exportErrText = document.createElement('span');
    exportEncryptError.append(exportErrIcon, exportErrText);

    function clearExportEncryptError() {
      exportEncryptError.hidden = true;
      exportErrText.textContent = '';
      exportPasswordField.input.removeAttribute('aria-invalid');
      exportConfirmField.input.removeAttribute('aria-invalid');
      exportPasswordField.input.setAttribute('aria-describedby', 'export-encrypt-hint');
      exportConfirmField.input.removeAttribute('aria-describedby');
    }

    encryptCheckbox.addEventListener('change', () => {
      encryptFieldsWrap.hidden = !encryptCheckbox.checked;
      clearExportEncryptError();
      if (encryptCheckbox.checked) {
        exportPasswordField.input.focus();
      } else {
        exportPasswordField.input.value = '';
        exportConfirmField.input.value = '';
        exportPasswordField.resetVisibility();
        exportConfirmField.resetVisibility();
      }
    });

    exportPasswordField.input.addEventListener('input', clearExportEncryptError);
    exportConfirmField.input.addEventListener('input', clearExportEncryptError);

    encryptFieldsWrap.append(
      exportPasswordField.field,
      exportConfirmField.field,
      encryptHint,
      exportEncryptError,
    );

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'cv-btn cv-btn--primary';
    exportBtn.id = 'btn-export-archive';
    const exportIcon = document.createElement('i');
    exportIcon.className = 'ph ph-download-simple cv-icon';
    exportIcon.setAttribute('aria-hidden', 'true');
    const exportBtnText = document.createTextNode(' Exporter l’archive ZIP');
    exportBtn.append(exportIcon, exportBtnText);

    exportBtn.addEventListener('click', async () => {
      clearExportEncryptError();
      const useEncryption = encryptCheckbox.checked;
      const password = exportPasswordField.input.value;
      const passwordConfirm = exportConfirmField.input.value;

      if (useEncryption) {
        if (password.length === 0) {
          exportErrText.textContent = 'Saisissez un mot de passe pour chiffrer l’archive.';
          exportEncryptError.hidden = false;
          exportPasswordField.input.setAttribute('aria-invalid', 'true');
          exportPasswordField.input.setAttribute(
            'aria-describedby',
            'export-encrypt-hint export-encrypt-error',
          );
          exportPasswordField.input.focus();
          return;
        }
        if (password !== passwordConfirm) {
          exportErrText.textContent = 'Les deux mots de passe ne correspondent pas.';
          exportEncryptError.hidden = false;
          exportConfirmField.input.setAttribute('aria-invalid', 'true');
          exportConfirmField.input.setAttribute('aria-describedby', 'export-encrypt-error');
          exportConfirmField.input.focus();
          return;
        }
      }

      exportBtn.disabled = true;
      try {
        await ensureExportDirectoryPermission();
        const current = store.getState();
        const now = new Date().toISOString();
        const { manifest, data } = buildBackupPayload(current, { now, appVersion });
        const assetBlobs = await loadAllAssetBlobs(db);
        const zipBlob = await buildArchiveZipBlob({
          manifest,
          data,
          assetBlobs,
          ...(useEncryption ? { password } : {}),
        });
        const datePart = now.slice(0, 10);
        const result = await saveArchiveBlob(zipBlob, `locavern-sauvegarde-${datePart}.zip`);
        if (!result.saved) return;
        await setLastBackupAt(db, now);
        updateLastBackupUi(now);
        exportPasswordField.input.value = '';
        exportConfirmField.input.value = '';
        exportPasswordField.resetVisibility();
        exportConfirmField.resetVisibility();
        notify({
          status: 'success',
          title: useEncryption ? 'Archive chiffrée exportée' : 'Archive exportée',
          text: `${current.projects.length} projets, ${current.tasks.length} tâches, ${current.notes.length} notes et ${current.whiteboards.length} tableaux blancs inclus.`,
        });
      } catch (error) {
        notify({
          status: 'danger',
          title: 'Échec de l’export',
          text:
            error instanceof Error
              ? error.message
              : 'Impossible d’enregistrer l’archive ZIP. Réessayez.',
        });
      } finally {
        exportBtn.disabled = false;
      }
    });
    exportSection.append(exportTitle, exportDesc, encryptCheckLabel, encryptFieldsWrap, exportBtn);

    // Import section
    const importSection = document.createElement('section');
    importSection.className = 'lc-backup-section';
    const importTitle = document.createElement('h3');
    importTitle.className = 'cv-h4';
    importTitle.style.margin = '0';
    importTitle.textContent = 'Importer une archive';
    const importDesc = document.createElement('p');
    importDesc.className = 'cv-caption';
    importDesc.style.margin = '0';
    importDesc.textContent =
      'Validez un fichier ZIP (clair ou chiffré) puis choisissez de fusionner les éléments, sélectionner des projets ou remplacer les données locales.';

    const fileField = document.createElement('div');
    fileField.className = 'cv-field';
    const fileLabel = document.createElement('label');
    fileLabel.className = 'cv-label';
    fileLabel.htmlFor = 'input-import-archive';
    fileLabel.textContent = 'Fichier de sauvegarde (.zip)';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'input-import-archive';
    fileInput.accept = '.zip,application/zip';
    fileInput.className = 'cv-input';
    fileInput.disabled = state.readOnly;
    fileField.append(fileLabel, fileInput);

    const importError = document.createElement('span');
    importError.id = 'import-archive-error';
    importError.className = 'cv-error';
    importError.hidden = true;
    const importErrIcon = document.createElement('i');
    importErrIcon.className = 'ph ph-warning-circle cv-icon';
    importErrIcon.setAttribute('aria-hidden', 'true');
    const importErrText = document.createElement('span');
    importError.append(importErrIcon, importErrText);

    const importPreviewSlot = document.createElement('div');
    importPreviewSlot.id = 'import-archive-preview';

    /** @type {File | null} */
    let pendingEncryptedFile = null;

    /**
     * Render mode options & project checkboxes for a parsed backup archive.
     * @param {Extract<Awaited<ReturnType<typeof parseArchiveFile>>, { ok: true }>} parsed
     */
    function renderImportOptionsPanel(parsed) {
      const panel = document.createElement('div');
      panel.className = 'lc-import-panel';
      panel.id = 'import-archive-panel';

      const summary = document.createElement('p');
      summary.className = 'cv-caption';
      summary.style.margin = '0';
      const prefix = parsed.encrypted ? 'Archive chiffrée déverrouillée' : 'Archive prête';
      summary.textContent = `${prefix} : ${parsed.data.projects.length} projet(s), ${parsed.data.tasks.length} tâche(s), ${parsed.data.notes.length} note(s), ${parsed.data.whiteboards.length} tableau(x) et ${parsed.data.assets.length} image(s).`;

      const modeFieldset = document.createElement('fieldset');
      modeFieldset.className = 'cv-fieldset lc-import-modes';
      const modeLegend = document.createElement('legend');
      modeLegend.className = 'cv-label';
      modeLegend.textContent = 'Mode d’importation';
      modeFieldset.append(modeLegend);

      const hasLocalData =
        state.projects.length > 0 ||
        state.tasks.length > 0 ||
        state.notes.length > 0 ||
        state.whiteboards.length > 0;
      /** @type {'merge' | 'projects' | 'replace'} */
      let selectedMode = hasLocalData ? 'merge' : 'replace';

      /** @type {Array<{ value: 'merge' | 'projects' | 'replace'; label: string }>} */
      const modeDefs = [
        {
          value: 'merge',
          label: 'Fusionner tout sans écraser les données locales',
        },
        {
          value: 'projects',
          label: 'Importer une sélection de projets sans écraser',
        },
        {
          value: 'replace',
          label: 'Remplacer toutes les données locales',
        },
      ];

      /** @type {HTMLInputElement[]} */
      const modeRadios = [];
      for (const def of modeDefs) {
        const lbl = document.createElement('label');
        lbl.className = 'cv-check';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'import-mode';
        radio.value = def.value;
        radio.checked = def.value === selectedMode;
        const txt = document.createElement('span');
        txt.textContent = def.label;
        lbl.append(radio, txt);
        modeFieldset.append(lbl);
        modeRadios.push(radio);
      }

      const projectSelectionWrap = document.createElement('div');
      projectSelectionWrap.id = 'import-project-selection';
      projectSelectionWrap.className = 'lc-import-projects';
      projectSelectionWrap.hidden = true;

      const projectSelectionTitle = document.createElement('span');
      projectSelectionTitle.className = 'cv-label';
      projectSelectionTitle.textContent = 'Projets à importer';
      projectSelectionWrap.append(projectSelectionTitle);

      /** @type {HTMLInputElement[]} */
      const projectCheckboxes = [];
      if (parsed.data.projects.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'cv-caption';
        emptyMsg.style.margin = '0';
        emptyMsg.textContent = 'Aucun projet dans cette archive.';
        projectSelectionWrap.append(emptyMsg);
      } else {
        for (const proj of parsed.data.projects) {
          const taskCount = parsed.data.tasks.filter((t) => t.projectId === proj.id).length;
          const noteCount = parsed.data.notes.filter((n) => n.projectId === proj.id).length;
          const wbCount = parsed.data.whiteboards.filter((w) => w.projectId === proj.id).length;
          const lbl = document.createElement('label');
          lbl.className = 'cv-check';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = true;
          cb.setAttribute('data-import-project-id', proj.id);
          const span = document.createElement('span');
          span.textContent = `${proj.name} (${taskCount} tâche(s), ${noteCount} note(s), ${wbCount} tableau(x))`;
          lbl.append(cb, span);
          projectSelectionWrap.append(lbl);
          projectCheckboxes.push(cb);
        }
      }

      const unassignedNotes = parsed.data.notes.filter((n) => n.projectId === null).length;
      const unassignedWbs = parsed.data.whiteboards.filter((w) => w.projectId === null).length;
      /** @type {HTMLInputElement | null} */
      let unassignedCb = null;
      if (unassignedNotes > 0 || unassignedWbs > 0) {
        const lbl = document.createElement('label');
        lbl.className = 'cv-check';
        unassignedCb = document.createElement('input');
        unassignedCb.type = 'checkbox';
        unassignedCb.id = 'import-include-unassigned';
        unassignedCb.checked = true;
        const span = document.createElement('span');
        span.textContent = `Inclure les éléments sans projet (${unassignedNotes} note(s), ${unassignedWbs} tableau(x))`;
        lbl.append(unassignedCb, span);
        projectSelectionWrap.append(lbl);
      }

      const selectionError = document.createElement('span');
      selectionError.id = 'import-selection-error';
      selectionError.className = 'cv-error';
      selectionError.hidden = true;
      const selErrIcon = document.createElement('i');
      selErrIcon.className = 'ph ph-warning-circle cv-icon';
      selErrIcon.setAttribute('aria-hidden', 'true');
      const selErrText = document.createElement('span');
      selErrText.textContent = 'Sélectionnez au moins un projet ou les éléments sans projet.';
      selectionError.append(selErrIcon, selErrText);
      projectSelectionWrap.append(selectionError);

      const actionsRow = document.createElement('div');
      actionsRow.className = 'lc-table-actions';
      const cancelImportBtn = document.createElement('button');
      cancelImportBtn.type = 'button';
      cancelImportBtn.id = 'btn-cancel-import-archive';
      cancelImportBtn.className = 'cv-btn cv-btn--sm';
      cancelImportBtn.textContent = 'Annuler';
      cancelImportBtn.addEventListener('click', () => {
        importPreviewSlot.replaceChildren();
      });

      const confirmImportBtn = document.createElement('button');
      confirmImportBtn.type = 'button';
      confirmImportBtn.id = 'btn-confirm-import-archive';
      const syncModeUi = () => {
        projectSelectionWrap.hidden = selectedMode !== 'projects';
        selectionError.hidden = true;
        confirmImportBtn.className =
          selectedMode === 'replace'
            ? 'cv-btn cv-btn--danger cv-btn--sm'
            : 'cv-btn cv-btn--primary cv-btn--sm';
        confirmImportBtn.textContent =
          selectedMode === 'replace' ? 'Importer et remplacer' : 'Lancer l’import';
      };
      syncModeUi();

      for (const radio of modeRadios) {
        radio.addEventListener('change', () => {
          if (radio.checked) {
            selectedMode = /** @type {'merge' | 'projects' | 'replace'} */ (radio.value);
            syncModeUi();
          }
        });
      }

      confirmImportBtn.addEventListener('click', async () => {
        if (selectedMode === 'replace') {
          closeDialogById('modal-backup');
          const confirmed = await confirmAction({
            title: 'Remplacer les données locales ?',
            message: `Cette archive contient ${parsed.data.projects.length} projets, ${parsed.data.tasks.length} tâches, ${parsed.data.notes.length} notes, ${parsed.data.whiteboards.length} tableaux blancs et ${parsed.data.assets.length} images. Les données actuelles seront remplacées.`,
            confirmLabel: 'Importer et remplacer',
            danger: true,
          });
          if (!confirmed) return;

          onBeforeReplace?.();
          await replaceAllWithBlobs(db, parsed.data, parsed.blobs);
          store.dispatch({
            type: 'replace_all',
            payload: {
              projects: parsed.data.projects,
              tasks: parsed.data.tasks,
              notes: parsed.data.notes,
              whiteboards: parsed.data.whiteboards,
              assets: parsed.data.assets,
              taskStatuses: parsed.data.taskStatuses,
            },
          });
          notify({
            status: 'success',
            title: 'Sauvegarde restaurée',
            text: `${parsed.data.projects.length} projets et ${parsed.data.tasks.length} tâches importés.`,
          });
          return;
        }

        const selectedProjectIds = projectCheckboxes
          .filter((cb) => cb.checked)
          .map((cb) => cb.getAttribute('data-import-project-id') ?? '')
          .filter(Boolean);
        const includeUnassigned = unassignedCb ? unassignedCb.checked : false;

        if (selectedMode === 'projects' && selectedProjectIds.length === 0 && !includeUnassigned) {
          selectionError.hidden = false;
          return;
        }

        const current = store.getState();
        const merged = prepareBackupMerge(current, parsed.data, parsed.blobs, {
          mode: selectedMode,
          ...(selectedMode === 'projects' ? { selectedProjectIds, includeUnassigned } : {}),
        });

        await mergeWithBlobs(db, merged, merged.blobs);
        store.dispatch({
          type: 'merge_backup',
          payload: {
            projects: merged.projects,
            tasks: merged.tasks,
            notes: merged.notes,
            whiteboards: merged.whiteboards,
            assets: merged.assets,
            ...(merged.taskStatuses ? { taskStatuses: merged.taskStatuses } : {}),
          },
        });
        closeDialogById('modal-backup');
        notify({
          status: 'success',
          title: 'Archive fusionnée',
          text: `${merged.projects.length} projet(s), ${merged.tasks.length} tâche(s), ${merged.notes.length} note(s) et ${merged.whiteboards.length} tableau(x) ajoutés sans écrasement.`,
        });
      });

      actionsRow.append(cancelImportBtn, confirmImportBtn);
      panel.append(summary, modeFieldset, projectSelectionWrap, actionsRow);
      importPreviewSlot.replaceChildren(panel);
    }

    /**
     * Render a password prompt when the selected ZIP is AES-GCM encrypted.
     * @param {File} encryptedFile
     */
    function renderDecryptPanel(encryptedFile) {
      const form = document.createElement('form');
      form.className = 'lc-import-panel';
      form.id = 'import-decrypt-panel';
      form.noValidate = true;

      const info = document.createElement('p');
      info.className = 'cv-caption';
      info.style.margin = '0';
      info.textContent = `L’archive « ${encryptedFile.name || 'sauvegarde.zip'} » est chiffrée par mot de passe. Saisissez-le pour vérifier et prévisualiser son contenu.`;

      const passwordField = createPasswordField({
        id: 'input-import-password',
        label: 'Mot de passe de l’archive',
        autocomplete: 'off',
      });

      const decryptError = document.createElement('span');
      decryptError.id = 'import-decrypt-error';
      decryptError.className = 'cv-error';
      decryptError.hidden = true;
      decryptError.setAttribute('aria-live', 'polite');
      const decErrIcon = document.createElement('i');
      decErrIcon.className = 'ph ph-warning-circle cv-icon';
      decErrIcon.setAttribute('aria-hidden', 'true');
      const decErrText = document.createElement('span');
      decryptError.append(decErrIcon, decErrText);

      const actionsRow = document.createElement('div');
      actionsRow.className = 'lc-table-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = 'btn-cancel-decrypt-archive';
      cancelBtn.className = 'cv-btn cv-btn--sm';
      cancelBtn.textContent = 'Annuler';
      cancelBtn.addEventListener('click', () => {
        pendingEncryptedFile = null;
        importPreviewSlot.replaceChildren();
      });

      const unlockBtn = document.createElement('button');
      unlockBtn.type = 'submit';
      unlockBtn.id = 'btn-unlock-archive';
      unlockBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
      const lockIcon = document.createElement('i');
      lockIcon.className = 'ph ph-lock-open cv-icon';
      lockIcon.setAttribute('aria-hidden', 'true');
      unlockBtn.append(lockIcon, document.createTextNode(' Déverrouiller l’archive'));

      passwordField.input.addEventListener('input', () => {
        decryptError.hidden = true;
        decErrText.textContent = '';
        passwordField.input.removeAttribute('aria-invalid');
        passwordField.input.removeAttribute('aria-describedby');
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!pendingEncryptedFile) return;
        const password = passwordField.input.value;
        if (password.length === 0) {
          decErrText.textContent = 'Saisissez le mot de passe pour déverrouiller cette archive.';
          decryptError.hidden = false;
          passwordField.input.setAttribute('aria-invalid', 'true');
          passwordField.input.setAttribute('aria-describedby', 'import-decrypt-error');
          passwordField.input.focus();
          return;
        }

        unlockBtn.disabled = true;
        try {
          const unlocked = await parseArchiveFile(pendingEncryptedFile, { password });
          if (!unlocked.ok) {
            if (unlocked.needsPassword) {
              decErrText.textContent = unlocked.error;
              decryptError.hidden = false;
              passwordField.input.setAttribute('aria-invalid', 'true');
              passwordField.input.setAttribute('aria-describedby', 'import-decrypt-error');
              passwordField.input.focus();
              passwordField.input.select();
              return;
            }
            pendingEncryptedFile = null;
            importPreviewSlot.replaceChildren();
            importErrText.textContent = unlocked.error;
            importError.hidden = false;
            return;
          }

          pendingEncryptedFile = null;
          passwordField.input.value = '';
          renderImportOptionsPanel(unlocked);
        } finally {
          unlockBtn.disabled = false;
        }
      });

      actionsRow.append(cancelBtn, unlockBtn);
      form.append(info, passwordField.field, decryptError, actionsRow);
      importPreviewSlot.replaceChildren(form);
      passwordField.input.focus();
    }

    fileInput.addEventListener('change', async () => {
      pendingEncryptedFile = null;
      importError.hidden = true;
      importErrText.textContent = '';
      importPreviewSlot.replaceChildren();
      fileInput.removeAttribute('aria-invalid');
      fileInput.removeAttribute('aria-describedby');
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;

      const parsed = await parseArchiveFile(file);
      if (!parsed.ok) {
        if (parsed.needsPassword) {
          pendingEncryptedFile = file;
          renderDecryptPanel(file);
          return;
        }
        importErrText.textContent = parsed.error;
        importError.hidden = false;
        fileInput.setAttribute('aria-invalid', 'true');
        fileInput.setAttribute('aria-describedby', 'import-archive-error');
        return;
      }

      renderImportOptionsPanel(parsed);
    });

    importSection.append(importTitle, importDesc, fileField, importError, importPreviewSlot);

    // Reset section
    const resetSection = document.createElement('section');
    resetSection.className = 'lc-backup-section';
    const resetTitle = document.createElement('h3');
    resetTitle.className = 'cv-h4';
    resetTitle.style.margin = '0';
    resetTitle.textContent = 'Réinitialisation locale';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'cv-btn cv-btn--danger';
    resetBtn.id = 'btn-reset-all-data';
    resetBtn.disabled = state.readOnly;
    resetBtn.textContent = 'Effacer toutes les données locales';
    resetBtn.addEventListener('click', async () => {
      closeDialogById('modal-backup');
      const confirmed = await confirmAction({
        title: 'Effacer toutes les données locales ?',
        message:
          'Tous les projets, tâches, notes, tableaux blancs et images stockés sur cet appareil seront définitivement supprimés.',
        confirmLabel: 'Effacer tout',
        danger: true,
      });
      if (!confirmed) return;

      onBeforeReplace?.();
      const emptyPayload = { projects: [], tasks: [], notes: [], whiteboards: [], assets: [] };
      await replaceAllWithBlobs(db, emptyPayload, new Map());
      await setLastBackupAt(db, null);
      store.dispatch({ type: 'replace_all', payload: emptyPayload });
      notify({
        status: 'info',
        title: 'Données effacées',
        text: 'Le stockage local est maintenant vide.',
      });
    });
    resetSection.append(resetTitle, resetBtn);

    modalBody.replaceChildren(
      statsSection,
      directorySection,
      exportSection,
      importSection,
      resetSection,
    );
    initTooltips(modalBody);
  }

  // Re-render whenever modal is opened
  const observer = new MutationObserver(() => {
    if (modal.open) {
      renderModalBody();
    }
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['open'] });

  modal.addEventListener('close', () => {
    modal.returnValue = '';
    modalBody.replaceChildren();
  });
}

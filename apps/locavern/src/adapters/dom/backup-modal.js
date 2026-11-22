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
import { errorText } from '../../core/messages.js';
import { closeDialogById, confirmAction, notify } from './app-shell.js';
import { initTooltips, setTooltip } from './tooltip.js';
import { i18n, t } from '../i18n.js';

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/** The counts of an archive or of the data in the "(s)" wording, one function per kind of item. */
const spelled = {
  projects: (/** @type {number} */ count) => t('backup.count.sp.projects', { count }),
  tasks: (/** @type {number} */ count) => t('backup.count.sp.tasks', { count }),
  notes: (/** @type {number} */ count) => t('backup.count.sp.notes', { count }),
  whiteboards: (/** @type {number} */ count) => t('backup.count.sp.whiteboards', { count }),
  assets: (/** @type {number} */ count) => t('backup.count.sp.assets', { count }),
};

/** The same counts in the plain plural wording. */
const plain = {
  projects: (/** @type {number} */ count) => t('backup.count.pl.projects', { count }),
  tasks: (/** @type {number} */ count) => t('backup.count.pl.tasks', { count }),
  notes: (/** @type {number} */ count) => t('backup.count.pl.notes', { count }),
  whiteboards: (/** @type {number} */ count) => t('backup.count.pl.whiteboards', { count }),
  assets: (/** @type {number} */ count) => t('backup.count.pl.assets', { count }),
};

/**
 * Format byte sizes into readable Kio / Mio labels.
 * @param {number | null} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === null) return t('backup.unavailable');
  if (bytes < 1024) return t('backup.bytes.b', { value: i18n.formatNumber(bytes) });
  if (bytes < 1024 * 1024)
    return t('backup.bytes.kb', { value: i18n.formatNumber(bytes / 1024, ONE_DECIMAL) });
  return t('backup.bytes.mb', { value: i18n.formatNumber(bytes / (1024 * 1024), TWO_DECIMALS) });
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
  toggleBtn.setAttribute('aria-label', t('backup.password.show', { label }));
  setTooltip(toggleBtn, t('backup.password.showTooltip'));

  const icon = document.createElement('i');
  icon.className = 'ph ph-eye cv-icon';
  icon.setAttribute('aria-hidden', 'true');
  toggleBtn.append(icon);

  /** @param {boolean} revealed */
  const setRevealed = (revealed) => {
    input.type = revealed ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', revealed ? 'true' : 'false');
    toggleBtn.setAttribute(
      'aria-label',
      revealed ? t('backup.password.hide', { label }) : t('backup.password.show', { label }),
    );
    setTooltip(
      toggleBtn,
      revealed ? t('backup.password.hideTooltip') : t('backup.password.showTooltip'),
    );
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
    statsTitle.textContent = t('backup.storage.title');

    const persistBadge = document.createElement('span');
    persistBadge.className = 'cv-badge cv-badge--info';
    const dot = document.createElement('span');
    dot.className = 'cv-badge__dot';
    const persistText = document.createTextNode(t('backup.storage.standard'));
    persistBadge.append(dot, persistText);
    statsHead.append(statsTitle, persistBadge);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'lc-backup-stats';

    /** @type {Array<[string, string, string]>} */
    const statItems = [
      ['projects', t('common.projects'), String(state.projects.length)],
      ['tasks', t('common.tasks'), String(state.tasks.length)],
      ['notes', t('common.notes'), String(state.notes.length)],
      ['whiteboards', t('common.whiteboards'), String(state.whiteboards.length)],
      ['assets', t('backup.stat.images'), String(state.assets.length)],
      ['used', t('backup.stat.used'), t('backup.stat.calculating')],
      ['quota', t('backup.stat.quota'), t('backup.stat.calculating')],
      ['lastBackup', t('backup.stat.lastBackup'), t('backup.stat.checking')],
    ];

    /** @type {HTMLElement | null} */
    let usageValueEl = null;
    /** @type {HTMLElement | null} */
    let quotaValueEl = null;
    /** @type {HTMLElement | null} */
    let lastBackupValueEl = null;

    for (const [statId, label, value] of statItems) {
      const box = document.createElement('div');
      box.className = 'lc-stat';
      const l = document.createElement('span');
      l.className = 'lc-stat__label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'lc-stat__value';
      v.textContent = value;
      if (statId === 'used') usageValueEl = v;
      if (statId === 'quota') quotaValueEl = v;
      if (statId === 'lastBackup') {
        v.id = 'stat-last-backup-age';
        lastBackupValueEl = v;
      }
      box.append(l, v);
      statsGrid.append(box);
    }

    /** @param {string | null} isoTimestamp */
    function updateLastBackupUi(isoTimestamp) {
      if (!lastBackupValueEl) return;
      lastBackupValueEl.textContent = formatBackupAgeLabel(isoTimestamp, Date.now(), t);
      if (isoTimestamp) {
        try {
          lastBackupValueEl.title = i18n.formatDateTime(Date.parse(isoTimestamp));
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
      persistText.nodeValue = storage.persisted
        ? t('backup.storage.persistent')
        : t('backup.storage.standard');
      if (usageValueEl) usageValueEl.textContent = formatBytes(storage.usageBytes);
      if (quotaValueEl) quotaValueEl.textContent = formatBytes(storage.quotaBytes);
      if (!storage.persisted && storage.supported && !state.readOnly) {
        const reqBtn = document.createElement('button');
        reqBtn.type = 'button';
        reqBtn.className = 'cv-btn cv-btn--sm';
        reqBtn.textContent = t('backup.persist.ask');
        reqBtn.addEventListener('click', async () => {
          const res = await inspectStorageStatus({ requestPersist: true });
          notify({
            status: res.persisted ? 'success' : 'info',
            title: res.persisted ? t('backup.persist.granted') : t('backup.persist.denied'),
            text: res.persisted ? t('backup.persist.grantedText') : t('backup.persist.deniedText'),
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
    directoryTitle.textContent = t('backup.directory.title');
    const directoryStatus = document.createElement('p');
    directoryStatus.className = 'cv-caption';
    directoryStatus.id = 'export-directory-status';
    directoryStatus.setAttribute('role', 'status');
    const directoryHint = document.createElement('p');
    directoryHint.className = 'cv-caption';
    directoryHint.textContent = t('backup.directory.hint');
    const chooseDirectoryBtn = document.createElement('button');
    chooseDirectoryBtn.type = 'button';
    chooseDirectoryBtn.className = 'cv-btn cv-btn--sm';
    chooseDirectoryBtn.id = 'btn-choose-export-directory';
    const forgetDirectoryBtn = document.createElement('button');
    forgetDirectoryBtn.type = 'button';
    forgetDirectoryBtn.className = 'cv-btn cv-btn--sm';
    forgetDirectoryBtn.id = 'btn-forget-export-directory';
    forgetDirectoryBtn.textContent = t('backup.directory.forget');
    function updateDirectoryUi() {
      const name = getExportDirectoryName();
      directoryStatus.textContent = name
        ? t('backup.directory.chosen', { name })
        : t('backup.directory.none');
      chooseDirectoryBtn.textContent = name
        ? t('backup.directory.change')
        : t('backup.directory.choose');
      forgetDirectoryBtn.hidden = !name;
    }
    updateDirectoryUi();
    chooseDirectoryBtn.addEventListener('click', async () => {
      chooseDirectoryBtn.disabled = true;
      try {
        const result = await chooseExportDirectory();
        updateDirectoryUi();
        if (!result.remembered)
          directoryStatus.textContent += ` ${t('backup.directory.sessionOnly')}`;
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          notify({
            status: 'danger',
            title: t('backup.directory.unavailable'),
            text: t('backup.directory.unavailableText'),
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
          title: t('backup.directory.forgetFailed'),
          text: t('backup.directory.forgetFailedText'),
        });
      }
    });
    directorySection.append(directoryTitle, directoryStatus);
    if (supportsExportDirectory()) {
      directorySection.append(directoryHint, chooseDirectoryBtn, forgetDirectoryBtn);
    } else {
      directoryStatus.textContent = t('backup.directory.unsupported');
    }

    // Export section
    const exportSection = document.createElement('section');
    exportSection.className = 'lc-backup-section';
    const exportTitle = document.createElement('h3');
    exportTitle.className = 'cv-h4';
    exportTitle.textContent = t('backup.export.title');
    const exportDesc = document.createElement('p');
    exportDesc.className = 'cv-caption';
    exportDesc.textContent = t('backup.export.desc');

    const encryptCheckLabel = document.createElement('label');
    encryptCheckLabel.className = 'cv-check';
    const encryptCheckbox = document.createElement('input');
    encryptCheckbox.type = 'checkbox';
    encryptCheckbox.id = 'chk-export-encrypt';
    const encryptCheckText = document.createElement('span');
    encryptCheckText.textContent = t('backup.export.encrypt');
    encryptCheckLabel.append(encryptCheckbox, encryptCheckText);

    const encryptFieldsWrap = document.createElement('div');
    encryptFieldsWrap.id = 'export-encrypt-fields';
    encryptFieldsWrap.className = 'lc-encrypt-fields';
    encryptFieldsWrap.hidden = true;

    const exportPasswordField = createPasswordField({
      id: 'input-export-password',
      label: t('backup.export.passwordLabel'),
      autocomplete: 'new-password',
      describedBy: 'export-encrypt-hint',
    });
    const exportConfirmField = createPasswordField({
      id: 'input-export-password-confirm',
      label: t('backup.export.confirmLabel'),
      autocomplete: 'new-password',
    });

    const encryptHint = document.createElement('p');
    encryptHint.id = 'export-encrypt-hint';
    encryptHint.className = 'cv-hint';
    encryptHint.textContent = t('backup.export.encryptHint');

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
    const exportBtnText = document.createTextNode(` ${t('backup.export.button')}`);
    exportBtn.append(exportIcon, exportBtnText);

    exportBtn.addEventListener('click', async () => {
      clearExportEncryptError();
      const useEncryption = encryptCheckbox.checked;
      const password = exportPasswordField.input.value;
      const passwordConfirm = exportConfirmField.input.value;

      if (useEncryption) {
        if (password.length === 0) {
          exportErrText.textContent = t('backup.export.passwordRequired');
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
          exportErrText.textContent = t('backup.export.passwordMismatch');
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
        const result = await saveArchiveBlob(zipBlob, `${t('export.slug.backup')}-${datePart}.zip`);
        if (!result.saved) return;
        await setLastBackupAt(db, now);
        updateLastBackupUi(now);
        exportPasswordField.input.value = '';
        exportConfirmField.input.value = '';
        exportPasswordField.resetVisibility();
        exportConfirmField.resetVisibility();
        notify({
          status: 'success',
          title: useEncryption ? t('backup.export.doneEncrypted') : t('backup.export.done'),
          text: t('backup.export.included', {
            items: i18n.formatList([
              plain.projects(current.projects.length),
              plain.tasks(current.tasks.length),
              plain.notes(current.notes.length),
              plain.whiteboards(current.whiteboards.length),
            ]),
          }),
        });
      } catch (error) {
        notify({
          status: 'danger',
          title: t('backup.export.failed'),
          text: errorText(error, t, 'backup.export.failedText'),
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
    importTitle.textContent = t('backup.import.title');
    const importDesc = document.createElement('p');
    importDesc.className = 'cv-caption';
    importDesc.textContent = t('backup.import.desc');

    const fileField = document.createElement('div');
    fileField.className = 'cv-field';
    const fileLabel = document.createElement('label');
    fileLabel.className = 'cv-label';
    fileLabel.htmlFor = 'input-import-archive';
    fileLabel.textContent = t('backup.import.fileLabel');
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
      const items = i18n.formatList([
        spelled.projects(parsed.data.projects.length),
        spelled.tasks(parsed.data.tasks.length),
        spelled.notes(parsed.data.notes.length),
        spelled.whiteboards(parsed.data.whiteboards.length),
        spelled.assets(parsed.data.assets.length),
      ]);
      summary.textContent = parsed.encrypted
        ? t('backup.import.summaryUnlocked', { items })
        : t('backup.import.summaryReady', { items });

      const modeFieldset = document.createElement('fieldset');
      modeFieldset.className = 'cv-fieldset lc-import-modes';
      const modeLegend = document.createElement('legend');
      modeLegend.className = 'cv-label';
      modeLegend.textContent = t('backup.import.modeLegend');
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
          label: t('backup.import.modeMerge'),
        },
        {
          value: 'projects',
          label: t('backup.import.modeProjects'),
        },
        {
          value: 'replace',
          label: t('backup.import.modeReplace'),
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
      projectSelectionTitle.textContent = t('backup.import.projectsTitle');
      projectSelectionWrap.append(projectSelectionTitle);

      /** @type {HTMLInputElement[]} */
      const projectCheckboxes = [];
      if (parsed.data.projects.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'cv-caption';
        emptyMsg.textContent = t('backup.import.noProjects');
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
          span.textContent = t('backup.import.projectLine', {
            name: proj.name,
            items: [
              spelled.tasks(taskCount),
              spelled.notes(noteCount),
              spelled.whiteboards(wbCount),
            ].join(', '),
          });
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
        span.textContent = t('backup.import.includeUnassigned', {
          items: [spelled.notes(unassignedNotes), spelled.whiteboards(unassignedWbs)].join(', '),
        });
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
      selErrText.textContent = t('backup.import.selectionRequired');
      selectionError.append(selErrIcon, selErrText);
      projectSelectionWrap.append(selectionError);

      const actionsRow = document.createElement('div');
      actionsRow.className = 'lc-table-actions';
      const cancelImportBtn = document.createElement('button');
      cancelImportBtn.type = 'button';
      cancelImportBtn.id = 'btn-cancel-import-archive';
      cancelImportBtn.className = 'cv-btn cv-btn--sm';
      cancelImportBtn.textContent = t('common.cancel');
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
          selectedMode === 'replace' ? t('backup.import.confirmReplace') : t('backup.import.start');
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
            title: t('backup.import.replaceTitle'),
            message: t('backup.import.replaceConfirm', {
              items: i18n.formatList([
                plain.projects(parsed.data.projects.length),
                plain.tasks(parsed.data.tasks.length),
                plain.notes(parsed.data.notes.length),
                plain.whiteboards(parsed.data.whiteboards.length),
                plain.assets(parsed.data.assets.length),
              ]),
            }),
            confirmLabel: t('backup.import.confirmReplace'),
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
            title: t('backup.import.restored'),
            text: t('backup.import.restoredText', {
              items: i18n.formatList([
                plain.projects(parsed.data.projects.length),
                plain.tasks(parsed.data.tasks.length),
              ]),
            }),
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
          title: t('backup.import.merged'),
          text: t('backup.import.mergedText', {
            items: i18n.formatList([
              spelled.projects(merged.projects.length),
              spelled.tasks(merged.tasks.length),
              spelled.notes(merged.notes.length),
              spelled.whiteboards(merged.whiteboards.length),
            ]),
          }),
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
      info.textContent = t('backup.decrypt.info', {
        name: encryptedFile.name || t('backup.import.defaultFile'),
      });

      const passwordField = createPasswordField({
        id: 'input-import-password',
        label: t('backup.decrypt.passwordLabel'),
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
      cancelBtn.textContent = t('common.cancel');
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
      unlockBtn.append(lockIcon, document.createTextNode(` ${t('backup.decrypt.unlock')}`));

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
          decErrText.textContent = t('backup.decrypt.required');
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
              decErrText.textContent = errorText(unlocked, t, 'backup.decrypt.required');
              decryptError.hidden = false;
              passwordField.input.setAttribute('aria-invalid', 'true');
              passwordField.input.setAttribute('aria-describedby', 'import-decrypt-error');
              passwordField.input.focus();
              passwordField.input.select();
              return;
            }
            pendingEncryptedFile = null;
            importPreviewSlot.replaceChildren();
            importErrText.textContent = errorText(unlocked, t, 'errors.backup.invalidJson');
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
        importErrText.textContent = errorText(parsed, t, 'errors.backup.invalidJson');
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
    resetTitle.textContent = t('backup.reset.title');
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'cv-btn cv-btn--danger';
    resetBtn.id = 'btn-reset-all-data';
    resetBtn.disabled = state.readOnly;
    resetBtn.textContent = t('backup.reset.button');
    resetBtn.addEventListener('click', async () => {
      closeDialogById('modal-backup');
      const confirmed = await confirmAction({
        title: t('backup.reset.confirmTitle'),
        message: t('backup.reset.confirmText'),
        confirmLabel: t('backup.reset.confirmLabel'),
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
        title: t('backup.reset.done'),
        text: t('backup.reset.doneText'),
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

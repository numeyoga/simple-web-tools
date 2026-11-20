// workspace management modal (IndexedDB workspaces).
// Lets the user switch, create, rename, delete, export or import a workspace.
import { importErrorMessage, readExport } from '../backup.js';
import { WORKSPACES } from '../workspaces.js';
import * as UI from './ui.js';

const { el } = UI;

/** @param {unknown} error */
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
function readTextFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ''));
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}

/** @param {number} ts */
function formatCreatedDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** @param {{ store: import('./types.js').Store, toasts?: import('./types.js').ToastHost }} options */
export function openWorkspaceManager({ store, toasts }) {
  /* Local state of the inline edit of a label. */
  /** @type {string | null} */
  let editingId = null;
  let pendingLabel = '';

  /* A question inside the modal itself (modals are never stacked): the content is replaced by
     the confirmation and comes back on the answer. */
  /** @param {{ title: string, message: string, confirmLabel?: string, danger?: boolean }} question */
  const ask = (question) => UI.Confirm({ ...question, within: modal });

  /* A read-only tab cannot create, rename, remove or import: the buttons are disabled, and the
     keyboard paths (Enter in a field) end here. */
  function refuseWhenReadOnly() {
    if (!store.state.readOnly) return false;
    if (toasts) {
      toasts.push({
        variant: 'warning',
        title: 'Lecture seule',
        body: 'Chrono est ouvert dans un autre onglet. Cet onglet est en lecture seule.',
      });
    }
    return true;
  }

  /* Single container re-rendered in place to avoid closing/reopening the modal. */
  const body = el('div', { class: 'ch-stack ch-gap-5' });

  /**
   * @param {import('@simple-web-tools/storage').Workspace} ws
   * @param {string} activeId
   */
  function workspaceRow(ws, activeId) {
    const isActive = ws.id === activeId;
    const isEditing = ws.id === editingId;

    // Normal view
    const title = isEditing
      ? UI.Input({
          ariaLabel: 'Nom de l’espace',
          value: pendingLabel,
          className: 'ch-grow',
          autoFocus: true,
          oninput: (e) => {
            pendingLabel = /** @type {HTMLInputElement} */ (e.target).value;
          },
          onkeydown: (e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              // Escape cancels the edit, not the whole dialog.
              e.preventDefault();
              e.stopPropagation();
              editingId = null;
              pendingLabel = '';
              render();
            }
          },
        })
      : el(
          'div',
          { class: 'ch-grow ch-stack ch-gap-1' },
          el(
            'div',
            { class: 'ch-row ch-center ch-wrap ch-gap-3' },
            el('span', { class: 'ch-ellipsis ch-figure' }, ws.label),
            isActive ? UI.Badge({ variant: 'accent', children: 'Actif' }) : null,
          ),
          el(
            'div',
            { class: 'ch-subtle cv-num ch-row ch-wrap ch-gap-3' },
            el('span', null, ws.id),
            ws.createdAt ? el('span', null, `créé ${formatCreatedDate(ws.createdAt)}`) : null,
          ),
        );

    function commitRename() {
      if (refuseWhenReadOnly()) return;
      const label = pendingLabel.trim();
      if (label && label !== ws.label) WORKSPACES.rename(ws.id, label);
      editingId = null;
      pendingLabel = '';
      render();
    }

    const list = WORKSPACES.getList();
    const canDelete = list.length > 1 && !isActive;

    return el(
      'div',
      {
        class: `ch-block ch-row ch-center ch-wrap ch-gap-4${isActive ? ' ch-block--selected' : ''}`,
      },
      title,

      isEditing
        ? el(
            'div',
            { class: 'ch-row ch-gap-2' },
            UI.IconButton({
              icon: 'check',
              label: 'Valider',
              onclick: commitRename,
            }),
            UI.IconButton({
              icon: 'x',
              label: 'Annuler',
              onclick: () => {
                editingId = null;
                pendingLabel = '';
                render();
              },
            }),
          )
        : el(
            'div',
            { class: 'ch-row ch-center ch-gap-2 ch-shrink-0' },
            !isActive
              ? UI.Button({
                  size: 'sm',
                  variant: 'primary',
                  icon: 'arrow-right',
                  children: 'Basculer',
                  onclick: async () => {
                    const ok = await ask({
                      title: 'Changer d’espace ?',
                      message: `La page va se recharger pour afficher l’espace « ${ws.label} ». Tout chrono en cours dans l’espace actuel reste enregistré.`,
                    });
                    if (ok) WORKSPACES.switchTo(ws.id);
                  },
                })
              : null,
            UI.IconButton({
              icon: 'pencil-simple',
              label: 'Renommer',
              mutates: true,
              onclick: () => {
                editingId = ws.id;
                pendingLabel = ws.label;
                render();
              },
            }),
            UI.IconButton({
              icon: 'trash',
              label: canDelete ? 'Supprimer' : 'Impossible : actif ou dernier',
              mutates: true,
              disabled: !canDelete,
              onclick: async () => {
                const ok = await ask({
                  title: 'Supprimer cet espace ?',
                  message: `Toutes les données de l’espace « ${ws.label} » seront effacées (projets, sessions, todos, pointage). Tu ne pourras pas annuler.`,
                  confirmLabel: 'Supprimer',
                  danger: true,
                });
                if (!ok || refuseWhenReadOnly()) return;
                await WORKSPACES.remove(ws.id);
                if (toasts)
                  toasts.push({ variant: 'info', title: 'Espace supprimé', body: ws.label });
                render();
              },
            }),
          ),
    );
  }

  function creationBlock() {
    let withDemo = false;
    const labelW = UI.Input({
      label: 'Nom du nouvel espace',
      placeholder: 'Ex. Perso, Freelance, Test, Q4…',
      className: 'ch-grow',
      onkeydown: (e) => {
        if (e.key === 'Enter') create();
      },
    });
    const input = labelW.input;
    const demo = UI.Checkbox({
      label: 'Inclure des données de démonstration au démarrage',
      onchange: (checked) => {
        withDemo = checked;
      },
    });

    async function create() {
      const label = (input.value || '').trim();
      if (!label) {
        labelW.setError('Le nom est vide. Saisis le nom du nouvel espace.');
        input.focus();
        return;
      }
      labelW.setError(null);
      if (refuseWhenReadOnly()) return;
      let ws;
      try {
        ws = await WORKSPACES.create({ label, seedDemo: withDemo });
      } catch (err) {
        if (toasts)
          toasts.push({ variant: 'danger', title: 'Création impossible', body: errorText(err) });
        return;
      }
      const ok = await ask({
        title: 'Basculer sur cet espace ?',
        message: `L’espace « ${ws.label} » a été créé. Veux-tu basculer dessus maintenant ?`,
      });
      if (ok) WORKSPACES.switchTo(ws.id);
      else {
        render();
        if (toasts) toasts.push({ variant: 'success', title: 'Espace créé', body: ws.label });
      }
    }
    input.addEventListener('input', () => labelW.setError(null));

    return el(
      'section',
      { class: 'ch-block ch-block--dashed ch-stack ch-gap-4' },
      el('h3', { class: 'cv-overline ch-title-reset' }, 'Nouvel espace'),
      el(
        'div',
        { class: 'ch-row ch-wrap ch-align-end ch-gap-3' },
        labelW,
        UI.Button({
          variant: 'primary',
          icon: 'plus',
          children: 'Créer',
          mutates: true,
          onclick: create,
        }),
      ),
      demo,
    );
  }

  function exportImportBlock() {
    const fileInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      hidden: true,
      'aria-hidden': 'true',
      tabindex: -1,
      onchange: async (/** @type {import('./types.js').TargetEvent} */ e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
          const txt = await readTextFile(file);
          // Rejects a file that is not a Chrono export before asking for the confirmation.
          readExport(txt, Date.now(), { strict: true });
          const ws = WORKSPACES.getActive();
          const ok = await ask({
            title: 'Remplacer les données ?',
            message: `Toutes les données actuelles de l’espace « ${ws.label} » seront remplacées par le contenu du fichier. Tu ne pourras pas annuler.`,
            confirmLabel: 'Remplacer les données',
            danger: true,
          });
          if (!ok || refuseWhenReadOnly()) return;
          await WORKSPACES.importJson(ws.id, txt);
          if (toasts)
            toasts.push({ variant: 'success', title: 'Import terminé', body: 'Rechargement…' });
          setTimeout(() => location.reload(), 400);
        } catch (err) {
          if (toasts)
            toasts.push({
              variant: 'danger',
              title: 'Import impossible',
              body: importErrorMessage(err),
            });
        }
      },
    });

    return el(
      'section',
      { class: 'ch-block ch-stack ch-gap-3' },
      el('h3', { class: 'cv-overline ch-title-reset' }, 'Sauvegarde'),
      el(
        'div',
        { class: 'ch-meta' },
        'Exporte ou importe l’espace actif au format JSON. Pratique pour archiver ou migrer.',
      ),
      el(
        'div',
        { class: 'ch-row ch-wrap ch-gap-3' },
        UI.Button({
          size: 'sm',
          icon: 'download-simple',
          children: 'Exporter JSON',
          onclick: async () => {
            try {
              await WORKSPACES.downloadCurrentJson(store);
              if (toasts) toasts.push({ variant: 'success', title: 'Export téléchargé' });
            } catch (err) {
              if (toasts)
                toasts.push({
                  variant: 'danger',
                  title: 'Export impossible',
                  body: errorText(err),
                });
            }
          },
        }),
        UI.Button({
          size: 'sm',
          icon: 'upload-simple',
          children: 'Importer JSON',
          mutates: true,
          onclick: () => fileInput.click(),
        }),
        fileInput,
      ),
    );
  }

  function render() {
    const list = WORKSPACES.getList();
    const activeId = WORKSPACES.getActiveId();
    body.replaceChildren(
      el(
        'div',
        { class: 'ch-meta' },
        'Chaque espace est une base IndexedDB isolée. Idéal pour séparer perso / pro, ou faire des essais sans toucher à tes vraies données.',
      ),
      el('div', { class: 'ch-stack ch-gap-3' }, ...list.map((ws) => workspaceRow(ws, activeId))),
      creationBlock(),
      exportImportBlock(),
    );
    UI.initCovenant(body);
  }

  render();

  const modal = UI.Modal({
    title: 'Espaces de sauvegarde',
    body,
    footer: [UI.Button({ children: 'Fermer', onclick: () => modal.close() })],
  });
}

// workspace management modal (IndexedDB workspaces).
// Lets the user switch, create, rename, delete, export or import a workspace.
import { importErrorMessage, readExport } from '../backup.js';
import { WORKSPACES } from '../workspaces.js';
import * as UI from './ui.js';

const { el, icon } = UI;

/* Small promisified confirmation modal (yes/no).
     Important: `modal.close()` triggers `onclose`. The answer is remembered
     before closing so that `onclose` does not resolve `false` in our place. */
/**
 * @param {{ title: string, message: string, danger?: boolean }} options
 * @returns {Promise<boolean>}
 */
function askConfirm({ title, message, danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (/** @type {boolean} */ value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const modal = UI.Modal({
      title: title,
      width: 420,
      body: el(
        'div',
        { style: { font: '400 13px/1.5 var(--cv-font-sans)', color: 'var(--cv-fg)' } },
        message,
      ),
      footer: [
        UI.Button({
          variant: 'ghost',
          children: 'Annuler',
          onclick: () => {
            finish(false);
            modal.close();
          },
        }),
        UI.Button({
          variant: danger ? 'destructive' : 'primary',
          icon: danger ? 'trash' : 'check',
          children: danger ? 'Supprimer' : 'Confirmer',
          onclick: () => {
            finish(true);
            modal.close();
          },
        }),
      ],
      onclose: () => finish(false),
    });
  });
}

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
  const body = el('div', { class: 'ch-pile ch-g14' });

  /**
   * @param {import('@simple-web-tools/storage').Workspace} ws
   * @param {string} activeId
   */
  function workspaceRow(ws, activeId) {
    const isActive = ws.id === activeId;
    const isEditing = ws.id === editingId;

    // Normal view
    const title = isEditing
      ? el('input', {
          value: pendingLabel,
          autocomplete: 'off',
          oninput: (/** @type {import('./types.js').TargetEvent} */ e) => {
            pendingLabel = e.target.value;
          },
          onkeydown: (/** @type {import('./types.js').TargetKeyEvent} */ e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              editingId = null;
              pendingLabel = '';
              render();
            }
          },
          style: {
            flex: 1,
            height: 30,
            padding: '0 10px',
            border: '1px solid var(--cv-accent-500)',
            borderRadius: 6,
            background: 'var(--cv-surface)',
            color: 'var(--cv-fg)',
            font: '500 13px/1 var(--cv-font-sans)',
            outline: 'none',
          },
          ref: (/** @type {HTMLInputElement} */ node) => {
            setTimeout(() => {
              node.focus();
              node.select();
            }, 10);
          },
        })
      : el(
          'div',
          { class: 'ch-souple ch-pile ch-g2' },
          el(
            'div',
            { class: 'ch-flex-c ch-g8' },
            el(
              'span',
              {
                class: 'ch-ellipse',
                style: {
                  font: '500 14px/1.2 var(--cv-font-sans)',
                  color: 'var(--cv-fg)',
                },
              },
              ws.label,
            ),
            isActive ? UI.Badge({ variant: 'accent', dot: true, children: 'actif' }) : null,
          ),
          el(
            'div',
            {
              class: 'ch-flex-c ch-g10',
              style: { font: '400 11px/1.3 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)' },
            },
            el('span', null, ws.id),
            ws.createdAt ? el('span', null, '·') : null,
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
        class: 'ch-flex-c ch-g10',
        style: {
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${isActive ? 'var(--cv-accent-500)' : 'var(--cv-border)'}`,
          background: isActive ? 'var(--cv-accent-50)' : 'var(--cv-surface)',
        },
      },
      // Icon
      el(
        'div',
        {
          style: {
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isActive ? 'var(--cv-accent-500)' : 'var(--cv-neutral-100)',
            color: isActive ? '#fff' : 'var(--cv-fg-muted)',
          },
        },
        icon(isActive ? 'database' : 'database', {
          weight: isActive ? 'fill' : 'regular',
          size: 16,
        }),
      ),

      title,

      isEditing
        ? el(
            'div',
            { class: 'ch-flex ch-g4' },
            UI.IconButton({
              icon: 'check',
              label: 'Valider',
              variant: 'ghost',
              onclick: commitRename,
            }),
            UI.IconButton({
              icon: 'x',
              label: 'Annuler',
              variant: 'ghost',
              onclick: () => {
                editingId = null;
                pendingLabel = '';
                render();
              },
            }),
          )
        : el(
            'div',
            { class: 'ch-flex ch-g4', style: { flexShrink: 0 } },
            !isActive
              ? UI.Button({
                  size: 'sm',
                  variant: 'primary',
                  icon: 'arrow-right',
                  children: 'Basculer',
                  onclick: async () => {
                    const ok = await askConfirm({
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
              variant: 'ghost',
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
              variant: 'ghost',
              mutates: true,
              disabled: !canDelete,
              onclick: async () => {
                const ok = await askConfirm({
                  title: 'Supprimer cet espace ?',
                  message: `Toutes les données de l’espace « ${ws.label} » seront effacées (projets, sessions, todos, pointage). Cette action est irréversible.`,
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
    const input = el('input', {
      placeholder: 'Ex. Perso, Freelance, Test, Q4…',
      autocomplete: 'off',
      onkeydown: (/** @type {import('./types.js').TargetKeyEvent} */ e) => {
        if (e.key === 'Enter') create();
      },
      style: {
        flex: 1,
        height: 32,
        padding: '0 10px',
        border: '1px solid var(--cv-border-strong)',
        borderRadius: 8,
        background: 'var(--cv-surface)',
        color: 'var(--cv-fg)',
        font: '400 13px/1 var(--cv-font-sans)',
        outline: 'none',
      },
    });
    const checkbox = el('input', {
      type: 'checkbox',
      onchange: (/** @type {import('./types.js').TargetEvent} */ e) => {
        withDemo = e.target.checked;
      },
      style: { accentColor: 'var(--cv-accent-500)' },
    });

    async function create() {
      const label = (input.value || '').trim();
      if (!label) {
        input.focus();
        return;
      }
      if (refuseWhenReadOnly()) return;
      let ws;
      try {
        ws = await WORKSPACES.create({ label, seedDemo: withDemo });
      } catch (err) {
        if (toasts)
          toasts.push({ variant: 'danger', title: 'Création impossible', body: errorText(err) });
        return;
      }
      const ok = await askConfirm({
        title: 'Basculer sur cet espace ?',
        message: `L’espace « ${ws.label} » a été créé. Veux-tu basculer dessus maintenant ?`,
      });
      if (ok) WORKSPACES.switchTo(ws.id);
      else {
        render();
        if (toasts) toasts.push({ variant: 'success', title: 'Espace créé', body: ws.label });
      }
    }

    return el(
      'div',
      {
        class: 'ch-pile ch-g10',
        style: {
          padding: 12,
          border: '1px dashed var(--cv-border-strong)',
          borderRadius: 10,
          background: 'var(--cv-neutral-50)',
        },
      },
      el(
        'div',
        {
          style: {
            font: '600 12px/1 var(--cv-font-sans)',
            color: 'var(--cv-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        },
        'Nouvel espace',
      ),
      el(
        'div',
        { class: 'ch-flex ch-g8' },
        input,
        UI.Button({
          variant: 'primary',
          icon: 'plus',
          children: 'Créer',
          mutates: true,
          onclick: create,
        }),
      ),
      el(
        'label',
        {
          class: 'ch-meta ch-flex-c ch-g8',
          style: { cursor: 'pointer' },
        },
        checkbox,
        el('span', null, 'Inclure des données de démonstration au démarrage'),
      ),
    );
  }

  function exportImportBlock() {
    const fileInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      style: { display: 'none' },
      onchange: async (/** @type {import('./types.js').TargetEvent} */ e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
          const txt = await readTextFile(file);
          // Rejects a file that is not a Chrono export before asking for the confirmation.
          readExport(txt, Date.now(), { strict: true });
          const ws = WORKSPACES.getActive();
          const ok = await askConfirm({
            title: 'Remplacer les données ?',
            message: `Toutes les données actuelles de l’espace « ${ws.label} » seront remplacées par le contenu du fichier. Continuer ?`,
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
      'div',
      {
        class: 'ch-panneau ch-pile ch-g8',
        style: { padding: 12 },
      },
      el(
        'div',
        {
          style: {
            font: '600 12px/1 var(--cv-font-sans)',
            color: 'var(--cv-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        },
        'Sauvegarde',
      ),
      el(
        'div',
        { class: 'ch-note' },
        'Exporte ou importe l’espace actif au format JSON. Pratique pour archiver ou migrer.',
      ),
      el(
        'div',
        { class: 'ch-flex ch-g8' },
        UI.Button({
          variant: 'secondary',
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
          variant: 'secondary',
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
        { class: 'ch-note' },
        'Chaque espace est une base IndexedDB isolée. Idéal pour séparer perso / pro, ou faire des essais sans toucher à tes vraies données.',
      ),
      el('div', { class: 'ch-pile ch-g8' }, ...list.map((ws) => workspaceRow(ws, activeId))),
      creationBlock(),
      exportImportBlock(),
    );
  }

  render();

  const modal = UI.Modal({
    title: 'Espaces de sauvegarde',
    width: 560,
    body,
    footer: [UI.Button({ variant: 'ghost', children: 'Fermer', onclick: () => modal.close() })],
  });
}

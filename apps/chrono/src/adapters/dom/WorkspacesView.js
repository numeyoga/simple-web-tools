// workspace management modal (IndexedDB workspaces).
// Lets the user switch, create, rename, delete, export or import a workspace.
import { importErrorMessage, readExport } from '../backup.js';
import { WORKSPACES } from '../workspaces.js';
import * as UI from './ui.js';

const { el, t, formatDay } = UI;

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
  if (!ts) return t('common.dash');
  return formatDay(ts, { day: '2-digit', month: 'short', year: 'numeric' });
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
        title: t('shell.readOnly.toastTitle'),
        body: t('shell.readOnly.toastBody'),
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
          ariaLabel: t('workspaces.nameLabel'),
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
            isActive ? UI.Badge({ variant: 'accent', children: t('workspaces.active') }) : null,
          ),
          el(
            'div',
            { class: 'ch-subtle cv-num ch-row ch-wrap ch-gap-3' },
            el('span', null, ws.id),
            ws.createdAt
              ? el('span', null, t('workspaces.created', { date: formatCreatedDate(ws.createdAt) }))
              : null,
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
              label: t('workspaces.validate'),
              onclick: commitRename,
            }),
            UI.IconButton({
              icon: 'x',
              label: t('common.cancel'),
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
                  children: t('workspaces.switch'),
                  onclick: async () => {
                    const ok = await ask({
                      title: t('workspaces.switchTitle'),
                      message: t('workspaces.switchMessage', { name: ws.label }),
                    });
                    if (ok) WORKSPACES.switchTo(ws.id);
                  },
                })
              : null,
            UI.IconButton({
              icon: 'pencil-simple',
              label: t('workspaces.rename'),
              mutates: true,
              onclick: () => {
                editingId = ws.id;
                pendingLabel = ws.label;
                render();
              },
            }),
            UI.IconButton({
              icon: 'trash',
              label: canDelete ? t('common.delete') : t('workspaces.cannotDelete'),
              mutates: true,
              disabled: !canDelete,
              onclick: async () => {
                const ok = await ask({
                  title: t('workspaces.deleteTitle'),
                  message: t('workspaces.deleteMessage', { name: ws.label }),
                  confirmLabel: t('common.delete'),
                  danger: true,
                });
                if (!ok || refuseWhenReadOnly()) return;
                await WORKSPACES.remove(ws.id);
                if (toasts)
                  toasts.push({ variant: 'info', title: t('workspaces.deleted'), body: ws.label });
                render();
              },
            }),
          ),
    );
  }

  function creationBlock() {
    let withDemo = false;
    const labelW = UI.Input({
      label: t('workspaces.newName'),
      placeholder: t('workspaces.newPlaceholder'),
      className: 'ch-grow',
      onkeydown: (e) => {
        if (e.key === 'Enter') create();
      },
    });
    const input = labelW.input;
    const demo = UI.Checkbox({
      label: t('workspaces.withDemo'),
      onchange: (checked) => {
        withDemo = checked;
      },
    });

    async function create() {
      const label = (input.value || '').trim();
      if (!label) {
        labelW.setError(t('workspaces.nameEmpty'));
        input.focus();
        return;
      }
      labelW.setError(null);
      if (refuseWhenReadOnly()) return;
      let ws;
      try {
        ws = await WORKSPACES.create({ label, seedDemo: withDemo, text: t });
      } catch (err) {
        if (toasts)
          toasts.push({
            variant: 'danger',
            title: t('workspaces.createFailed'),
            body: errorText(err),
          });
        return;
      }
      const ok = await ask({
        title: t('workspaces.switchToNewTitle'),
        message: t('workspaces.switchToNewMessage', { name: ws.label }),
      });
      if (ok) WORKSPACES.switchTo(ws.id);
      else {
        render();
        if (toasts)
          toasts.push({ variant: 'success', title: t('workspaces.createdToast'), body: ws.label });
      }
    }
    input.addEventListener('input', () => labelW.setError(null));

    return el(
      'section',
      { class: 'ch-block ch-block--dashed ch-stack ch-gap-4' },
      el('h3', { class: 'cv-overline ch-title-reset' }, t('workspaces.newTitle')),
      el(
        'div',
        { class: 'ch-row ch-wrap ch-align-end ch-gap-3' },
        labelW,
        UI.Button({
          variant: 'primary',
          icon: 'plus',
          children: t('common.create'),
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
            title: t('workspaces.replaceTitle'),
            message: t('workspaces.replaceMessage', { name: ws.label }),
            confirmLabel: t('workspaces.replaceConfirm'),
            danger: true,
          });
          if (!ok || refuseWhenReadOnly()) return;
          await WORKSPACES.importJson(ws.id, txt);
          if (toasts)
            toasts.push({
              variant: 'success',
              title: t('workspaces.imported'),
              body: t('workspaces.reloading'),
            });
          setTimeout(() => location.reload(), 400);
        } catch (err) {
          if (toasts)
            toasts.push({
              variant: 'danger',
              title: t('workspaces.importFailed'),
              body: importErrorMessage(err, t),
            });
        }
      },
    });

    return el(
      'section',
      { class: 'ch-block ch-stack ch-gap-3' },
      el('h3', { class: 'cv-overline ch-title-reset' }, t('workspaces.backup')),
      el('div', { class: 'ch-meta' }, t('workspaces.backupHint')),
      el(
        'div',
        { class: 'ch-row ch-wrap ch-gap-3' },
        UI.Button({
          size: 'sm',
          icon: 'download-simple',
          children: t('workspaces.exportJson'),
          onclick: async () => {
            try {
              await WORKSPACES.downloadCurrentJson(store);
              if (toasts) toasts.push({ variant: 'success', title: t('workspaces.exported') });
            } catch (err) {
              if (toasts)
                toasts.push({
                  variant: 'danger',
                  title: t('workspaces.exportFailed'),
                  body: errorText(err),
                });
            }
          },
        }),
        UI.Button({
          size: 'sm',
          icon: 'upload-simple',
          children: t('workspaces.importJson'),
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
      el('div', { class: 'ch-meta' }, t('workspaces.intro')),
      el('div', { class: 'ch-stack ch-gap-3' }, ...list.map((ws) => workspaceRow(ws, activeId))),
      creationBlock(),
      exportImportBlock(),
    );
    UI.initCovenant(body);
  }

  render();

  const modal = UI.Modal({
    title: t('workspaces.title'),
    body,
    footer: [UI.Button({ children: t('common.close'), onclick: () => modal.close() })],
  });
}

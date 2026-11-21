// The workspaces dialog: switch, create, rename and delete a workspace, and export or import the
// JSON backup of the active one. The registry is in adapters/workspaces.js; creating, renaming,
// deleting and importing change data that is shared by every tab, so they are for the writer tab
// only (the controls are disabled in a read-only tab, and the keyboard paths end at the guard).
import { toLocalIsoDate } from '@simple-web-tools/dates';
import { serializeBackup, importErrorMessage, readBackup } from '../backup.js';
import { downloadText } from '../download.js';
import {
  activeWorkspace,
  activeWorkspaceId,
  createWorkspace,
  listWorkspaces,
  removeWorkspace,
  renameWorkspace,
  switchWorkspace,
} from '../workspaces.js';
import { exportFileName } from '../../core/export.js';
import * as UI from './ui.js';

const { el, t, formatDate } = UI;

/** @param {unknown} error */
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {number} timestamp epoch milliseconds, from the registry */
function formatCreatedDate(timestamp) {
  if (!timestamp) return '–';
  return formatDate(toLocalIsoDate(new Date(timestamp)), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * @param {{ store: import('./types.js').Store, toasts: import('./types.js').ToastHost }} options
 * @returns {import('./types.js').ModalHandle}
 */
export function openWorkspaceManager({ store, toasts }) {
  /* Local state of the inline edit of a name. */
  /** @type {string | null} */
  let editingId = null;
  let pendingLabel = '';

  /* A question inside the modal itself (modals are never stacked): the content is replaced by
     the confirmation and comes back on the answer. */
  /** @param {{ title: string, message: string, confirmLabel?: string, danger?: boolean }} question */
  const ask = (question) => UI.Confirm({ ...question, within: modal });

  function refuseWhenReadOnly() {
    if (!store.getState().readOnly) return false;
    toasts.push({
      variant: 'warning',
      title: t('shell.readOnly.toastTitle'),
      body: t('shell.readOnly.toastBody'),
    });
    return true;
  }

  /* Single container re-rendered in place to avoid closing and reopening the modal. */
  const body = el('div', { class: 'tn-stack tn-gap-5' });

  /**
   * @param {import('@simple-web-tools/storage').Workspace} workspace
   * @param {string} activeId
   */
  function workspaceRow(workspace, activeId) {
    const isActive = workspace.id === activeId;
    const isEditing = workspace.id === editingId;

    function stopEditing() {
      editingId = null;
      pendingLabel = '';
      render();
    }

    function commitRename() {
      if (refuseWhenReadOnly()) return;
      const label = pendingLabel.trim();
      if (label && label !== workspace.label) renameWorkspace(workspace.id, label);
      stopEditing();
    }

    const title = isEditing
      ? UI.Input({
          ariaLabel: t('workspaces.nameLabel'),
          value: pendingLabel,
          className: 'tn-grow',
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
              stopEditing();
            }
          },
        })
      : el(
          'div',
          { class: 'tn-grow tn-stack tn-gap-1' },
          el(
            'div',
            { class: 'tn-row tn-center tn-wrap tn-gap-3' },
            el('span', { class: 'tn-ellipsis tn-figure' }, workspace.label),
            isActive ? UI.Badge({ variant: 'accent', children: t('workspaces.active') }) : null,
          ),
          el(
            'div',
            { class: 'tn-subtle cv-num tn-row tn-wrap tn-gap-3' },
            el('span', null, workspace.id),
            workspace.createdAt
              ? el(
                  'span',
                  null,
                  t('workspaces.created', { date: formatCreatedDate(workspace.createdAt) }),
                )
              : null,
          ),
        );

    const canDelete =
      listWorkspaces().length > 1 && !isActive && workspace.id !== store.workspaceId;

    return el(
      'div',
      {
        class: `tn-block tn-row tn-center tn-wrap tn-gap-4${isActive ? ' tn-block--selected' : ''}`,
      },
      title,
      isEditing
        ? el(
            'div',
            { class: 'tn-row tn-gap-2' },
            UI.IconButton({
              icon: 'check',
              label: t('workspaces.validate'),
              onclick: commitRename,
            }),
            UI.IconButton({ icon: 'x', label: t('common.cancel'), onclick: stopEditing }),
          )
        : el(
            'div',
            { class: 'tn-row tn-center tn-gap-2 tn-shrink-0' },
            !isActive
              ? UI.Button({
                  size: 'sm',
                  variant: 'primary',
                  icon: 'arrow-right',
                  children: t('workspaces.switch'),
                  onclick: async () => {
                    const ok = await ask({
                      title: t('workspaces.switchTitle'),
                      message: t('workspaces.switchMessage', { name: workspace.label }),
                    });
                    if (!ok) return;
                    await store.flush();
                    switchWorkspace(workspace.id);
                  },
                })
              : null,
            UI.IconButton({
              icon: 'pencil-simple',
              label: t('workspaces.rename'),
              mutates: true,
              onclick: () => {
                editingId = workspace.id;
                pendingLabel = workspace.label;
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
                  message: t('workspaces.deleteMessage', { name: workspace.label }),
                  confirmLabel: t('common.delete'),
                  danger: true,
                });
                if (!ok || refuseWhenReadOnly()) return;
                await removeWorkspace(workspace.id, store.workspaceId);
                toasts.push({
                  variant: 'info',
                  title: t('workspaces.deleted'),
                  body: workspace.label,
                });
                render();
              },
            }),
          ),
    );
  }

  function creationBlock() {
    const nameField = UI.Input({
      label: t('workspaces.newName'),
      placeholder: t('workspaces.newPlaceholder'),
      className: 'tn-grow',
      onkeydown: (e) => {
        if (e.key === 'Enter') void create();
      },
    });

    async function create() {
      const label = (nameField.input.value || '').trim();
      if (!label) {
        nameField.setError(t('workspaces.nameEmpty'));
        nameField.input.focus();
        return;
      }
      nameField.setError(null);
      if (refuseWhenReadOnly()) return;
      let workspace;
      try {
        workspace = createWorkspace(label);
      } catch (error) {
        toasts.push({
          variant: 'danger',
          title: t('workspaces.createFailed'),
          body: errorText(error),
        });
        return;
      }
      const ok = await ask({
        title: t('workspaces.switchToNewTitle'),
        message: t('workspaces.switchToNewMessage', { name: workspace.label }),
      });
      if (ok) {
        await store.flush();
        switchWorkspace(workspace.id);
      } else {
        render();
        toasts.push({
          variant: 'success',
          title: t('workspaces.createdToast'),
          body: workspace.label,
        });
      }
    }
    nameField.input.addEventListener('input', () => nameField.setError(null));

    return el(
      'section',
      { class: 'tn-block tn-block--dashed tn-stack tn-gap-4' },
      el('h3', { class: 'cv-overline tn-title-reset' }, t('workspaces.newTitle')),
      el(
        'div',
        { class: 'tn-row tn-wrap tn-align-end tn-gap-3' },
        nameField,
        UI.Button({
          variant: 'primary',
          icon: 'plus',
          children: t('common.create'),
          mutates: true,
          onclick: create,
        }),
      ),
    );
  }

  /** Reads the chosen backup, asks before replacing the workspace, then replaces it and reloads. */
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
        // Rejects a file that is not a backup before asking for the confirmation.
        const content = readBackup(await file.text());
        const workspace = activeWorkspace();
        const ok = await ask({
          title: t('workspaces.replaceTitle'),
          message: t('workspaces.replaceMessage', { name: workspace.label }),
          confirmLabel: t('workspaces.replaceConfirm'),
          danger: true,
        });
        if (!ok || refuseWhenReadOnly()) return;
        const { skipped } = content;
        await store.replaceAll(content);
        const hasSkipped = skipped.folders + skipped.notes + skipped.assets > 0;
        toasts.push({
          variant: hasSkipped ? 'warning' : 'success',
          title: t('workspaces.imported'),
          body: hasSkipped ? t('workspaces.importedSkipped') : t('workspaces.reloading'),
        });
        setTimeout(() => location.reload(), hasSkipped ? 2500 : 400);
      } catch (error) {
        toasts.push({
          variant: 'danger',
          title: t('workspaces.importFailed'),
          body: importErrorMessage(error, t),
        });
      }
    },
  });

  function backupBlock() {
    return el(
      'section',
      { class: 'tn-block tn-stack tn-gap-3' },
      el('h3', { class: 'cv-overline tn-title-reset' }, t('workspaces.backup')),
      el('div', { class: 'tn-meta' }, t('workspaces.backupHint')),
      el(
        'div',
        { class: 'tn-row tn-wrap tn-gap-3' },
        UI.Button({
          size: 'sm',
          icon: 'download-simple',
          children: t('workspaces.exportJson'),
          onclick: async () => {
            try {
              const envelope = await store.exportBackup();
              downloadText(
                exportFileName({
                  kind: 'all',
                  workspaceId: store.workspaceId,
                  date: toLocalIsoDate(new Date()),
                  extension: 'json',
                }),
                serializeBackup(envelope),
                'application/json',
              );
              toasts.push({ variant: 'success', title: t('workspaces.exported') });
            } catch (error) {
              toasts.push({
                variant: 'danger',
                title: t('workspaces.exportFailed'),
                body: errorText(error),
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
    const activeId = activeWorkspaceId();
    body.replaceChildren(
      el('div', { class: 'tn-meta' }, t('workspaces.intro')),
      el(
        'div',
        { class: 'tn-stack tn-gap-3' },
        ...listWorkspaces().map((workspace) => workspaceRow(workspace, activeId)),
      ),
      creationBlock(),
      backupBlock(),
    );
    UI.initCovenant(body);
  }

  render();

  const modal = UI.Modal({
    title: t('workspaces.title'),
    body,
    footer: [UI.Button({ children: t('common.close'), onclick: () => modal.close() })],
  });
  return modal;
}

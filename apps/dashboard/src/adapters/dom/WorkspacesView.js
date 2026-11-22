// The workspaces dialog (the spaces of the previous version): switch, create, rename, duplicate
// and delete a workspace. The registry is in adapters/workspaces.js; creating, renaming,
// duplicating and deleting change data that is shared by every tab, so they are for the writer tab
// only (the controls are disabled in a read-only tab, and the keyboard paths end at the guard).
import { toLocalIsoDate } from '@simple-web-tools/dates';
import {
  activeWorkspaceId,
  createWorkspace,
  duplicateWorkspace,
  listWorkspaces,
  removeWorkspace,
  renameWorkspace,
  switchWorkspace,
} from '../workspaces.js';
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
  const body = el('div', { class: 'dsh-stack dsh-gap-5' });

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
          className: 'dsh-grow',
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
          { class: 'dsh-grow dsh-stack dsh-gap-1' },
          el(
            'div',
            { class: 'dsh-row dsh-center dsh-wrap dsh-gap-3' },
            el('span', { class: 'dsh-ellipsis dsh-figure' }, workspace.label),
            isActive ? UI.Badge({ variant: 'accent', children: t('workspaces.active') }) : null,
          ),
          el(
            'div',
            { class: 'dsh-subtle cv-num dsh-row dsh-wrap dsh-gap-3' },
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
        class: `dsh-block dsh-row dsh-center dsh-wrap dsh-gap-4${isActive ? ' dsh-block--selected' : ''}`,
      },
      title,
      isEditing
        ? el(
            'div',
            { class: 'dsh-row dsh-gap-2' },
            UI.IconButton({
              icon: 'check',
              label: t('workspaces.validate'),
              onclick: commitRename,
            }),
            UI.IconButton({ icon: 'x', label: t('common.cancel'), onclick: stopEditing }),
          )
        : el(
            'div',
            { class: 'dsh-row dsh-center dsh-gap-2 dsh-shrink-0' },
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
              icon: 'copy',
              label: t('workspaces.duplicate'),
              mutates: true,
              onclick: async () => {
                if (refuseWhenReadOnly()) return;
                try {
                  await store.flush();
                  const copy = await duplicateWorkspace(
                    workspace.id,
                    t('workspaces.copyName', { name: workspace.label }),
                  );
                  toasts.push({
                    variant: 'success',
                    title: t('workspaces.duplicated'),
                    body: copy.label,
                  });
                  render();
                } catch (error) {
                  toasts.push({
                    variant: 'danger',
                    title: t('workspaces.duplicateFailed'),
                    body: errorText(error),
                  });
                }
              },
            }),
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
      className: 'dsh-grow',
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
      { class: 'dsh-block dsh-block--dashed dsh-stack dsh-gap-4' },
      el('h3', { class: 'cv-overline' }, t('workspaces.newTitle')),
      el(
        'div',
        { class: 'dsh-row dsh-wrap dsh-align-end dsh-gap-3' },
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

  function render() {
    const activeId = activeWorkspaceId();
    body.replaceChildren(
      el('div', { class: 'dsh-meta' }, t('workspaces.intro')),
      el(
        'div',
        { class: 'dsh-stack dsh-gap-3' },
        ...listWorkspaces().map((workspace) => workspaceRow(workspace, activeId)),
      ),
      creationBlock(),
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

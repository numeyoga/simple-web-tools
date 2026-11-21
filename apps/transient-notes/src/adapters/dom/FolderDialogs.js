// The folder dialogs: create, rename, move to another category and delete (with a confirmation).
// Each one is a Covenant modal; the change itself is a command of the store.
import { PARA_CATEGORIES } from '../../core/model.js';
import { selectNoteCounts } from '../../core/selectors.js';
import { createFolderCommand } from '../commands.js';
import { categoryLabel } from '../labels.js';
import * as UI from './ui.js';

const { el, t } = UI;

/**
 * A modal with a folder name field and/or a category select, and a primary button.
 * @param {{ title: string, confirmLabel: string, name?: string | null, category?: import('../../types.d.ts').ParaCategory | null,
 *   onSubmit: (values: { name: string, category: import('../../types.d.ts').ParaCategory }) => void }} options
 *   `name: null` hides the name field, `category: null` hides the category select
 * @returns {import('./types.js').ModalHandle}
 */
function openFolderForm({ title, confirmLabel, name = null, category = null, onSubmit }) {
  const nameField =
    name === null
      ? null
      : UI.Input({
          label: t('folders.nameLabel'),
          value: name,
          placeholder: t('folders.namePlaceholder'),
          autoFocus: true,
          required: true,
        });
  const categoryField =
    category === null
      ? null
      : UI.Select({
          label: t('folders.categoryLabel'),
          value: category,
          options: PARA_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) })),
        });

  function submit() {
    const value = nameField ? nameField.input.value.trim() : '';
    if (nameField && value === '') {
      nameField.setError(t('folders.nameEmpty'));
      nameField.input.focus();
      return;
    }
    const chosen = /** @type {import('../../types.d.ts').ParaCategory} */ (
      categoryField ? categoryField.input.value : (category ?? 'projects')
    );
    modal.close();
    onSubmit({ name: value, category: chosen });
  }

  if (nameField) {
    nameField.input.addEventListener('input', () => nameField.setError(null));
    nameField.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }
  const modal = UI.Modal({
    title,
    body: el('div', { class: 'tn-stack tn-gap-4' }, nameField, categoryField),
    footer: [
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({ variant: 'primary', children: confirmLabel, onclick: submit }),
    ],
  });
  nameField?.input.select();
  return modal;
}

/**
 * Creates a folder, then shows it.
 * @param {import('./types.js').Store} store
 * @param {import('../../types.d.ts').ParaCategory} category the category the select starts on
 */
export function openNewFolder(store, category) {
  openFolderForm({
    title: t('folders.newTitle'),
    confirmLabel: t('common.create'),
    name: '',
    category,
    onSubmit: ({ name, category: chosen }) => {
      const command = createFolderCommand(name, chosen);
      store.dispatch(command);
      if (command.type === 'create_folder') {
        store.dispatch({ type: 'select', selection: { kind: 'folder', folderId: command.id } });
      }
    },
  });
}

/**
 * @param {import('./types.js').Store} store
 * @param {import('../../types.d.ts').Folder} folder
 */
export function openRenameFolder(store, folder) {
  openFolderForm({
    title: t('folders.renameTitle'),
    confirmLabel: t('folders.rename'),
    name: folder.name,
    onSubmit: ({ name }) => store.dispatch({ type: 'rename_folder', id: folder.id, name }),
  });
}

/**
 * @param {import('./types.js').Store} store
 * @param {import('../../types.d.ts').Folder} folder
 */
export function openMoveFolder(store, folder) {
  openFolderForm({
    title: t('folders.moveTitle'),
    confirmLabel: t('folders.move'),
    category: folder.category,
    onSubmit: ({ category }) => store.dispatch({ type: 'move_folder', id: folder.id, category }),
  });
}

/**
 * Asks, then deletes the folder: its notes are kept, with no folder.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {import('../../types.d.ts').Folder} folder
 */
export async function confirmDeleteFolder(store, toasts, folder) {
  const count = selectNoteCounts(store.getState()).byFolder[folder.id] ?? 0;
  const ok = await UI.Confirm({
    title: t('folders.deleteTitle'),
    message: t('folders.deleteMessage', { name: folder.name, count }),
    confirmLabel: t('folders.deleteConfirm'),
    danger: true,
  });
  if (!ok) return;
  store.dispatch({ type: 'delete_folder', id: folder.id });
  toasts.push({ variant: 'success', title: t('folders.deleted') });
}

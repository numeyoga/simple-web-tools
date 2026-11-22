// The group dialogs: create, edit (name and colour) and delete (with a confirmation). Each one is
// a Covenant modal; the change itself is a command of the store.
import { nextCategory } from '../../core/colors.js';
import { createGroupCommand } from '../commands.js';
import { createColorPicker } from './ColorPicker.js';
import * as UI from './ui.js';

const { el, fieldId, t } = UI;

/**
 * A modal with a group name field and a colour picker.
 * @param {{ title: string, confirmLabel: string, name: string, category: number,
 *   onSubmit: (values: { name: string, category: number }) => void }} options
 * @returns {import('./types.js').ModalHandle}
 */
function openGroupForm({ title, confirmLabel, name, category, onSubmit }) {
  const nameField = UI.Input({
    label: t('groups.nameLabel'),
    value: name,
    placeholder: t('groups.namePlaceholder'),
    autoFocus: true,
    required: true,
  });
  const picker = createColorPicker({ name: fieldId('fv-group-color'), value: category });

  function submit() {
    const value = nameField.input.value.trim();
    if (value === '') {
      nameField.setError(t('groups.nameEmpty'));
      nameField.input.focus();
      return;
    }
    modal.close();
    onSubmit({ name: value, category: picker.value });
  }

  nameField.input.addEventListener('input', () => nameField.setError(null));
  nameField.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  const modal = UI.Modal({
    title,
    body: el('div', { class: 'fv-stack fv-gap-5' }, nameField, picker.element),
    footer: [
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({ variant: 'primary', children: confirmLabel, onclick: submit }),
    ],
  });
  nameField.input.select();
  return modal;
}

/**
 * Creates a group. `onCreated` gets its id.
 * @param {import('./types.js').Store} store
 * @param {(id: string) => void} [onCreated]
 */
export function openNewGroup(store, onCreated) {
  openGroupForm({
    title: t('groups.newTitle'),
    confirmLabel: t('common.create'),
    name: '',
    category: nextCategory(store.getState().groups),
    onSubmit: ({ name, category }) => {
      const command = createGroupCommand(store.getState(), name, category);
      store.dispatch(command);
      onCreated?.(command.id);
    },
  });
}

/**
 * @param {import('./types.js').Store} store
 * @param {import('../../types.d.ts').Group} group
 */
export function openEditGroup(store, group) {
  openGroupForm({
    title: t('groups.editTitle'),
    confirmLabel: t('common.save'),
    name: group.label,
    category: group.category,
    onSubmit: ({ name, category }) =>
      store.dispatch({ type: 'update_group', id: group.id, label: name, category }),
  });
}

/**
 * Asks, then deletes the group: its links are kept, with no group.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {import('../../types.d.ts').Group} group
 */
export async function confirmDeleteGroup(store, toasts, group) {
  const count = store.getState().links.filter((link) => link.groupId === group.id).length;
  const ok = await UI.Confirm({
    title: t('groups.deleteTitle'),
    message: t('groups.deleteMessage', { name: group.label, count }),
    confirmLabel: t('common.delete'),
    danger: true,
  });
  if (!ok) return;
  store.dispatch({ type: 'delete_group', id: group.id });
  toasts.push({ variant: 'info', title: t('groups.deleted'), body: group.label });
}

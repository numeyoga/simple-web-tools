// The link dialogs: add and edit a link (with a new group made on the spot), delete with a
// confirmation, and "move to a group", the keyboard alternative to dragging a link onto a group.
import { nextCategory } from '../../core/colors.js';
import { orderedGroups } from '../../core/model.js';
import { parseUrl } from '../../core/url.js';
import { createGroupCommand, createLinkCommand } from '../commands.js';
import { createColorPicker } from './ColorPicker.js';
import * as UI from './ui.js';

const { el, fieldId, t } = UI;

/** The values of the group select that are not a group. */
const NO_GROUP = '';
const NEW_GROUP = '__new__';

/**
 * The error text of an address that cannot be saved.
 * @param {string} raw
 * @returns {string | null} `null` when the address is fine
 */
function urlProblem(raw) {
  const result = parseUrl(raw);
  if (result.ok) return null;
  if (result.reason === 'empty') return t('links.urlEmpty');
  if (result.reason === 'unsupported') return t('links.urlUnsupported');
  return t('links.urlInvalid');
}

/**
 * Adds a link, or edits one.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {{ link?: import('../../types.d.ts').Link, groupId?: string | null }} [options]
 *   `link` edits it; `groupId` is the group a new link starts in
 * @returns {import('./types.js').ModalHandle}
 */
export function openLinkForm(store, toasts, { link, groupId } = {}) {
  const state = store.getState();
  const groups = orderedGroups(state.groups);
  const startGroup = link
    ? link.groupId
    : groupId !== undefined
      ? groupId
      : (groups[0]?.id ?? null);

  const nameField = UI.Input({
    label: t('links.nameLabel'),
    value: link?.name ?? '',
    placeholder: t('links.namePlaceholder'),
    autoFocus: true,
  });
  const urlField = UI.Input({
    label: t('links.urlLabel'),
    value: link?.url ?? '',
    placeholder: t('links.urlPlaceholder'),
    hint: t('links.urlHint'),
    required: true,
    mono: true,
  });
  urlField.input.setAttribute('inputmode', 'url');
  urlField.input.setAttribute('autocomplete', 'off');
  urlField.input.setAttribute('autocapitalize', 'off');
  urlField.input.spellcheck = false;

  const groupField = UI.Select({
    label: t('links.groupLabel'),
    value: startGroup ?? NO_GROUP,
    options: [
      { value: NO_GROUP, label: t('links.noGroup') },
      ...groups.map((g) => ({ value: g.id, label: g.label })),
      { value: NEW_GROUP, label: t('links.newGroup') },
    ],
    onchange: (value) => {
      newGroup.hidden = value !== NEW_GROUP;
      if (value === NEW_GROUP) newGroupName.input.focus();
    },
  });

  const newGroupName = UI.Input({
    label: t('groups.nameLabel'),
    placeholder: t('groups.namePlaceholder'),
  });
  const picker = createColorPicker({
    name: fieldId('fv-link-group-color'),
    value: nextCategory(state.groups),
  });
  const newGroup = el(
    'div',
    { class: 'fv-stack fv-gap-4', hidden: true },
    newGroupName,
    picker.element,
  );

  urlField.input.addEventListener('input', () => urlField.setError(null));
  newGroupName.input.addEventListener('input', () => newGroupName.setError(null));

  function submit() {
    const problem = urlProblem(urlField.input.value);
    if (problem) {
      urlField.setError(problem);
      urlField.input.focus();
      return;
    }
    let target = groupField.input.value === NO_GROUP ? null : groupField.input.value;
    if (groupField.input.value === NEW_GROUP) {
      const label = newGroupName.input.value.trim();
      if (label === '') {
        newGroupName.setError(t('groups.nameEmpty'));
        newGroupName.input.focus();
        return;
      }
      const create = createGroupCommand(store.getState(), label, picker.value);
      store.dispatch(create);
      target = create.id;
    }
    const name = nameField.input.value;
    const url = urlField.input.value;
    modal.close();
    if (link) {
      store.dispatch({ type: 'update_link', id: link.id, name, url, groupId: target });
      toasts.push({ variant: 'success', title: t('links.updated') });
    } else {
      store.dispatch(createLinkCommand({ name, url, groupId: target }));
      toasts.push({ variant: 'success', title: t('links.added') });
    }
  }

  for (const field of [nameField, urlField, newGroupName]) {
    field.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    });
  }

  const modal = UI.Modal({
    title: link ? t('links.editTitle') : t('links.newTitle'),
    body: el('div', { class: 'fv-stack fv-gap-4' }, nameField, urlField, groupField, newGroup),
    footer: [
      link
        ? UI.Button({
            variant: 'danger',
            icon: 'trash',
            className: 'fv-push',
            children: t('common.delete'),
            onclick: () => {
              modal.close();
              void confirmDeleteLink(store, toasts, link);
            },
          })
        : null,
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({
        variant: 'primary',
        children: link ? t('common.save') : t('common.add'),
        onclick: submit,
      }),
    ],
  });
  nameField.input.focus();
  return modal;
}

/**
 * Asks, then deletes the link.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {import('../../types.d.ts').Link} link
 */
export async function confirmDeleteLink(store, toasts, link) {
  const ok = await UI.Confirm({
    title: t('links.deleteTitle'),
    message: t('links.deleteMessage', { name: link.name }),
    confirmLabel: t('common.delete'),
    danger: true,
  });
  if (!ok) return;
  store.dispatch({ type: 'delete_link', id: link.id });
  toasts.push({ variant: 'info', title: t('links.deleted'), body: link.name });
}

/**
 * "Move to a group": the keyboard and screen reader alternative to dragging a link onto a group.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {import('../../types.d.ts').Link} link
 */
export function openMoveLink(store, toasts, link) {
  const groups = orderedGroups(store.getState().groups);
  const field = UI.Select({
    label: t('links.moveLabel'),
    value: link.groupId ?? NO_GROUP,
    options: [
      { value: NO_GROUP, label: t('links.noGroup') },
      ...groups.map((g) => ({ value: g.id, label: g.label })),
    ],
  });
  const modal = UI.Modal({
    title: t('links.moveTitle', { name: link.name }),
    body: field,
    footer: [
      UI.Button({ children: t('common.cancel'), onclick: () => modal.close() }),
      UI.Button({
        variant: 'primary',
        children: t('links.move'),
        onclick: () => {
          const groupId = field.input.value === NO_GROUP ? null : field.input.value;
          modal.close();
          if (groupId === link.groupId) return;
          store.dispatch({ type: 'move_link', id: link.id, groupId });
          const group = groups.find((g) => g.id === groupId);
          toasts.push({
            variant: 'success',
            title: t('links.moved'),
            body: group ? group.label : t('links.noGroup'),
          });
        },
      }),
    ],
  });
  return modal;
}

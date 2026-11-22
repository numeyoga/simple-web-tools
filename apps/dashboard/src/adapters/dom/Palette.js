// The command menu (Covenant's CommandMenu, Ctrl+K or ⌘K): go to an application or a screen, or
// run an action, by typing a few letters. Covenant's combobox reads its options once, when it is
// wired, so the dialog is built again when the list of commands changes (a new application, a
// renamed template) and never while it is open.
import { ADMIN_PAGES } from '../../core/route.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/** The id of the dialog: the top bar button opens it by this id. */
export const PALETTE_ID = 'dsh-cmd';

/**
 * @typedef {object} PaletteItem
 * @property {string} value what `onCommand` gets
 * @property {string} label
 * @property {string} icon a Phosphor icon name
 * @property {string} [meta] a few words under the label, searched too
 */

/** The name of an admin screen. @param {string} page */
export function adminTitle(page) {
  switch (page) {
    case 'templates':
      return t('admin.templates');
    case 'metadata':
      return t('admin.metadata');
    case 'tags':
      return t('admin.tags');
    case 'data':
      return t('admin.data');
    default:
      return t('admin.settings');
  }
}

/** Phosphor icon of each admin screen. @type {Record<string, { icon: string }>} */
const ADMIN_SCREENS = {
  templates: { icon: 'stack' },
  metadata: { icon: 'rows' },
  tags: { icon: 'tag' },
  data: { icon: 'arrows-down-up' },
  settings: { icon: 'sliders-horizontal' },
};

/** The icon of an admin screen. @param {string} page */
export function adminIcon(page) {
  return (ADMIN_SCREENS[page] ?? ADMIN_SCREENS.settings)?.icon ?? '';
}

/**
 * The commands for the state of the app.
 * @param {import('../../types.d.ts').AppState} state
 * @returns {PaletteItem[]}
 */
export function paletteItems(state) {
  /** @type {PaletteItem[]} */
  const items = [
    { value: 'new-app', label: t('palette.newApp'), icon: 'plus' },
    {
      value: 'toggle-edit',
      label: state.editMode ? t('palette.editOff') : t('palette.editOn'),
      icon: 'pencil-simple',
    },
    { value: 'export', label: t('palette.export'), icon: 'download-simple' },
    { value: 'workspaces', label: t('palette.workspaces'), icon: 'database' },
    { value: 'preferences', label: t('palette.preferences'), icon: 'gear' },
    ...ADMIN_PAGES.map((page) => ({
      value: `admin:${page}`,
      label: t('palette.goTo', { name: adminTitle(page) }),
      icon: adminIcon(page),
    })),
    ...state.apps.map((app) => ({
      value: `app:${app.id}`,
      label: t('palette.goTo', { name: app.name }),
      icon: 'squares-four',
      meta: `${app.slug} ${app.jiraKey}`.trim(),
    })),
  ];
  return items;
}

/**
 * The command menu. `refresh` builds the dialog again from the items when they changed.
 * @param {{ getItems: () => PaletteItem[], onCommand: (value: string) => void }} options
 * @returns {{ el: HTMLElement, refresh: () => void }}
 */
export function createPalette({ getItems, onCommand }) {
  const host = el('div', { class: 'dsh-palette-host' });
  let signature = '';

  function build(/** @type {PaletteItem[]} */ items) {
    const listId = UI.fieldId('dsh-cmd-list');
    return el(
      'dialog',
      {
        class: 'cv-cmd',
        id: PALETTE_ID,
        'data-cv-shortcut': 'mod+k',
        'aria-label': t('palette.label'),
      },
      el(
        'div',
        { class: 'cv-combobox', 'data-cv-inline': '' },
        el(
          'div',
          { class: 'cv-cmd__search' },
          icon('magnifying-glass', { className: 'cv-icon' }),
          el('input', {
            class: 'cv-cmd__input',
            type: 'text',
            role: 'combobox',
            'aria-expanded': 'true',
            'aria-controls': listId,
            'aria-label': t('palette.inputLabel'),
            placeholder: t('palette.placeholder'),
            autocomplete: 'off',
          }),
          UI.Kbd(t('palette.esc')),
        ),
        el(
          'ul',
          { class: 'cv-listbox', id: listId, role: 'listbox', 'aria-label': t('palette.commands') },
          items.map((item) =>
            el(
              'li',
              { class: 'cv-option', role: 'option', 'data-value': item.value },
              icon(item.icon, { className: 'cv-icon' }),
              item.label,
              item.meta ? el('span', { class: 'cv-sr-only' }, ` ${item.meta}`) : null,
            ),
          ),
        ),
        // Outside the listbox: a list box that holds a message and no option is not valid.
        el(
          'p',
          { class: 'cv-listbox__empty', hidden: true, role: 'status' },
          t('palette.noResults'),
        ),
      ),
    );
  }

  function refresh() {
    const existing = host.querySelector('dialog');
    if (existing instanceof HTMLDialogElement && existing.open) return;
    const items = getItems();
    const next = JSON.stringify(items);
    if (next === signature && existing) return;
    signature = next;
    host.replaceChildren(build(items));
    UI.initCovenant(host);
    wireEmptyState(host);
  }

  /**
   * Covenant filters the options as the text changes but writes "no match" into an element it finds
   * inside the list; here the message sits outside the list box, so this shows it and hides the
   * empty list.
   * @param {HTMLElement} root
   */
  function wireEmptyState(root) {
    const dialog = root.querySelector('dialog');
    const input = root.querySelector('.cv-cmd__input');
    const list = root.querySelector('[role="listbox"]');
    const empty = root.querySelector('.cv-listbox__empty');
    if (!dialog || !input || !(list instanceof HTMLElement) || !(empty instanceof HTMLElement))
      return;
    const sync = () =>
      setTimeout(() => {
        const none = list.querySelector('[role="option"]:not([hidden])') === null;
        list.hidden = none;
        empty.hidden = !none;
      }, 0);
    input.addEventListener('input', sync);
    dialog.addEventListener('close', sync);
  }

  host.addEventListener('cv:command', (event) => {
    const { value } = /** @type {CustomEvent<{ value: string }>} */ (event).detail;
    if (value) onCommand(value);
  });

  refresh();
  return { el: host, refresh };
}

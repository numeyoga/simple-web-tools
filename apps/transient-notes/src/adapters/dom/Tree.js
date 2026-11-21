// The PARA tree of the sidebar: "All notes", then each of the four categories as a disclosure
// that holds its folders. A category has an "add a note" button, a folder has a menu (rename,
// move to another category, delete). Choosing a row filters the notes list. The tree is drawn
// again when what it shows changes (folders, counts, selection, open categories), not on every
// edit of a note.
import { PARA_CATEGORIES } from '../../core/model.js';
import { selectFolders, selectNoteCounts } from '../../core/selectors.js';
import { createNoteCommand } from '../commands.js';
import { categoryLabel } from '../labels.js';
import {
  confirmDeleteFolder,
  openMoveFolder,
  openNewFolder,
  openRenameFolder,
} from './FolderDialogs.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/** Phosphor icon of each PARA category. @type {Record<import('../../types.d.ts').ParaCategory, { icon: string }>} */
const CATEGORY_ICONS = {
  projects: { icon: 'target' },
  areas: { icon: 'house-line' },
  resources: { icon: 'books' },
  archives: { icon: 'archive' },
};

/**
 * @param {import('./types.js').Store} store
 * @param {{ toasts: import('./types.js').ToastHost, onNavigate: () => void }} options
 *   `onNavigate` runs when a row is chosen (the narrow layout closes its drawer)
 * @returns {import('./types.js').View}
 */
export function createTree(store, { toasts, onNavigate }) {
  const root = el('div', { class: 'tn-tree' });
  const collator = new Intl.Collator(UI.locale, { numeric: true, sensitivity: 'base' });
  /** Categories the user folded. @type {Set<string>} */
  const collapsed = new Set();
  let lastKey = '';

  /** @param {import('../../types.d.ts').Selection} selection */
  function choose(selection) {
    store.dispatch({ type: 'select', selection });
    onNavigate();
  }

  /** @param {import('../../types.d.ts').ParaCategory} category @param {number} count @param {boolean} current @param {boolean} hasFolders */
  function categoryRow(category, count, current, hasFolders) {
    const name = categoryLabel(category);
    const open = !collapsed.has(category);
    const foldersId = UI.fieldId('tn-tree-folders');
    const toggle = el(
      'button',
      {
        type: 'button',
        class: 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm tn-tree-toggle',
        'aria-expanded': String(open),
        'aria-controls': hasFolders ? foldersId : null,
        'aria-label': open ? t('tree.collapse', { name }) : t('tree.expand', { name }),
        'data-focus-key': `toggle-${category}`,
        onclick: () => {
          if (open) collapsed.add(category);
          else collapsed.delete(category);
          paint(true);
        },
      },
      icon(open ? 'caret-down' : 'caret-right'),
    );
    const link = el(
      'button',
      {
        type: 'button',
        class: 'cv-nav-item tn-nav-btn tn-tree-link',
        'aria-current': current ? 'page' : null,
        'data-focus-key': `category-${category}`,
        onclick: () => choose({ kind: 'category', category }),
      },
      icon(CATEGORY_ICONS[category].icon),
      el('span', { class: 'tn-grow tn-ellipsis' }, name),
      el('span', { class: 'tn-nav-count cv-num' }, String(count)),
    );
    const add = UI.IconButton({
      icon: 'plus',
      label: t('tree.newNoteIn', { name }),
      size: 'sm',
      mutates: true,
      onclick: () => {
        store.dispatch(createNoteCommand(store.getState(), category));
        onNavigate();
      },
    });
    add.button.dataset.focusKey = `add-${category}`;
    return { row: el('div', { class: 'tn-tree-row' }, toggle, link, add), foldersId, open };
  }

  /** @param {import('../../types.d.ts').Folder} folder @param {number} count @param {boolean} current */
  function folderRow(folder, count, current) {
    const link = el(
      'button',
      {
        type: 'button',
        class: 'cv-nav-item tn-nav-btn tn-tree-link',
        'aria-current': current ? 'page' : null,
        'data-focus-key': `folder-${folder.id}`,
        onclick: () => choose({ kind: 'folder', folderId: folder.id }),
      },
      icon('folder'),
      el('span', { class: 'tn-grow tn-ellipsis' }, folder.name),
      el('span', { class: 'tn-nav-count cv-num' }, String(count)),
    );
    const menu = UI.Menu({
      icon: 'dots-three',
      label: t('tree.folderActions', { name: folder.name }),
      size: 'sm',
      items: [
        {
          label: t('tree.renameFolder'),
          icon: 'pencil-simple',
          mutates: true,
          onclick: () => openRenameFolder(store, folder),
        },
        {
          label: t('tree.moveFolder'),
          icon: 'arrows-left-right',
          mutates: true,
          onclick: () => openMoveFolder(store, folder),
        },
        { separator: true },
        {
          label: t('tree.deleteFolder'),
          icon: 'trash',
          danger: true,
          mutates: true,
          onclick: () => void confirmDeleteFolder(store, toasts, folder),
        },
      ],
    });
    menu.button.dataset.focusKey = `menu-${folder.id}`;
    return el('div', { class: 'tn-tree-row tn-tree-row--folder' }, link, menu);
  }

  /** @param {boolean} [force] */
  function paint(force = false) {
    // A menu is wired to its button while both are in the document: nothing is drawn before.
    if (!root.isConnected) return;
    const state = store.getState();
    const counts = selectNoteCounts(state);
    const folders = selectFolders(state, null, collator.compare);
    // What the tree shows, as a string: nothing is redrawn while a note is being typed.
    const key = JSON.stringify([
      folders.map((f) => [f.id, f.name, f.category]),
      counts,
      state.selection,
      [...collapsed],
      state.readOnly,
    ]);
    if (!force && key === lastKey) return;
    lastKey = key;

    const active = document.activeElement;
    const focusKey =
      active instanceof HTMLElement && root.contains(active) ? active.dataset.focusKey : null;

    const { selection } = state;
    const items = [
      el(
        'li',
        null,
        el(
          'button',
          {
            type: 'button',
            class: 'cv-nav-item tn-nav-btn tn-tree-link tn-tree-all',
            'aria-current': selection.kind === 'all' ? 'page' : null,
            'data-focus-key': 'all',
            onclick: () => choose({ kind: 'all' }),
          },
          icon('notebook'),
          el('span', { class: 'tn-grow tn-ellipsis' }, t('nav.allNotes')),
          el('span', { class: 'tn-nav-count cv-num' }, String(counts.all)),
        ),
      ),
    ];
    for (const category of PARA_CATEGORIES) {
      const current = selection.kind === 'category' && selection.category === category;
      const folderItems = folders
        .filter((f) => f.category === category)
        .map((folder) =>
          el(
            'li',
            null,
            folderRow(
              folder,
              counts.byFolder[folder.id] ?? 0,
              selection.kind === 'folder' && selection.folderId === folder.id,
            ),
          ),
        );
      const { row, foldersId, open } = categoryRow(
        category,
        counts.byCategory[category],
        current,
        folderItems.length > 0,
      );
      items.push(
        el(
          'li',
          null,
          row,
          folderItems.length > 0
            ? el('ul', { id: foldersId, class: 'tn-tree-folders', hidden: !open }, folderItems)
            : null,
        ),
      );
    }

    const newFolder = UI.Button({
      size: 'sm',
      icon: 'folder-plus',
      children: t('tree.newFolder'),
      mutates: true,
      className: 'tn-tree-new-folder',
      onclick: () => {
        const current =
          selection.kind === 'category'
            ? selection.category
            : selection.kind === 'folder'
              ? (state.folders.find((f) => f.id === selection.folderId)?.category ?? 'projects')
              : 'projects';
        onNavigate();
        openNewFolder(store, current);
      },
    });
    newFolder.dataset.focusKey = 'new-folder';

    root.replaceChildren(el('ul', null, items), newFolder);
    UI.initCovenant(root);
    if (focusKey) {
      /** @type {HTMLElement | null} */ (
        root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)
      )?.focus({ preventScroll: true });
    }
  }

  const unsubscribe = store.subscribe(() => paint());
  return { el: root, destroy: unsubscribe, mounted: () => paint(true) };
}

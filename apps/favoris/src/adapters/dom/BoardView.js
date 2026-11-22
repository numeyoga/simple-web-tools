// The main region: the toolbar (search, edit mode, more actions) and the board of group cards.
// Every card is a group with its links. In edit mode the cards and the links have a drag handle
// and drop targets (the mouse path) and a menu with "move up", "move down" and "move to a group"
// (the keyboard and screen reader path): drag and drop is never the only way to reorder.
// The board is drawn again when what it shows changes; the control that had the focus gets it
// back (`data-focus-key`), so a keyboard user is not sent back to the top by a change.
import { orderedGroups } from '../../core/model.js';
import { canShiftGroup, canShiftLink, countByGroup, selectBoard } from '../../core/selectors.js';
import { safeHref } from '../../core/url.js';
import { SITE_ICONS_EVENT, getSiteIcons } from '../preferences.js';
import { confirmDeleteGroup, openEditGroup, openNewGroup } from './GroupDialogs.js';
import { confirmDeleteLink, openLinkForm, openMoveLink } from './LinkDialogs.js';
import { createSiteIcon } from './SiteIcon.js';
import { createDataActions } from './DataActions.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/** Classes that mark the drop target under a drag. */
const DROP_CLASSES = ['fv-drop-before', 'fv-drop-after', 'fv-drop-into', 'fv-drop-target'];

/**
 * @param {import('./types.js').Store} store
 * @param {{ toasts: import('./types.js').ToastHost }} options
 * @returns {import('./types.js').View & { focusSearch: () => void, openNewLink: () => void, scrollToGroup: (id: string | null) => void }}
 */
export function createBoardView(store, { toasts }) {
  const root = el('div', { class: 'fv-view' });
  const board = el('div', { class: 'fv-board', tabindex: -1 });

  /** What is being dragged: a link or a group. @type {{ kind: 'link' | 'group', id: string } | null} */
  let drag = null;

  /* ---------------- toolbar ---------------- */

  const search = UI.Input({
    ariaLabel: t('board.searchLabel'),
    placeholder: t('board.searchPlaceholder'),
    type: 'search',
    icon: 'magnifying-glass',
    className: 'fv-grow',
    oninput: (e) =>
      store.dispatch({
        type: 'set_search',
        query: /** @type {HTMLInputElement} */ (e.target).value,
      }),
  });
  search.input.setAttribute('autocomplete', 'off');
  search.input.setAttribute('autocapitalize', 'off');
  search.input.spellcheck = false;

  const editButton = UI.Button({
    icon: 'pencil-simple',
    children: t('board.edit'),
    onclick: () => store.dispatch({ type: 'set_edit_mode', editMode: !store.getState().editMode }),
  });
  editButton.dataset.focusKey = 'edit-mode';

  const count = el('span', { class: 'fv-meta', role: 'status' });
  const data = createDataActions(store, toasts, { onNewGroup: () => openNewGroup(store) });
  data.menu.button.dataset.focusKey = 'more';

  const toolbar = el(
    'div',
    { class: 'fv-toolbar' },
    search,
    editButton,
    data.menu,
    data.fileInput,
    count,
  );

  /* ---------------- helpers ---------------- */

  /** @param {HTMLElement} node @param {string} key */
  function withFocusKey(node, key) {
    node.dataset.focusKey = key;
    return node;
  }

  /** @param {import('./types.js').IconButtonElement} wrap @param {string} key */
  function withIconFocusKey(wrap, key) {
    wrap.button.dataset.focusKey = key;
    return wrap;
  }

  function clearDropMarks() {
    for (const node of board.querySelectorAll(DROP_CLASSES.map((c) => `.${c}`).join(', '))) {
      node.classList.remove(...DROP_CLASSES);
    }
  }

  /** The mouse path starts from the handle only, so that selecting text never drags a row. @param {HTMLElement} node @param {HTMLElement} handle */
  function armOnHandle(node, handle) {
    const arm = () => {
      node.draggable = !store.getState().readOnly;
    };
    const disarm = () => {
      node.draggable = false;
    };
    handle.addEventListener('mousedown', arm);
    handle.addEventListener('touchstart', arm, { passive: true });
    handle.addEventListener('mouseup', disarm);
    handle.addEventListener('touchend', disarm);
    node.addEventListener('dragend', disarm);
  }

  /** @param {DragEvent} e @param {HTMLElement} node */
  function isAfter(e, node) {
    const rect = node.getBoundingClientRect();
    return e.clientY > rect.top + rect.height / 2;
  }

  /* ---------------- a link ---------------- */

  /**
   * @param {import('../../types.d.ts').Link} link
   * @param {boolean} editMode
   * @param {boolean} remoteIcons
   */
  function linkRow(link, editMode, remoteIcons) {
    const href = safeHref(link.url);
    const name = href
      ? el(
          'a',
          {
            class: 'fv-link__name',
            href,
            target: '_blank',
            rel: 'noopener noreferrer',
            'data-cv-tooltip': link.url,
            draggable: 'false',
          },
          link.name,
          el('span', { class: 'cv-sr-only' }, ' ', t('links.newTab')),
        )
      : el('span', { class: 'fv-link__name' }, link.name);
    withFocusKey(name, `link:${link.id}`);

    const li = el('li', { class: 'fv-link', 'data-link-id': link.id });
    if (editMode) {
      const grip = el(
        'span',
        { class: 'fv-grip', 'aria-hidden': 'true' },
        icon('dots-six-vertical'),
      );
      li.append(grip);
      armOnHandle(li, grip);
    }
    li.append(
      createSiteIcon(link, { remote: remoteIcons }),
      name,
      el(
        'span',
        { class: 'fv-link__actions' },
        withIconFocusKey(
          UI.IconButton({
            icon: 'copy',
            label: t('links.copy', { name: link.name }),
            size: 'sm',
            onclick: () => copyUrl(link),
          }),
          `copy:${link.id}`,
        ),
        withIconFocusKey(
          UI.IconButton({
            icon: 'pencil-simple',
            label: t('links.edit', { name: link.name }),
            size: 'sm',
            mutates: true,
            onclick: () => openLinkForm(store, toasts, { link }),
          }),
          `edit:${link.id}`,
        ),
        editMode ? linkMenu(link) : null,
        editMode
          ? withIconFocusKey(
              UI.IconButton({
                icon: 'trash',
                label: t('links.delete', { name: link.name }),
                size: 'sm',
                mutates: true,
                onclick: () => void confirmDeleteLink(store, toasts, link),
              }),
              `delete:${link.id}`,
            )
          : null,
      ),
    );
    if (editMode) wireLinkDrag(li, link);
    return li;
  }

  /** The keyboard and screen reader path of a link: up, down, to a group. @param {import('../../types.d.ts').Link} link */
  function linkMenu(link) {
    const state = store.getState();
    const items = /** @type {import('./types.js').MenuItem[]} */ ([]);
    if (canShiftLink(state, link.id, -1)) {
      items.push({
        label: t('links.moveUp'),
        icon: 'arrow-up',
        mutates: true,
        onclick: () => store.dispatch({ type: 'shift_link', id: link.id, delta: -1 }),
      });
    }
    if (canShiftLink(state, link.id, 1)) {
      items.push({
        label: t('links.moveDown'),
        icon: 'arrow-down',
        mutates: true,
        onclick: () => store.dispatch({ type: 'shift_link', id: link.id, delta: 1 }),
      });
    }
    items.push({
      label: t('links.moveToGroup'),
      icon: 'folder-simple',
      mutates: true,
      onclick: () => openMoveLink(store, toasts, link),
    });
    const menu = UI.Menu({
      icon: 'arrows-down-up',
      label: t('links.moveMenu', { name: link.name }),
      menuLabel: t('links.moveMenu', { name: link.name }),
      size: 'sm',
      items,
    });
    menu.button.dataset.focusKey = `move:${link.id}`;
    return menu;
  }

  /** @param {import('../../types.d.ts').Link} link */
  function copyUrl(link) {
    const done = () =>
      toasts.push({ variant: 'success', title: t('links.copied'), body: link.name });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(link.url)
        .then(done, () => toasts.push({ variant: 'danger', title: t('links.copyFailed') }));
    } else {
      toasts.push({ variant: 'danger', title: t('links.copyFailed') });
    }
  }

  /** @param {HTMLElement} li @param {import('../../types.d.ts').Link} link */
  function wireLinkDrag(li, link) {
    li.addEventListener('dragstart', (e) => {
      if (!li.draggable) {
        e.preventDefault();
        return;
      }
      e.stopPropagation();
      drag = { kind: 'link', id: link.id };
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `link:${link.id}`);
      }
      setTimeout(() => li.classList.add('fv-dragging'), 0);
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('fv-dragging');
      clearDropMarks();
      drag = null;
    });
    li.addEventListener('dragover', (e) => {
      if (drag?.kind !== 'link' || drag.id === link.id) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const after = isAfter(e, li);
      li.classList.toggle('fv-drop-after', after);
      li.classList.toggle('fv-drop-before', !after);
    });
    li.addEventListener('dragleave', () => li.classList.remove('fv-drop-before', 'fv-drop-after'));
    li.addEventListener('drop', (e) => {
      if (drag?.kind !== 'link') return;
      e.preventDefault();
      e.stopPropagation();
      const place = isAfter(e, li) ? 'after' : 'before';
      const id = drag.id;
      clearDropMarks();
      drag = null;
      store.dispatch({ type: 'move_link', id, groupId: link.groupId, targetId: link.id, place });
    });
  }

  /* ---------------- a group card ---------------- */

  /**
   * @param {import('../../core/selectors.js').Section} section
   * @param {{ editMode: boolean, remoteIcons: boolean, total: number }} context
   */
  function groupCard({ group, links }, { editMode, remoteIcons, total }) {
    const state = store.getState();
    const groupId = group?.id ?? null;
    const label = group?.label ?? t('groups.ungrouped');
    const titleId = UI.fieldId('fv-group-title');
    const listId = UI.fieldId('fv-group-links');
    const collapsed = group?.collapsed === true;

    const card = el('section', {
      class: 'fv-card cv-cat-stripe',
      'data-cat': String(group?.category ?? 16),
      'data-group-id': groupId ?? '',
      'aria-labelledby': titleId,
    });

    /** The name of the group, with its colour dot: never the colour alone. */
    const name = el(
      'span',
      { class: 'cv-cat-name' },
      el('span', { class: 'cv-cat-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'fv-ellipsis' }, label),
    );
    /** The title of a group is the button that folds it (a disclosure inside the heading). */
    const fold = group
      ? withFocusKey(
          el(
            'button',
            {
              type: 'button',
              class: 'fv-fold',
              'aria-expanded': String(!collapsed),
              'aria-controls': listId,
              // Folding is a stored choice: it needs the write lock like any other change.
              'data-mutates': '',
              onclick: () =>
                store.dispatch({ type: 'update_group', id: group.id, collapsed: !collapsed }),
            },
            icon('caret-down', { className: 'fv-fold__caret' }),
            name,
            group.featured
              ? el(
                  'span',
                  { class: 'fv-star' },
                  icon('star', { weight: 'bold' }),
                  el('span', { class: 'cv-sr-only' }, t('groups.featuredMark')),
                )
              : null,
          ),
          `fold:${group.id}`,
        )
      : null;
    const title = el('h2', { class: 'fv-card__title', id: titleId }, fold ?? name);

    const head = el('header', { class: 'fv-card__head' });
    if (group && editMode) {
      const grip = el(
        'span',
        { class: 'fv-grip', 'aria-hidden': 'true' },
        icon('dots-six-vertical'),
      );
      head.append(grip);
      armOnHandle(card, grip);
    }
    head.append(
      title,
      UI.Tag(String(links.length), { mono: true }),
      el(
        'span',
        { class: 'fv-card__actions' },
        group ? starButton(group) : null,
        withIconFocusKey(
          UI.IconButton({
            icon: 'plus',
            label: group
              ? t('groups.addLink', { name: group.label })
              : t('groups.addLinkUngrouped'),
            size: 'sm',
            mutates: true,
            onclick: () => openLinkForm(store, toasts, { groupId }),
          }),
          `add:${groupId ?? ''}`,
        ),
        group && editMode ? groupMenu(group, state) : null,
      ),
    );
    card.append(head);

    const list = el('ul', { class: 'fv-links', id: listId, hidden: collapsed });
    if (links.length === 0) {
      list.append(
        el(
          'li',
          { class: 'fv-links__empty fv-meta' },
          total === 0 ? t('groups.empty') : t('groups.noMatch'),
        ),
      );
    } else {
      for (const link of links) list.append(linkRow(link, editMode, remoteIcons));
    }
    card.append(list);

    wireCardDrop(card, group, list);
    return card;
  }

  /** @param {import('../../types.d.ts').Group} group */
  function starButton(group) {
    const wrap = withIconFocusKey(
      UI.IconButton({
        icon: 'star',
        weight: group.featured ? 'bold' : 'regular',
        label: t('groups.feature', { name: group.label }),
        size: 'sm',
        mutates: true,
        onclick: () =>
          store.dispatch({ type: 'update_group', id: group.id, featured: !group.featured }),
      }),
      `star:${group.id}`,
    );
    wrap.button.setAttribute('aria-pressed', String(group.featured));
    return wrap;
  }

  /** @param {import('../../types.d.ts').Group} group @param {import('../../types.d.ts').AppState} state */
  function groupMenu(group, state) {
    const items = /** @type {import('./types.js').MenuItem[]} */ ([
      {
        label: t('groups.edit'),
        icon: 'pencil-simple',
        mutates: true,
        onclick: () => openEditGroup(store, group),
      },
    ]);
    if (canShiftGroup(state, group.id, -1)) {
      items.push({
        label: t('groups.moveUp'),
        icon: 'arrow-up',
        mutates: true,
        onclick: () => store.dispatch({ type: 'shift_group', id: group.id, delta: -1 }),
      });
    }
    if (canShiftGroup(state, group.id, 1)) {
      items.push({
        label: t('groups.moveDown'),
        icon: 'arrow-down',
        mutates: true,
        onclick: () => store.dispatch({ type: 'shift_group', id: group.id, delta: 1 }),
      });
    }
    items.push(
      { separator: true },
      {
        label: t('common.delete'),
        icon: 'trash',
        danger: true,
        mutates: true,
        onclick: () => void confirmDeleteGroup(store, toasts, group),
      },
    );
    const menu = UI.Menu({
      icon: 'dots-three-vertical',
      label: t('groups.menu', { name: group.label }),
      menuLabel: t('groups.menu', { name: group.label }),
      size: 'sm',
      items,
    });
    menu.button.dataset.focusKey = `gmenu:${group.id}`;
    return menu;
  }

  /**
   * Drop targets of a card: another group (reorders the groups) and a link (moves it to the end
   * of this group).
   * @param {HTMLElement} card
   * @param {import('../../types.d.ts').Group | null} group
   * @param {HTMLElement} list
   */
  function wireCardDrop(card, group, list) {
    if (!store.getState().editMode) return;
    if (group) {
      card.addEventListener('dragstart', (e) => {
        if (!card.draggable) {
          e.preventDefault();
          return;
        }
        drag = { kind: 'group', id: group.id };
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `group:${group.id}`);
        }
        setTimeout(() => card.classList.add('fv-dragging'), 0);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('fv-dragging');
        clearDropMarks();
        drag = null;
      });
    }
    card.addEventListener('dragover', (e) => {
      if (!drag) return;
      if (drag.kind === 'group') {
        if (!group || drag.id === group.id) return;
        e.preventDefault();
        card.classList.add('fv-drop-target');
      } else {
        e.preventDefault();
        list.classList.add('fv-drop-into');
      }
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('dragleave', (e) => {
      if (!(e.relatedTarget instanceof Node && card.contains(e.relatedTarget))) {
        card.classList.remove('fv-drop-target');
        list.classList.remove('fv-drop-into');
      }
    });
    card.addEventListener('drop', (e) => {
      if (!drag) return;
      e.preventDefault();
      const { kind, id } = drag;
      clearDropMarks();
      drag = null;
      if (kind === 'link') {
        store.dispatch({ type: 'move_link', id, groupId: group?.id ?? null });
      } else if (group) {
        // Dragged from before the target: it lands just after it, as in a list.
        const shown = orderedGroups(store.getState().groups).map((g) => g.id);
        const place = shown.indexOf(id) < shown.indexOf(group.id) ? 'after' : 'before';
        store.dispatch({ type: 'move_group', id, targetId: group.id, place });
      }
    });
  }

  /* ---------------- drawing ---------------- */

  /**
   * The key of the control that has the focus inside the board. An item of a menu stands for the
   * button that opened the menu: choosing "move up" draws the board again, and the focus goes
   * back to the menu button of the same link.
   * @returns {string | null}
   */
  function currentFocusKey() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !board.contains(active)) return null;
    const menu = active.closest('.cv-menu');
    if (menu) {
      const opener = board.querySelector(`[popovertarget="${CSS.escape(menu.id)}"]`);
      return opener instanceof HTMLElement ? (opener.dataset.focusKey ?? null) : null;
    }
    return active.dataset.focusKey ?? null;
  }

  function renderBoard() {
    const state = store.getState();
    const focusKey = currentFocusKey();

    const { sections, matching, searching } = selectBoard(state);
    const total = state.links.length;
    window.Covenant?.hideTooltips?.();

    if (state.groups.length === 0 && total === 0) {
      board.replaceChildren(
        UI.EmptyState({
          icon: 'bookmarks-simple',
          title: t('board.emptyTitle'),
          text: t('board.emptyText'),
          actions: el(
            'div',
            { class: 'fv-row fv-wrap fv-gap-3 fv-center-x' },
            UI.Button({
              variant: 'primary',
              icon: 'plus',
              children: t('board.addLink'),
              mutates: true,
              onclick: () => openLinkForm(store, toasts),
            }),
            UI.Button({
              icon: 'folder-simple-plus',
              children: t('board.newGroup'),
              mutates: true,
              onclick: () => openNewGroup(store),
            }),
          ),
        }),
      );
    } else if (searching && sections.length === 0) {
      board.replaceChildren(
        UI.EmptyState({
          icon: 'magnifying-glass',
          title: t('board.noResultsTitle'),
          text: t('board.noResultsText', { query: state.search.trim() }),
        }),
      );
    } else {
      const remoteIcons = getSiteIcons();
      const counts = countByGroup(state);
      board.replaceChildren(
        el(
          'div',
          { class: 'fv-grid' },
          sections.map((section) =>
            groupCard(section, {
              editMode: state.editMode,
              remoteIcons,
              total: counts.get(section.group?.id ?? null) ?? 0,
            }),
          ),
        ),
      );
    }
    UI.initCovenant(board);

    count.textContent = searching
      ? t('board.found', { count: matching })
      : t('board.count', { count: total });

    if (focusKey) {
      const next = board.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (next instanceof HTMLElement) next.focus({ preventScroll: true });
      else board.focus({ preventScroll: true });
    }
  }

  function paintToolbar() {
    const { editMode } = store.getState();
    editButton.setAttribute('aria-pressed', String(editMode));
    editButton.classList.toggle('cv-btn--primary', editMode);
    root.dataset.edit = editMode ? 'true' : 'false';
  }

  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (state.editMode !== prevState.editMode) paintToolbar();
    if (
      state.groups !== prevState.groups ||
      state.links !== prevState.links ||
      state.search !== prevState.search ||
      state.editMode !== prevState.editMode
    ) {
      renderBoard();
    }
  });
  document.addEventListener(SITE_ICONS_EVENT, renderBoard);

  root.append(toolbar, board);
  paintToolbar();
  renderBoard();

  return {
    el: root,
    mounted: () => UI.initCovenant(root),
    focusSearch() {
      search.input.focus();
      search.input.select();
    },
    openNewLink() {
      openLinkForm(store, toasts);
    },
    /** @param {string | null} id */
    scrollToGroup(id) {
      const card = board.querySelector(`[data-group-id="${CSS.escape(id ?? '')}"]`);
      if (!(card instanceof HTMLElement)) return;
      card.scrollIntoView({ block: 'start' });
      const target = card.querySelector('h2 button') ?? card.querySelector('h2');
      if (target instanceof HTMLElement) {
        if (!target.matches('button')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    },
    destroy() {
      unsubscribe();
      document.removeEventListener(SITE_ICONS_EVENT, renderBoard);
    },
  };
}

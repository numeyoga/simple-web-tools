// The groups of the sidebar: a list of buttons, one per card of the board (in the order they are
// shown), with the number of links. Choosing one scrolls to its card and puts the focus on the
// card's title. Drawn again when the groups, the links or the search change.
import { selectBoard } from '../../core/selectors.js';
import * as UI from './ui.js';

const { el, t } = UI;

/**
 * @param {import('./types.js').Store} store
 * @param {{ onChoose: (groupId: string | null) => void }} options
 * @returns {import('./types.js').View}
 */
export function createGroupNav(store, { onChoose }) {
  const root = el('div', { class: 'fv-group-nav' });

  function draw() {
    const { sections } = selectBoard(store.getState());
    if (sections.length === 0) {
      root.replaceChildren();
      return;
    }
    const headingId = UI.fieldId('fv-group-nav');
    root.replaceChildren(
      el('div', { class: 'cv-overline cv-sidebar__group', id: headingId }, t('nav.groups')),
      el(
        'ul',
        { 'aria-labelledby': headingId },
        sections.map(({ group, links }) =>
          el(
            'li',
            { 'data-cat': String(group?.category ?? 16) },
            el(
              'button',
              {
                type: 'button',
                class: 'cv-nav-item fv-nav-btn',
                onclick: () => onChoose(group?.id ?? null),
              },
              el(
                'span',
                { class: 'cv-cat-name fv-grow' },
                el('span', { class: 'cv-cat-dot', 'aria-hidden': 'true' }),
                el('span', { class: 'fv-ellipsis' }, group?.label ?? t('groups.ungrouped')),
              ),
              el('span', { class: 'fv-nav-count cv-num' }, String(links.length)),
            ),
          ),
        ),
      ),
    );
  }

  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (
      state.groups !== prevState.groups ||
      state.links !== prevState.links ||
      state.search !== prevState.search
    ) {
      draw();
    }
  });
  draw();
  return { el: root, destroy: unsubscribe };
}

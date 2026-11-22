// The tags screen: the tags the links are grouped by (a key, a label and a Phosphor icon). The
// key is what a link refers to; renaming it carries the links along. Deleting a tag keeps its
// links, shown under "unknown tag".
import { TAG_ICONS } from '../../core/model.js';
import { card, commitInput, commitSelect, dataTable, focusKey } from './parts.js';
import { createRedraw } from './redraw.js';
import * as UI from './ui.js';

const { el, icon, t } = UI;

/**
 * @param {import('./types.js').Context} ctx
 * @returns {import('./types.js').View}
 */
export function createTagsView(ctx) {
  const { store, toasts } = ctx;
  const root = el('div', { class: 'dsh-view' });

  /** How many links (of templates and of applications) carry a tag. @param {string} key */
  function usage(key) {
    const { templates, apps } = store.getState();
    return (
      templates.reduce((sum, tpl) => sum + tpl.links.filter((l) => l.tag === key).length, 0) +
      apps.reduce((sum, app) => sum + app.extras.filter((x) => x.tag === key).length, 0)
    );
  }

  function build() {
    const { settings } = store.getState();
    const rows = settings.tags.map((tag, index) => {
      const n = index + 1;
      const icons = TAG_ICONS.includes(tag.icon) ? TAG_ICONS : [tag.icon, ...TAG_ICONS];
      return [
        el(
          'span',
          { class: 'dsh-row dsh-gap-1' },
          UI.IconButton({
            icon: 'caret-up',
            label: t('common.moveUp', { name: tag.label }),
            size: 'sm',
            disabled: index === 0,
            mutates: true,
            onclick: () => store.dispatch({ type: 'shift_tag', key: tag.key, delta: -1 }),
          }),
          UI.IconButton({
            icon: 'caret-down',
            label: t('common.moveDown', { name: tag.label }),
            size: 'sm',
            disabled: index === settings.tags.length - 1,
            mutates: true,
            onclick: () => store.dispatch({ type: 'shift_tag', key: tag.key, delta: 1 }),
          }),
        ),
        commitInput({
          label: t('tags.keyField', { n }),
          value: tag.key,
          mono: true,
          focusKey: focusKey('tag', index, 'key'),
          onCommit: (value, field) => {
            const result = store.dispatch({ type: 'rename_tag', key: tag.key, newKey: value });
            if (result.effects.length === 0) {
              field.setError(
                value.trim() === tag.key || value.trim() === '' ? null : t('tags.keyTaken'),
              );
              field.input.value = tag.key;
            }
          },
        }),
        commitInput({
          label: t('tags.labelField', { n }),
          value: tag.label,
          focusKey: focusKey('tag', index, 'label'),
          onCommit: (value, field) => {
            if (value.trim() === '') field.input.value = tag.label;
            else store.dispatch({ type: 'update_tag', key: tag.key, label: value });
          },
        }),
        commitSelect({
          label: t('tags.iconField', { n }),
          value: tag.icon,
          options: icons.map((name) => ({ value: name, label: name })),
          focusKey: focusKey('tag', index, 'icon'),
          onCommit: (value) => store.dispatch({ type: 'update_tag', key: tag.key, icon: value }),
        }),
        el(
          'span',
          { class: 'dsh-row dsh-center dsh-gap-2' },
          icon(tag.icon, { weight: 'bold' }),
          tag.label,
        ),
        UI.IconButton({
          icon: 'trash',
          label: t('tags.delete', { name: tag.label }),
          size: 'sm',
          mutates: true,
          onclick: async () => {
            const used = usage(tag.key);
            const ok = await UI.Confirm({
              title: t('tags.deleteTitle'),
              message: t('tags.deleteMessage', { name: tag.label, count: used }),
              confirmLabel: t('common.delete'),
              danger: true,
            });
            if (!ok) return;
            store.dispatch({ type: 'delete_tag', key: tag.key });
            toasts.push({ variant: 'info', title: t('tags.deleted'), body: tag.label });
          },
        }),
      ];
    });
    return card({
      title: t('tags.title'),
      subtitle: t('tags.subtitle'),
      actions: UI.Button({
        size: 'sm',
        icon: 'plus',
        children: t('tags.add'),
        mutates: true,
        onclick: () => {
          let n = 1;
          while (settings.tags.some((tag) => tag.key === `tag${n}`)) n += 1;
          store.dispatch({
            type: 'add_tag',
            key: `tag${n}`,
            label: t('tags.newLabel'),
            icon: 'tag',
          });
        },
      }),
      flush: true,
      body:
        settings.tags.length === 0
          ? el('p', { class: 'dsh-card__empty dsh-meta' }, t('tags.empty'))
          : dataTable({
              caption: t('tags.title'),
              columns: [
                t('common.order'),
                t('tags.colKey'),
                t('tags.colLabel'),
                t('tags.colIcon'),
                t('tags.colPreview'),
                t('common.actions'),
              ],
              rows,
            }),
    });
  }

  const redraw = createRedraw(root, build);
  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (state.settings !== prevState.settings) redraw.schedule();
  });
  redraw.draw();
  return { el: root, destroy: unsubscribe, title: () => t('admin.tags') };
}

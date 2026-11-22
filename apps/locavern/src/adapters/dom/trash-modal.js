/** @import { AppCommand, AppState, StoreEffect, TrashItem, TrashItemKind } from '../../types.d.ts' */

import { errorText } from '../../core/messages.js';
import { selectTrashItems } from '../../core/store.js';
import { closeDialogById, confirmAction, notify, openDialogById } from './app-shell.js';
import { i18n, t } from '../i18n.js';

/** @type {Readonly<Record<TrashItemKind, { label: string; icon: string }>>} */
const KIND_META = Object.freeze({
  project: { label: t('common.project'), icon: 'ph-folder-open' },
  task: { label: t('common.task'), icon: 'ph-check-square' },
  note: { label: t('common.note'), icon: 'ph-notebook' },
  whiteboard: { label: t('common.whiteboard'), icon: 'ph-chalkboard-simple' },
});

/**
 * Format an ISO timestamp as a short date in the language of the page.
 * @param {string} iso
 * @returns {string}
 */
function formatShortDate(iso) {
  try {
    return i18n.formatDateTime(Date.parse(iso), { dateStyle: 'medium' });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Format remaining retention label before automatic purge.
 * @param {string} expiresAtIso
 * @returns {string}
 */
function formatRemainingLabel(expiresAtIso) {
  const diffMs = Date.parse(expiresAtIso) - Date.now();
  if (Number.isNaN(diffMs)) return t('trash.purgeScheduled');
  if (diffMs <= 0) return t('trash.purgeImminent');
  const daysLeft = Math.ceil(diffMs / 86_400_000);
  return t('trash.purgeIn', { count: daysLeft });
}

/**
 * Update sidebar badge count for the local trash.
 * @param {AppState} state
 */
export function syncTrashBadge(state) {
  const badge = document.getElementById('nav-trash-count');
  if (!badge) return;
  const count = state.trash.length;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

/**
 * Describe secondary metadata for a TrashItem.
 * @param {TrashItem} item
 * @returns {string}
 */
function describeTrashItemMeta(item) {
  const parts = [
    t('trash.deletedOn', { date: formatShortDate(item.deletedAt) }),
    formatRemainingLabel(item.expiresAt),
  ];
  if (item.kind === 'project') {
    const taskCount = item.tasks?.length ?? 0;
    if (taskCount > 0) {
      parts.unshift(t('common.tasksCount', { count: taskCount }));
    }
  } else if (item.projectName) {
    parts.unshift(item.projectName);
  }
  return parts.join(' · ');
}

/**
 * Wire the local Trash modal (#modal-trash).
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *     subscribe: (
 *       listener: (info: {
 *         state: AppState;
 *         prevState: AppState;
 *         command: AppCommand;
 *         effects: StoreEffect[];
 *       }) => void,
 *     ) => () => void;
 *   };
 * }} opts
 */
export function wireTrashModal({ store }) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-trash'));
  const body = document.getElementById('modal-trash-body');
  if (!modal || !body) return;
  const trashModal = modal;
  const modalBody = body;

  function renderTrashBody() {
    const state = store.getState();
    const items = selectTrashItems(state);
    const retentionDays = state.preferences.trashRetentionDays;

    const headerRow = document.createElement('div');
    headerRow.className = 'lc-trash-toolbar';

    const retentionInfo = document.createElement('p');
    retentionInfo.className = 'cv-caption';
    retentionInfo.textContent = t('trash.retention', { count: retentionDays });

    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'lc-table-actions';

    const configBtn = document.createElement('button');
    configBtn.type = 'button';
    configBtn.id = 'btn-trash-config-retention';
    configBtn.className = 'cv-btn cv-btn--sm';
    configBtn.textContent = t('trash.configure');
    configBtn.addEventListener('click', () => {
      closeDialogById('modal-trash');
      openDialogById('modal-preferences');
      const prefInput = document.getElementById('pref-trash-retention');
      if (prefInput instanceof HTMLElement) prefInput.focus();
    });

    const emptyBtn = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.id = 'btn-empty-trash';
    emptyBtn.className = 'cv-btn cv-btn--danger cv-btn--sm';
    emptyBtn.disabled = state.readOnly || items.length === 0;
    emptyBtn.textContent = t('trash.empty');
    emptyBtn.addEventListener('click', async () => {
      closeDialogById('modal-trash');
      const confirmed = await confirmAction({
        title: t('trash.emptyTitle'),
        message: t('trash.emptyConfirm', { count: items.length }),
        confirmLabel: t('trash.empty'),
        danger: true,
      });
      if (!confirmed) return;
      store.dispatch({ type: 'empty_trash' });
      notify({
        status: 'info',
        title: t('trash.emptied'),
        text: t('trash.emptiedText'),
      });
    });

    toolbarActions.append(configBtn, emptyBtn);
    headerRow.append(retentionInfo, toolbarActions);

    if (items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'cv-empty';
      const emptyIcon = document.createElement('i');
      emptyIcon.className = 'ph ph-trash cv-icon';
      emptyIcon.setAttribute('aria-hidden', 'true');
      const emptyTitle = document.createElement('p');
      emptyTitle.className = 'cv-h4';
      // Inside `.cv-empty`, which gives its sentences a margin: the gap here is the flex gap.
      emptyTitle.style.margin = '0';
      emptyTitle.textContent = t('trash.isEmpty');
      const emptyDesc = document.createElement('p');
      emptyDesc.className = 'cv-caption';
      emptyDesc.style.margin = '0';
      emptyDesc.textContent = t('trash.isEmptyText');
      emptyState.append(emptyIcon, emptyTitle, emptyDesc);
      modalBody.replaceChildren(headerRow, emptyState);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'lc-trash-list';

    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'lc-trash-item';
      li.setAttribute('data-trash-id', item.id);

      const meta = KIND_META[item.kind];
      const infoCol = document.createElement('div');
      infoCol.className = 'lc-trash-item__info';

      const titleRow = document.createElement('div');
      titleRow.className = 'lc-trash-item__head';

      const kindBadge = document.createElement('span');
      kindBadge.className = 'cv-badge';
      const kindIcon = document.createElement('i');
      kindIcon.className = `ph ${meta.icon} cv-icon`;
      kindIcon.setAttribute('aria-hidden', 'true');
      kindBadge.append(kindIcon, document.createTextNode(` ${meta.label}`));

      const titleSpan = document.createElement('span');
      titleSpan.className = 'lc-trash-item__title';
      titleSpan.textContent = item.title;

      titleRow.append(kindBadge, titleSpan);

      const sub = document.createElement('span');
      sub.className = 'cv-caption';
      sub.textContent = describeTrashItemMeta(item);

      infoCol.append(titleRow, sub);

      const actionsCol = document.createElement('div');
      actionsCol.className = 'lc-table-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'cv-btn cv-btn--sm';
      restoreBtn.disabled = state.readOnly;
      restoreBtn.setAttribute('data-restore-trash-id', item.id);
      restoreBtn.setAttribute('aria-label', t('trash.restoreNamed', { title: item.title }));
      restoreBtn.textContent = t('trash.restore');
      restoreBtn.addEventListener('click', () => {
        try {
          store.dispatch({
            type: 'restore_trash_item',
            id: item.id,
            now: new Date().toISOString(),
          });
          notify({
            status: 'success',
            title: t('trash.restored'),
            text: t('trash.restoredText', { title: item.title }),
          });
          renderTrashBody();
        } catch (err) {
          notify({
            status: 'warning',
            title: t('trash.restoreImpossible'),
            text: errorText(err, t, 'trash.restoreFailed'),
          });
        }
      });

      const purgeBtn = document.createElement('button');
      purgeBtn.type = 'button';
      purgeBtn.className = 'cv-btn cv-btn--danger cv-btn--sm';
      purgeBtn.disabled = state.readOnly;
      purgeBtn.setAttribute('data-purge-trash-id', item.id);
      purgeBtn.setAttribute('aria-label', t('trash.purgeNamed', { title: item.title }));
      purgeBtn.textContent = t('trash.purge');
      purgeBtn.addEventListener('click', async () => {
        closeDialogById('modal-trash');
        const confirmed = await confirmAction({
          title: t('trash.purgeTitle'),
          message: t('trash.purgeConfirm', { title: item.title }),
          confirmLabel: t('trash.purgeLabel'),
          danger: true,
        });
        if (!confirmed) return;
        store.dispatch({ type: 'purge_trash_item', id: item.id });
        notify({
          status: 'info',
          title: t('trash.purged'),
          text: t('trash.purgedText', { title: item.title }),
        });
      });

      actionsCol.append(restoreBtn, purgeBtn);
      li.append(infoCol, actionsCol);
      list.append(li);
    }

    modalBody.replaceChildren(headerRow, list);
  }

  const observer = new MutationObserver(() => {
    if (trashModal.open) {
      renderTrashBody();
    }
  });
  observer.observe(trashModal, { attributes: true, attributeFilter: ['open'] });

  trashModal.addEventListener('close', () => {
    trashModal.returnValue = '';
    modalBody.replaceChildren();
  });

  syncTrashBadge(store.getState());
  store.subscribe(({ state }) => {
    syncTrashBadge(state);
    if (trashModal.open) {
      renderTrashBody();
    }
  });
}

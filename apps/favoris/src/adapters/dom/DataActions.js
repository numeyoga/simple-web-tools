// The actions on the data of the active workspace: a new group, the JSON backup (export and
// import, which also reads the file the previous version of the app exported) and "clear all".
// Importing and clearing replace what the workspace holds, so each asks first, in a Covenant modal
// and never with the browser's `confirm()`.
import { toLocalIsoDate } from '@simple-web-tools/dates';
import { backupFileName } from '../../core/backup.js';
import { importErrorMessage, readBackup, serializeBackup } from '../backup.js';
import { downloadText } from '../download.js';
import { activeWorkspace } from '../workspaces.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** @param {import('../../types.d.ts').Skipped} skipped */
function skippedCount({ groups, links, unsafeUrls }) {
  return groups + links + unsafeUrls;
}

/**
 * The "more actions" menu of the toolbar and the file input it opens.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @param {{ onNewGroup: () => void }} options
 */
export function createDataActions(store, toasts, { onNewGroup }) {
  /** @param {string} title @param {string} message @param {string} confirmLabel */
  const ask = (title, message, confirmLabel) =>
    UI.Confirm({ title, message, confirmLabel, danger: true });

  async function exportJson() {
    try {
      const envelope = await store.exportBackup();
      downloadText(
        backupFileName({ workspaceId: store.workspaceId, date: toLocalIsoDate(new Date()) }),
        serializeBackup(envelope),
        'application/json',
      );
      toasts.push({ variant: 'success', title: t('data.exported') });
    } catch (error) {
      toasts.push({
        variant: 'danger',
        title: t('data.exportFailed'),
        body: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function clearAll() {
    const workspace = activeWorkspace();
    const ok = await ask(
      t('data.clearTitle'),
      t('data.clearMessage', { name: workspace.label }),
      t('data.clearConfirm'),
    );
    if (!ok) return;
    if (await store.replaceAll({ groups: [], links: [] })) {
      toasts.push({ variant: 'info', title: t('data.cleared') });
    }
  }

  const fileInput = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    'aria-hidden': 'true',
    tabindex: -1,
    onchange: async (/** @type {import('./types.js').TargetEvent} */ e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        // Rejects a file that is not a backup before asking for the confirmation. The records
        // are validated one by one: the ones that cannot be used are skipped and counted.
        const { data, skipped, legacy } = readBackup(await file.text());
        const workspace = activeWorkspace();
        const ok = await ask(
          t('data.replaceTitle'),
          t('data.replaceMessage', {
            name: workspace.label,
            count: data.links.length,
          }),
          t('data.replaceConfirm'),
        );
        if (!ok) return;
        if (!(await store.replaceAll(data))) return;
        const left = skippedCount(skipped);
        toasts.push({
          variant: left > 0 ? 'warning' : 'success',
          title: legacy ? t('data.importedOld') : t('data.imported'),
          body:
            left > 0
              ? t('data.importedSkipped', { count: left, unsafe: skipped.unsafeUrls })
              : null,
          timeout: left > 0 ? 0 : undefined,
        });
      } catch (error) {
        toasts.push({
          variant: 'danger',
          title: t('data.importFailed'),
          body: importErrorMessage(error, t),
        });
      }
    },
  });

  const menu = UI.Menu({
    icon: 'dots-three-vertical',
    label: t('board.more'),
    menuLabel: t('board.moreMenu'),
    items: [
      {
        label: t('board.newGroup'),
        icon: 'folder-simple-plus',
        mutates: true,
        onclick: onNewGroup,
      },
      { separator: true },
      { label: t('data.exportJson'), icon: 'download-simple', onclick: () => void exportJson() },
      {
        label: t('data.importJson'),
        icon: 'upload-simple',
        mutates: true,
        onclick: () => fileInput.click(),
      },
      { separator: true },
      {
        label: t('data.clear'),
        icon: 'trash',
        danger: true,
        mutates: true,
        onclick: () => void clearAll(),
      },
    ],
  });

  return { menu, fileInput };
}

// The actions on the data of the active workspace: export, import (into the workspace, merged,
// or into a new workspace), the sample and "clear". Importing and clearing replace what the
// workspace holds, so each asks first, in a Covenant modal and never with the browser's
// `confirm()`.
import { toLocalIsoDate } from '@simple-web-tools/dates';
import { backupFileName } from '../../core/backup.js';
import { buildSample } from '../../core/sample.js';
import { importErrorMessage, readBackup, serializeBackup } from '../backup.js';
import { copyText } from '../clipboard.js';
import { downloadText } from '../download.js';
import { newId } from '../ids.js';
import { emptyWorkspaceData } from '../starting.js';
import { activeWorkspace } from '../workspaces.js';
import * as UI from './ui.js';

const { t } = UI;

/**
 * Downloads the workspace as a JSON file.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 */
export async function exportJson(store, toasts) {
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

/**
 * Copies the JSON of the workspace to the clipboard.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 */
export async function copyJson(store, toasts) {
  try {
    const envelope = await store.exportBackup();
    toasts.push(
      (await copyText(serializeBackup(envelope)))
        ? { variant: 'success', title: t('data.copied') }
        : { variant: 'danger', title: t('links.copyFailed'), body: t('links.copyFailedBody') },
    );
  } catch (error) {
    toasts.push({
      variant: 'danger',
      title: t('data.exportFailed'),
      body: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Reads a file as a backup (this version's or the earlier version's).
 * @param {File} file
 * @returns {Promise<ReturnType<typeof readBackup>>}
 */
export async function readBackupFile(file) {
  return readBackup(await file.text());
}

/**
 * Message of a failed read, for a toast or an alert.
 * @param {unknown} error
 */
export const readErrorText = (error) => importErrorMessage(error, t);

/**
 * Replaces the workspace with the sample, after asking.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @returns {Promise<boolean>}
 */
export async function loadSample(store, toasts) {
  const { apps } = store.getState();
  if (apps.length > 0 || store.getState().templates.length > 0) {
    const ok = await UI.Confirm({
      title: t('data.sampleTitle'),
      message: t('data.sampleMessage', { name: activeWorkspace().label }),
      confirmLabel: t('data.sampleConfirm'),
      danger: true,
    });
    if (!ok) return false;
  }
  const sample = buildSample({ makeId: newId, t });
  if (!(await store.replaceAll(sample))) return false;
  toasts.push({
    variant: 'success',
    title: t('data.sampleLoaded'),
    body: t('data.sampleLoadedBody', {
      apps: sample.apps.length,
      templates: sample.templates.length,
    }),
  });
  return true;
}

/**
 * Empties the workspace (it keeps nothing but the default tags), after asking.
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').ToastHost} toasts
 * @returns {Promise<boolean>}
 */
export async function clearWorkspace(store, toasts) {
  const ok = await UI.Confirm({
    title: t('data.clearTitle'),
    message: t('data.clearMessage', { name: activeWorkspace().label }),
    confirmLabel: t('data.clearConfirm'),
    danger: true,
  });
  if (!ok) return false;
  if (!(await store.replaceAll(emptyWorkspaceData()))) return false;
  toasts.push({ variant: 'info', title: t('data.cleared') });
  return true;
}

// The import and export screen. Export: a JSON file of the workspace, or the same JSON on the
// clipboard. Import: a file from this app or the one the earlier version exported (its
// `{ version, exportedAt, data }` or the bare object). The file is read and checked record by
// record before anything is asked; then three ways to bring it in: merge it into the workspace
// (what the workspace already has wins), replace the workspace, or put it in a new workspace.
import { activeWorkspace, createWorkspaceWithData, switchWorkspace } from '../workspaces.js';
import { copyJson, exportJson, readBackupFile, readErrorText } from './DataActions.js';
import { card } from './parts.js';
import { createRedraw } from './redraw.js';
import * as UI from './ui.js';

const { el, t } = UI;

/** @param {import('../../types.d.ts').WorkspaceData} data */
function countLinks(data) {
  return data.templates.reduce((sum, template) => sum + template.links.length, 0);
}

/**
 * @param {import('./types.js').Context} ctx
 * @returns {import('./types.js').View}
 */
export function createDataView(ctx) {
  const { store, toasts } = ctx;
  const root = el('div', { class: 'dsh-view' });

  /** The file that was read and is ready to import. @type {{ name: string, read: ReturnType<typeof readBackupFile> extends Promise<infer R> ? R : never } | null} */
  let pending = null;
  /** Why the last file could not be read. */
  let readError = '';
  /** @type {'merge' | 'replace' | 'new'} */
  let strategy = 'merge';
  let newName = '';

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
        const read = await readBackupFile(file);
        pending = { name: file.name, read };
        readError = '';
        newName = read.data.settings.dashboardName;
      } catch (error) {
        pending = null;
        readError = readErrorText(error);
      }
      redraw.draw();
    },
  });

  function skippedCount() {
    const skipped = pending?.read.skipped;
    return skipped ? skipped.templates + skipped.apps + skipped.parts + skipped.unsafeUrls : 0;
  }

  async function runImport() {
    if (!pending) return;
    const { data, legacy } = pending.read;
    const left = skippedCount();
    const report = () => {
      toasts.push({
        variant: left > 0 ? 'warning' : 'success',
        title: legacy ? t('data.importedOld') : t('data.imported'),
        body:
          left > 0
            ? t('data.importedSkipped', {
                count: left,
                unsafe: pending?.read.skipped.unsafeUrls ?? 0,
              })
            : null,
        timeout: left > 0 ? 0 : undefined,
      });
    };
    try {
      if (strategy === 'merge') {
        const before = store.getState();
        const { effects } = store.dispatch({ type: 'merge_data', data });
        if (effects.length === 0 && !store.getState().readOnly && before === store.getState()) {
          toasts.push({ variant: 'info', title: t('data.nothingToMerge') });
        } else if (effects.length > 0) {
          report();
        }
      } else if (strategy === 'replace') {
        const ok = await UI.Confirm({
          title: t('data.replaceTitle'),
          message: t('data.replaceMessage', {
            name: activeWorkspace().label,
            apps: data.apps.length,
            templates: data.templates.length,
          }),
          confirmLabel: t('data.replaceConfirm'),
          danger: true,
        });
        if (!ok) return;
        if (!(await store.replaceAll(data))) return;
        report();
      } else {
        const label = newName.trim() || t('data.newWorkspaceDefault');
        const workspace = await createWorkspaceWithData(label, data);
        report();
        const switchNow = await UI.Confirm({
          title: t('data.switchTitle'),
          message: t('data.switchMessage', { name: workspace.label }),
          confirmLabel: t('workspaces.switch'),
        });
        if (switchNow) {
          await store.flush();
          switchWorkspace(workspace.id);
          return;
        }
      }
      pending = null;
      redraw.draw();
    } catch (error) {
      toasts.push({
        variant: 'danger',
        title: t('data.importFailed'),
        body: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function exportCard() {
    const { templates, apps } = store.getState();
    const envs = apps.reduce(
      (sum, app) => sum + (templates.find((tpl) => tpl.id === app.templateId)?.envs.length ?? 0),
      0,
    );
    const stat = (/** @type {number} */ value, /** @type {string} */ label) =>
      el(
        'div',
        { class: 'dsh-stat' },
        el('span', { class: 'dsh-stat__value cv-num' }, String(value)),
        el('span', { class: 'dsh-meta' }, label),
      );
    return card({
      title: t('data.exportTitle'),
      subtitle: t('data.exportSubtitle'),
      body: el(
        'div',
        { class: 'dsh-stack dsh-gap-5' },
        el(
          'div',
          { class: 'dsh-stats' },
          stat(apps.length, t('data.statApps')),
          stat(templates.length, t('data.statTemplates')),
          stat(
            templates.reduce((sum, tpl) => sum + tpl.links.length, 0),
            t('data.statLinks'),
          ),
          stat(envs, t('data.statEnvs')),
        ),
        UI.Alert({
          status: 'info',
          title: t('data.exportContentTitle'),
          text: t('data.exportContent'),
        }),
        el(
          'div',
          { class: 'dsh-row dsh-wrap dsh-gap-2' },
          UI.Button({
            variant: 'primary',
            icon: 'download-simple',
            children: t('data.exportJson'),
            onclick: () => void exportJson(store, toasts),
          }),
          UI.Button({
            icon: 'copy',
            children: t('data.copyJson'),
            onclick: () => void copyJson(store, toasts),
          }),
        ),
      ),
    });
  }

  function importCard() {
    const body = el('div', { class: 'dsh-stack dsh-gap-5' });
    body.append(
      el('p', { class: 'dsh-meta' }, t('data.importHelp')),
      el(
        'div',
        null,
        UI.Button({
          icon: 'upload-simple',
          children: t('data.chooseFile'),
          mutates: true,
          onclick: () => fileInput.click(),
        }),
        fileInput,
      ),
    );
    if (readError) {
      body.append(
        UI.Alert({ status: 'danger', title: t('data.invalidFile'), text: readError, live: true }),
      );
    }
    if (pending) {
      const { data, legacy } = pending.read;
      body.append(
        UI.Alert({
          status: skippedCount() > 0 ? 'warning' : 'success',
          title: t('data.readyTitle', { name: pending.name }),
          text: [
            t('data.readySummary', {
              apps: data.apps.length,
              templates: data.templates.length,
              links: countLinks(data),
            }),
            legacy ? ` ${t('data.readyOld')}` : '',
            skippedCount() > 0
              ? ` ${t('data.readySkipped', { count: skippedCount(), unsafe: pending.read.skipped.unsafeUrls })}`
              : '',
          ].join(''),
          live: true,
        }),
        UI.Segmented({
          legend: t('data.strategy'),
          name: 'import-strategy',
          options: [
            { value: 'merge', label: t('data.strategyMerge') },
            { value: 'replace', label: t('data.strategyReplace') },
            { value: 'new', label: t('data.strategyNew') },
          ],
          value: strategy,
          onchange: (value) => {
            strategy = value === 'replace' || value === 'new' ? value : 'merge';
            redraw.draw();
          },
        }),
        el(
          'p',
          { class: 'dsh-meta' },
          strategy === 'merge'
            ? t('data.strategyMergeHelp')
            : strategy === 'replace'
              ? t('data.strategyReplaceHelp')
              : t('data.strategyNewHelp'),
        ),
      );
      if (strategy === 'new') {
        const name = UI.Input({
          label: t('data.newWorkspaceName'),
          value: newName,
          placeholder: t('data.newWorkspaceDefault'),
        });
        name.input.addEventListener('input', () => {
          newName = name.input.value;
        });
        body.append(name);
      }
      body.append(
        el(
          'div',
          { class: 'dsh-row dsh-gap-2' },
          UI.Button({
            variant: 'primary',
            icon: 'check',
            children: t('data.import'),
            mutates: strategy !== 'new',
            onclick: () => void runImport(),
          }),
          UI.Button({
            variant: 'ghost',
            children: t('common.cancel'),
            onclick: () => {
              pending = null;
              redraw.draw();
            },
          }),
        ),
      );
    }
    return card({ title: t('data.importTitle'), subtitle: t('data.importSubtitle'), body });
  }

  function build() {
    return el('div', { class: 'dsh-grid-2' }, exportCard(), importCard());
  }

  const redraw = createRedraw(root, build);
  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (state.templates !== prevState.templates || state.apps !== prevState.apps) redraw.schedule();
  });
  redraw.draw();
  return { el: root, destroy: unsubscribe, title: () => t('admin.data') };
}

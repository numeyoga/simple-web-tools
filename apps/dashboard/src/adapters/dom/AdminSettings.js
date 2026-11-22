// The settings of the workspace: its name, what opens at the start, and the sample and the reset.
// Theme, text size, density and language are the person's own preferences, not the workspace's:
// they are in the preferences dialog.
import { activeWorkspace } from '../workspaces.js';
import { clearWorkspace, loadSample } from './DataActions.js';
import { openPreferences } from './Preferences.js';
import { card } from './parts.js';
import { createRedraw } from './redraw.js';
import * as UI from './ui.js';

const { el, t } = UI;

/**
 * @param {import('./types.js').Context} ctx
 * @returns {import('./types.js').View}
 */
export function createSettingsView(ctx) {
  const { store, toasts } = ctx;
  const root = el('div', { class: 'dsh-view' });

  function build() {
    const { settings, apps } = store.getState();
    const name = UI.Input({
      label: t('settings.nameLabel'),
      value: settings.dashboardName,
      placeholder: activeWorkspace().label,
      hint: t('settings.nameHint', { workspace: activeWorkspace().label }),
    });
    name.input.dataset.focusKey = 'settings-name';
    name.input.setAttribute('data-mutates', '');
    name.input.addEventListener('change', () =>
      store.dispatch({ type: 'update_settings', dashboardName: name.input.value }),
    );

    const defaultApp = UI.Select({
      label: t('settings.defaultApp'),
      value: settings.defaultAppId ?? '',
      options: [
        { value: '', label: t('settings.lastApp') },
        ...apps.map((app) => ({ value: app.id, label: app.name })),
      ],
      hint: t('settings.defaultAppHint'),
      onchange: (value) =>
        store.dispatch({ type: 'update_settings', defaultAppId: value === '' ? null : value }),
      mutates: true,
    });
    defaultApp.input.dataset.focusKey = 'settings-default-app';

    const defaultEnv = UI.Segmented({
      legend: t('settings.defaultEnv'),
      name: 'settings-default-env',
      options: [
        { value: 'first', label: t('settings.envFirst') },
        { value: 'last', label: t('settings.envLast') },
        { value: 'remember', label: t('settings.envRemember') },
      ],
      value: settings.defaultEnv,
      onchange: (value) =>
        store.dispatch({
          type: 'update_settings',
          defaultEnv: value === 'first' || value === 'remember' ? value : 'last',
        }),
    });

    return el(
      'div',
      { class: 'dsh-grid-2' },
      card({
        title: t('settings.nameTitle'),
        subtitle: t('settings.nameSubtitle'),
        body: name,
      }),
      card({
        title: t('settings.startTitle'),
        subtitle: t('settings.startSubtitle'),
        body: el(
          'div',
          { class: 'dsh-stack dsh-gap-5' },
          defaultApp,
          el(
            'div',
            { class: 'cv-field' },
            el('span', { class: 'cv-label', 'aria-hidden': 'true' }, t('settings.defaultEnv')),
            defaultEnv,
            el('span', { class: 'cv-hint' }, t('settings.defaultEnvHint')),
          ),
        ),
      }),
      card({
        title: t('settings.appearanceTitle'),
        subtitle: t('settings.appearanceSubtitle'),
        body: el(
          'div',
          { class: 'dsh-stack dsh-gap-4' },
          el('p', { class: 'dsh-meta' }, t('settings.appearanceText')),
          el(
            'div',
            null,
            UI.Button({
              icon: 'gear',
              children: t('settings.openPreferences'),
              onclick: () => openPreferences(),
            }),
          ),
        ),
      }),
      card({
        title: t('settings.resetTitle'),
        subtitle: t('settings.resetSubtitle'),
        body: el(
          'div',
          { class: 'dsh-stack dsh-gap-4' },
          el(
            'div',
            { class: 'dsh-row dsh-wrap dsh-gap-2' },
            UI.Button({
              icon: 'sparkle',
              children: t('settings.loadSample'),
              mutates: true,
              onclick: () => void loadSample(store, toasts),
            }),
            UI.Button({
              variant: 'danger',
              icon: 'trash',
              children: t('settings.clear'),
              mutates: true,
              onclick: () => void clearWorkspace(store, toasts),
            }),
          ),
          el(
            'p',
            { class: 'dsh-meta' },
            t('settings.resetHelp', { workspace: activeWorkspace().label }),
          ),
        ),
      }),
    );
  }

  const redraw = createRedraw(root, build);
  const unsubscribe = store.subscribe(({ state, prevState }) => {
    if (state.settings !== prevState.settings || state.apps !== prevState.apps) redraw.schedule();
  });
  redraw.draw();
  return { el: root, destroy: unsubscribe, title: () => t('admin.settings') };
}

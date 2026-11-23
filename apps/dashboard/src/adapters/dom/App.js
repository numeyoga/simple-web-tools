// Main shell (the AppShell of the Covenant skill): skip link, sidebar (brand, workspace, the
// applications with their filter, the administration screens, the app switcher), sticky top bar
// (page title, command menu, new application, preferences) and the main region, where one view
// at a time is shown: an application or an administration screen, chosen by the `#/...` address.
// Below 1024 px the sidebar is an off-canvas drawer.
// The tab that does not hold the write lock is read-only: a banner says so, the controls that
// change data are disabled and the shortcuts that change data do nothing.
import { registerServiceWorker } from '@simple-web-tools/pwa/update';
import { findApp } from '@simple-web-tools/suite';
import { createAppBrand, createAppSwitcher } from '@simple-web-tools/suite/dom';
import { allowsSingleKeyShortcut } from '../../core/preferences.js';
import { ADMIN_PAGES, parseRoute, routeHash, sameRoute } from '../../core/route.js';
import { filterApps } from '../../core/search.js';
import { startApp } from '../../core/selectors.js';
import { getSingleKeyShortcuts, watchPreferences } from '../preferences.js';
import { StorageError, createAppStore } from '../store.js';
import { readViewMemory, writeViewMemory } from '../view-memory.js';
import { activeWorkspace, activeWorkspaceId, listWorkspaces } from '../workspaces.js';
import { createDataView } from './AdminData.js';
import { createMetadataView } from './AdminMetadata.js';
import { createSettingsView } from './AdminSettings.js';
import { createTagsView } from './AdminTags.js';
import { createTemplatesView } from './AdminTemplates.js';
import { openNewApp } from './AppDialogs.js';
import { createAppView } from './AppView.js';
import { exportJson, loadSample } from './DataActions.js';
import { PALETTE_ID, adminIcon, adminTitle, createPalette, paletteItems } from './Palette.js';
import { openPreferences } from './Preferences.js';
import * as UI from './ui.js';
import { openWorkspaceManager } from './WorkspacesView.js';

const { el, icon, t } = UI;

/** Id of this app in the suite registry (brand, switcher, icon). */
const APP_ID = 'dashboard';

/**
 * The page that replaces the app when the browser storage cannot be used: nothing is read or
 * written until the cause is fixed.
 * @param {HTMLElement} rootEl
 * @param {'blocked' | 'unavailable'} code
 */
function showStorageError(rootEl, code) {
  const message =
    code === 'blocked'
      ? { title: t('shell.storageBlocked.title'), body: t('shell.storageBlocked.body') }
      : { title: t('shell.storageUnavailable.title'), body: t('shell.storageUnavailable.body') };
  // The shell is replaced by a framed message: a top bar with the brand, then the message as the
  // one h1 of the page.
  rootEl.replaceChildren(
    el(
      'div',
      { class: 'cv-shell__main' },
      el(
        'header',
        { class: 'cv-topbar' },
        el(
          'span',
          { class: 'dsh-brand' },
          icon(findApp(APP_ID).icon, { weight: 'bold', className: 'swt-brand__icon' }),
          t('app.name'),
        ),
      ),
      el(
        'main',
        {
          class: 'cv-shell__content',
          id: 'shell-main',
          'data-testid': 'storage-error',
          'data-code': code,
        },
        el(
          'div',
          { role: 'alert', class: 'dsh-error-screen' },
          icon('warning', { className: 'dsh-warning-text dsh-icon-xl' }),
          el('h1', { class: 'cv-h1' }, message.title),
          el('p', null, message.body),
          el(
            'div',
            null,
            UI.Button({
              variant: 'primary',
              icon: 'arrow-clockwise',
              children: t('shell.reload'),
              onclick: () => location.reload(),
            }),
          ),
        ),
      ),
    ),
  );
}

/** @param {HTMLElement} rootEl */
export async function start(rootEl) {
  const store = createAppStore({ workspaceId: activeWorkspaceId() });
  const toasts = UI.ToastHost();
  /** @type {import('./types.js').View | null} */
  let currentView = null;
  /** The environments chosen while this page is open, by application id. */
  const sessionEnvs = new Map();
  let firstRoute = true;

  watchPreferences();

  /* ---------------- shell ---------------- */

  function workspaceChip() {
    const workspace = activeWorkspace();
    const count = listWorkspaces().length;
    return el(
      'button',
      {
        type: 'button',
        onclick: () => {
          // Below 1024 px the drawer closes first, so the dialog gives the focus back to the menu button.
          closeNav({ focusToggle: true });
          openWorkspaceManager({ store, toasts });
        },
        class: 'cv-btn dsh-workspace',
      },
      icon('database'),
      el(
        'span',
        { class: 'dsh-grow dsh-stack' },
        el('span', { class: 'dsh-meta' }, t('shell.workspace')),
        el('span', { class: 'dsh-ellipsis dsh-strong' }, workspace.label),
      ),
      count > 1 ? UI.Tag(`${count}`, { mono: true }) : null,
      icon('caret-up-down'),
    );
  }

  // The filter of the applications (and of the links of the one that is open).
  const filter = UI.Input({
    ariaLabel: t('nav.filterLabel'),
    placeholder: t('nav.filterPlaceholder'),
    type: 'search',
    icon: 'magnifying-glass',
    oninput: (e) =>
      store.dispatch({
        type: 'set_search',
        query: /** @type {HTMLInputElement} */ (e.target).value,
      }),
  });
  filter.input.setAttribute('autocomplete', 'off');
  filter.input.setAttribute('autocapitalize', 'off');
  filter.input.spellcheck = false;

  const appsHeadingId = UI.fieldId('dsh-nav-apps');
  const appList = el('ul', { 'aria-labelledby': appsHeadingId, class: 'dsh-nav-list' });
  const appsCount = el('span', { class: 'dsh-nav-count cv-num' });
  const adminHeadingId = UI.fieldId('dsh-nav-admin');
  const adminList = el('ul', { 'aria-labelledby': adminHeadingId });

  function drawNav() {
    const state = store.getState();
    const route = currentRoute;
    const shown = filterApps(state.apps, state.templates, state.search);
    appsCount.textContent =
      state.search.trim() === ''
        ? String(state.apps.length)
        : `${shown.length}/${state.apps.length}`;
    appList.replaceChildren(
      ...shown.map((app) =>
        el(
          'li',
          null,
          el(
            'a',
            {
              class: 'cv-nav-item',
              href: routeHash({ screen: 'app', appId: app.id }),
              'aria-current': route?.screen === 'app' && route.appId === app.id ? 'page' : null,
              onclick: () => closeNav(),
            },
            el('span', { class: 'dsh-grow dsh-ellipsis' }, app.name),
          ),
        ),
      ),
      ...(shown.length === 0
        ? [
            el(
              'li',
              { class: 'dsh-meta dsh-nav-empty' },
              state.apps.length === 0 ? t('nav.noApps') : t('nav.noMatch'),
            ),
          ]
        : []),
    );
    adminList.replaceChildren(
      ...ADMIN_PAGES.map((page) =>
        el(
          'li',
          null,
          el(
            'a',
            {
              class: 'cv-nav-item',
              href: routeHash({ screen: 'admin', page, templateId: null }),
              'aria-current': route?.screen === 'admin' && route.page === page ? 'page' : null,
              onclick: () => closeNav(),
            },
            icon(adminIcon(page), { className: 'cv-icon' }),
            adminTitle(page),
          ),
        ),
      ),
    );
  }

  // The sidebar is navigation only: brand, workspace, the applications, the administration, then the
  // app switcher (pinned to the bottom). The skill's own script opens and closes it below 1024 px.
  const sidebar = el(
    'nav',
    { id: 'shell-nav', 'aria-label': t('shell.navLabel'), class: 'cv-sidebar' },
    createAppBrand(APP_ID),
    el('div', { class: 'dsh-sidebar-workspace' }, workspaceChip()),
    el(
      'div',
      { class: 'swt-sidebar__body' },
      el(
        'div',
        { class: 'dsh-sidebar-apps' },
        el(
          'div',
          { class: 'cv-overline cv-sidebar__group dsh-row dsh-between', id: appsHeadingId },
          t('nav.apps'),
          appsCount,
        ),
        filter,
        appList,
        UI.Button({
          variant: 'ghost',
          size: 'sm',
          icon: 'plus',
          children: t('nav.newApp'),
          mutates: true,
          className: 'dsh-nav-new',
          onclick: () => {
            closeNav();
            newApp();
          },
        }),
      ),
      el('div', { class: 'cv-overline cv-sidebar__group', id: adminHeadingId }, t('nav.admin')),
      adminList,
    ),
    createAppSwitcher(APP_ID, { label: t('shell.apps') }),
  );

  // The page title is the one h1 of the page: the name of the application or of the screen shown.
  const pageTitle = el('h1', { class: 'cv-topbar__title' }, activeWorkspace().label);
  const dashboardName = el('span', { class: 'dsh-topbar-name dsh-meta dsh-ellipsis' });
  const menuButton = el(
    'button',
    {
      type: 'button',
      class: 'cv-btn cv-btn--ghost cv-btn--icon cv-shell__menu',
      'data-cv-nav-toggle': '',
      'aria-controls': 'shell-nav',
      'aria-expanded': 'false',
      'aria-label': t('shell.menu'),
    },
    icon('list'),
  );
  // The text is hidden on a narrow screen: the label names the button then (and repeats the text).
  const newAppButton = UI.Button({
    variant: 'primary',
    icon: 'plus',
    children: el('span', { class: 'dsh-btn-label' }, t('nav.newApp')),
    mutates: true,
    onclick: () => newApp(),
  });
  newAppButton.setAttribute('aria-label', t('nav.newApp'));
  const searchButton = el(
    'button',
    {
      type: 'button',
      class: 'cv-search',
      'data-cv-open': PALETTE_ID,
      'aria-label': t('palette.open'),
    },
    icon('magnifying-glass', { className: 'cv-icon' }),
    el('span', { class: 'cv-search__label' }, t('palette.open')),
    UI.Kbd(t('palette.keys')),
  );
  const topbar = el(
    'header',
    { class: 'cv-topbar' },
    menuButton,
    el('div', { class: 'dsh-topbar-title' }, dashboardName, pageTitle),
    el('span', { class: 'cv-topbar__spacer' }),
    searchButton,
    newAppButton,
    UI.IconButton({
      icon: 'gear',
      label: t('shell.preferences'),
      onclick: () => openPreferences(),
    }),
  );

  const main = el('main', { class: 'cv-shell__content dsh-main', id: 'shell-main', tabindex: -1 });

  const palette = createPalette({
    getItems: () => paletteItems(store.getState()),
    onCommand: runCommand,
  });

  const shell = el(
    'div',
    { class: 'cv-shell' },
    el('a', { class: 'cv-skip-link', href: '#shell-main' }, t('shell.skipLink')),
    sidebar,
    el('div', { class: 'cv-shell__scrim' }),
    el('div', { class: 'cv-shell__main' }, topbar, main),
    palette.el,
  );

  rootEl.appendChild(shell);
  // Menus are wired to their buttons once both are in the document.
  UI.initCovenant(shell);

  /** Closes the drawer of the narrow layout; `focusToggle` gives the focus back to its button. */
  /** @param {{ focusToggle?: boolean }} [opts] */
  function closeNav({ focusToggle = false } = {}) {
    if (!shell.hasAttribute('data-nav-open')) return;
    shell.removeAttribute('data-nav-open');
    menuButton.setAttribute('aria-expanded', 'false');
    if (focusToggle) menuButton.focus();
  }
  // From 1024 px the sidebar is fixed: a drawer left open must not keep its state.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) closeNav();
  });

  /* ---------------- read-only tab (another tab holds the write lock) ---------------- */
  /** @type {HTMLElement | null} */
  let readOnlyBanner = null;

  function buildReadOnlyBanner() {
    const banner = UI.Alert({
      status: 'warning',
      title: t('shell.readOnly.title'),
      text: t('shell.readOnly.text'),
      live: true,
    });
    banner.dataset.testid = 'read-only-banner';
    banner.classList.add('dsh-center');
    banner.append(
      UI.Button({
        size: 'sm',
        children: t('shell.readOnly.resume'),
        onclick: async () => {
          if (!(await store.retryWriteLock())) {
            toasts.push({
              variant: 'warning',
              title: t('shell.readOnly.stillWriting'),
              body: t('shell.readOnly.closeIt'),
            });
          }
        },
      }),
    );
    return banner;
  }

  // Shows or hides the banner, and disables the controls that change data.
  function paintReadOnly() {
    const readOnly = store.getState().readOnly;
    document.body.toggleAttribute('data-read-only', readOnly);
    if (readOnly && !readOnlyBanner) readOnlyBanner = buildReadOnlyBanner();
    if (readOnly && readOnlyBanner && readOnlyBanner.parentElement !== main) {
      main.prepend(readOnlyBanner);
    }
    if (!readOnly && readOnlyBanner) {
      readOnlyBanner.remove();
      readOnlyBanner = null;
    }
    // A control that is disabled for another reason is left alone: only the ones disabled here
    // carry the marker, and only those are enabled again.
    for (const control of /** @type {NodeListOf<HTMLButtonElement | HTMLInputElement>} */ (
      document.querySelectorAll('button[data-mutates], input[data-mutates], select[data-mutates]')
    )) {
      if (readOnly && !control.disabled) {
        control.disabled = true;
        control.dataset.readOnlyDisabled = '';
      } else if (!readOnly && 'readOnlyDisabled' in control.dataset) {
        control.disabled = false;
        delete control.dataset.readOnlyDisabled;
      }
    }
  }

  /* ---------------- screens ---------------- */

  /** @type {import('../../core/route.js').Route | null} */
  let currentRoute = null;

  /** @param {import('../../core/route.js').Route} route */
  function navigate(route) {
    const hash = routeHash(route);
    if (location.hash === hash || (hash === '#/' && location.hash === '')) showRoute();
    else location.hash = hash;
  }

  /** @type {import('./types.js').Context} */
  const ctx = { store, toasts, navigate, workspaceId: store.workspaceId };

  function newApp() {
    openNewApp(store, (id) => navigate({ screen: 'app', appId: id }));
  }

  /** @param {string} value a command of the menu */
  function runCommand(value) {
    if (value === 'new-app') newApp();
    else if (value === 'toggle-edit') {
      store.dispatch({ type: 'set_edit_mode', editMode: !store.getState().editMode });
    } else if (value === 'export') void exportJson(store, toasts);
    else if (value === 'workspaces') openWorkspaceManager({ store, toasts });
    else if (value === 'preferences') openPreferences();
    else if (value.startsWith('admin:')) {
      const page = ADMIN_PAGES.find((candidate) => candidate === value.slice(6));
      if (page) navigate({ screen: 'admin', page, templateId: null });
    } else if (value.startsWith('app:')) navigate({ screen: 'app', appId: value.slice(4) });
  }

  function emptyView() {
    const empty = el(
      'div',
      { class: 'dsh-view' },
      UI.EmptyState({
        icon: 'squares-four',
        title: t('app.emptyTitle'),
        text: t('app.emptyText'),
        actions: el(
          'div',
          { class: 'dsh-row dsh-wrap dsh-gap-2 dsh-center-x' },
          UI.Button({
            variant: 'primary',
            icon: 'plus',
            children: t('nav.newApp'),
            mutates: true,
            onclick: () => newApp(),
          }),
          UI.Button({
            icon: 'sparkle',
            children: t('settings.loadSample'),
            mutates: true,
            onclick: () => void loadSample(store, toasts),
          }),
        ),
      }),
    );
    return { el: empty, title: () => t('app.emptyHeading') };
  }

  /**
   * Shows the screen the address names. An unknown application falls back to the one the app
   * opens on.
   */
  function showRoute() {
    const state = store.getState();
    let route = parseRoute(location.hash);
    if (route.screen === 'app') {
      const wanted = route.appId;
      const memory = readViewMemory(store.workspaceId);
      const app =
        (wanted ? state.apps.find((a) => a.id === wanted) : null) ?? startApp(state, memory.appId);
      route = { screen: 'app', appId: app?.id ?? null };
    }
    if (currentRoute && currentView && sameRoute(route, currentRoute)) {
      drawNav();
      return;
    }
    currentRoute = route;
    currentView?.destroy?.();
    /** @type {import('./types.js').View} */
    let view;
    if (route.screen === 'app') {
      if (route.appId === null) view = emptyView();
      else {
        view = createAppView(ctx, route.appId, { sessionEnvs });
        writeViewMemory(store.workspaceId, route.appId, null);
      }
    } else if (route.page === 'templates') view = createTemplatesView(ctx, route.templateId);
    else if (route.page === 'metadata') view = createMetadataView(ctx, route.templateId);
    else if (route.page === 'tags') view = createTagsView(ctx);
    else if (route.page === 'data') view = createDataView(ctx);
    else view = createSettingsView(ctx);
    currentView = view;
    main.replaceChildren(view.el);
    if (readOnlyBanner) main.prepend(readOnlyBanner);
    UI.initCovenant(main);
    view.mounted?.();
    drawTitle();
    drawNav();
    paintReadOnly();
    if (!firstRoute) main.focus({ preventScroll: true });
    firstRoute = false;
  }

  function drawTitle() {
    const state = store.getState();
    const title = currentView?.title() ?? '';
    pageTitle.textContent = title;
    const name = state.settings.dashboardName;
    dashboardName.textContent = name;
    dashboardName.hidden = name === '' || name === title;
    document.title = `${title} · ${t('app.name')}`;
  }

  /* ---------------- keyboard shortcuts ---------------- */
  // `N` (new application) and `/` (filter the applications) are single-key shortcuts: on by default, and the user can turn
  // them off in the preferences (WCAG 2.1.4). They never steal a key from a control that uses it:
  // a text field, an open dialog (a native <dialog>: the page behind is inert) or the open
  // drawer, a combination with Ctrl, Alt or Meta, Shift on a letter, and the auto-repeat of a
  // held key. Ctrl+K (Cmd+K) opens the command menu (Covenant binds it): it has a modifier, so it is
  // always on.
  /** @param {KeyboardEvent} e */
  function mayRunShortcut(e) {
    const target = /** @type {HTMLElement | null} */ (e.target);
    const inTextField =
      !!target &&
      (target.isContentEditable ||
        !!target.closest?.(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
        ));
    return allowsSingleKeyShortcut({
      enabled: getSingleKeyShortcuts(),
      key: e.key,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      repeat: e.repeat,
      inTextField,
      dialogOpen: !!document.querySelector('dialog[open]') || shell.hasAttribute('data-nav-open'),
    });
  }

  window.addEventListener('keydown', (e) => {
    if (!mayRunShortcut(e)) return;
    if (e.key.toLowerCase() === 'n') {
      if (store.getState().readOnly) return;
      e.preventDefault();
      newApp();
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      openNavForFilter();
      filter.input.focus();
    }
  });
  // The filter is in the sidebar: on a narrow screen the drawer opens to show it.
  function openNavForFilter() {
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      shell.setAttribute('data-nav-open', '');
      menuButton.setAttribute('aria-expanded', 'true');
    }
  }

  /* ---------------- initial load ---------------- */
  const loader = el('p', { class: 'dsh-meta dsh-loading', role: 'status' }, t('shell.loading'));
  main.appendChild(loader);

  store.onRefused(() => {
    toasts.push({
      variant: 'warning',
      title: t('shell.readOnly.toastTitle'),
      body: t('shell.readOnly.toastBody'),
    });
  });
  store.onWriteError(() => {
    toasts.push({
      variant: 'danger',
      title: t('shell.writeFailed.title'),
      body: t('shell.writeFailed.body'),
    });
  });
  // The banner and the disabled controls follow the role of the tab, and the controls that a
  // view builds again on every refresh are disabled as they appear.
  let wasReadOnly = false;
  store.subscribe(({ state, prevState }) => {
    paintReadOnly();
    if (wasReadOnly && !state.readOnly) {
      toasts.push({
        variant: 'success',
        title: t('shell.readOnly.restored'),
        body: t('shell.readOnly.restoredBody'),
      });
    }
    wasReadOnly = state.readOnly;
    drawTitle();
    drawNav();
    palette.refresh();
    // The application this tab shows was deleted (here or in another tab), or the first one was
    // just created: show the screen the address names again.
    const shown = currentRoute;
    if (state.apps !== prevState.apps && shown?.screen === 'app') {
      const gone = shown.appId !== null && !state.apps.some((a) => a.id === shown.appId);
      const first = shown.appId === null && state.apps.length > 0;
      if (gone || first) {
        currentRoute = null;
        showRoute();
      }
    }
  });
  new MutationObserver(() => {
    if (store.getState().readOnly) paintReadOnly();
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('hashchange', showRoute);

  // A new version waits in the background: the toast stays until the person reloads or dismisses it.
  void registerServiceWorker({
    enabled: import.meta.env.PROD,
    onUpdateReady(applyUpdate) {
      toasts.push({
        variant: 'info',
        title: t('pwa.updateTitle'),
        body: t('pwa.updateBody'),
        timeout: 0,
        action: {
          label: t('pwa.reload'),
          onclick: (button) => {
            button.disabled = true;
            button.textContent = t('pwa.reloading');
            applyUpdate();
          },
        },
      });
    },
  });

  store
    .init()
    .then(() => {
      wasReadOnly = store.getState().readOnly;
      loader.remove();
      showRoute();
      palette.refresh();
      paintReadOnly();
    })
    .catch((error) => {
      console.error('[App] init failed', error);
      if (error instanceof StorageError) showStorageError(rootEl, error.code);
      else loader.textContent = t('shell.loadError', { message: error.message });
    });
}

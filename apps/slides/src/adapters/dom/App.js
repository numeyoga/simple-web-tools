// The application: the main window and the presenter window are the same page (`?view=presenter`
// is the second one). The main window owns the state (core/store.js), switches between the home
// screen and the presentation, runs the effects the reducer asks for (the channel to the presenter
// window, releasing the object URLs of the images) and takes the keyboard.
import { registerServiceWorker } from '@simple-web-tools/pwa/update';
import { MessageType } from '../../core/messages.js';
import { interpretKey, isCharacterShortcut, GOTO_RESET_DELAY } from '../../core/keyboard.js';
import { allowsSingleKeyShortcut } from '../../core/preferences.js';
import { createStore } from '../../core/store.js';
import { createChannel } from '../channel.js';
import { loadExample } from '../examples.js';
import { failureOf, fromDrop, fromInput, loadPresentation, revokeAssets } from '../folder.js';
import { i18n } from '../i18n.js';
import { getSingleKeyShortcuts, watchPreferences } from '../preferences.js';
import { isPresenterWindow, openPresenterWindow } from '../windows.js';
import { createHome } from './Home.js';
import { openPreferences } from './Preferences.js';
import { createPresentationView } from './PresentationView.js';
import { mountPresenter } from './PresenterView.js';
import { createPrintView } from './PrintView.js';
import * as UI from './ui.js';

const { t } = UI;

/** @typedef {import('../folder.js').FolderFile} FolderFile */

/** @param {HTMLElement} rootEl */
export function start(rootEl) {
  watchPreferences();
  const toasts = UI.ToastHost();
  registerUpdates(toasts);

  if (isPresenterWindow()) {
    mountPresenter(rootEl);
    return;
  }
  mountMain(rootEl);
}

/** A new version waits in the background: the toast stays until the person reloads or dismisses it. */
function registerUpdates(/** @type {import('./types.js').ToastHost} */ toasts) {
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
}

/** @param {HTMLElement} rootEl */
function mountMain(rootEl) {
  const store = createStore();
  const channel = createChannel();
  const printView = createPrintView(store);
  let busy = false;

  /* ---- opening presentations ---- */
  /** @param {FolderFile[] | Promise<FolderFile[]>} source */
  async function open(source) {
    busy = true;
    paint();
    try {
      const files = await source;
      const { presentation, assets } = await loadPresentation(files);
      store.dispatch({ type: 'loaded', presentation, assets });
    } catch (error) {
      store.dispatch({ type: 'failed', error: failureOf(error) });
    } finally {
      busy = false;
      paint();
    }
  }

  const home = createHome({
    onFolder: (files) => void open(fromInput(files)),
    // The entries of the drop are taken synchronously by `fromDrop`, inside the event handler.
    onDrop: (dataTransfer) => void open(fromDrop(dataTransfer)),
    onExample: () => void open(loadExample(i18n.locale)),
  });

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  const presentationView = createPresentationView({
    dispatch: store.dispatch,
    getState: store.getState,
    onPresenter: openPresenterWindow,
    onPrint: () => void printView.print(),
    onFullscreen: toggleFullscreen,
    onPreferences: () => openPreferences(),
    onClose: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      store.dispatch({ type: 'closed' });
    },
  });

  /* ---- screens ---- */
  /** @type {'home' | 'presentation' | null} */
  let screen = null;

  function paint() {
    const state = store.getState();
    const wanted = state.status === 'ready' ? 'presentation' : 'home';
    if (screen !== wanted) {
      screen = wanted;
      rootEl.replaceChildren(wanted === 'home' ? home.el : presentationView.el);
      UI.initCovenant(rootEl);
      document.title = t('app.title');
    }
    if (wanted === 'home') {
      home.update(state, busy);
    } else {
      presentationView.update(state);
      const title = state.presentation?.meta.title ?? '';
      document.title = title ? t('app.titleWith', { title }) : t('app.title');
    }
  }

  /* ---- effects ---- */
  function publish() {
    const state = store.getState();
    if (state.status !== 'ready' || !state.presentation) return;
    channel.post({
      type: MessageType.STATE,
      presentation: state.presentation,
      assets: { ...state.assets },
      currentIndex: state.currentIndex,
    });
  }

  store.subscribe(({ effects }) => {
    for (const effect of effects) {
      if (effect.type === 'publish') publish();
      else if (effect.type === 'sync')
        channel.post({ type: MessageType.SYNC, currentIndex: effect.index });
      else if (effect.type === 'release_assets') revokeAssets(effect.urls);
    }
    paint();
  });

  channel.onMessage((message) => {
    if (message.type === MessageType.REQUEST_STATE) {
      publish();
    } else if (message.type === MessageType.COMMAND) {
      if (message.action === 'goto')
        store.dispatch({ type: 'navigate', index: message.index ?? 0 });
      else store.dispatch({ type: message.action });
    }
  });

  // A page kept for the back button (`persisted`) keeps its images.
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) revokeAssets(Object.values(store.getState().assets));
  });

  /* ---- keyboard ---- */
  let digits = '';
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let digitsTimer;

  window.addEventListener('keydown', (event) => {
    if (store.getState().status !== 'ready') return;

    // Ctrl+P (Cmd+P) prints through the app, so that the diagrams are drawn first.
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      void printView.print();
      return;
    }
    // Everything else with Ctrl, Alt or Meta belongs to the browser or the system.
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const target = /** @type {HTMLElement | null} */ (event.target);
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    // Space and Enter belong to the button or the link that has the focus.
    if (
      target?.closest('button, a[href], summary') &&
      (event.key === ' ' || event.key === 'Enter')
    ) {
      return;
    }
    // Another dialog (the preferences) has its own keys; the overview is part of the presentation.
    const dialogOpen = document.querySelector('dialog[open]:not([data-overview])') !== null;
    if (dialogOpen) return;

    const characterShortcuts =
      !isCharacterShortcut(event.key) ||
      allowsSingleKeyShortcut({
        enabled: getSingleKeyShortcuts(),
        key: event.key,
        ctrl: false,
        alt: false,
        meta: false,
        shift: event.shiftKey,
        repeat: event.repeat,
        inTextField: false,
        dialogOpen: false,
      });
    const result = interpretKey(event.key, digits, { characterShortcuts });
    digits = result.buffer;
    if (result.restartTimer) {
      clearTimeout(digitsTimer);
      digitsTimer = setTimeout(() => {
        digits = '';
      }, GOTO_RESET_DELAY);
    }
    if (result.handled) event.preventDefault();
    const { intent } = result;
    if (!intent) return;
    if (intent.type === 'command') store.dispatch(intent.command);
    else if (intent.type === 'fullscreen') toggleFullscreen();
    else openPresenterWindow();
  });

  paint();
}

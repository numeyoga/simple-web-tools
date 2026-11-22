import { t } from '../i18n.js';
import { showChunkError, showChunkLoading } from './lazy-chunk-state.js';

/**
 * Lazy front door of the whiteboard screen. The SVG canvas (`whiteboard-canvas.js`) is the
 * largest module of the application and only this screen uses it: it lives in its own chunk,
 * fetched by a dynamic `import()` the first time the screen opens, and kept in the service
 * worker's precache for offline use.
 *
 * Once the chunk is in, `renderWhiteboardView` renders at once and returns the real handle, as
 * before. Until then it shows a loading placeholder and returns a stand-in that cancels the
 * pending render when the screen is left or re-rendered.
 *
 * @typedef {typeof import('./whiteboard-view.js')} ViewModule
 * @typedef {Parameters<ViewModule['renderWhiteboardView']>[0]} WhiteboardViewOptions
 * @typedef {ReturnType<ViewModule['renderWhiteboardView']>} WhiteboardViewHandle
 */

/** @type {Promise<ViewModule> | null} */
let pending = null;
/** @type {ViewModule | null} */
let loaded = null;

/**
 * Load the whiteboard chunk once. A failed load is forgotten, so that a retry fetches it again.
 * @returns {Promise<ViewModule>}
 */
function loadViewModule() {
  if (!pending) {
    pending = import('./whiteboard-view.js').then(
      (module) => {
        loaded = module;
        return module;
      },
      (error) => {
        pending = null;
        throw error;
      },
    );
  }
  return pending;
}

/**
 * Same contract as `renderWhiteboardView` of `whiteboard-view.js`.
 * @param {WhiteboardViewOptions} options
 * @returns {WhiteboardViewHandle}
 */
export function renderWhiteboardView(options) {
  if (loaded) return loaded.renderWhiteboardView(options);

  /** @type {WhiteboardViewHandle | null} */
  let view = null;
  let cancelled = false;
  const { container } = options;

  function start() {
    showChunkLoading(container, t('whiteboards.loading'));
    loadViewModule().then(
      (module) => {
        if (cancelled) return;
        view = module.renderWhiteboardView(options);
        window.Covenant?.init?.(container);
      },
      () => {
        if (cancelled) return;
        showChunkError(
          container,
          { title: t('whiteboards.loadFailed'), text: t('whiteboards.loadFailedText') },
          start,
        );
      },
    );
  }
  start();

  return {
    flushAndDestroy() {
      cancelled = true;
      view?.flushAndDestroy();
      view = null;
    },
    isDispatchingInline: () => view?.isDispatchingInline() ?? false,
  };
}

// The two windows of the app: the main one and the presenter window, which is the same page opened
// with `?view=presenter`.
import { presenterWindowName } from './names.js';

/** Whether this page is the presenter window. */
export function isPresenterWindow() {
  return new URLSearchParams(location.search).get('view') === 'presenter';
}

/** The address of the presenter window: this page, with `?view=presenter` and no hash. */
export function presenterUrl() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('view', 'presenter');
  return url.toString();
}

/**
 * Opens the presenter window, or brings the open one to the front (it has a name).
 * Must be called from a click or a key press, or the browser blocks the popup.
 */
export function openPresenterWindow() {
  window.open(presenterUrl(), presenterWindowName(), 'popup,width=1280,height=800');
}

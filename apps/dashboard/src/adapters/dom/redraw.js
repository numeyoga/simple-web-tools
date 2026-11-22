// Drawing a part of the page again when the data it shows changed, without losing the
// control the person was using.
//
// - The control that had the focus gets it back: every control that can have it carries a
//   `data-focus-key`, and the new one with the same key is focused (the caret is kept in a text
//   field).
// - The scroll position of the host is kept.
// - `schedule()` draws after the current event: a field that commits on `change` fires it before
//   the focus moves to the next control, and drawing at that moment would replace the control
//   that is about to get the focus.
// - While a mouse button or a finger is down, the drawing also waits for the release: the same
//   `change` fires on the mouse-down of the next click, and drawing then would replace the
//   button before the click reaches it.

import { initCovenant } from '@simple-web-tools/dom';

/** The drawings that wait for the pointer to be released. @type {Set<() => void>} */
const waiting = new Set();
let pointerDown = false;

function release() {
  pointerDown = false;
  // After the click handlers of this release.
  setTimeout(() => {
    for (const run of [...waiting]) {
      waiting.delete(run);
      run();
    }
  }, 0);
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => (pointerDown = true), true);
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  // A drag that ends outside the window sends no pointerup.
  window.addEventListener('blur', release);
}

/**
 * Keeps the host up to date with `build()`.
 * @param {HTMLElement} host
 * @param {() => Node | Node[]} build the new content
 * @returns {{ draw: () => void, schedule: () => void }} `draw` now; `schedule` once the pointer is up
 */
export function createRedraw(host, build) {
  let queued = false;
  function draw() {
    waiting.delete(draw);
    queued = false;
    const active = document.activeElement;
    const key =
      active instanceof HTMLElement && host.contains(active) ? active.dataset.focusKey : undefined;
    const caret =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        ? { start: active.selectionStart, end: active.selectionEnd }
        : null;
    const scroll = host.scrollTop;
    const content = build();
    host.replaceChildren(...(Array.isArray(content) ? content : [content]));
    initCovenant(host);
    host.scrollTop = scroll;
    if (key !== undefined) {
      const next = [...host.querySelectorAll('[data-focus-key]')].find(
        (node) => node instanceof HTMLElement && node.dataset.focusKey === key,
      );
      if (next instanceof HTMLElement) {
        next.focus({ preventScroll: true });
        if (caret && (next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement)) {
          try {
            next.setSelectionRange(caret.start, caret.end);
          } catch {
            // Not a field that has a caret.
          }
        }
      }
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    if (pointerDown) waiting.add(draw);
    else setTimeout(draw, 0);
  }
  return { draw, schedule };
}

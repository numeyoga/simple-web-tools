// What the main window and the presenter window say to each other on the BroadcastChannel.
//
//   STATE          main to presenter    the whole presentation, its image URLs and the current slide
//   SYNC           main to presenter    the current slide changed
//   COMMAND        presenter to main    go to the next or previous slide, or to a given one
//   REQUEST_STATE  presenter to main    "send me the state": the presenter has just opened
//
// A channel is open to every page of the origin, including the other apps, so nothing that comes
// in is trusted: `parseMessage` accepts a well-formed message and nothing else, and the HTML of a
// STATE is sanitized again by the receiver before it reaches the page.

/** @typedef {import('./parser.js').Presentation} Presentation */

/** The COMMAND messages the presenter window sends. */
export const Commands = Object.freeze({
  next: /** @type {const} */ ({ type: 'COMMAND', action: 'next' }),
  previous: /** @type {const} */ ({ type: 'COMMAND', action: 'previous' }),
  /** @param {number} index */
  goto: (index) => /** @type {const} */ ({ type: 'COMMAND', action: 'goto', index }),
});

export const MessageType = Object.freeze({
  STATE: 'STATE',
  SYNC: 'SYNC',
  COMMAND: 'COMMAND',
  REQUEST_STATE: 'REQUEST_STATE',
});

/**
 * @typedef {{ type: 'STATE', presentation: Presentation, assets: Record<string, string>, currentIndex: number }
 *   | { type: 'SYNC', currentIndex: number }
 *   | { type: 'COMMAND', action: 'next' | 'previous' | 'goto', index?: number }
 *   | { type: 'REQUEST_STATE' }} Message
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is number} */
function isIndex(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** @param {unknown} value @returns {value is Presentation} */
function isPresentation(value) {
  if (!isRecord(value) || !isRecord(value.meta) || !Array.isArray(value.slides)) return false;
  const { meta, slides } = value;
  if (!['title', 'description', 'author'].every((key) => typeof meta[key] === 'string')) {
    return false;
  }
  if (meta.theme !== 'light' && meta.theme !== 'dark') return false;
  if (meta.ratio !== 'fixed' && meta.ratio !== 'auto') return false;
  return (
    slides.length > 0 &&
    slides.every(
      (slide) =>
        isRecord(slide) &&
        typeof slide.html === 'string' &&
        isRecord(slide.notes) &&
        typeof slide.notes.public === 'string' &&
        typeof slide.notes.presenter === 'string' &&
        isRecord(slide.meta) &&
        typeof slide.meta.title === 'string' &&
        typeof slide.meta.description === 'string',
    )
  );
}

/** Object URLs of this origin only: a message cannot point an image at another address. @param {unknown} value */
function isAssetMap(value) {
  return (
    isRecord(value) &&
    Object.values(value).every((url) => typeof url === 'string' && url.startsWith('blob:'))
  );
}

/**
 * The message a received value stands for, or `null` when it is not one.
 * @param {unknown} data
 * @returns {Message | null}
 */
export function parseMessage(data) {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case MessageType.STATE:
      if (!isPresentation(data.presentation) || !isAssetMap(data.assets)) return null;
      if (!isIndex(data.currentIndex) || data.currentIndex >= data.presentation.slides.length) {
        return null;
      }
      return {
        type: 'STATE',
        presentation: data.presentation,
        assets: /** @type {Record<string, string>} */ (data.assets),
        currentIndex: data.currentIndex,
      };
    case MessageType.SYNC:
      return isIndex(data.currentIndex) ? { type: 'SYNC', currentIndex: data.currentIndex } : null;
    case MessageType.COMMAND:
      if (data.action === 'next' || data.action === 'previous') {
        return { type: 'COMMAND', action: data.action };
      }
      if (data.action === 'goto' && isIndex(data.index)) {
        return { type: 'COMMAND', action: 'goto', index: data.index };
      }
      return null;
    case MessageType.REQUEST_STATE:
      return { type: 'REQUEST_STATE' };
    default:
      return null;
  }
}

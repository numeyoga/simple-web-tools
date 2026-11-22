// The ways loading a presentation can fail. The core raises a code and the adapter writes the
// sentence in the language of the interface (decision 0002), so the core holds no text.

/**
 * @typedef {'no-main-file' | 'no-slides' | 'invalid-frontmatter' | 'source-too-large' | 'unreadable'} PresentationErrorCode
 */

export class PresentationError extends Error {
  /**
   * @param {PresentationErrorCode} code
   * @param {string} [detail] what the cause said, for the person who writes the file
   */
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'PresentationError';
    this.code = code;
    this.detail = detail;
  }
}

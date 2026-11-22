// Copies a text to the clipboard. The Clipboard API needs a secure context and the browser's
// permission; when it refuses, the caller says so (never a silent failure).

/**
 * @param {string} text
 * @returns {Promise<boolean>} whether the text was copied
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

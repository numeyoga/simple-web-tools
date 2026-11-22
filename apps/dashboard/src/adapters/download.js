// Saves a text in a file, through a `blob:` link followed by the browser as a download (which a
// strict CSP does not govern).

/**
 * @param {string} fileName
 * @param {string} text
 * @param {string} mime for example `text/plain;charset=utf-8`
 */
export function downloadText(fileName, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

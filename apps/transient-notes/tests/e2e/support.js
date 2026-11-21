// Helpers shared by the journeys. Black box: everything goes through the UI.
import { expect } from '@playwright/test';

/** The name of the main navigation, in the language of the interface (the suites run in French). */
const NAV_NAME = /^(Navigation principale|Main navigation)$/;

/**
 * The accessible name of a row of the tree (`Projets 0`): its label and its count. The buttons
 * around it (`Replier Projets`, `Nouvelle note dans Projets`) and the folders must not match.
 * @param {string} label `Toutes les notes`, `Projets`, `Domaines`, `Ressources` or `Archives`
 */
export function treeRowName(label) {
  return new RegExp(`^${label}\\s*\\d*$`);
}

/**
 * Opens the app with the network blocked: any request that is not for the local preview server
 * is aborted, so nothing can leave the machine (and `blockedHosts` must stay empty).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ errors: string[], blockedHosts: string[] }>} console errors and blocked URLs
 */
export async function openApp(page) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const blockedHosts = [];

  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const isExternal = /^https?:$/.test(url.protocol) && url.hostname !== '127.0.0.1';
    if (!isExternal) return route.continue();
    blockedHosts.push(url.hostname);
    return route.abort();
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The failed load of a blocked external resource is expected, and is not an app error.
    const hostName = m.location().url ? new URL(m.location().url).hostname : '';
    if (hostName && hostName !== '127.0.0.1') return;
    errors.push(`console.error: ${m.text()}`);
  });

  await page.goto('/');
  await waitForShell(page);
  return { errors, blockedHosts };
}

/**
 * Waits until the shell is up: the page title is the h1 of the current selection. Below 1024 px
 * the sidebar is a closed drawer, so it is only expected to be visible from there.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForShell(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 1024) {
    await expect(page.getByRole('navigation', { name: NAV_NAME })).toBeVisible();
  }
}

/**
 * Opens a selection from the sidebar. Below 1024 px the sidebar is a drawer: the menu button
 * opens it first, and choosing a selection closes it again.
 * @param {import('@playwright/test').Page} page
 * @param {string} label `Toutes les notes`, `Projets`, `Domaines`, `Ressources` or `Archives`
 */
export async function goToSelection(page, label) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  // The row is named by its label and its count; the folders and the buttons of a category
  // (`Replier Projets`, `Nouvelle note dans Projets`) must not match.
  await page
    .getByRole('navigation', { name: NAV_NAME })
    .getByRole('button', { name: treeRowName(label) })
    .click();
}

/**
 * Creates a note with the "New note" button of the top bar.
 * @param {import('@playwright/test').Page} page
 */
export async function createNote(page) {
  await page.getByRole('button', { name: /^(Nouvelle note|New note)$/ }).click();
}

/**
 * Opens the actions menu of a folder of the tree (below 1024 px the drawer opens first).
 * @param {import('@playwright/test').Page} page
 * @param {string} folderName
 * @returns the menu
 */
export async function openFolderMenu(page, folderName) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: `Actions du dossier « ${folderName} »` }).click();
  const popover = page.getByRole('menu', { name: `Actions du dossier « ${folderName} »` });
  await expect(popover).toBeVisible();
  return popover;
}

/**
 * Shows the notes list. On a narrow screen the editor replaces it while a note is open: the
 * back control brings it back.
 * @param {import('@playwright/test').Page} page
 */
export async function showNotesList(page) {
  const back = page.getByRole('button', { name: /^(Retour aux notes|Back to notes)$/ });
  if (await back.isVisible()) await back.click();
}

/**
 * Opens the workspaces dialog from the sidebar (below 1024 px the drawer opens first).
 * @param {import('@playwright/test').Page} page
 */
export async function openWorkspaces(page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: /^(Espace de travail|Workspace)/ }).click();
  const dialog = page.getByRole('dialog', { name: /^(Espaces de travail|Workspaces)$/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Waits until a workspace's IndexedDB holds a record of `collection` with `field === value`,
 * i.e. until the write has reached the disk.
 * @param {import('@playwright/test').Page} page
 * @param {string} collection store name (`notes`, `folders`...)
 * @param {string} fieldName field to look for
 * @param {string | null} value expected value of the field
 * @param {string} [workspaceId]
 */
export async function waitForWrite(page, collection, fieldName, value, workspaceId = 'default') {
  await expect
    .poll(() =>
      page.evaluate(
        ([w, c, f, v]) =>
          new Promise((resolve) => {
            const req = indexedDB.open(`transient-notes__${w}`);
            req.onerror = () => resolve(false);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction(c, 'readonly');
              const all = tx.objectStore(c).getAll();
              all.onsuccess = () => {
                db.close();
                resolve(all.result.some((r) => r[f] === v));
              };
            };
          }),
        [workspaceId, collection, fieldName, value],
      ),
    )
    .toBe(true);
}

/**
 * Collects what the browser reports about the page: CSP violations (the event of the document
 * and the console message), page errors and requests that leave the origin.
 * @param {import('@playwright/test').Page} page
 */
export async function watchPage(page) {
  /** @type {string[]} */
  const violations = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const external = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      // Read back through the exposed function below: it lives outside the page's own scripts.
      /** @type {any} */ (window).__reportCsp(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await page.exposeFunction('__reportCsp', (/** @type {string} */ text) => violations.push(text));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(m.text());
  });
  page.on('request', (request) => {
    const { protocol, origin } = new URL(request.url());
    if (/^https?:$/.test(protocol) && origin !== 'http://127.0.0.1:4175') external.push(origin);
  });
  return { violations, errors, external };
}

/** A 1 x 1 PNG picture, base64 encoded. */
export const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/**
 * Pastes a picture into the editor of the open note: a `paste` event whose clipboard holds a PNG
 * file, as the browser fires it after Ctrl+V on a copied image.
 * @param {import('@playwright/test').Page} page
 * @param {string} [name] the file name of the picture
 */
export async function pasteImage(page, name = 'capture.png') {
  const editor = page.getByRole('textbox', { name: /^(Contenu de la note|Note content)$/ });
  await editor.click();
  await editor.evaluate(
    (node, [base64, fileName]) => {
      const bytes = Uint8Array.from(atob(String(base64)), (c) => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], String(fileName), { type: 'image/png' }));
      node.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    },
    [PNG_BASE64, name],
  );
}

/**
 * Types in the title field and the body of the open note.
 * @param {import('@playwright/test').Page} page
 * @param {{ title?: string, body?: string }} text
 */
export async function writeNote(page, { title, body }) {
  if (title !== undefined) await page.getByRole('textbox', { name: /^(Titre|Title)$/ }).fill(title);
  if (body !== undefined) {
    const editor = page.getByRole('textbox', { name: /^(Contenu de la note|Note content)$/ });
    await editor.click();
    await page.keyboard.type(body);
  }
}

/**
 * Every record of a store of a workspace database, read straight from IndexedDB.
 * @param {import('@playwright/test').Page} page
 * @param {string} collection `notes`, `folders` or `assets`
 * @param {string} [workspaceId]
 * @returns {Promise<Record<string, any>[]>}
 */
export function readStore(page, collection, workspaceId = 'default') {
  return page.evaluate(
    ([w, c]) =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(`transient-notes__${w}`);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction(String(c), 'readonly').objectStore(String(c)).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result);
          };
        };
      }),
    [workspaceId, collection],
  );
}

/**
 * Waits until a note whose stored text (title and document) contains `text` is on disk.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @param {string} [workspaceId]
 */
export async function waitForStoredText(page, text, workspaceId = 'default') {
  await expect
    .poll(async () => JSON.stringify(await readStore(page, 'notes', workspaceId)))
    .toContain(text);
}

/** The local calendar date, `YYYY-MM-DD`, as a person reads it (never the UTC day). */
export function localDate() {
  const now = new Date();
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

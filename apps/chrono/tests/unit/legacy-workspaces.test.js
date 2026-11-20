// Workspaces of the version 1 list whose id the registry refuses (a hyphen left by the
// 40-character cut, a `-2` suffix after it, more than 40 characters): they get a valid id and
// their database `chrono__<old id>` is copied once into `chrono__<new id>`, never deleted.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { copyLegacyDatabases } from '../../src/adapters/legacy-databases.js';
import { createStore } from '../../src/adapters/store.js';
import { getRegistry, readLegacyWorkspaces } from '../../src/adapters/workspace-list.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { createV1Database, createV2Database, describeDatabase, readStore } from './support/idb.js';

// What the version 1 `slugify(label).slice(0, 40)` produced for these labels.
const LONG_LABEL = 'Refonte du site internet du client Martin Dupont'; // 48 characters
const LONG_ID = 'refonte-du-site-internet-du-client-marti'; // 40 characters
const LONG_DUPLICATE_ID = `${LONG_ID}-2`; // 42 characters: refused
const HYPHEN_LABEL = 'Suivi des heures du projet de migration cloud 2026';
const HYPHEN_ID = 'suivi-des-heures-du-projet-de-migration-'; // ends with "-": refused
const HYPHEN_DUPLICATE_ID = `${HYPHEN_ID}-2`; // contains "--": refused

const NOW = new Date(2026, 10, 18, 10, 0).getTime();

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: NOW });
});
afterEach(uninstallBrowser);

/** @param {string} id @param {string} title */
const v1Data = (id, title) => ({
  projets: [{ id: `p-${id}`, nom: title, couleur: '#000', client: '', archive: false }],
  todos: [{ id: `t-${id}`, titre: title, fait: false, projetId: null, echeance: null, creeLe: 1 }],
  sessions: [
    {
      id: `s-${id}`,
      projetId: `p-${id}`,
      description: 'work',
      debut: 10,
      dernierDebut: null,
      fin: 20,
      duree: 10,
      statut: 'terminee',
    },
  ],
  pointage: [{ id: `a-${id}`, type: 'arrivee', at: 5 }],
});

/** The version 1 storage of a user who had these workspaces. */
async function seedVersion1(active = 'default') {
  nav.localStorage.setItem(
    'chrono.workspaces',
    JSON.stringify([
      { id: 'default', label: 'Espace principal', creeLe: 1 },
      { id: LONG_ID, label: LONG_LABEL, creeLe: 2 },
      { id: LONG_DUPLICATE_ID, label: LONG_LABEL, creeLe: 3 },
      { id: HYPHEN_ID, label: HYPHEN_LABEL, creeLe: 4 },
      { id: HYPHEN_DUPLICATE_ID, label: HYPHEN_LABEL, creeLe: 5 },
    ]),
  );
  nav.localStorage.setItem('chrono.workspace.active', active);
  for (const id of ['default', LONG_ID, LONG_DUPLICATE_ID, HYPHEN_ID, HYPHEN_DUPLICATE_ID]) {
    await createV1Database(`chrono__${id}`, v1Data(id, `data of ${id}`));
  }
}

describe('the list', () => {
  test('every workspace of the version 1 list is kept, with a valid unique id', async () => {
    await seedVersion1();

    const list = getRegistry().list();

    expect(list.map((w) => [w.id, w.label])).toEqual([
      ['default', 'Espace principal'],
      [LONG_ID, LONG_LABEL],
      [LONG_ID.slice(0, 38) + '-2', LONG_LABEL],
      ['suivi-des-heures-du-projet-de-migration', HYPHEN_LABEL],
      ['suivi-des-heures-du-projet-de-migratio-2', HYPHEN_LABEL],
    ]);
  });

  test('the repaired ids are recorded with the old ones, and the version 1 keys stay', async () => {
    await seedVersion1();
    const rawList = nav.localStorage.getItem('chrono.workspaces');

    getRegistry();

    expect(readLegacyWorkspaces()).toEqual([
      { from: LONG_DUPLICATE_ID, to: LONG_ID.slice(0, 38) + '-2', copied: false },
      { from: HYPHEN_ID, to: 'suivi-des-heures-du-projet-de-migration', copied: false },
      { from: HYPHEN_DUPLICATE_ID, to: 'suivi-des-heures-du-projet-de-migratio-2', copied: false },
    ]);
    expect(nav.localStorage.getItem('chrono.workspaces')).toBe(rawList);
  });

  test('the active workspace follows its new id', async () => {
    await seedVersion1(HYPHEN_ID);

    expect(getRegistry().activeId()).toBe('suivi-des-heures-du-projet-de-migration');
  });
});

describe('the data', () => {
  test('is copied into the database of the new id, converted to the current version', async () => {
    await seedVersion1();
    getRegistry();

    await copyLegacyDatabases();

    const target = 'chrono__suivi-des-heures-du-projet-de-migration';
    expect(await readStore(target, 'projects')).toEqual([
      {
        id: `p-${HYPHEN_ID}`,
        name: `data of ${HYPHEN_ID}`,
        category: null,
        customColor: '#000000',
        client: '',
        archived: false,
      },
    ]);
    expect(await readStore(target, 'sessions')).toMatchObject([
      { id: `s-${HYPHEN_ID}`, projectId: `p-${HYPHEN_ID}`, status: 'done', start: 10, end: 20 },
    ]);
    expect(await readStore(target, 'attendance')).toEqual([
      { id: `a-${HYPHEN_ID}`, type: 'arrival', at: 5 },
    ]);
    expect(await describeDatabase(target)).toMatchObject({ version: 3 });
  });

  test('the 42-character duplicate keeps its own data, apart from the 40-character one', async () => {
    await seedVersion1();
    getRegistry();

    await copyLegacyDatabases();

    const duplicate = `chrono__${LONG_ID.slice(0, 38)}-2`;
    expect((await readStore(duplicate, 'projects')).map((p) => p.name)).toEqual([
      `data of ${LONG_DUPLICATE_ID}`,
    ]);
    expect(await indexedDB.databases()).not.toContainEqual({
      name: `chrono__${LONG_ID}`,
      version: 2,
    });
  });

  test('never deletes nor modifies the old database', async () => {
    await seedVersion1();
    getRegistry();

    await copyLegacyDatabases();

    expect(await describeDatabase(`chrono__${HYPHEN_ID}`)).toMatchObject({ version: 1 });
    expect((await readStore(`chrono__${HYPHEN_ID}`, 'projets')).map((p) => p.nom)).toEqual([
      `data of ${HYPHEN_ID}`,
    ]);
    expect(await readStore(`chrono__${HYPHEN_ID}`, 'pointage')).toHaveLength(1);
  });

  test('is copied once: a second run changes nothing', async () => {
    await seedVersion1();
    getRegistry();
    expect(await copyLegacyDatabases()).toBe(3);
    const target = 'chrono__suivi-des-heures-du-projet-de-migration';
    await createV2Database('chrono__other'); // unrelated

    expect(await copyLegacyDatabases()).toBe(0);

    expect(await readStore(target, 'projects')).toHaveLength(1);
    expect(readLegacyWorkspaces().every((w) => w.copied)).toBe(true);
  });

  test('is never written over a database that already holds data', async () => {
    await seedVersion1();
    getRegistry();
    const target = 'chrono__suivi-des-heures-du-projet-de-migration';
    await createV2Database(target, {
      projects: [{ id: 'mine', name: 'Mine', color: '#fff', client: '', archived: false }],
    });

    await copyLegacyDatabases();

    expect((await readStore(target, 'projects')).map((p) => p.name)).toEqual(['Mine']);
  });

  test('a workspace whose old database never existed does not create one', async () => {
    nav.localStorage.setItem(
      'chrono.workspaces',
      JSON.stringify([
        { id: 'default', label: 'A', creeLe: 1 },
        { id: 'x-', label: 'X', creeLe: 2 },
      ]),
    );
    getRegistry();

    await copyLegacyDatabases();

    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain('chrono__x-');
    expect(readLegacyWorkspaces()).toEqual([{ from: 'x-', to: 'x', copied: true }]);
  });

  test('shows up in the store of the repaired workspace', async () => {
    await seedVersion1(HYPHEN_ID);
    const store = createStore();

    await store.init();

    expect(store.state.projects.map((p) => p.name)).toEqual([`data of ${HYPHEN_ID}`]);
    expect(store.state.sessions).toHaveLength(1);
  });

  test('a read-only tab does not copy anything', async () => {
    await seedVersion1(HYPHEN_ID);
    // Another tab holds the write lock.
    void nav.locks.request('chrono-write-lock', {}, () => new Promise(() => {}));
    const reader = createStore();

    await reader.init();

    expect(reader.state.readOnly).toBe(true);
    expect(reader.state.projects).toEqual([]);
    expect(readLegacyWorkspaces().some((w) => w.copied)).toBe(false);
  });
});

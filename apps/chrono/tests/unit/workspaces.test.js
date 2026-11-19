// Workspace API: JSON import, creation (with optional demo data), removal and the storage
// names. The payloads of the import tests are the files of the former site (version 1,
// French fields): they are what users still have.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { WORKSPACES } from '../../src/adapters/workspaces.js';
import { databaseNameFor, wsLoadList, wsSetActiveId } from '../../src/adapters/workspace-list.js';
import { channelName, fallbackKey, legacyFallbackKey } from '../../src/adapters/names.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { readStore } from './support/idb.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const yesterday = new Date(2026, 10, 17, 9, 0).getTime();
/** A finished session, version 1. */
const S = {
  id: 's1',
  projetId: 'p1',
  description: '',
  debut: 1,
  dernierDebut: null,
  fin: 2,
  duree: 1,
  statut: 'terminee',
};

afterEach(uninstallBrowser);

describe('import', () => {
  test('writes the version 2 records into IndexedDB, from a version 1 file', async () => {
    installBrowser();

    await WORKSPACES.importJson('default', {
      data: {
        projets: [{ id: 'p1', nom: 'A' }],
        todos: [{ id: 't1', titre: 'x' }],
        sessions: [S],
        pointage: [{ id: 'pt1', type: 'arrivee', at: 5 }],
        activeId: 'zz',
      },
    });

    expect(await readStore('chrono__default', 'projects')).toEqual([{ id: 'p1', name: 'A' }]);
    expect((await readStore('chrono__default', 'sessions'))[0]).toMatchObject({
      id: 's1',
      status: 'done',
      start: 1,
      end: 2,
    });
    expect(await readStore('chrono__default', 'attendance')).toEqual([
      { id: 'pt1', type: 'arrival', at: 5 },
    ]);
  });

  test('everything invalid => error, nothing written', async () => {
    installBrowser();

    await expect(
      WORKSPACES.importJson('default', {
        projets: [{ nom: 'x' }],
        sessions: [{ id: 's', statut: 'nope' }],
      }),
    ).rejects.toThrow(/aucune donnée valide/);

    expect(indexedDB.databases ? await indexedDB.databases() : []).toEqual([]);
  });

  test('an empty but well-formed file => accepted', async () => {
    installBrowser();

    await WORKSPACES.importJson('default', { projets: [], sessions: [] });

    expect(await readStore('chrono__default', 'projects')).toEqual([]);
  });

  test('the imported todos (old format) are migrated', async () => {
    installBrowser({ now: NOW });
    const t = (/** @type {string} */ id, /** @type {string} */ echeance) => ({
      id,
      titre: id,
      fait: false,
      projetId: null,
      echeance,
      creeLe: yesterday,
    });

    await WORKSPACES.importJson('default', {
      data: { todos: [t('a', 'today'), t('b', 'nimporte'), t('c', '2026-11-30')] },
    });

    const saved = await readStore('chrono__default', 'todos');
    expect(
      saved
        .map((/** @type {{ id: string, dueDate: string | null }} */ x) => [x.id, x.dueDate])
        .sort(),
    ).toEqual([
      ['a', '2026-11-17'],
      ['b', null],
      ['c', '2026-11-30'],
    ]);
  });

  test("replaces the content of the workspace's database", async () => {
    installBrowser();
    const writer = createStore();
    await writer.init();
    writer.actions.addProject('Old');
    await writer.flush();
    const reader = createStore(); // a second tab, read-only
    await reader.init();

    await WORKSPACES.importJson('default', { data: { projets: [{ id: 'p1', nom: 'New' }] } });

    expect((await readStore('chrono__default', 'projects')).map((p) => p.name)).toEqual(['New']);
    // The import notifies the other tabs: they re-read the database.
    await vi.waitFor(() => expect(reader.state.projects.map((p) => p.name)).toEqual(['New']));
  });

  test('without IndexedDB it fails and writes nothing to localStorage', async () => {
    const nav = installBrowser({ indexedDB: false });
    const before = nav.localStorage.keys().sort();

    await expect(WORKSPACES.importJson('default', { data: { projets: [] } })).rejects.toMatchObject(
      {
        code: 'unavailable',
      },
    );

    // Only the default list of the workspace registry appears: no data key is written.
    expect(nav.localStorage.keys().filter((key) => !before.includes(key))).toEqual([
      'chrono-workspaces',
    ]);
  });
});

describe('workspaces', () => {
  test('a created workspace starts empty unless demo data is asked for', async () => {
    installBrowser();

    const plain = await WORKSPACES.create({ label: 'Perso' });
    await WORKSPACES.create({ label: 'Démo', seedDemo: true });

    expect(plain.id).toBe('perso');
    // Its database is created when the workspace is opened for the first time, and is empty.
    const databases = (await indexedDB.databases()).map((d) => d.name);
    expect(databases).toContain('chrono__demo');
    expect(databases).not.toContain('chrono__perso');
    expect((await readStore('chrono__demo', 'projects')).length).toBeGreaterThan(0);
  });

  test('removing a workspace deletes its database but never the old localStorage keys', async () => {
    const nav = installBrowser();
    await WORKSPACES.create({ label: 'Perso' });
    nav.localStorage.setItem(fallbackKey('perso'), '{}');
    nav.localStorage.setItem(legacyFallbackKey('perso'), '{}');

    await WORKSPACES.remove('perso');

    expect(nav.localStorage.getItem(fallbackKey('perso'))).toBe('{}');
    expect(nav.localStorage.getItem(legacyFallbackKey('perso'))).toBe('{}');
    expect(WORKSPACES.getList().map((w) => w.id)).toEqual(['default']);
  });

  test('rename keeps the label when the new one is blank; the last workspace stays', async () => {
    installBrowser();

    expect(WORKSPACES.rename('default', '   ').label).toBe('Espace principal');
    expect(WORKSPACES.rename('default', ' Travail ').label).toBe('Travail');
    await expect(WORKSPACES.remove('default')).rejects.toThrow(/dernier espace/);
  });
});

describe('storage names prefixed by the app (decision 0005)', () => {
  test('databases, fallback keys and channels start with "chrono"', () => {
    expect(databaseNameFor('abc')).toBe('chrono__abc');
    expect(fallbackKey('abc')).toBe('chrono-fallback-abc-v2');
    expect(channelName('abc')).toBe('chrono-sync-abc');
  });

  test('so do the list of workspaces and the active one', () => {
    const nav = installBrowser();

    wsLoadList();
    wsSetActiveId('default');

    expect(nav.localStorage.keys().sort()).toEqual([
      'chrono-workspace-active',
      'chrono-workspaces',
    ]);
  });
});

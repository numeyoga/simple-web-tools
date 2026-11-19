// Workspace API: JSON import (localStorage fallback and IndexedDB), the demo flag and the
// storage names. The payloads of the import tests are the files of the former site (version 1,
// French fields): they are what users still have.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { WORKSPACES } from '../../src/adapters/workspaces.js';
import {
  databaseNameFor,
  isDemoEnabled,
  wsLoadList,
  wsSetActiveId,
} from '../../src/adapters/workspace-list.js';
import { channelName, fallbackKey, legacyFallbackKey } from '../../src/adapters/names.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { readStore } from './support/idb.js';

const KEY = fallbackKey('default');
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

describe('import without IndexedDB', () => {
  test('writes the version 2 fallback to localStorage, and the store reads it back', async () => {
    const nav = installBrowser({ indexedDB: false });

    await WORKSPACES.importJson('default', {
      data: {
        projets: [{ id: 'p1', nom: 'A' }],
        todos: [{ id: 't1', titre: 'x' }],
        sessions: [S],
        pointage: [{ id: 'pt1', type: 'arrivee', at: 5 }],
        activeId: 'zz',
      },
    });

    const saved = JSON.parse(nav.localStorage.getItem(KEY) ?? 'null');
    expect(Object.keys(saved).sort()).toEqual(['attendance', 'projects', 'sessions', 'todos']);
    expect(saved.projects).toEqual([{ id: 'p1', name: 'A' }]);
    expect(saved.sessions[0]).toMatchObject({ id: 's1', status: 'done', start: 1, end: 2 });
    expect(saved.attendance).toEqual([{ id: 'pt1', type: 'arrival', at: 5 }]);
    const store = createStore();
    await store.init({ seedIfEmpty: false });
    expect(store.state.attendance).toHaveLength(1);
  });

  test('everything invalid => error, nothing written', async () => {
    const nav = installBrowser({ indexedDB: false });

    await expect(
      WORKSPACES.importJson('default', {
        projets: [{ nom: 'x' }],
        sessions: [{ id: 's', statut: 'nope' }],
      }),
    ).rejects.toThrow(/aucune donnée valide/);

    expect(nav.localStorage.getItem(KEY)).toBeNull();
  });

  test('an empty but well-formed file => accepted', async () => {
    const nav = installBrowser({ indexedDB: false });

    await WORKSPACES.importJson('default', { projets: [], sessions: [] });

    expect(JSON.parse(nav.localStorage.getItem(KEY) ?? 'null').projects).toHaveLength(0);
  });

  test('the imported todos (old format) are migrated', async () => {
    const nav = installBrowser({ indexedDB: false, now: NOW });
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

    const saved = JSON.parse(nav.localStorage.getItem(KEY) ?? 'null');
    expect(saved.todos.map((/** @type {{ dueDate: string | null }} */ x) => x.dueDate)).toEqual([
      '2026-11-17',
      null,
      '2026-11-30',
    ]);
  });
});

describe('import with IndexedDB', () => {
  test("replaces the content of the workspace's database", async () => {
    installBrowser();
    const store = createStore();
    await store.init({ seedIfEmpty: false });
    store.actions.addProject('Old');
    await store.flush();

    await WORKSPACES.importJson('default', { data: { projets: [{ id: 'p1', nom: 'New' }] } });

    expect((await readStore('chrono__default', 'projects')).map((p) => p.name)).toEqual(['New']);
    // The import notifies the other tabs: they re-read the database.
    await vi.waitFor(() => expect(store.state.projects.map((p) => p.name)).toEqual(['New']));
  });
});

describe('workspaces and the demo data flag', () => {
  test('a created workspace has no demo data unless asked, and removal forgets the flag', async () => {
    const nav = installBrowser({ indexedDB: false });

    const plain = WORKSPACES.create({ label: 'Perso' });
    const withDemo = WORKSPACES.create({ label: 'Démo', seedDemo: true });

    expect(plain.id).toBe('perso');
    expect(isDemoEnabled(plain.id)).toBe(false);
    expect(isDemoEnabled(withDemo.id)).toBe(true);
    expect(isDemoEnabled('default')).toBe(true);

    nav.localStorage.setItem(fallbackKey('perso'), '{}');
    nav.localStorage.setItem(legacyFallbackKey('perso'), '{}');
    await WORKSPACES.remove('perso');

    expect(isDemoEnabled('perso')).toBe(true);
    expect(nav.localStorage.getItem(fallbackKey('perso'))).toBeNull();
    expect(nav.localStorage.getItem(legacyFallbackKey('perso'))).toBeNull();
    expect(WORKSPACES.getList().map((w) => w.id)).toEqual(['default', 'demo']);
  });

  test('rename keeps the label when the new one is blank; the last workspace stays', async () => {
    installBrowser({ indexedDB: false });

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
    const nav = installBrowser({ indexedDB: false });

    wsLoadList();
    wsSetActiveId('default');

    expect(nav.localStorage.keys().sort()).toEqual([
      'chrono-workspace-active',
      'chrono-workspaces',
    ]);
  });
});

// The localStorage fallback of the former releases is imported once into IndexedDB and never
// written again; the keys are never deleted.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { WORKSPACES } from '../../src/adapters/workspaces.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { h } from './support/data.js';
import { readStore } from './support/idb.js';

const DB = 'chrono__default';
const KEY = 'chrono-fallback-default-v2';
const LEGACY_KEY = 'chrono.fallback.default.v1';
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const yesterday = new Date(2026, 10, 17, 9, 0).getTime();

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: h(9) });
});
afterEach(uninstallBrowser);

/** @param {string} id @param {string | null} dueDate */
const todo = (id, dueDate) => ({
  id,
  title: id,
  done: false,
  projectId: null,
  dueDate,
  createdAt: NOW,
});
const v2 = () =>
  JSON.stringify({
    projects: [{ id: 'p1', name: 'Alpha', color: '#000', client: '', archived: false }],
    todos: [todo('a', 'today'), todo('b', '2026-12-01')],
    sessions: [],
    attendance: [],
  });
const v1 = () =>
  JSON.stringify({
    projets: [{ id: 'p1', nom: 'Legacy', couleur: '#000', client: '', archive: false }],
    todos: [
      { id: 't1', titre: 'x', fait: false, projetId: 'p1', echeance: 'today', creeLe: yesterday },
    ],
    sessions: [
      {
        id: 's1',
        projetId: 'p1',
        description: '',
        debut: 1,
        dernierDebut: null,
        fin: 2,
        duree: 1,
        statut: 'terminee',
      },
    ],
    pointage: [{ id: 'a1', type: 'pause_debut', at: 3, sessionSuspendueId: 's1' }],
  });

/** The tab is closed and the app opened again: same databases, a new page. */
async function restart() {
  await uninstallBrowser();
  nav = installBrowser({ now: NOW });
}

async function newStore() {
  const store = createStore();
  await store.init();
  return store;
}
const metaKeys = async () => (await readStore(DB, 'meta')).map((m) => m.key).sort();

describe('a version 2 fallback and an empty database', () => {
  test('is imported into IndexedDB, with its old due dates migrated', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(KEY, v2());

    const store = await newStore();
    await store.flush();

    expect(store.state.projects.map((p) => p.name)).toEqual(['Alpha']);
    expect(store.state.todos.map((x) => x.dueDate)).toEqual(['2026-11-18', '2026-12-01']);
    expect((await readStore(DB, 'projects')).map((p) => p.name)).toEqual(['Alpha']);
    expect((await readStore(DB, 'todos')).map((x) => x.dueDate).sort()).toEqual([
      '2026-11-18',
      '2026-12-01',
    ]);
  });

  test('is recorded in meta and never imported twice', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(KEY, v2());
    const first = await newStore();
    const imported = await readStore(DB, 'meta');
    first.actions.deleteProject('p1');
    first.actions.deleteTodo('a');
    first.actions.deleteTodo('b');
    await first.flush();
    await restart();
    nav.localStorage.setItem(KEY, v2()); // the key is still there after a restart

    const second = await newStore();

    expect(imported).toEqual([{ key: 'fallbackImported', value: NOW }]);
    expect(second.state.projects).toEqual([]);
    expect(second.state.todos).toEqual([]);
  });

  test('never deletes the key and never writes it again', async () => {
    nav.localStorage.setItem(KEY, v2());
    nav.localStorage.setItem(LEGACY_KEY, v1());

    const store = await newStore();
    store.actions.addProject('Beta');
    await store.flush();

    expect(nav.localStorage.getItem(KEY)).toBe(v2());
    expect(nav.localStorage.getItem(LEGACY_KEY)).toBe(v1());
    expect(nav.localStorage.keys().sort()).toEqual(['chrono-workspaces', LEGACY_KEY, KEY].sort());
  });
});

describe('a version 1 fallback', () => {
  test('is converted to version 2, imported and left untouched', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(LEGACY_KEY, v1());

    const store = await newStore();
    await store.flush();

    expect(await readStore(DB, 'projects')).toEqual([
      { id: 'p1', name: 'Legacy', color: '#000', client: '', archived: false },
    ]);
    expect(store.state.todos[0]).toMatchObject({ title: 'x', dueDate: '2026-11-17' });
    expect(store.state.sessions[0]).toMatchObject({ projectId: 'p1', status: 'done', start: 1 });
    expect(await readStore(DB, 'attendance')).toEqual([
      { id: 'a1', type: 'break_start', at: 3, suspendedSessionIds: ['s1'] },
    ]);
    expect(nav.localStorage.getItem(LEGACY_KEY)).toBe(v1());
  });

  test('the version 2 key wins when both exist', async () => {
    nav.localStorage.setItem(KEY, v2());
    nav.localStorage.setItem(LEGACY_KEY, v1());

    const store = await newStore();

    expect(store.state.projects.map((p) => p.name)).toEqual(['Alpha']);
  });
});

describe('when the fallback must not come back', () => {
  test('a database that already has data is left alone, and the fallback is marked as skipped', async () => {
    const first = await newStore();
    first.actions.addProject('Mine');
    await first.flush();
    await restart();
    nav.localStorage.setItem(KEY, v2());

    const second = await newStore();

    expect(second.state.projects.map((p) => p.name)).toEqual(['Mine']);
    expect(await metaKeys()).toEqual(['fallbackSkipped']);
  });

  test('emptying the workspace afterwards does not bring the fallback back', async () => {
    const first = await newStore();
    first.actions.addProject('Mine');
    const id = first.state.projects[0]?.id ?? '';
    await first.flush();
    await restart();
    nav.localStorage.setItem(KEY, v2());
    const second = await newStore(); // skipped
    second.actions.deleteProject(id);
    await second.flush();
    await restart();
    nav.localStorage.setItem(KEY, v2());

    const again = await newStore();

    expect(again.state.projects).toEqual([]);
  });

  test('without a fallback key nothing is recorded', async () => {
    await newStore();

    expect(await metaKeys()).toEqual([]);
  });

  test('an unreadable fallback is ignored', async () => {
    nav.localStorage.setItem(KEY, '{broken');

    const store = await newStore();

    expect(store.state.projects).toEqual([]);
    expect(await metaKeys()).toEqual([]);
  });

  test('the fallback of a removed workspace does not return if its id is reused', async () => {
    await WORKSPACES.create({ label: 'Perso' });
    await uninstallBrowser();
    nav = installBrowser({ now: NOW });
    nav.localStorage.setItem('chrono-fallback-perso-v2', v2());
    const created = await WORKSPACES.create({ label: 'Perso' });
    expect(created.id).toBe('perso');
    await WORKSPACES.remove('perso');

    await WORKSPACES.create({ label: 'Perso' });
    WORKSPACES.switchTo('perso');
    const store = await newStore();

    expect(store.state.projects).toEqual([]);
    expect(nav.localStorage.getItem('chrono-fallback-perso-v2')).toBe(v2());
  });
});

// Store on the localStorage fallback (no IndexedDB): saving, reloading on the `storage` event,
// and migration of the old due dates.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { h } from './support/data.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';

const KEY = 'chrono-fallback-default-v2';
const LEGACY_KEY = 'chrono.fallback.default.v1';
// Wednesday 2026-11-18, 10:00.
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const yesterday = new Date(2026, 10, 17, 9, 0).getTime();
/**
 * @param {string} id
 * @param {string | null} dueDate
 * @param {number} [createdAt]
 */
const t = (id, dueDate, createdAt = NOW) => ({
  id,
  title: id,
  done: false,
  projectId: null,
  dueDate,
  createdAt,
});

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ indexedDB: false, now: h(9) });
});
afterEach(uninstallBrowser);

const readStored = () => JSON.parse(nav.localStorage.getItem(KEY) || 'null');
async function newStore() {
  const store = createStore();
  await store.init({ seedIfEmpty: false });
  return store;
}

describe('start', () => {
  test('the store loads and starts a timer', async () => {
    nav.setNow(NOW);
    const store = await newStore();

    const id = store.actions.startSession('p1', 'x');

    expect(store.activeSessions()).toHaveLength(1);
    expect(store.activeSessions()[0]?.id).toBe(id);
  });
});

describe('saving', () => {
  test('pagehide: immediate flush, without waiting for the 80 ms', async () => {
    const store = await newStore();

    store.actions.addProject('Alpha');
    expect(readStored()).toBeNull(); // not written yet
    nav.fire('pagehide');

    expect(readStored().projects).toHaveLength(1);
    expect(readStored().projects[0].name).toBe('Alpha');
  });

  test('pagehide without a change: writes nothing', async () => {
    await newStore();

    nav.fire('pagehide');

    expect(readStored()).toBeNull();
  });
});

describe('reload on the storage event', () => {
  test('the state is reloaded from localStorage, without losing the additions', async () => {
    const A = await newStore();
    const B = await newStore();
    B.actions.addProject('Beta');
    await B.flush();

    nav.fire('storage');
    await vi.waitFor(() => expect(A.state.projects.map((p) => p.name)).toEqual(['Beta']));

    A.actions.addProject('Alpha');
    await A.flush();
    expect(readStored().projects.map((/** @type {{ name: string }} */ p) => p.name)).toEqual([
      'Beta',
      'Alpha',
    ]);
  });

  test('emits the state after a reload', async () => {
    const A = await newStore();
    const B = await newStore();
    B.actions.addProject('Beta');
    await B.flush();
    let n = 0;
    A.onState(() => n++);

    await A.reloadFromStorage();

    expect(n).toBe(1);
  });
});

describe('due-date migration', () => {
  test('init: an old format is migrated in memory AND rewritten', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(
      KEY,
      JSON.stringify({
        projects: [],
        sessions: [],
        attendance: [],
        todos: [
          t('a', 'today', yesterday),
          t('b', 'fri', NOW),
          t('c', '2026-12-01'),
          t('d', null),
          t('e', 'zzz'),
        ],
      }),
    );

    const store = await newStore();

    expect(store.state.todos.map((x) => x.dueDate)).toEqual([
      '2026-11-17',
      '2026-11-20',
      '2026-12-01',
      null,
      null,
    ]);
    await store.flush(); // scheduleSave('todos') was called after state.loaded = true
    expect(
      readStored().todos.map((/** @type {{ dueDate: string | null }} */ x) => x.dueDate),
    ).toEqual(['2026-11-17', '2026-11-20', '2026-12-01', null, null]);
  });

  test('init: already migrated data => no rewrite', async () => {
    nav.setNow(NOW);
    const raw = JSON.stringify({
      projects: [],
      sessions: [],
      attendance: [],
      todos: [t('a', '2026-11-18'), t('b', null)],
    });
    nav.localStorage.setItem(KEY, raw);
    const store = await newStore();

    await store.flush();

    expect(nav.localStorage.getItem(KEY)).toBe(raw);
  });

  test('reloadFromStorage: re-reads and migrates', async () => {
    nav.setNow(NOW);
    const store = await newStore();
    nav.localStorage.setItem(
      KEY,
      JSON.stringify({
        projects: [],
        sessions: [],
        attendance: [],
        todos: [t('a', 'tomorrow', yesterday)],
      }),
    );

    await store.reloadFromStorage();

    expect(store.state.todos[0]?.dueDate).toBe('2026-11-18');
    await store.flush();
    expect(readStored().todos[0].dueDate).toBe('2026-11-18');
  });
});

describe('demo data', () => {
  test('the first start without data creates it, with YYYY-MM-DD due dates', async () => {
    nav.setNow(NOW);
    const store = createStore();

    await store.init();

    expect(store.state.projects).toHaveLength(6);
    expect(store.state.todos.find((x) => x.id === 't5')?.dueDate).toBe('2026-11-18');
    expect(store.activeSessions().map((s) => s.id)).toEqual(['s14', 's15']);
  });
});

describe('fallback written by version 1', () => {
  /** The former layout: French fields, under the `chrono.fallback.<id>.v1` key. */
  const legacy = () =>
    JSON.stringify({
      projets: [{ id: 'p1', nom: 'Alpha', couleur: '#000', client: '', archive: false }],
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

  test('is read and converted to version 2, and left untouched', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(LEGACY_KEY, legacy());

    const store = await newStore();

    expect(store.state.projects).toEqual([
      { id: 'p1', name: 'Alpha', color: '#000', client: '', archived: false },
    ]);
    expect(store.state.todos[0]).toMatchObject({ title: 'x', done: false, dueDate: '2026-11-17' });
    expect(store.state.sessions[0]).toMatchObject({ projectId: 'p1', status: 'done', start: 1 });
    expect(store.state.attendance).toEqual([
      { id: 'a1', type: 'break_start', at: 3, suspendedSessionIds: ['s1'] },
    ]);
    await store.flush();
    expect(nav.localStorage.getItem(LEGACY_KEY)).toBe(legacy());
  });

  test('the next save writes the version 2 key, and it wins afterwards', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(LEGACY_KEY, legacy());
    const store = await newStore();

    store.actions.addProject('Beta');
    await store.flush();

    expect(readStored().projects.map((/** @type {{ name: string }} */ p) => p.name)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(nav.localStorage.getItem(LEGACY_KEY)).toBe(legacy());
    expect((await newStore()).state.projects).toHaveLength(2);
  });
});

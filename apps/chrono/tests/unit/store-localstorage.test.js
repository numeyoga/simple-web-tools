// Store on the localStorage fallback (no IndexedDB): saving, reloading on the `storage` event,
// and migration of the old due dates.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { h } from './support/data.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';

const KEY = 'chrono.fallback.default.v1';
// Wednesday 2026-11-18, 10:00.
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const hier = new Date(2026, 10, 17, 9, 0).getTime();
/**
 * @param {string} id
 * @param {string | null} echeance
 * @param {number} [creeLe]
 */
const t = (id, echeance, creeLe = NOW) => ({
  id,
  titre: id,
  fait: false,
  projetId: null,
  echeance,
  creeLe,
});

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ indexedDB: false, now: h(9) });
});
afterEach(uninstallBrowser);

const lu = () => JSON.parse(nav.localStorage.getItem(KEY) || 'null');
async function nouveauStore() {
  const store = createStore();
  await store.init({ seedIfEmpty: false });
  return store;
}

describe('démarrage', () => {
  test('le store se charge et démarre un chrono', async () => {
    nav.setNow(NOW);
    const store = await nouveauStore();

    const id = store.actions.demarrer('p1', 'x');

    expect(store.sessionsActives()).toHaveLength(1);
    expect(store.sessionsActives()[0]?.id).toBe(id);
  });
});

describe('sauvegarde', () => {
  test('pagehide : flush immédiat, sans attendre les 80 ms', async () => {
    const store = await nouveauStore();

    store.actions.ajouterProjet('Alpha');
    expect(lu()).toBeNull(); // pas encore écrit
    nav.fire('pagehide');

    expect(lu().projets).toHaveLength(1);
    expect(lu().projets[0].nom).toBe('Alpha');
  });

  test("pagehide sans modification : n'écrit rien", async () => {
    await nouveauStore();

    nav.fire('pagehide');

    expect(lu()).toBeNull();
  });
});

describe("rechargement sur l'événement storage", () => {
  test("l'état est rechargé depuis localStorage, sans perdre les ajouts", async () => {
    const A = await nouveauStore();
    const B = await nouveauStore();
    B.actions.ajouterProjet('Beta');
    await B.flush();

    nav.fire('storage');
    await vi.waitFor(() => expect(A.state.projets.map((p) => p.nom)).toEqual(['Beta']));

    A.actions.ajouterProjet('Alpha');
    await A.flush();
    expect(lu().projets.map((/** @type {{ nom: string }} */ p) => p.nom)).toEqual([
      'Beta',
      'Alpha',
    ]);
  });

  test("émet l'état après rechargement", async () => {
    const A = await nouveauStore();
    const B = await nouveauStore();
    B.actions.ajouterProjet('Beta');
    await B.flush();
    let n = 0;
    A.onState(() => n++);

    await A.recharger();

    expect(n).toBe(1);
  });
});

describe('migration des échéances', () => {
  test('init : un ancien format est migré en mémoire ET réécrit', async () => {
    nav.setNow(NOW);
    nav.localStorage.setItem(
      KEY,
      JSON.stringify({
        projets: [],
        sessions: [],
        pointage: [],
        todos: [
          t('a', 'today', hier),
          t('b', 'fri', NOW),
          t('c', '2026-12-01'),
          t('d', null),
          t('e', 'zzz'),
        ],
      }),
    );

    const store = await nouveauStore();

    expect(store.state.todos.map((x) => x.echeance)).toEqual([
      '2026-11-17',
      '2026-11-20',
      '2026-12-01',
      null,
      null,
    ]);
    await store.flush(); // scheduleSave('todos') a été appelé après state.loaded = true
    expect(lu().todos.map((/** @type {{ echeance: string | null }} */ x) => x.echeance)).toEqual([
      '2026-11-17',
      '2026-11-20',
      '2026-12-01',
      null,
      null,
    ]);
  });

  test('init : données déjà migrées => aucune réécriture', async () => {
    nav.setNow(NOW);
    const brut = JSON.stringify({
      projets: [],
      sessions: [],
      pointage: [],
      todos: [t('a', '2026-11-18'), t('b', null)],
    });
    nav.localStorage.setItem(KEY, brut);
    const store = await nouveauStore();

    await store.flush();

    expect(nav.localStorage.getItem(KEY)).toBe(brut);
  });

  test('recharger : relit et migre', async () => {
    nav.setNow(NOW);
    const store = await nouveauStore();
    nav.localStorage.setItem(
      KEY,
      JSON.stringify({
        projets: [],
        sessions: [],
        pointage: [],
        todos: [t('a', 'tomorrow', hier)],
      }),
    );

    await store.recharger();

    expect(store.state.todos[0]?.echeance).toBe('2026-11-18');
    await store.flush();
    expect(lu().todos[0].echeance).toBe('2026-11-18');
  });
});

describe('données de démonstration', () => {
  test('le premier démarrage sans données les crée, avec des échéances AAAA-MM-JJ', async () => {
    nav.setNow(NOW);
    const store = createStore();

    await store.init();

    expect(store.state.projets).toHaveLength(6);
    expect(store.state.todos.find((x) => x.id === 't5')?.echeance).toBe('2026-11-18');
    expect(store.sessionsActives().map((s) => s.id)).toEqual(['s14', 's15']);
  });
});

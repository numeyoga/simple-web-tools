// Store on IndexedDB (fake-indexeddb): differential writes, two tabs, migration on load.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { h } from './support/data.js';
import { lire, preparer } from './support/idb.js';

const DB = 'chrono__default';
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const hier = new Date(2026, 10, 17, 9, 0).getTime();

/** Write operations seen by IndexedDB: ['put' | 'delete' | 'clear', store, key?]. */
/** @type {(string | undefined)[][]} */
let ops = [];

beforeEach(() => {
  installBrowser({ now: h(9) });
});
afterEach(uninstallBrowser);

/** Starts recording the write operations (from now on). */
function espionner() {
  ops = [];
  const proto = IDBObjectStore.prototype;
  const put = proto.put;
  const supprimer = proto.delete;
  const clear = proto.clear;
  /**
   * @this {IDBObjectStore}
   * @param {{ id: string }} value
   * @param {IDBValidKey} [key]
   */
  function enregistrerPut(value, key) {
    ops.push(['put', this.name, value.id]);
    return put.call(this, value, key);
  }
  /**
   * @this {IDBObjectStore}
   * @param {IDBValidKey | IDBKeyRange} key
   */
  function enregistrerDelete(key) {
    ops.push(['delete', this.name, String(key)]);
    return supprimer.call(this, key);
  }
  /** @this {IDBObjectStore} */
  function enregistrerClear() {
    ops.push(['clear', this.name]);
    return clear.call(this);
  }
  vi.spyOn(proto, 'put').mockImplementation(enregistrerPut);
  vi.spyOn(proto, 'delete').mockImplementation(enregistrerDelete);
  vi.spyOn(proto, 'clear').mockImplementation(enregistrerClear);
}

async function nouveauStore() {
  const store = createStore();
  await store.init({ seedIfEmpty: false });
  return store;
}

const noms = async (/** @type {string} */ collection) =>
  (await lire(DB, collection)).map((x) => x.nom).sort();

describe('deux onglets', () => {
  test("aucun n'efface les ajouts de l'autre", async () => {
    const A = await nouveauStore();
    const B = await nouveauStore();
    espionner();

    A.actions.ajouterProjet('Alpha');
    B.actions.ajouterProjet('Beta');
    await A.flush();
    await B.flush();

    expect(await noms('projets')).toEqual(['Alpha', 'Beta']);
    expect(ops.some((o) => o[0] === 'clear')).toBe(false);
    // Rechargement via BroadcastChannel : chaque onglet voit tout.
    await vi.waitFor(() => {
      expect(A.state.projets.map((p) => p.nom).sort()).toEqual(['Alpha', 'Beta']);
      expect(B.state.projets.map((p) => p.nom).sort()).toEqual(['Alpha', 'Beta']);
    });
  });

  test("à la réception, l'onglet vide d'abord ses écritures en attente puis relit", async () => {
    const A = await nouveauStore();
    const B = await nouveauStore();
    B.actions.ajouterProjet('Beta');
    await B.flush();

    A.actions.ajouterProjet('Alpha'); // en attente (timer 80 ms) quand le message de B arrive

    await vi.waitFor(async () => {
      expect(await noms('projets')).toEqual(['Alpha', 'Beta']);
      expect(A.state.projets.map((p) => p.nom).sort()).toEqual(['Alpha', 'Beta']);
    });
  });
});

describe('écriture différentielle', () => {
  test('put des seuls objets modifiés, delete des supprimés', async () => {
    const A = await nouveauStore();
    const a = A.actions.ajouterProjet('Alpha');
    A.actions.ajouterProjet('Beta');
    await A.flush();
    espionner();

    A.actions.majProjet(a, { nom: 'Alpha2' });
    await A.flush();

    expect(ops).toEqual([['put', 'projets', a]]);

    ops.length = 0;
    A.actions.supprimerProjet(a);
    await A.flush();

    expect(ops).toEqual([['delete', 'projets', a]]);
    expect(await noms('projets')).toEqual(['Beta']);
  });
});

describe('migration des échéances au chargement', () => {
  test('init migre les anciennes échéances et ne réécrit que les todos changés', async () => {
    vi.setSystemTime(NOW);
    // Base préremplie en ancien format.
    await preparer(DB, {
      projets: [{ id: 'p1', nom: 'A' }],
      todos: [
        { id: 'a', titre: 'a', fait: false, echeance: 'today', creeLe: hier },
        { id: 'b', titre: 'b', fait: false, echeance: '2026-12-01', creeLe: hier },
      ],
    });
    espionner();

    const store = await nouveauStore();
    expect(store.state.todos.find((x) => x.id === 'a')?.echeance).toBe('2026-11-17');
    expect(store.state.todos.find((x) => x.id === 'b')?.echeance).toBe('2026-12-01');

    await store.flush();

    const stockes = await lire(DB, 'todos');
    expect(stockes.find((x) => x.id === 'a').echeance).toBe('2026-11-17');
    expect(ops.filter((o) => o[0] === 'put' && o[1] === 'todos').map((o) => o[2])).toEqual(['a']);
  });
});

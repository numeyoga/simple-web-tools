// Migration des échéances relatives au chargement IndexedDB (faux IndexedDB en mémoire).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

function fakeIDB() {
  const bases = new Map(); const ops = [];
  const later = fn => setTimeout(fn, 0);
  const idb = {
    ops,
    open(nom) {
      const req = {};
      later(() => {
        let db = bases.get(nom); const neuf = !db;
        if (neuf) {
          const stores = new Map();
          db = {
            stores, objectStoreNames: { contains: n => stores.has(n) },
            createObjectStore: (n, { keyPath }) => stores.set(n, { keyPath, data: new Map() }),
            close() {},
            transaction(noms) {
              const tx = {}; const liste = [].concat(noms);
              tx.objectStore = n => {
                const st = stores.get(n); const cle = v => v[st.keyPath];
                const rq = fn => { const r = {}; later(() => { r.result = fn(); r.onsuccess?.(); }); return r; };
                return {
                  getAll: () => rq(() => [...st.data.values()]),
                  get: k => rq(() => st.data.get(k)),
                  put: v => { ops.push(['put', n, cle(v)]); st.data.set(cle(v), v); },
                  delete: k => { ops.push(['delete', n, k]); st.data.delete(k); },
                  clear: () => { ops.push(['clear', n]); st.data.clear(); },
                };
              };
              later(() => later(() => tx.oncomplete?.()));
              return tx;
            },
          };
          bases.set(nom, db);
        }
        req.result = db;
        if (neuf) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
  return idb;
}

const NOW = new Date(2026, 10, 18, 9, 0).getTime();
const hier = new Date(2026, 10, 17, 9, 0).getTime();
const pause = (ms = 30) => new Promise(r => setTimeout(r, ms));

test('IDB : init migre les anciennes échéances et ne réécrit que les todos changés', async () => {
  const app = loadApp({ scripts: ['lib.js', 'db.js', 'Todos.js'], now: NOW });
  app.indexedDB = fakeIDB();
  // Base préremplie en ancien format via un premier import brut dans le faux IDB.
  const q = app.indexedDB.open('chrono__default');
  const db = await new Promise(r => { q.onsuccess = () => r(q.result); });
  for (const n of ['projets', 'todos', 'sessions', 'pointage']) db.createObjectStore(n, { keyPath: 'id' });
  db.createObjectStore('meta', { keyPath: 'key' });
  const put = (n, v) => db.stores.get(n).data.set(v.id, v);
  put('projets', { id: 'p1', nom: 'A' });
  put('todos', { id: 'a', titre: 'a', fait: false, echeance: 'today', creeLe: hier });
  put('todos', { id: 'b', titre: 'b', fait: false, echeance: '2026-12-01', creeLe: hier });

  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  assert.equal(store.state.todos.find(t => t.id === 'a').echeance, '2026-11-17');
  assert.equal(store.state.todos.find(t => t.id === 'b').echeance, '2026-12-01');

  await store.flush(); await pause();
  assert.equal(db.stores.get('todos').data.get('a').echeance, '2026-11-17');
  const ecrits = app.indexedDB.ops.filter(o => o[0] === 'put' && o[1] === 'todos').map(o => o[2]);
  assert.deepEqual([...ecrits], ['a']);
});

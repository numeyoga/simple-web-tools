// Écriture différentielle IndexedDB + synchro multi-onglets, avec un IndexedDB et
// un BroadcastChannel factices (en mémoire) injectés dans le contexte vm.
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

function fakeBC() {
  const reg = [];
  return class {
    constructor(nom) { this.nom = nom; reg.push(this); }
    postMessage(data) { for (const c of reg) if (c !== this && c.nom === this.nom) setTimeout(() => c.onmessage?.({ data }), 0); }
    close() {}
  };
}

const pause = (ms = 30) => new Promise(r => setTimeout(r, ms));

async function setup() {
  const app = loadApp({ now: new Date(2026, 10, 18, 9, 0).getTime() });
  app.indexedDB = fakeIDB();
  app.BroadcastChannel = fakeBC();
  const A = app.createStore(); await A.init({ seedIfEmpty: false });
  const B = app.createStore(); await B.init({ seedIfEmpty: false });
  return { app, A, B };
}
const contenu = async (app, store) => {
  const db = await new Promise(r => { const q = app.indexedDB.open('chrono__default'); q.onsuccess = () => r(q.result); });
  return [...db.stores.get(store).data.values()].map(x => x.nom);
};

test('IDB : deux onglets, aucun n\'efface les ajouts de l\'autre', async () => {
  const { app, A, B } = await setup();
  A.actions.ajouterProjet('Alpha');
  B.actions.ajouterProjet('Beta');
  await A.flush(); await B.flush(); await pause();
  assert.deepEqual([...(await contenu(app, 'projets'))].sort(), ['Alpha', 'Beta']);
  assert.ok(!app.indexedDB.ops.some(o => o[0] === 'clear'));
  // Rechargement via BroadcastChannel : chaque onglet voit tout.
  assert.deepEqual([...A.state.projets.map(p => p.nom)].sort(), ['Alpha', 'Beta']);
  assert.deepEqual([...B.state.projets.map(p => p.nom)].sort(), ['Alpha', 'Beta']);
});

test('IDB : flush différentiel (put des seuls objets modifiés, delete des supprimés)', async () => {
  const { app, A } = await setup();
  const a = A.actions.ajouterProjet('Alpha'); A.actions.ajouterProjet('Beta');
  await A.flush();
  app.indexedDB.ops.length = 0;
  A.actions.majProjet(a, { nom: 'Alpha2' });
  await A.flush();
  assert.equal(app.indexedDB.ops.length, 1);
  assert.deepEqual([...app.indexedDB.ops[0]], ['put', 'projets', a]);
  app.indexedDB.ops.length = 0;
  A.actions.supprimerProjet(a);
  await A.flush();
  assert.deepEqual([...app.indexedDB.ops[0]], ['delete', 'projets', a]);
  assert.equal(app.indexedDB.ops.length, 1);
  assert.deepEqual([...(await contenu(app, 'projets'))], ['Beta']);
});

test('IDB : à la réception, l\'onglet vide d\'abord ses écritures en attente puis relit', async () => {
  const { app, A, B } = await setup();
  B.actions.ajouterProjet('Beta'); await B.flush();
  A.actions.ajouterProjet('Alpha');           // en attente (timer 80 ms)
  await pause(30);                             // le message de B arrive
  assert.deepEqual([...(await contenu(app, 'projets'))].sort(), ['Alpha', 'Beta']);
  assert.deepEqual([...A.state.projets.map(p => p.nom)].sort(), ['Alpha', 'Beta']);
});

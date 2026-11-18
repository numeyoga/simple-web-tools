// Migration des échéances relatives ('today', 'fri'...) vers des dates 'AAAA-MM-JJ'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const KEY = 'chrono.fallback.default.v1';
// Mercredi 18 novembre 2026, 10h00.
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const hier = new Date(2026, 10, 17, 9, 0).getTime();
const il = (j, h = 9) => new Date(2026, 10, 18 + j, h, 0).getTime();
const t = (id, echeance, creeLe = NOW) => ({ id, titre: id, fait: false, projetId: null, echeance, creeLe });

test('migrerEcheancesTodos : étiquettes relatives ancrées sur creeLe', () => {
  const app = loadApp({ now: NOW });
  const { todos, change } = app.migrerEcheancesTodos([
    t('a', 'today', hier),          // créé hier -> hier
    t('b', 'tomorrow', hier),       // -> aujourd'hui
    t('c', 'fri', NOW),             // mercredi -> vendredi 20
    t('d', 'fri', il(-7)),          // mercredi 11 -> vendredi 13 (reste « en retard »)
    t('e', 'mon', NOW),             // -> lundi 23
    t('f', 'sun', NOW),             // -> dimanche 22
    t('g', 'week', NOW),            // +6 jours -> 24
  ]);
  assert.equal(change, true);
  assert.deepEqual([...todos.map(x => x.echeance)], [
    '2026-11-17', '2026-11-18', '2026-11-20', '2026-11-13', '2026-11-23', '2026-11-22', '2026-11-24',
  ]);
});

test('migrerEcheancesTodos : ISO et null intacts, inconnu -> null, références préservées', () => {
  const app = loadApp({ now: NOW });
  const a = t('a', '2026-12-25'), b = t('b', null), c = t('c', 'bizarre'), d = t('d', 'today', hier);
  const { todos, change } = app.migrerEcheancesTodos([a, b, c, d]);
  assert.equal(change, true);
  assert.equal(todos[0], a);              // même objet : pas de réécriture IndexedDB inutile
  assert.equal(todos[1], b);
  assert.equal(todos[2].echeance, null);
  assert.equal(todos[3].echeance, '2026-11-17');
  assert.equal(c.echeance, 'bizarre');    // l'entrée n'est pas mutée
  assert.equal(d.echeance, 'today');
});

test('migrerEcheancesTodos : rien à faire => change false ; idempotente', () => {
  const app = loadApp({ now: NOW });
  const liste = [t('a', '2026-12-25'), t('b', null)];
  const r = app.migrerEcheancesTodos(liste);
  assert.equal(r.change, false);
  assert.equal(r.todos, liste); // même tableau, rien recréé
  const r1 = app.migrerEcheancesTodos([t('c', 'tomorrow', hier)]);
  const r2 = app.migrerEcheancesTodos(r1.todos);
  assert.equal(r2.change, false);
});

test('migrerEcheancesTodos : date impossible -> null ; creeLe absent -> maintenant ; pas un tableau', () => {
  const app = loadApp({ now: NOW });
  const { todos } = app.migrerEcheancesTodos([t('a', '2026-02-30'), { id: 'b', titre: 'b', echeance: 'tomorrow' }]);
  assert.equal(todos[0].echeance, null);
  assert.equal(todos[1].echeance, '2026-11-19');
  const r = app.migrerEcheancesTodos(undefined);
  assert.equal(r.todos, undefined);
  assert.equal(r.change, false);
});

test('init (localStorage) : un ancien format est migré en mémoire ET réécrit', async () => {
  const app = loadApp({ scripts: ['lib.js', 'db.js', 'Todos.js'], now: NOW });
  app.localStorage.setItem(KEY, JSON.stringify({
    projets: [], sessions: [], pointage: [],
    todos: [t('a', 'today', hier), t('b', 'fri', NOW), t('c', '2026-12-01'), t('d', null), t('e', 'zzz')],
  }));
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  assert.deepEqual([...store.state.todos.map(x => x.echeance)], ['2026-11-17', '2026-11-20', '2026-12-01', null, null]);
  assert.equal(app.UI.todos.bucket(store.state.todos[0]), 'overdue'); // sens d'origine conservé

  await store.flush(); // scheduleSave('todos') a été appelé après state.loaded = true
  const saved = JSON.parse(app.localStorage.getItem(KEY));
  assert.deepEqual(saved.todos.map(x => x.echeance), ['2026-11-17', '2026-11-20', '2026-12-01', null, null]);
});

test('init (localStorage) : données déjà migrées => aucune réécriture', async () => {
  const app = loadApp({ now: NOW });
  const brut = JSON.stringify({ projets: [], sessions: [], pointage: [], todos: [t('a', '2026-11-18'), t('b', null)] });
  app.localStorage.setItem(KEY, brut);
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  await store.flush();
  assert.equal(app.localStorage.getItem(KEY), brut);
});

test('seed : produit directement des dates AAAA-MM-JJ', async () => {
  const app = loadApp({ now: NOW });
  const store = app.createStore();
  await store.init({ seedIfEmpty: true });
  for (const x of store.state.todos) assert.ok(x.echeance === null || /^\d{4}-\d{2}-\d{2}$/.test(x.echeance), x.echeance);
  assert.equal(store.state.todos.find(x => x.id === 't5').echeance, '2026-11-18'); // « today » créé aujourd'hui
});

test('recharger (localStorage) : relit et migre', async () => {
  const app = loadApp({ now: NOW });
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  app.localStorage.setItem(KEY, JSON.stringify({
    projets: [], sessions: [], pointage: [], todos: [t('a', 'tomorrow', hier)],
  }));
  await store.recharger();
  assert.equal(store.state.todos[0].echeance, '2026-11-18');
  await store.flush();
  assert.equal(JSON.parse(app.localStorage.getItem(KEY)).todos[0].echeance, '2026-11-18');
});

test('import JSON : les todos importés (ancien format) sont migrés', async () => {
  const app = loadApp({ now: NOW });
  await app.WORKSPACES.importJSON('default', { data: {
    projets: [], sessions: [], pointage: [],
    todos: [t('a', 'today', hier), t('b', 'nimporte'), t('c', '2026-11-30')],
  } });
  const saved = JSON.parse(app.localStorage.getItem(KEY));
  assert.deepEqual(saved.todos.map(x => x.echeance), ['2026-11-17', null, '2026-11-30']);
});

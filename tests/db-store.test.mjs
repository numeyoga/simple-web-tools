// Sauvegarde : pagehide, rechargement sur l'événement storage (repli localStorage).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const KEY = 'chrono.fallback.default.v1';
const lu = app => JSON.parse(app.localStorage.getItem(KEY) || 'null');

async function setup() {
  const app = loadApp({ now: new Date(2026, 10, 18, 9, 0).getTime() });
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  return { app, store };
}

test('pagehide : flush immédiat, sans attendre les 80 ms', async () => {
  const { app, store } = await setup();
  store.actions.ajouterProjet('Alpha');
  assert.equal(lu(app), null);                 // pas encore écrit
  app.fire('pagehide');
  assert.equal(lu(app).projets.length, 1);
  assert.equal(lu(app).projets[0].nom, 'Alpha');
});

test('pagehide sans modification : n\'écrit rien', async () => {
  const { app } = await setup();
  app.fire('pagehide');
  assert.equal(lu(app), null);
});

test('storage : l\'état est rechargé depuis localStorage, sans perdre les ajouts', async () => {
  const { app, store: A } = await setup();
  const B = app.createStore();
  await B.init({ seedIfEmpty: false });
  B.actions.ajouterProjet('Beta');
  await B.flush();
  app.fire('storage');
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual([...A.state.projets.map(p => p.nom)], ['Beta']);
  A.actions.ajouterProjet('Alpha');
  await A.flush();
  assert.deepEqual(lu(app).projets.map(p => p.nom), ['Beta', 'Alpha']);
});

test('storage : émet l\'état après rechargement', async () => {
  const { app, store: A } = await setup();
  const B = app.createStore();
  await B.init({ seedIfEmpty: false });
  B.actions.ajouterProjet('Beta'); await B.flush();
  let n = 0; A.onState(() => n++);
  await A.recharger();
  assert.equal(n, 1);
});

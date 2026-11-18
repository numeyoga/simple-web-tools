import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const h = (hh, mm = 0) => new Date(2026, 10, 18, hh, mm).getTime();
const H = 3600_000;

async function setup() {
  const app = loadApp({ now: h(9) });
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  // session 9h-17h avec 1h de pause décomptée : duree = 7h
  store.state.sessions = [{ id: 's1', projetId: 'p1', description: '', debut: h(9), dernierDebut: null, fin: h(17), duree: 7 * H, statut: 'terminee' }];
  return { store, sess: () => store.state.sessions[0] };
}

test('majSession conserve les pauses déjà décomptées', async () => {
  const { store, sess } = await setup();
  store.actions.majSession('s1', { fin: h(18) });
  assert.equal(sess().duree, 8 * H);          // 9h-18h moins 1h de pause
  store.actions.majSession('s1', { debut: h(10) });
  assert.equal(sess().duree, 7 * H);          // 10h-18h moins 1h de pause
});

test('majSession : duree explicite prioritaire, durée plancher à 0', async () => {
  const { store, sess } = await setup();
  store.actions.majSession('s1', { fin: h(18), duree: 2 * H });
  assert.equal(sess().duree, 2 * H);
  store.actions.majSession('s1', { debut: h(18), fin: h(18) });
  assert.equal(sess().duree, 0);
});

test('majSession : session non terminée avant le patch, calcul fin - debut', async () => {
  const { store, sess } = await setup();
  store.state.sessions = [{ id: 's1', projetId: 'p1', description: '', debut: h(9), dernierDebut: null, fin: null, duree: 30 * 60_000, statut: 'en_pause' }];
  store.actions.majSession('s1', { statut: 'terminee', fin: h(11) });
  assert.equal(sess().duree, 2 * H);
});

test('majSession : session sans pause, duree = fin - debut', async () => {
  const { store, sess } = await setup();
  store.state.sessions = [{ id: 's1', projetId: 'p1', description: '', debut: h(9), dernierDebut: null, fin: h(10), duree: H, statut: 'terminee' }];
  store.actions.majSession('s1', { fin: h(12) });
  assert.equal(sess().duree, 3 * H);
});

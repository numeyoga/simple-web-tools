// Tests de plagesPresence (lib.js) et de tronquerSurPresence (db.js), via les actions publiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const h = (hh, mm = 0) => new Date(2026, 10, 18, hh, mm).getTime();
const H = 3600_000;
const plain = x => JSON.parse(JSON.stringify(x)); // sort du contexte vm (prototypes différents)

async function setup(hh = 8) {
  const app = loadApp({ now: h(hh) });
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  return { app, store, sess: id => store.state.sessions.find(s => s.id === id) };
}

test('plagesPresence : plages fermées, plage ouverte jusqu\'à now', () => {
  const app = loadApp();
  const ev = [
    { type: 'pause_debut', at: h(12) }, { type: 'arrivee', at: h(9) },
    { type: 'pause_fin', at: h(13) }, { type: 'depart', at: h(17) },
  ];
  assert.deepEqual(plain(app.UI.plagesPresence(ev, h(18)).map(p => [p.debut, p.fin])), [[h(9), h(12)], [h(13), h(17)]]);
  assert.deepEqual(plain(app.UI.plagesPresence(ev.slice(0, 2), h(15)).map(p => [p.debut, p.fin])), [[h(9), h(12)]]);
  assert.deepEqual(plain(app.UI.plagesPresence([{ type: 'arrivee', at: h(9) }], h(11)).map(p => [p.debut, p.fin])), [[h(9), h(11)]]);
  assert.equal(app.UI.dureePresence(ev, h(18)), 7 * H);
  assert.equal(app.UI.dureePresence([], h(18)), 0);
});

test('deux chronos parallèles de 9h à 10h, présence 9h-10h : aucune coupe', async () => {
  const { app, store, sess } = await setup(9);
  store.actions.pointer('arrivee');
  const a = store.actions.demarrer('p1', 'a');
  const b = store.actions.demarrer('p2', 'b');
  app.setNow(h(10));
  store.actions.arreterTout();
  assert.equal(sess(a).duree, H);
  assert.equal(sess(b).duree, H);
  assert.equal(sess(a).debut, h(9));
});

test('chrono 8h-12h, arrivée à 9h : durée 3h et début à 9h', async () => {
  const { app, store, sess } = await setup(8);
  const id = store.actions.demarrer('p1', 'x');
  app.setNow(h(9));
  store.actions.pointer('arrivee');
  app.setNow(h(12));
  store.actions.arreterSession(id);
  assert.equal(sess(id).duree, 3 * H);
  assert.equal(sess(id).debut, h(9));
  assert.equal(sess(id).fin, h(12));
});

test('chrono 9h-17h avec pause pointée 12h-13h : durée 7h, rien de coupé', async () => {
  const { app, store, sess } = await setup(9);
  store.actions.pointer('arrivee');
  const id = store.actions.demarrer('p1', 'x');
  app.setNow(h(12)); store.actions.pointer('pause_debut');
  app.setNow(h(13)); store.actions.pointer('pause_fin');
  app.setNow(h(17)); store.actions.arreterSession(id);
  assert.equal(sess(id).duree, 7 * H);
  assert.equal(sess(id).debut, h(9));
  assert.equal(sess(id).fin, h(17));
});

test('sans arrivée ce jour-là : rien n\'est coupé', async () => {
  const { app, store, sess } = await setup(8);
  const id = store.actions.demarrer('p1', 'x');
  app.setNow(h(12));
  store.actions.arreterSession(id);
  assert.equal(sess(id).duree, 4 * H);
  assert.equal(sess(id).debut, h(8));
});

test('chrono mis en pause avant l\'arrivée : seule la durée est coupée, pas le début', async () => {
  const { app, store, sess } = await setup(8);
  const id = store.actions.demarrer('p1', 'x');
  app.setNow(h(9)); store.actions.pauserSession(id);   // 1h comptée
  app.setNow(h(10)); store.actions.pointer('arrivee');
  store.actions.reprendreSession(id);
  app.setNow(h(10, 30)); store.actions.arreterSession(id); // 1h30 comptées, 2h30 de bloc
  // présence 10h-10h30 = 30 min : duree ramenée à 30 min, début inchangé (pause existante)
  assert.equal(sess(id).duree, 30 * 60_000);
  assert.equal(sess(id).debut, h(8));
  assert.equal(sess(id).fin, h(10, 30));
});

test('départ : les chronos arrêtés sont tronqués sur la présence', async () => {
  const { app, store, sess } = await setup(8);
  const id = store.actions.demarrer('p1', 'x');
  app.setNow(h(9)); store.actions.pointer('arrivee');
  app.setNow(h(11)); store.actions.pointer('depart');
  assert.equal(sess(id).duree, 2 * H);
  assert.equal(sess(id).debut, h(9));
});

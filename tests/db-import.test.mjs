import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const KEY = 'chrono.fallback.default.v1';
const S = { id: 's1', projetId: 'p1', debut: 1, fin: 2, duree: 1, statut: 'terminee' };

test('import sans IndexedDB : écrit dans localStorage au format lsSave', async () => {
  const app = loadApp();
  await app.WORKSPACES.importJSON('default', { data: {
    projets: [{ id: 'p1', nom: 'A' }], todos: [{ id: 't1', titre: 'x' }],
    sessions: [S], pointage: [{ id: 'pt1', type: 'arrivee', at: 5 }], activeId: 'zz',
  } });
  const saved = JSON.parse(app.localStorage.getItem(KEY));
  assert.deepEqual(Object.keys(saved).sort(), ['pointage', 'projets', 'sessions', 'todos']);
  assert.equal(saved.projets.length, 1);
  assert.equal(saved.sessions[0].id, 's1');
  // et le store le relit
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  assert.equal(store.state.pointage.length, 1);
});

test('import : filtre les éléments invalides', async () => {
  const app = loadApp();
  await app.WORKSPACES.importJSON('default', { projets: [{ id: 'p1' }, { id: 3 }, null, 'x', { nom: 'sans id' }],
    sessions: [S, { ...S, id: 's2', statut: 'bizarre' }, { ...S, id: 's3', statut: 'en_cours' }, { ...S, id: 's4', statut: 'en_pause' }] });
  const saved = JSON.parse(app.localStorage.getItem(KEY));
  assert.deepEqual(saved.projets.map(p => p.id), ['p1']);
  assert.deepEqual(saved.sessions.map(s => s.id), ['s1', 's3', 's4']);
});

test('import : tout invalide => erreur, rien d\'écrit', async () => {
  const app = loadApp();
  await assert.rejects(app.WORKSPACES.importJSON('default', { projets: [{ nom: 'x' }], sessions: [{ id: 's', statut: 'nope' }] }),
    /aucune donnée valide/);
  assert.equal(app.localStorage.getItem(KEY), null);
});

test('import : fichier vide mais bien formé => accepté', async () => {
  const app = loadApp();
  await app.WORKSPACES.importJSON('default', { projets: [], sessions: [] });
  assert.equal(JSON.parse(app.localStorage.getItem(KEY)).projets.length, 0);
});

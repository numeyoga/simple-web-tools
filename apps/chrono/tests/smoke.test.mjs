import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

test('le store se charge et démarre un chrono', async () => {
  const app = loadApp({ now: new Date(2026, 10, 18, 10, 0).getTime() });
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  const id = store.actions.demarrer('p1', 'x');
  assert.equal(store.sessionsActives().length, 1);
  assert.equal(store.sessionsActives()[0].id, id);
});

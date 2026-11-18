// Échéances de todos : conversion preset -> date, catégories (bucket) et scénario du bug
// (un todo ancien édité avec « aujourd'hui » ne doit pas tomber en « en retard »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load.mjs';

const J = 86400000;
// Mercredi 18 novembre 2026, 10h00 (heure locale).
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const charge = (now = NOW) => loadApp({ scripts: ['lib.js', 'db.js', 'Todos.js'], now });
const todo = (echeance, extra = {}) => ({ id: 't', titre: 'x', fait: false, echeance, creeLe: NOW, ...extra });

test('presetVersDate : aujourd\'hui, demain, vendredi, lundi, semaine, aucune', () => {
  const { presetVersDate } = charge().UI.todos;
  assert.equal(presetVersDate('today', NOW), '2026-11-18');
  assert.equal(presetVersDate('tomorrow', NOW), '2026-11-19');
  assert.equal(presetVersDate('fri', NOW), '2026-11-20');
  assert.equal(presetVersDate('mon', NOW), '2026-11-23'); // mercredi -> lundi suivant
  assert.equal(presetVersDate('wed', NOW), '2026-11-18'); // même jour accepté
  assert.equal(presetVersDate('week', NOW), '2026-11-24');
  assert.equal(presetVersDate('none', NOW), null);
  assert.equal(presetVersDate('n-importe-quoi', NOW), null);
});

test('presetVersDate : ref par défaut = maintenant, et ancré sur ref (pas sur Date.now)', () => {
  const app = charge();
  const { presetVersDate } = app.UI.todos;
  assert.equal(presetVersDate('today'), '2026-11-18');
  // vendredi 20 : « fri » = aujourd'hui ; samedi 21 : vendredi suivant
  assert.equal(presetVersDate('fri', new Date(2026, 10, 20, 23, 59).getTime()), '2026-11-20');
  assert.equal(presetVersDate('fri', new Date(2026, 10, 21, 0, 1).getTime()), '2026-11-27');
});

test('presetVersDate : passage à l\'heure d\'hiver/été ne décale pas le jour', () => {
  const { presetVersDate } = charge().UI.todos;
  // 2026-10-25 : fin de l'heure d'été en Europe (journée de 25 h) ; 2026-03-29 : début (23 h).
  assert.equal(presetVersDate('tomorrow', new Date(2026, 9, 24, 12, 0).getTime()), '2026-10-25');
  assert.equal(presetVersDate('tomorrow', new Date(2026, 9, 25, 12, 0).getTime()), '2026-10-26');
  assert.equal(presetVersDate('tomorrow', new Date(2026, 2, 28, 12, 0).getTime()), '2026-03-29');
  assert.equal(presetVersDate('tomorrow', new Date(2026, 2, 29, 12, 0).getTime()), '2026-03-30');
});

test('dateEcheanceVersTs : minuit local, ou null', () => {
  const { dateEcheanceVersTs } = charge().UI.todos;
  assert.equal(dateEcheanceVersTs('2026-11-18'), new Date(2026, 10, 18).getTime());
  assert.equal(dateEcheanceVersTs(null), null);
  assert.equal(dateEcheanceVersTs(''), null);
  assert.equal(dateEcheanceVersTs('today'), null);
  assert.equal(dateEcheanceVersTs('2026-13-01'), null);
  assert.equal(dateEcheanceVersTs('2026-02-30'), null);
  assert.equal(dateEcheanceVersTs(20261118), null);
});

test('bucket : overdue, today, tomorrow, week, none, done', () => {
  const { bucket } = charge().UI.todos;
  assert.equal(bucket(todo('2026-11-17')), 'overdue');
  assert.equal(bucket(todo('2025-01-01')), 'overdue');
  assert.equal(bucket(todo('2026-11-18')), 'today');
  assert.equal(bucket(todo('2026-11-19')), 'tomorrow');
  assert.equal(bucket(todo('2026-11-20')), 'week');
  assert.equal(bucket(todo('2027-06-01')), 'week'); // tout ce qui est au-delà de demain
  assert.equal(bucket(todo(null)), 'none');
  assert.equal(bucket(todo('today')), 'none');       // étiquette non migrée : inconnue
  assert.equal(bucket(todo('2026-11-17', { fait: true })), 'done');
  assert.equal(bucket(todo(null, { fait: true })), 'done');
});

test('bucket : ne dépend pas de creeLe, suit l\'heure courante', () => {
  const app = charge();
  const { bucket } = app.UI.todos;
  const t = todo('2026-11-18', { creeLe: NOW - 30 * J });
  assert.equal(bucket(t), 'today');
  app.setNow(new Date(2026, 10, 19, 0, 0, 1).getTime());
  assert.equal(bucket(t), 'overdue');
  app.setNow(new Date(2026, 10, 17, 23, 59).getTime());
  assert.equal(bucket(t), 'tomorrow');
});

test('bucket : demain correct la veille d\'un changement d\'heure', () => {
  const app = charge(new Date(2026, 9, 24, 12, 0).getTime());
  const { bucket } = app.UI.todos;
  assert.equal(bucket(todo('2026-10-25')), 'tomorrow');
  assert.equal(bucket(todo('2026-10-26')), 'week');
});

test('scénario du bug : todo créé il y a 3 jours, édité avec « today » => today, pas overdue', async () => {
  const app = charge(NOW - 3 * J);
  const { presetVersDate, bucket } = app.UI.todos;
  const store = app.createStore();
  await store.init({ seedIfEmpty: false });
  store.actions.ajouterTodo('Vieux todo', null, presetVersDate('fri'));
  const id = store.state.todos[0].id;
  assert.equal(store.state.todos[0].creeLe, NOW - 3 * J);

  app.setNow(NOW); // trois jours plus tard, l'utilisateur édite l'échéance
  store.actions.majTodo(id, { echeance: presetVersDate('today') });
  const t = store.state.todos.find(x => x.id === id);
  assert.equal(t.echeance, '2026-11-18');
  assert.equal(bucket(t), 'today');
});

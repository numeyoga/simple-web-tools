// Due dates: preset to date, buckets, and the bug scenario (an old todo edited with "today"
// must not fall into "overdue"). The clock is always passed in.
import { describe, expect, test } from 'vitest';
import { bucket, dateEcheanceVersTs, presetVersDate } from '../../src/core/echeances.js';
import { majTodo, ajouterTodo } from '../../src/core/todos.js';
import { vide } from './support/data.js';

const J = 86400000;
// Wednesday 2026-11-18, 10:00 (local time).
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
/**
 * @param {string | null} echeance
 * @param {Partial<import('../../src/types.js').Todo>} [extra]
 * @returns {import('../../src/types.js').Todo}
 */
const todo = (echeance, extra = {}) => ({
  id: 't',
  titre: 'x',
  fait: false,
  projetId: null,
  echeance,
  creeLe: NOW,
  ...extra,
});

describe('presetVersDate', () => {
  test("aujourd'hui, demain, vendredi, lundi, semaine, aucune", () => {
    expect(presetVersDate('today', NOW)).toBe('2026-11-18');
    expect(presetVersDate('tomorrow', NOW)).toBe('2026-11-19');
    expect(presetVersDate('fri', NOW)).toBe('2026-11-20');
    expect(presetVersDate('mon', NOW)).toBe('2026-11-23'); // mercredi -> lundi suivant
    expect(presetVersDate('wed', NOW)).toBe('2026-11-18'); // même jour accepté
    expect(presetVersDate('week', NOW)).toBe('2026-11-24');
    expect(presetVersDate('none', NOW)).toBeNull();
    expect(presetVersDate('n-importe-quoi', NOW)).toBeNull();
  });

  // Le test d'origine vérifiait aussi « ref par défaut = maintenant » : la référence est
  // désormais toujours passée explicitement (le défaut Date.now() vit dans la vue Todos).
  test('est ancré sur la référence reçue', () => {
    expect(presetVersDate('today', NOW)).toBe('2026-11-18');
    // vendredi 20 : « fri » = aujourd'hui ; samedi 21 : vendredi suivant
    expect(presetVersDate('fri', new Date(2026, 10, 20, 23, 59).getTime())).toBe('2026-11-20');
    expect(presetVersDate('fri', new Date(2026, 10, 21, 0, 1).getTime())).toBe('2026-11-27');
  });

  test("le passage à l'heure d'hiver/été ne décale pas le jour", () => {
    // 2026-10-25 : fin de l'heure d'été en Europe (journée de 25 h) ; 2026-03-29 : début (23 h).
    expect(presetVersDate('tomorrow', new Date(2026, 9, 24, 12, 0).getTime())).toBe('2026-10-25');
    expect(presetVersDate('tomorrow', new Date(2026, 9, 25, 12, 0).getTime())).toBe('2026-10-26');
    expect(presetVersDate('tomorrow', new Date(2026, 2, 28, 12, 0).getTime())).toBe('2026-03-29');
    expect(presetVersDate('tomorrow', new Date(2026, 2, 29, 12, 0).getTime())).toBe('2026-03-30');
  });
});

describe('dateEcheanceVersTs', () => {
  test('minuit local, ou null', () => {
    expect(dateEcheanceVersTs('2026-11-18')).toBe(new Date(2026, 10, 18).getTime());
    expect(dateEcheanceVersTs(null)).toBeNull();
    expect(dateEcheanceVersTs('')).toBeNull();
    expect(dateEcheanceVersTs('today')).toBeNull();
    expect(dateEcheanceVersTs('2026-13-01')).toBeNull();
    expect(dateEcheanceVersTs('2026-02-30')).toBeNull();
    expect(dateEcheanceVersTs(20261118)).toBeNull();
  });
});

describe('bucket', () => {
  test('overdue, today, tomorrow, week, none, done', () => {
    expect(bucket(todo('2026-11-17'), NOW)).toBe('overdue');
    expect(bucket(todo('2025-01-01'), NOW)).toBe('overdue');
    expect(bucket(todo('2026-11-18'), NOW)).toBe('today');
    expect(bucket(todo('2026-11-19'), NOW)).toBe('tomorrow');
    expect(bucket(todo('2026-11-20'), NOW)).toBe('week');
    expect(bucket(todo('2027-06-01'), NOW)).toBe('week'); // tout ce qui est au-delà de demain
    expect(bucket(todo(null), NOW)).toBe('none');
    expect(bucket(todo('today'), NOW)).toBe('none'); // étiquette non migrée : inconnue
    expect(bucket(todo('2026-11-17', { fait: true }), NOW)).toBe('done');
    expect(bucket(todo(null, { fait: true }), NOW)).toBe('done');
  });

  test("ne dépend pas de creeLe, suit l'heure reçue", () => {
    const t = todo('2026-11-18', { creeLe: NOW - 30 * J });

    expect(bucket(t, NOW)).toBe('today');
    expect(bucket(t, new Date(2026, 10, 19, 0, 0, 1).getTime())).toBe('overdue');
    expect(bucket(t, new Date(2026, 10, 17, 23, 59).getTime())).toBe('tomorrow');
  });

  test("demain correct la veille d'un changement d'heure", () => {
    const veille = new Date(2026, 9, 24, 12, 0).getTime();

    expect(bucket(todo('2026-10-25'), veille)).toBe('tomorrow');
    expect(bucket(todo('2026-10-26'), veille)).toBe('week');
  });
});

describe('scénario du bug', () => {
  test('todo créé il y a 3 jours, édité avec « today » => today, pas overdue', () => {
    const creation = NOW - 3 * J;
    let d = ajouterTodo(
      vide(),
      { titre: 'Vieux todo', projetId: null, echeance: presetVersDate('fri', creation) },
      creation,
      't1',
    );
    expect(d.todos[0]?.creeLe).toBe(creation);

    // trois jours plus tard, l'utilisateur édite l'échéance
    d = majTodo(d, { id: 't1', patch: { echeance: presetVersDate('today', NOW) } });

    const t = d.todos[0];
    expect(t?.echeance).toBe('2026-11-18');
    expect(t && bucket(t, NOW)).toBe('today');
  });
});

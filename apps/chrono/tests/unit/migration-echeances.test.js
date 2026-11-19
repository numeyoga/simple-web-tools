// Migration of relative due dates ('today', 'fri'...) to 'AAAA-MM-JJ' dates, and the seed.
import { describe, expect, test } from 'vitest';
import { migrerEcheancesTodos } from '../../src/core/echeances.js';
import { seed } from '../../src/core/seed.js';

// Wednesday 2026-11-18, 10:00.
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const hier = new Date(2026, 10, 17, 9, 0).getTime();
const il = (/** @type {number} */ j, h = 9) => new Date(2026, 10, 18 + j, h, 0).getTime();
/**
 * @param {string} id
 * @param {string | null} echeance
 * @param {number} [creeLe]
 */
const t = (id, echeance, creeLe = NOW) => ({
  id,
  titre: id,
  fait: false,
  projetId: null,
  echeance,
  creeLe,
});

describe('migrerEcheancesTodos', () => {
  test('étiquettes relatives ancrées sur creeLe', () => {
    const { todos, change } = migrerEcheancesTodos(
      [
        t('a', 'today', hier), // créé hier -> hier
        t('b', 'tomorrow', hier), // -> aujourd'hui
        t('c', 'fri', NOW), // mercredi -> vendredi 20
        t('d', 'fri', il(-7)), // mercredi 11 -> vendredi 13 (reste « en retard »)
        t('e', 'mon', NOW), // -> lundi 23
        t('f', 'sun', NOW), // -> dimanche 22
        t('g', 'week', NOW), // +6 jours -> 24
      ],
      NOW,
    );

    expect(change).toBe(true);
    expect(todos.map((x) => x.echeance)).toEqual([
      '2026-11-17',
      '2026-11-18',
      '2026-11-20',
      '2026-11-13',
      '2026-11-23',
      '2026-11-22',
      '2026-11-24',
    ]);
  });

  test('ISO et null intacts, inconnu -> null, références préservées', () => {
    const a = t('a', '2026-12-25');
    const b = t('b', null);
    const c = t('c', 'bizarre');
    const d = t('d', 'today', hier);

    const { todos, change } = migrerEcheancesTodos([a, b, c, d], NOW);

    expect(change).toBe(true);
    expect(todos[0]).toBe(a); // même objet : pas de réécriture IndexedDB inutile
    expect(todos[1]).toBe(b);
    expect(todos[2]?.echeance).toBeNull();
    expect(todos[3]?.echeance).toBe('2026-11-17');
    expect(c.echeance).toBe('bizarre'); // l'entrée n'est pas mutée
    expect(d.echeance).toBe('today');
  });

  test('rien à faire => change false ; idempotente', () => {
    const liste = [t('a', '2026-12-25'), t('b', null)];

    const r = migrerEcheancesTodos(liste, NOW);

    expect(r.change).toBe(false);
    expect(r.todos).toBe(liste); // même tableau, rien recréé
    const r1 = migrerEcheancesTodos([t('c', 'tomorrow', hier)], NOW);
    expect(migrerEcheancesTodos(r1.todos, NOW).change).toBe(false);
  });

  test('date impossible -> null ; creeLe absent -> maintenant ; pas un tableau', () => {
    const sansCreeLe = { id: 'b', titre: 'b', echeance: 'tomorrow' };

    const { todos } = migrerEcheancesTodos([t('a', '2026-02-30'), sansCreeLe], NOW);

    expect(todos[0]?.echeance).toBeNull();
    expect(todos[1]?.echeance).toBe('2026-11-19');
    const r = migrerEcheancesTodos(/** @type {any} */ (undefined), NOW);
    expect(r.todos).toBeUndefined();
    expect(r.change).toBe(false);
  });
});

describe('seed', () => {
  test('produit directement des dates AAAA-MM-JJ', () => {
    const { todos } = seed(NOW);

    for (const x of todos) {
      expect(x.echeance === null || /^\d{4}-\d{2}-\d{2}$/.test(x.echeance)).toBe(true);
    }
    expect(todos.find((x) => x.id === 't5')?.echeance).toBe('2026-11-18'); // « today » créé aujourd'hui
  });
});

// Migration of relative due dates ('today', 'fri'...) to 'YYYY-MM-DD' dates, and the seed.
import { describe, expect, test } from 'vitest';
import { migrateRelativeDueDates } from '../../src/core/due-dates.js';
import { seed } from '../../src/core/seed.js';

// Wednesday 2026-11-18, 10:00.
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const yesterday = new Date(2026, 10, 17, 9, 0).getTime();
const inDays = (/** @type {number} */ days, h = 9) => new Date(2026, 10, 18 + days, h, 0).getTime();
/**
 * @param {string} id
 * @param {string | null} dueDate
 * @param {number} [createdAt]
 */
const t = (id, dueDate, createdAt = NOW) => ({
  id,
  title: id,
  done: false,
  projectId: null,
  dueDate,
  createdAt,
});

describe('migrateRelativeDueDates', () => {
  test('relative labels are anchored on createdAt', () => {
    const { todos, change } = migrateRelativeDueDates(
      [
        t('a', 'today', yesterday), // created yesterday -> yesterday
        t('b', 'tomorrow', yesterday), // -> today
        t('c', 'fri', NOW), // Wednesday -> Friday 20
        t('d', 'fri', inDays(-7)), // Wednesday 11 -> Friday 13 (stays "overdue")
        t('e', 'mon', NOW), // -> Monday 23
        t('f', 'sun', NOW), // -> Sunday 22
        t('g', 'week', NOW), // +6 days -> 24
      ],
      NOW,
    );

    expect(change).toBe(true);
    expect(todos.map((x) => x.dueDate)).toEqual([
      '2026-11-17',
      '2026-11-18',
      '2026-11-20',
      '2026-11-13',
      '2026-11-23',
      '2026-11-22',
      '2026-11-24',
    ]);
  });

  test('ISO and null untouched, unknown -> null, references preserved', () => {
    const a = t('a', '2026-12-25');
    const b = t('b', null);
    const c = t('c', 'bizarre');
    const d = t('d', 'today', yesterday);

    const { todos, change } = migrateRelativeDueDates([a, b, c, d], NOW);

    expect(change).toBe(true);
    expect(todos[0]).toBe(a); // same object: no needless IndexedDB write
    expect(todos[1]).toBe(b);
    expect(todos[2]?.dueDate).toBeNull();
    expect(todos[3]?.dueDate).toBe('2026-11-17');
    expect(c.dueDate).toBe('bizarre'); // the input is not mutated
    expect(d.dueDate).toBe('today');
  });

  test('nothing to do => change false; idempotent', () => {
    const list = [t('a', '2026-12-25'), t('b', null)];

    const r = migrateRelativeDueDates(list, NOW);

    expect(r.change).toBe(false);
    expect(r.todos).toBe(list); // same array, nothing recreated
    const r1 = migrateRelativeDueDates([t('c', 'tomorrow', yesterday)], NOW);
    expect(migrateRelativeDueDates(r1.todos, NOW).change).toBe(false);
  });

  test('impossible date -> null; missing createdAt -> now; not an array', () => {
    const withoutCreatedAt = { id: 'b', title: 'b', dueDate: 'tomorrow' };

    const { todos } = migrateRelativeDueDates([t('a', '2026-02-30'), withoutCreatedAt], NOW);

    expect(todos[0]?.dueDate).toBeNull();
    expect(todos[1]?.dueDate).toBe('2026-11-19');
    const r = migrateRelativeDueDates(/** @type {any} */ (undefined), NOW);
    expect(r.todos).toBeUndefined();
    expect(r.change).toBe(false);
  });
});

describe('seed', () => {
  test('directly produces YYYY-MM-DD dates', () => {
    const { todos } = seed(NOW);

    for (const x of todos) {
      expect(x.dueDate === null || /^\d{4}-\d{2}-\d{2}$/.test(x.dueDate)).toBe(true);
    }
    expect(todos.find((x) => x.id === 't5')?.dueDate).toBe('2026-11-18'); // "today" created today
  });
});

import { describe, expect, test } from 'vitest';
import { formatLocalDate } from '../../src/core/dates.js';
import { aggregateWeek, buildReportCsv } from '../../src/core/report.js';
import { H, finishedSession } from './support/data.js';

const projects = [
  { id: 'p1', name: 'Site "vitrine"', client: 'Café Müller' },
  { id: 'p2', name: '=SOMME(A1:A2)', client: '@cible' },
];
const start = new Date(2026, 10, 16, 9, 0).getTime();
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
/** @param {Record<string, unknown>} [extra] */
const sess = (extra) =>
  /** @type {any} */ ({
    id: 's',
    projectId: 'p1',
    start,
    end: start + 5400_000,
    duration: 5400_000,
    status: 'done',
    description: 'Maquette',
    ...extra,
  });
const csv = (/** @type {any[]} */ sessions) => buildReportCsv(sessions, projects, NOW);

describe('buildReportCsv', () => {
  test('is a function', () => {
    expect(typeof buildReportCsv).toBe('function');
  });

  test('; separator, UTF-8 BOM and CRLF line ends', () => {
    const text = csv([sess()]);

    expect(text.charCodeAt(0)).toBe(0xfeff);
    const rows = text.slice(1).split('\r\n');
    expect(rows[0]).toBe('"Date";"Projet";"Client";"Description";"Début";"Fin";"Durée (h)"');
    expect(rows[1]?.split('";"')).toHaveLength(7);
    expect(!text.slice(1).includes('\n') || text.includes('\r\n')).toBe(true);
    expect(text).toContain('Café Müller');
  });

  test('duration with a decimal comma', () => {
    const row = csv([sess()]).slice(1).split('\r\n')[1] ?? '';

    expect(row.endsWith(';"1,50"')).toBe(true);
    expect(row).not.toContain('1.50');
  });

  test('doubled quotes', () => {
    expect(csv([sess()])).toContain('"Site ""vitrine"""');
  });

  test('formula injection neutralised on text fields only', () => {
    const l = csv([
      sess({ projectId: 'p2', description: '+1+1' }),
      sess({ description: '-2' }),
      sess({ description: '@x' }),
      sess({ description: '=1+1' }),
    ])
      .slice(1)
      .split('\r\n');

    expect(l[1]).toContain(`"'=SOMME(A1:A2)"`);
    expect(l[1]).toContain(`"'@cible"`);
    expect(l[1]).toContain(`"'+1+1"`);
    expect(l[2]).toContain(`"'-2"`);
    expect(l[3]).toContain(`"'@x"`);
    expect(l[4]).toContain(`"'=1+1"`);
    // non-text fields stay intact (no apostrophe on date/time/duration)
    expect(l[1]).not.toMatch(/"'\d/);
  });

  test('a running session counts up to now', () => {
    const isRunning = sess({
      status: 'running',
      duration: 0,
      lastStart: NOW - 90 * 60_000,
      end: null,
    });

    const row = csv([isRunning]).slice(1).split('\r\n')[1] ?? '';

    expect(row.endsWith(';"";"1,50"')).toBe(true);
  });
});

describe('formatLocalDate', () => {
  test('gives the local date', () => {
    expect(formatLocalDate(new Date(2026, 10, 16))).toBe('2026-11-16');
  });
});

describe('aggregateWeek', () => {
  test('totals per day and per project for the week of Monday 16 to Sunday 22 November', () => {
    const monday = finishedSession({ id: 'a', projectId: 'p1', start, duration: 2 * H });
    const tuesday = finishedSession({
      id: 'b',
      projectId: 'p2',
      start: start + 26 * H,
      duration: H,
    });
    const outsideWeek = finishedSession({
      id: 'c',
      projectId: 'p1',
      start: start - 7 * 24 * H,
      duration: 5 * H,
    });

    const s = aggregateWeek([monday, tuesday, outsideWeek], /** @type {any} */ (projects), 0, NOW);

    expect(formatLocalDate(s.monday)).toBe('2026-11-16');
    expect(formatLocalDate(s.sunday)).toBe('2026-11-22');
    expect(s.weekTotal).toBe(3 * H);
    expect(s.totalSessions).toBe(2);
    expect(s.activeDays).toBe(2);
    expect(s.byDay.map((j) => j.total)).toEqual([2 * H, H, 0, 0, 0, 0, 0]);
    expect(s.sortedProjects.map((p) => [p.id, p.duration])).toEqual([
      ['p1', 2 * H],
      ['p2', H],
    ]);
    expect(s.maxDay).toBe(8 * H);
  });
});

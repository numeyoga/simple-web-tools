// validateImport (core/import-export.js): the rules applied to the version 2 data of an import,
// and the wrapper of the version 1 files. The files themselves are tested in backup.test.js.
import { describe, expect, test } from 'vitest';
import {
  isLegacyExport,
  toExportData,
  validateImport,
  wrapLegacyExport,
} from '../../src/core/import-export.js';
import { emptyData, finishedSession } from './support/data.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const S = finishedSession({ id: 's1', start: 1, end: 2, duration: 1 });

describe('validateImport', () => {
  test('filters the invalid items', () => {
    const r = validateImport(
      {
        projects: [{ id: 'p1' }, { id: 3 }, null, 'x', { name: 'no id' }],
        sessions: [
          S,
          { ...S, id: 's2', status: 'odd' },
          { ...S, id: 's3', status: 'running' },
          { ...S, id: 's4', status: 'paused' },
          { ...S, id: 's5', status: 'en_cours' }, // a version 1 status is not valid in version 2
        ],
      },
      NOW,
    );

    expect(r.projects.map((p) => p.id)).toEqual(['p1']);
    expect(r.sessions.map((s) => s.id)).toEqual(['s1', 's3', 's4']);
  });

  test('everything invalid => error', () => {
    expect(() =>
      validateImport({ projects: [{ name: 'x' }], sessions: [{ id: 's', status: 'nope' }] }, NOW),
    ).toThrow(/aucune donnée valide/);
  });

  test('an empty but well-formed file => accepted', () => {
    const r = validateImport({ projects: [], sessions: [] }, NOW);

    expect(r).toEqual(emptyData());
  });

  test('keeps the four collections and ignores the unknown keys', () => {
    const r = validateImport(
      {
        projects: [{ id: 'p1', name: 'A' }],
        todos: [{ id: 't1', title: 'x' }],
        sessions: [S],
        attendance: [{ id: 'pt1', type: 'arrival', at: 5 }],
        activeId: 'zz',
      },
      NOW,
    );

    expect(Object.keys(r).sort()).toEqual(['attendance', 'projects', 'sessions', 'todos']);
  });

  test('rejects a format that is not an object', () => {
    expect(() => validateImport(null, NOW)).toThrow(/format invalide/);
  });

  test('migrates the due dates of the imported todos (old format)', () => {
    const yesterday = new Date(2026, 10, 17, 9, 0).getTime();
    const todo = (/** @type {string} */ id, /** @type {string} */ dueDate) => ({
      id,
      title: id,
      done: false,
      projectId: null,
      dueDate,
      createdAt: yesterday,
    });

    const r = validateImport(
      { todos: [todo('a', 'today'), todo('b', 'whatever'), todo('c', '2026-11-30')] },
      NOW,
    );

    expect(r.todos.map((x) => x.dueDate)).toEqual(['2026-11-17', null, '2026-11-30']);
  });
});

describe('toExportData', () => {
  test('keeps the four collections only', () => {
    const data = {
      ...emptyData(),
      projects: [{ id: 'p', name: 'A', color: '#000', client: '', archived: false }],
    };

    expect(toExportData(/** @type {any} */ ({ ...data, extra: 1 }))).toEqual(data);
  });
});

describe('version 1 files', () => {
  test('a file without an `app` field is a version 1 file, or bare data', () => {
    expect(isLegacyExport({ version: 1, exporteLe: 'x', data: {} })).toBe(true);
    expect(isLegacyExport({ projets: [] })).toBe(true);
    expect(isLegacyExport({ app: 'chrono', version: 2 })).toBe(false);
    expect(isLegacyExport(null)).toBe(false);
    expect(isLegacyExport([])).toBe(false);
    expect(isLegacyExport('text')).toBe(false);
  });

  test('is wrapped as a version 1 envelope', () => {
    const data = { projets: [] };

    expect(
      wrapLegacyExport({ version: 1, exporteLe: '2026-11-18T09:00:00.000Z', data }, NOW),
    ).toEqual({
      app: 'chrono',
      format: 'chrono-workspace',
      version: 1,
      exportedAt: '2026-11-18T09:00:00.000Z',
      data,
    });
    // Bare data, and an invalid export time.
    expect(wrapLegacyExport(data, NOW)).toMatchObject({
      data,
      exportedAt: new Date(NOW).toISOString(),
    });
    expect(wrapLegacyExport({ exporteLe: 'nope', data }, NOW).exportedAt).toBe(
      new Date(NOW).toISOString(),
    );
  });
});

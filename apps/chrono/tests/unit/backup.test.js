// JSON export and import on the envelope of @simple-web-tools/storage: version 3 files, version 2
// files (a hex colour per project), and the files of the former site (version 1, a bare object that is not an envelope), which must
// import forever (docs/moving-your-data.md).
import { ExportError, serializeExport } from '@simple-web-tools/storage';
import { describe, expect, test } from 'vitest';
import { buildExport, importErrorMessage, readExport } from '../../src/adapters/backup.js';
import { seed } from '../../src/core/seed.js';
import legacyFile from './fixtures/chrono-v1-export.json';
import v2File from './fixtures/chrono-v2-export.json';

const NOW = Date.UTC(2026, 10, 18, 10, 0);
const legacyText = JSON.stringify(legacyFile);

describe('a version 1 file of the former site', () => {
  test('is imported as version 3 data', () => {
    const data = readExport(legacyText, NOW);

    expect(data.projects).toEqual([
      {
        id: 'p1',
        name: 'Refonte site',
        category: 1,
        customColor: null,
        client: 'Orion SAS',
        archived: false,
      },
      {
        id: 'p2',
        name: 'Audit',
        category: 12,
        customColor: null,
        client: 'Atlas',
        archived: true,
        note: 'extra field kept',
      },
    ]);
    expect(data.todos.map((t) => [t.id, t.title, t.done, t.projectId, t.description])).toEqual([
      ['t1', 'Valider la palette', false, 'p1', 'avec le client'],
      ['t2', 'Envoyer la facture', true, null, undefined],
    ]);
    // The relative due date is turned into a date, anchored on the creation time (`creeLe`).
    expect(data.todos.map((t) => t.dueDate)).toEqual(['2026-11-20', '2026-11-20']);
    expect(data.sessions.map((s) => [s.id, s.status, s.projectId])).toEqual([
      ['s1', 'done', 'p1'],
      ['s2', 'running', 'p1'],
      ['s3', 'paused', 'p2'],
    ]);
    expect(data.sessions[1]).toMatchObject({ lastStart: Date.UTC(2026, 10, 18, 11), end: null });
    expect(data.attendance.map((a) => [a.id, a.type, a.suspendedSessionIds])).toEqual([
      ['a1', 'arrival', undefined],
      ['a2', 'break_start', ['s2']],
      ['a3', 'break_end', undefined],
      ['a4', 'break_start', ['s3']], // the legacy singular field
      ['a5', 'departure', undefined],
    ]);
    expect(JSON.stringify(data)).not.toMatch(/sessionSuspendueId|"nom"|"statut"/);
  });

  test('also accepts the bare data, and an envelope-less file whose data is v2-shaped', () => {
    // No colour: the next category of the default order (blue first).
    expect(readExport({ projets: [{ id: 'p', nom: 'A' }] }, NOW).projects).toEqual([
      { id: 'p', name: 'A', category: 9, customColor: null },
    ]);
    expect(readExport({ data: { projets: [{ id: 'p', nom: 'A' }] } }, NOW).projects).toHaveLength(
      1,
    );
    expect(readExport({ projects: [{ id: 'p', name: 'A' }] }, NOW).projects).toHaveLength(1);
  });

  test('uses the validation rules: invalid items are dropped, all invalid is refused, empty is fine', () => {
    const data = readExport(
      {
        projets: [{ id: 'p1' }, { id: 3 }, null, { nom: 'no id' }],
        sessions: [{ id: 's', statut: 'nope' }],
      },
      NOW,
    );
    expect(data.projects.map((p) => p.id)).toEqual(['p1']);
    expect(data.sessions).toEqual([]);

    expect(() =>
      readExport({ projets: [{ nom: 'x' }], sessions: [{ id: 's', statut: 'nope' }] }, NOW),
    ).toThrow(/aucune donnée valide/);
    expect(readExport({ projets: [], sessions: [] }, NOW)).toEqual({
      projects: [],
      todos: [],
      sessions: [],
      attendance: [],
    });
  });

  test('strict mode asks for a list of projects or sessions', () => {
    expect(() => readExport({ data: { todos: [] } }, NOW, { strict: true })).toThrow(
      'JSON invalide',
    );
    expect(readExport({ projets: [] }, NOW, { strict: true }).projects).toEqual([]);
    expect(readExport(legacyText, NOW, { strict: true }).sessions).toHaveLength(3);
  });

  test('takes the export time of the file, or now', () => {
    // Observable through the wrap: an invalid exporteLe must not make the import fail.
    expect(() => readExport({ exporteLe: 'not a date', data: { projets: [] } }, NOW)).not.toThrow();
  });
});

describe('a version 3 export', () => {
  test('is an envelope of the chrono-workspace format', () => {
    const data = seed(NOW);

    const envelope = buildExport(data, NOW);

    expect(envelope).toEqual({
      app: 'chrono',
      format: 'chrono-workspace',
      version: 3,
      exportedAt: '2026-11-18T10:00:00.000Z',
      data: {
        projects: data.projects,
        todos: data.todos,
        sessions: data.sessions,
        attendance: data.attendance,
      },
    });
  });

  test('round-trips through its JSON text', () => {
    const data = seed(NOW);

    const text = serializeExport(buildExport(data, NOW));

    expect(readExport(text, NOW)).toEqual(data);
  });

  test('round-trips through a parsed value, and keeps extra record fields', () => {
    const data = {
      projects: [
        {
          id: 'p',
          name: 'A',
          category: null,
          customColor: '#ffff00',
          client: '',
          archived: false,
          extra: 1,
        },
      ],
      todos: [],
      sessions: [],
      attendance: [{ id: 'a', type: /** @type {const} */ ('arrival'), at: 1, extra: [2] }],
    };

    expect(readExport(JSON.parse(serializeExport(buildExport(data, NOW))), NOW)).toEqual(data);
  });

  test('an export of the previous generation is not mistaken for a version 3 one', () => {
    const envelope = { ...buildExport(seed(NOW), NOW), version: 1 };

    // Version 1 data inside an envelope goes through the upgrades; current shaped data stays valid.
    expect(readExport(envelope, NOW).projects).toEqual(seed(NOW).projects);
  });
});

describe('a version 2 file (a hex colour per project)', () => {
  test('is upgraded: a palette colour becomes its category, another colour stays free', () => {
    const data = readExport(JSON.stringify(v2File), NOW);

    expect(data.projects.map((p) => [p.id, p.category, p.customColor, 'color' in p])).toEqual([
      ['p1', 1, null, false], // the orange of the former palette
      ['p2', 12, null, false], // purple, written in capitals
      ['p3', null, '#ffff00', false], // a free colour is kept, not moved to the nearest category
      ['p4', null, '#ff0000', false], // `#rgb` is expanded
      ['p5', 9, null, false], // no colour: the next category of the default order
      ['p6', 4, null, false], // an invalid colour: the next one, not the one p5 took
    ]);
    expect(data.projects[1]).toMatchObject({ archived: true, note: 'extra field kept' });
    expect(data.todos).toHaveLength(1);
    expect(data.sessions).toHaveLength(1);
    expect(data.attendance).toHaveLength(1);
  });

  test('a version 1 file ends in the same shape, in one import', () => {
    const fromV1 = readExport(legacyText, NOW);
    const fromV2 = readExport(JSON.stringify(v2File), NOW);

    expect(fromV1.projects.map((p) => [p.id, p.category, p.customColor])).toEqual([
      ['p1', 1, null],
      ['p2', 12, null],
    ]);
    expect(Object.keys(fromV1.projects[0] ?? {}).sort()).toEqual(
      Object.keys(fromV2.projects[0] ?? {}).sort(),
    );
  });
});

describe('files that are refused', () => {
  /** @param {() => unknown} fn */
  const codeOf = (fn) => {
    try {
      fn();
    } catch (error) {
      return error instanceof ExportError ? error.code : `not an ExportError: ${error}`;
    }
    return 'no error';
  };
  const envelope = () => buildExport(seed(NOW), NOW);

  test('a newer version', () => {
    expect(codeOf(() => readExport({ ...envelope(), version: 4 }, NOW))).toBe('newer-version');
  });

  test('another app', () => {
    expect(codeOf(() => readExport({ ...envelope(), app: 'locavern' }, NOW))).toBe('wrong-app');
  });

  test('another format', () => {
    expect(codeOf(() => readExport({ ...envelope(), format: 'chrono-other' }, NOW))).toBe(
      'wrong-format',
    );
  });

  test('an invalid version', () => {
    expect(codeOf(() => readExport({ ...envelope(), version: 'two' }, NOW))).toBe(
      'invalid-version',
    );
  });

  test('not JSON, not an object, an array', () => {
    expect(codeOf(() => readExport('{broken', NOW))).toBe('invalid-json');
    expect(codeOf(() => readExport(null, NOW))).toBe('not-an-envelope');
    expect(codeOf(() => readExport([], NOW))).toBe('not-an-envelope');
    expect(codeOf(() => readExport('"text"', NOW))).toBe('not-an-envelope');
  });

  test('French messages for the toast', () => {
    expect(importErrorMessage(new ExportError('newer-version', 'x'))).toMatch(/plus récente/);
    expect(importErrorMessage(new ExportError('wrong-app', 'x'))).toMatch(
      /pas été exporté par Chrono/,
    );
    expect(importErrorMessage(new ExportError('invalid-json', 'x'))).toBe('JSON invalide');
    expect(importErrorMessage(new ExportError('not-an-envelope', 'x'))).toBe('format invalide');
    expect(importErrorMessage(new Error('aucune donnée valide'))).toBe('aucune donnée valide');
    expect(importErrorMessage('x')).toBe('x');
  });
});

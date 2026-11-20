// The CSV of the weekly report follows the language of the interface. French stays what it
// always was (`;`, decimal comma, French headers: see report.test.js, which is unchanged);
// English is made for an English spreadsheet (`,`, decimal point, English headers).
import { describe, expect, test } from 'vitest';
import { buildReportCsv, csvConvention } from '../../src/core/report.js';

const projects = [
  { id: 'p1', name: 'Site, "vitrine"', client: 'Café Müller' },
  { id: 'p2', name: '=SUM(A1:A2)', client: '@target' },
];
const start = new Date(2026, 10, 16, 9, 0).getTime();
const NOW = new Date(2026, 10, 18, 10, 0).getTime();
/** @param {Record<string, unknown>} [extra] */
const session = (extra) =>
  /** @type {any} */ ({
    id: 's',
    projectId: 'p1',
    start,
    end: start + 5400_000,
    duration: 5400_000,
    status: 'done',
    description: 'Mockup',
    ...extra,
  });
/** @param {string} locale @param {any[]} sessions */
const lines = (locale, sessions) =>
  buildReportCsv(sessions, projects, NOW, { locale }).slice(1).split('\r\n');

describe('conventions of a language', () => {
  test('French spreadsheets expect ; and a decimal comma, English ones , and a point', () => {
    expect(csvConvention('fr')).toEqual({ separator: ';', decimal: ',' });
    expect(csvConvention('fr-CA')).toEqual({ separator: ';', decimal: ',' });
    expect(csvConvention('en')).toEqual({ separator: ',', decimal: '.' });
    expect(csvConvention('de')).toEqual({ separator: ',', decimal: '.' });
  });
});

describe('French CSV', () => {
  test('is the default and the explicit French one, byte for byte', () => {
    const sessions = [session(), session({ start: start + 86_400_000, end: undefined })];
    expect(buildReportCsv(sessions, projects, NOW, { locale: 'fr' })).toBe(
      buildReportCsv(sessions, projects, NOW),
    );
  });

  test('French headers, ; separator, dd/mm/yyyy, 24 h times, decimal comma, BOM', () => {
    const text = buildReportCsv([session()], projects, NOW, { locale: 'fr' });
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const [header, row] = text.slice(1).split('\r\n');
    expect(header).toBe('"Date";"Projet";"Client";"Description";"Début";"Fin";"Durée (h)"');
    expect(row).toBe(
      '"16/11/2026";"Site, ""vitrine""";"Café Müller";"Mockup";"09:00";"10:30";"1,50"',
    );
  });
});

describe('English CSV', () => {
  test('English headers, , separator, BOM kept, CRLF line ends', () => {
    const text = buildReportCsv([session()], projects, NOW, { locale: 'en' });
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const rows = text.slice(1).split('\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe('"Date","Project","Client","Description","Start","End","Duration (h)"');
  });

  test('decimal point, mm/dd/yyyy date and the time of the English interface', () => {
    const row = lines('en', [session()])[1] ?? '';
    expect(row).toMatch(
      /^"11\/16\/2026","Site, ""vitrine""","Café Müller","Mockup","9:00\sAM","10:30\sAM","1\.50"$/,
    );
    expect(row).not.toContain('1,50');
  });

  test('a comma inside a text does not split the cell, quotes are doubled', () => {
    const row = lines('en', [session()])[1] ?? '';
    expect(row).toContain('"Site, ""vitrine"""');
  });

  test('a running session has no end and counts up to now', () => {
    const row = lines('en', [
      session({ end: null, status: 'running', lastStart: start, duration: 0 }),
    ])[1];
    // 09:00 on Monday to 10:00 on Wednesday: 49 hours.
    expect(row?.split('","')[5]).toBe('');
    expect(row?.endsWith('"49.00"')).toBe(true);
  });

  test('formula injection is neutralised in English too, on text fields only', () => {
    const rows = lines('en', [session({ projectId: 'p2', description: '+1+1' })]);
    expect(rows[1]).toContain(`"'=SUM(A1:A2)","'@target","'+1+1"`);
  });

  test('sessions come out in the order of their start', () => {
    const later = session({ id: 'b', start: start + 3600_000, end: start + 7200_000 });
    const rows = lines('en', [later, session()]);
    expect(rows[1]).toContain('"9:00');
    expect(rows[2]).toContain('"10:00');
  });
});

// The demo data and the import messages follow the language of the interface.
import { ExportError } from '@simple-web-tools/storage';
import { createTranslator } from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import { ImportError } from '../../src/core/import-export.js';
import { seed } from '../../src/core/seed.js';
import { importErrorMessage } from '../../src/adapters/backup.js';
import { catalogs } from '../../src/i18n/index.js';

const NOW = new Date(2026, 10, 18, 10, 0).getTime();
const english = createTranslator({ locale: 'en', catalogs }).t;
const french = createTranslator({ locale: 'fr', catalogs }).t;

/** The data without its words: ids, colours, dates and durations. */
function withoutText(/** @type {ReturnType<typeof seed>} */ data) {
  return JSON.parse(
    JSON.stringify(data, (key, value) =>
      ['name', 'client', 'title', 'description'].includes(key) ? undefined : value,
    ),
  );
}

describe('demo data', () => {
  test('is French when no translator is given, as it always was', () => {
    const data = seed(NOW);
    expect(data.projects[0]?.name).toBe('Refonte site — Orion SAS');
    expect(data.projects[1]?.client).toBe('Interne');
    expect(data.todos[1]?.title).toBe('Maquette écran « panier »');
    expect(data.sessions[0]?.description).toBe('Maquette homepage v3');
    expect(seed(NOW, french)).toEqual(data);
  });

  test('is English with the English translator', () => {
    const data = seed(NOW, english);
    expect(data.projects.map((p) => p.name)).toEqual([
      'Website redesign — Orion SAS',
      'Internal design system',
      'Helios mobile app',
      'UX audit — Atlas',
      'Admin & accounting',
      'v2 migration — Phoenix',
    ]);
    expect(data.projects[1]?.client).toBe('Internal');
    expect(data.todos[1]?.title).toBe('Mockup of the “cart” screen');
    expect(data.sessions.at(-1)?.description).toBe('Atlas — audit summary');
  });

  test('has the same shape in both languages: only the words change', () => {
    expect(withoutText(seed(NOW, english))).toEqual(withoutText(seed(NOW, french)));
  });

  test('no demo text is empty or left as a key', () => {
    for (const data of [seed(NOW, english), seed(NOW, french)]) {
      const texts = [
        ...data.projects.flatMap((p) => [p.name, p.client]),
        ...data.todos.map((todo) => todo.title),
        ...data.sessions.map((s) => s.description),
      ];
      for (const text of texts) {
        expect(text).toBeTruthy();
        expect(text).not.toMatch(/^demo\./);
      }
    }
  });
});

describe('import messages', () => {
  test('are French by default', () => {
    expect(importErrorMessage(new ImportError('invalid-json', 'x'))).toBe('JSON invalide');
    expect(importErrorMessage(new ImportError('no-valid-data', 'x'))).toBe('aucune donnée valide');
    expect(importErrorMessage(new ImportError('invalid-format', 'x'))).toBe('format invalide');
  });

  test('are English with the English translator', () => {
    const message = (/** @type {unknown} */ error) => importErrorMessage(error, english);
    expect(message(new ExportError('invalid-json', 'x'))).toBe('Invalid JSON');
    expect(message(new ExportError('not-an-envelope', 'x'))).toBe('Invalid format');
    expect(message(new ImportError('no-valid-data', 'x'))).toBe('No valid data in the file.');
    expect(message(new ExportError('wrong-app', 'x'))).toBe(
      'This file was not exported by Chrono.',
    );
    expect(message(new ExportError('newer-version', 'x'))).toMatch(/newer version of Chrono/);
    expect(message(new ExportError('upgrade-failed', 'x'))).toBe('This file cannot be converted.');
    expect(message(new Error('disk full'))).toBe('disk full');
    expect(message('x')).toBe('x');
  });
});

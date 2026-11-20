// The texts the core produces, in French (what it always wrote) and in English: errors, default
// statuses, built-in templates, the labels of the exports and the age of the last backup.
import { createTranslator } from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import { formatBackupAgeLabel } from '../../src/core/backup.js';
import { decryptArchiveBytes, encryptArchiveBytes } from '../../src/core/crypto-archive.js';
import { buildTasksIcsCalendar } from '../../src/core/ical.js';
import { noteToMarkdown } from '../../src/core/markdown.js';
import { LocavernError, errorText, failure, frenchText } from '../../src/core/messages.js';
import {
  createDefaultTaskStatuses,
  createProject,
  createTask,
  getTaskRecurrenceLabel,
  getTaskStatusMeta,
} from '../../src/core/model.js';
import { validateBackupData } from '../../src/core/schema.js';
import { createBuiltinTemplates, getTemplatesForKind } from '../../src/core/templates.js';
import { catalogs } from '../../src/i18n/index.js';
import { t as pageText } from '../../src/adapters/i18n.js';

/** @param {string} locale */
const text = (locale) => createTranslator({ locale, catalogs }).t;
const en = text('en');
const NOW = '2026-11-15T10:00:00.000Z';

describe('errors', () => {
  test('keep their French message and carry the key of the catalogs', () => {
    expect(() => createProject({ id: 'p', name: '  ', now: NOW })).toThrow(
      'Le nom du projet ne peut pas être vide.',
    );
    try {
      createProject({ id: 'p', name: 'x'.repeat(121), now: NOW });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(LocavernError);
      expect(/** @type {LocavernError} */ (error).key).toBe('errors.model.projectNameTooLong');
      expect(errorText(error, en, 'errors.validation')).toBe(
        'The project name cannot be longer than 120 characters.',
      );
      expect(errorText(error, text('fr'), 'errors.validation')).toBe(
        'Le nom du projet ne peut pas dépasser 120 caractères.',
      );
    }
  });

  test('a failed result has its message, its key and its parameters', () => {
    const result = validateBackupData({ schemaVersion: 99 });
    expect(result).toMatchObject({
      ok: false,
      key: 'errors.backup.schemaVersion',
      params: { version: '99' },
      error: 'Version de schéma non prise en charge (99).',
    });
    expect(errorText(result, en, 'errors.validation')).toBe('Schema version not supported (99).');
    expect(failure('errors.backup.invalidJson').error).toBe(
      frenchText('errors.backup.invalidJson'),
    );
  });

  test('an encrypted archive says the same thing in both languages', async () => {
    const { header, ciphertext } = await encryptArchiveBytes(new Uint8Array([1, 2, 3]), 'secret', {
      iterations: 100_000,
    });
    const wrong = await decryptArchiveBytes(header, ciphertext, 'nope');
    expect(wrong).toMatchObject({
      ok: false,
      wrongPassword: true,
      key: 'errors.encryption.wrongPassword',
    });
    expect(errorText(wrong, en, 'errors.validation')).toBe('Wrong password or damaged archive.');
  });

  test('an error that is not from the core keeps its own message, anything else gets the fallback', () => {
    expect(errorText(new Error('Disk full'), en, 'errors.validation')).toBe('Disk full');
    expect(errorText('oops', en, 'errors.validation')).toBe('Validation error.');
    expect(errorText(null, text('fr'), 'errors.validation')).toBe('Erreur de validation.');
  });
});

describe('default statuses and labels', () => {
  test('a new workspace starts with statuses named in the language of the page', () => {
    expect(createDefaultTaskStatuses(en).map((s) => s.label)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
    expect(createDefaultTaskStatuses(text('fr')).map((s) => s.label)).toEqual([
      'À faire',
      'En cours',
      'Terminé',
    ]);
    expect(createDefaultTaskStatuses(en).map((s) => s.id)).toEqual(['todo', 'in_progress', 'done']);
    expect(createDefaultTaskStatuses(en)[2]).toMatchObject({ isTerminal: true });
  });

  test('statuses of the user are never renamed', () => {
    const statuses = [{ id: 'todo', label: 'À faire', isInitial: true }];
    expect(getTaskStatusMeta('todo', statuses, en).label).toBe('À faire');
    expect(getTaskStatusMeta('in_progress', statuses, en).label).toBe(
      'Unknown status (In progress)',
    );
    expect(getTaskStatusMeta(null, statuses, en).label).toBe('No status');
  });

  test('recurrence', () => {
    expect(getTaskRecurrenceLabel('weekly', en)).toBe('Weekly');
    expect(getTaskRecurrenceLabel('weekly', text('fr'))).toBe('Hebdomadaire');
    expect(getTaskRecurrenceLabel(null, en)).toBe('');
  });
});

describe('built-in templates', () => {
  test('are written in the language asked for, with the same structure', () => {
    const french = createBuiltinTemplates(text('fr'));
    const english = createBuiltinTemplates(en);
    expect(english.map((tpl) => tpl.id)).toEqual(french.map((tpl) => tpl.id));
    expect(english.map((tpl) => tpl.name)).toEqual([
      'Release preparation',
      'Quality and security review',
      'Meeting notes',
      'Decision record (ADR)',
      'Retrospective (3 columns)',
      '3-step flow',
    ]);
    expect(french[0]?.name).toBe('Préparation de livraison');
    expect(english[0]?.checklistItems?.[0]).toBe('Check the automated tests');
    const retro = english.find((tpl) => tpl.id === 'builtin-wb-retro');
    expect(retro?.elements?.map((el) => el.text).slice(0, 3)).toEqual([
      'What went well',
      'To improve',
      'Actions',
    ]);
  });

  test('the list of a kind takes the templates of the page', () => {
    const english = createBuiltinTemplates(en);
    expect(getTemplatesForKind([], 'note', english).map((tpl) => tpl.name)).toEqual([
      'Meeting notes',
      'Decision record (ADR)',
    ]);
  });
});

describe('exports', () => {
  const project = createProject({ id: 'p1', name: 'Alpha', now: NOW });
  const task = createTask({
    id: 't1',
    projectId: 'p1',
    title: 'Ship',
    priority: 'high',
    dueDate: '2026-11-20',
    checklist: [{ id: 'c1', text: 'Zip', done: true }],
    now: NOW,
  });

  /** @param {(key: string, params?: Record<string, string | number>) => string} [t] */
  const ics = (t) =>
    buildTasksIcsCalendar([task], [project], { now: NOW, ...(t ? { t, locale: 'en' } : {}) })
      .icsContent.replace(/\r\n /g, '')
      .split('\r\n');

  test('the iCalendar protocol fields are the same in every language', () => {
    const french = ics();
    const english = ics(en);
    const protocol = (/** @type {string[]} */ lines) =>
      lines.filter((line) => !/^(X-WR-CALNAME|DESCRIPTION|SUMMARY)/.test(line));
    expect(protocol(english)).toEqual(protocol(french));
    expect(english).toContain('PRODID:-//Locavern//Locavern PWA//FR');
    expect(english).toContain('STATUS:TENTATIVE');
    expect(english).toContain('PRIORITY:1');
  });

  test('French calendar name and description are what they always were', () => {
    const lines = ics();
    expect(lines).toContain('X-WR-CALNAME:Locavern — Échéances');
    expect(lines).toContain(
      'DESCRIPTION:Projet : Alpha · Statut : À faire · Priorité : Haute\\n\\nSous-tâches :\\n[x] Zip',
    );
  });

  test('English calendar name and description', () => {
    const lines = ics(en);
    expect(lines).toContain('X-WR-CALNAME:Locavern — Due dates');
    expect(lines).toContain(
      'DESCRIPTION:Project: Alpha · Status: To do · Priority: High\\n\\nSubtasks:\\n[x] Zip',
    );
  });

  test('a note in Markdown', () => {
    const note = {
      title: '',
      updatedAt: '2026-11-15T10:00:00.000Z',
      contentDoc: {
        type: 'doc',
        content: [{ type: 'localImage', attrs: { assetId: 'a1' } }],
      },
    };
    const options = { projectName: 'Alpha' };
    expect(noteToMarkdown(/** @type {any} */ (note), options)).toBe(
      '# Note sans titre\n\n> Projet : Alpha · Mise à jour : 2026-11-15\n\n![Image locale](local-asset://a1)\n',
    );
    expect(noteToMarkdown(/** @type {any} */ (note), { ...options, t: en })).toBe(
      '# Untitled note\n\n> Project: Alpha · Updated: 2026-11-15\n\n![Local image](local-asset://a1)\n',
    );
  });
});

describe('the age of the last backup', () => {
  const base = Date.parse('2026-11-15T10:00:00.000Z');
  const ago = (/** @type {number} */ ms) => new Date(base - ms).toISOString();

  test('in English', () => {
    expect(formatBackupAgeLabel(null, base, en)).toBe('No ZIP backup yet');
    expect(formatBackupAgeLabel(ago(10_000), base, en)).toBe('Just now');
    expect(formatBackupAgeLabel(ago(5 * 60_000), base, en)).toBe('5 min ago');
    expect(formatBackupAgeLabel(ago(3 * 3_600_000), base, en)).toBe('3 h ago');
    expect(formatBackupAgeLabel(ago(86_400_000), base, en)).toBe('1 day ago');
    expect(formatBackupAgeLabel(ago(4 * 86_400_000), base, en)).toBe('4 days ago');
  });
});

describe('the translator of the page without a browser', () => {
  test('speaks English, the fallback, and formats like en', () => {
    expect(pageText('common.today')).toBe('Today');
  });
});

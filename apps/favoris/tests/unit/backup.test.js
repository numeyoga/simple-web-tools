// The JSON backup: the envelope of this app, the validation record by record, and the file the
// previous version exported.
import { describe, expect, test } from 'vitest';
import { importErrorMessage, readBackup, serializeBackup } from '../../src/adapters/backup.js';
import {
  BACKUP_APP,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  backupFileName,
  buildBackupData,
  validateBackupData,
} from '../../src/core/backup.js';
import { createExportEnvelope } from '@simple-web-tools/storage';
import { group, link } from './support/data.js';
import { legacyExportFile } from './support/legacy-fixtures.js';

let n = 0;
const makeId = () => `made-${++n}`;

/** @param {unknown} data */
const envelope = (data) =>
  serializeBackup(
    createExportEnvelope({
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2026-11-22T10:00:00.000Z',
      data,
    }),
  );

describe('the file name', () => {
  test('is the app, the workspace and the local date', () => {
    expect(backupFileName({ workspaceId: 'work', date: '2026-11-22' })).toBe(
      'favoris-work-2026-11-22.json',
    );
  });
});

describe('the envelope', () => {
  test('a backup written by the app reads back the same', () => {
    const groups = [group({ id: 'g', position: 0, featured: true })];
    const links = [link({ id: 'l', groupId: 'g', position: 0 })];

    const { data, skipped, legacy } = readBackup(envelope(buildBackupData({ groups, links })));

    expect(data).toEqual({ groups, links });
    expect(skipped).toEqual({ groups: 0, links: 0, unsafeUrls: 0 });
    expect(legacy).toBe(false);
  });

  test('every record is validated one by one: unsafe addresses and broken records are skipped and counted', () => {
    const text = envelope({
      groups: [{ id: 'g', label: 'G', category: 3 }, 'junk'],
      links: [
        { id: '1', name: 'Fine', url: 'https://fine.example', groupId: 'g' },
        { id: '2', name: 'Evil', url: 'javascript:alert(1)', groupId: 'g' },
        { id: '3', name: 'Data', url: 'data:text/html,<script>alert(1)</script>', groupId: 'g' },
        { id: '4', name: 'File', url: 'file:///etc/passwd', groupId: 'g' },
        { id: '5', name: 'Broken' },
      ],
    });

    const { data, skipped } = readBackup(text, makeId);

    expect(data.links.map((l) => l.id)).toEqual(['1']);
    expect(skipped).toEqual({ groups: 1, links: 1, unsafeUrls: 3 });
  });

  test('refuses a file that is not a backup of this app', () => {
    expect(() => readBackup('not json')).toThrow(expect.objectContaining({ code: 'invalid-json' }));
    expect(() => readBackup('"text"')).toThrow(
      expect.objectContaining({ code: 'not-an-envelope' }),
    );
    expect(() => readBackup('[]')).toThrow(expect.objectContaining({ code: 'not-an-envelope' }));
    expect(() =>
      readBackup(
        JSON.stringify({
          app: 'chrono',
          format: 'chrono-workspace',
          version: 1,
          exportedAt: '2026-01-01T00:00:00Z',
          data: {},
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'wrong-app' }));
    expect(() =>
      readBackup(
        JSON.stringify({
          app: BACKUP_APP,
          format: BACKUP_FORMAT,
          version: 9,
          exportedAt: '2026-01-01T00:00:00Z',
          data: {},
        }),
      ),
    ).toThrow(expect.objectContaining({ code: 'newer-version' }));
  });

  test('refuses data without lists of groups and links', () => {
    expect(() => validateBackupData(null, makeId)).toThrow(BackupError);
    expect(() => validateBackupData({ groups: [] }, makeId)).toThrow(BackupError);
    expect(() => readBackup(envelope({ groups: 'no', links: [] }))).toThrow(BackupError);
  });
});

describe('the file the previous version exported ({ space, tags, links })', () => {
  test('is accepted without an envelope or a version', () => {
    const { data, skipped, legacy } = readBackup(JSON.stringify(legacyExportFile()), makeId);

    expect(legacy).toBe(true);
    expect(data.groups.map((g) => [g.id, g.label, g.category, g.featured])).toEqual([
      ['clients', 'Clients', 14, true],
      ['outils', 'Outils', 6, false],
    ]);
    expect(data.links.map((l) => [l.name, l.url, l.groupId])).toEqual([
      ['Intranet', 'https://intranet.example/', 'clients'],
      ['Sans id', 'https://wiki.example', 'outils'],
    ]);
    expect(skipped.unsafeUrls).toBe(1);
  });

  test('a parsed value works too, and an export with no tags and no links is not one', () => {
    expect(readBackup(legacyExportFile(), makeId).legacy).toBe(true);
    expect(() => readBackup({ space: 'x' })).toThrow();
  });
});

describe('importErrorMessage', () => {
  const t = (/** @type {string} */ key) => key;

  test('gives a catalog key for each kind of failure', () => {
    expect(importErrorMessage(new BackupError('invalid-data', 'x'), t)).toBe(
      'importErrors.invalidData',
    );
    for (const [code, key] of [
      ['invalid-json', 'invalidJson'],
      ['not-an-envelope', 'invalidFormat'],
      ['wrong-format', 'invalidFormat'],
      ['wrong-app', 'wrongApp'],
      ['newer-version', 'newerVersion'],
      ['upgrade-failed', 'cannotConvert'],
    ]) {
      expect(importErrorMessage({ code }, t)).toBe(`importErrors.${key}`);
    }
    expect(importErrorMessage(new Error('boom'), t)).toBe('boom');
  });
});

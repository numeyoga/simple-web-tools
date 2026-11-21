// The backup file of a workspace: the envelope of @simple-web-tools/storage around the content of
// core/backup.js, with the pictures as base64. A restored backup shows its images.
import { describe, expect, test } from 'vitest';
import { ExportError } from '@simple-web-tools/storage';
import {
  base64ToBlob,
  blobToBase64,
  buildBackup,
  importErrorMessage,
  readBackup,
  serializeBackup,
} from '../../src/adapters/backup.js';
import { BackupError } from '../../src/core/backup.js';
import { createTranslator } from '@simple-web-tools/i18n';
import { catalogs } from '../../src/i18n/index.js';
import { asset, at, doc, docWithImage, folder, note } from './support/data.js';

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]);
const picture = () => new Blob([bytes], { type: 'image/png' });
const content = () => ({
  folders: [folder({ id: 'f1', category: 'resources' })],
  notes: [
    note({ id: 'n1', title: 'With picture', folderId: 'f1', doc: docWithImage('a1', 'alt') }),
    note({ id: 'n2', title: 'Plain', doc: doc('text') }),
  ],
  assets: [
    { meta: asset('a1', bytes.length), blob: picture() },
    { meta: asset('unused', 1), blob: picture() },
  ],
});

describe('base64', () => {
  test('a picture survives the round trip, byte for byte', async () => {
    const text = await blobToBase64(picture());
    const back = base64ToBlob(text, 'image/png');

    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
    expect(back.type).toBe('image/png');
  });

  test('a large picture does not overflow the stack', async () => {
    const big = new Blob([new Uint8Array(3 * 1024 * 1024).fill(7)], { type: 'image/png' });

    expect((await blobToBase64(big)).length).toBe(4 * 1024 * 1024);
  });
});

describe('the file', () => {
  test('is an envelope of the app, format transient-notes-workspace, version 1', async () => {
    const envelope = await buildBackup(content(), '2026-11-18T09:00:00.000Z');

    expect(envelope).toMatchObject({
      app: 'transient-notes',
      format: 'transient-notes-workspace',
      version: 1,
      exportedAt: '2026-11-18T09:00:00.000Z',
    });
    const data = /** @type {{ assets: { id: string, data: string }[] }} */ (envelope.data);
    expect(data.assets.map((a) => a.id)).toEqual(['a1']); // the unused picture stays out
    expect(typeof data.assets[0]?.data).toBe('string');
  });

  test('a backup restores the folders, the notes and the pictures', async () => {
    const text = serializeBackup(await buildBackup(content(), at()));

    const restored = readBackup(text);

    expect(restored.folders).toEqual(content().folders);
    expect(restored.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(restored.notes[0]?.doc).toEqual(content().notes[0]?.doc);
    expect(restored.assets).toHaveLength(1);
    expect(restored.assets[0]?.meta).toMatchObject({
      id: 'a1',
      mime: 'image/png',
      size: bytes.length,
    });
    expect(
      new Uint8Array(await (restored.assets[0]?.blob.arrayBuffer() ?? new ArrayBuffer(0))),
    ).toEqual(bytes);
    expect(restored.skipped).toEqual({ folders: 0, notes: 0, assets: 0 });
  });

  test('is pretty-printed JSON text', async () => {
    const text = serializeBackup(await buildBackup({ folders: [], notes: [], assets: [] }, at()));

    expect(text).toContain('\n  "app": "transient-notes"');
  });
});

describe('reading a file', () => {
  /** @param {object} over */
  const file = (over) =>
    JSON.stringify({
      app: 'transient-notes',
      format: 'transient-notes-workspace',
      version: 1,
      exportedAt: at(),
      data: { folders: [], notes: [] },
      ...over,
    });

  test.each([
    ['not JSON', '{nope', 'invalid-json'],
    ['a JSON text that is a string', '"text"', 'not-an-envelope'],
    ['an array', '[]', 'not-an-envelope'],
    ['an export of another app', file({ app: 'chrono' }), 'wrong-app'],
    ['another format', file({ format: 'other' }), 'wrong-format'],
    ['a newer version', file({ version: 2 }), 'newer-version'],
    ['no version', file({ version: undefined }), 'invalid-version'],
  ])('%s is refused with an ExportError (%s)', (_label, text, code) => {
    expect(() => readBackup(text)).toThrow(ExportError);
    expect(() => readBackup(text)).toThrow(expect.objectContaining({ code }));
  });

  test('a good envelope with unusable data is a BackupError', () => {
    expect(() => readBackup(file({ data: { folders: 'x', notes: [] } }))).toThrow(BackupError);
  });

  test('an empty workspace is a valid backup', () => {
    expect(readBackup(file({}))).toMatchObject({ folders: [], notes: [], assets: [] });
  });

  test('accepts the value already parsed', () => {
    expect(readBackup(JSON.parse(file({}))).notes).toEqual([]);
  });
});

describe('the message of a failure', () => {
  const { t } = createTranslator({ locale: 'en', catalogs });

  test.each([
    [new ExportError('invalid-json', 'x'), 'The file is not valid JSON.'],
    [new ExportError('not-an-envelope', 'x'), 'The file is not a Transient Notes backup.'],
    [new ExportError('wrong-app', 'x'), 'This file was not exported by Transient Notes.'],
    [new ExportError('newer-version', 'x'), /newer version/],
    [new ExportError('upgrade-failed', 'x'), 'This file cannot be converted.'],
    [new BackupError('invalid-data', 'x'), 'The backup has no usable notes or folders.'],
    [new Error('disk is on fire'), 'disk is on fire'],
  ])('%s', (error, expected) => {
    expect(importErrorMessage(error, t)).toMatch(
      expected instanceof RegExp
        ? expected
        : new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
    );
  });
});

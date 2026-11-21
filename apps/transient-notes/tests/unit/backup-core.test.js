// The content of a JSON backup: what is written, and how a file is validated on import.
import { describe, expect, test } from 'vitest';
import {
  BackupError,
  base64ByteLength,
  buildBackupData,
  validateBackupData,
} from '../../src/core/backup.js';
import { at, doc, docWithImage, folder, note } from './support/data.js';

// 1x1 transparent PNG.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+XJ/PNwAAAABJRU5ErkJggg==';
const pngAsset = (id = 'a1', extra = {}) => ({
  id,
  mime: 'image/png',
  size: base64ByteLength(PNG) ?? 0,
  createdAt: at(),
  data: PNG,
  ...extra,
});

describe('buildBackupData', () => {
  test('carries the folders, the notes and the pictures the notes show, and no others', () => {
    const data = buildBackupData({
      folders: [folder({ id: 'f1' })],
      notes: [note({ id: 'n1', doc: docWithImage('used') })],
      assets: [pngAsset('used'), pngAsset('orphan')],
    });

    expect(data.folders).toHaveLength(1);
    expect(data.notes).toHaveLength(1);
    expect(data.assets.map((a) => a.id)).toEqual(['used']);
  });
});

describe('base64ByteLength', () => {
  test('counts the bytes of valid padded base64; null for anything else', () => {
    expect(base64ByteLength('TWFu')).toBe(3);
    expect(base64ByteLength('TWE=')).toBe(2);
    expect(base64ByteLength('TQ==')).toBe(1);
    for (const bad of ['', 'abc', 'TW Fu', 'T!Fu', 12, null, undefined]) {
      expect(base64ByteLength(bad)).toBeNull();
    }
  });
});

describe('validateBackupData', () => {
  const valid = {
    folders: [folder({ id: 'f1', category: 'areas' })],
    notes: [note({ id: 'n1', folderId: 'f1', doc: docWithImage('a1') })],
    assets: [pngAsset('a1')],
  };

  test('accepts what buildBackupData wrote, and reports nothing skipped', () => {
    const { data, skipped } = validateBackupData(valid);

    expect(data.folders).toEqual(valid.folders);
    expect(data.notes[0]).toMatchObject({ id: 'n1', folderId: 'f1' });
    expect(data.assets[0]).toMatchObject({ id: 'a1', mime: 'image/png', data: PNG });
    expect(skipped).toEqual({ folders: 0, notes: 0, assets: 0 });
  });

  test('an empty workspace is a valid backup', () => {
    expect(validateBackupData({ folders: [], notes: [] }).data).toEqual({
      folders: [],
      notes: [],
      assets: [],
    });
  });

  test.each([
    ['not an object', 'text'],
    ['null', null],
    ['no folders', { notes: [] }],
    ['no notes', { folders: [] }],
    ['folders that are not a list', { folders: {}, notes: [] }],
    ['assets that are not a list', { folders: [], notes: [], assets: 'x' }],
  ])('rejects %s with a BackupError', (_label, input) => {
    expect(() => validateBackupData(input)).toThrow(BackupError);
  });

  test('skips what cannot be used and counts it', () => {
    const { data, skipped } = validateBackupData({
      folders: [
        valid.folders[0],
        valid.folders[0],
        { id: 'x', name: 'N', category: 'inbox' },
        'junk',
      ],
      notes: [valid.notes[0], valid.notes[0], { title: 'no id' }, null],
      assets: [
        pngAsset('a1'),
        pngAsset('svg', { mime: 'image/svg+xml' }),
        pngAsset('bad', { data: 'not base64!' }),
        pngAsset('a1'),
      ],
    });

    expect(data.folders).toHaveLength(1);
    expect(data.notes).toHaveLength(1);
    expect(data.assets.map((a) => a.id)).toEqual(['a1']);
    expect(skipped).toEqual({ folders: 3, notes: 3, assets: 3 });
  });

  test('the size of a picture is what its data says, not what the file claims', () => {
    const { data } = validateBackupData({ ...valid, assets: [pngAsset('a1', { size: 999999 })] });

    expect(data.assets[0]?.size).toBe(base64ByteLength(PNG));
  });

  test('a note whose folder is not in the file is left with no folder', () => {
    const { data } = validateBackupData({
      folders: [],
      notes: [note({ id: 'n1', folderId: 'gone' })],
    });

    expect(data.notes[0]?.folderId).toBeNull();
  });

  test('a picture the file does not carry is removed from the note that showed it', () => {
    const { data } = validateBackupData({
      folders: [],
      notes: [
        note({
          id: 'n1',
          doc: {
            type: 'doc',
            content: [...(doc('text').content ?? []), ...(docWithImage('missing').content ?? [])],
          },
        }),
      ],
      assets: [],
    });

    expect(JSON.stringify(data.notes[0]?.doc)).not.toContain('localImage');
    expect(JSON.stringify(data.notes[0]?.doc)).toContain('text');
  });

  test('sanitizes the content: no script-like link, no unknown node', () => {
    const { data } = validateBackupData({
      folders: [],
      notes: [
        {
          id: 'n1',
          title: 'x',
          doc: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'hi',
                    marks: [{ type: 'link', attrs: { href: 'javascript:1' } }],
                  },
                ],
              },
              { type: 'iframe' },
            ],
          },
        },
      ],
    });

    expect(JSON.stringify(data.notes[0]?.doc)).not.toMatch(/javascript|iframe/);
  });

  test('a missing or invalid date becomes the epoch, never a crash', () => {
    const { data } = validateBackupData({
      folders: [{ id: 'f1', name: 'F', category: 'areas', createdAt: 'yesterday' }],
      notes: [{ id: 'n1', title: 'N', createdAt: at(), updatedAt: 'never' }],
    });

    expect(data.folders[0]?.createdAt).toBe('1970-01-01T00:00:00.000Z');
    expect(data.notes[0]).toMatchObject({ createdAt: at(), updatedAt: at() });
  });
});

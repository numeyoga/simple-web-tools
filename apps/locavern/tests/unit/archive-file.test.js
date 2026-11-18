import { describe, it, expect, vi } from 'vitest';
import {
  buildArchiveZipBlob,
  parseArchiveFile,
  saveArchiveBlob,
} from '../../src/adapters/archive-file.js';
import { buildBackupPayload } from '../../src/core/backup.js';
import { createInitialState, reduce } from '../../src/core/store.js';

describe('archive-file saveArchiveBlob & encryption', () => {
  const blob = new Blob(['zip-bytes'], { type: 'application/zip' });

  it('utilise showSaveFilePicker lorsque disponible et écrit le blob dans le flux', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }));
    const fallbackDownload = vi.fn();

    const result = await saveArchiveBlob(blob, 'sauvegarde.zip', {
      showSaveFilePicker,
      fallbackDownload,
    });

    expect(result).toEqual({ saved: true, method: 'picker' });
    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'sauvegarde.zip' }),
    );
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledTimes(1);
    expect(fallbackDownload).not.toHaveBeenCalled();
  });

  it('annule proprement sans téléchargement de repli si l’utilisateur annule (AbortError)', async () => {
    const showSaveFilePicker = vi.fn(async () => {
      throw new DOMException('Annulé', 'AbortError');
    });
    const fallbackDownload = vi.fn();

    const result = await saveArchiveBlob(blob, 'sauvegarde.zip', {
      showSaveFilePicker,
      fallbackDownload,
    });

    expect(result).toEqual({ saved: false, cancelled: true });
    expect(fallbackDownload).not.toHaveBeenCalled();
  });

  it('bascule sur le téléchargement de repli si showSaveFilePicker est bloqué ou non pris en charge', async () => {
    for (const errName of ['SecurityError', 'NotAllowedError', 'NotSupportedError']) {
      const showSaveFilePicker = vi.fn(async () => {
        throw new DOMException('Bloqué', errName);
      });
      const fallbackDownload = vi.fn();

      const result = await saveArchiveBlob(blob, 'sauvegarde.zip', {
        showSaveFilePicker,
        fallbackDownload,
      });

      expect(result).toEqual({ saved: true, method: 'download' });
      expect(fallbackDownload).toHaveBeenCalledWith(blob, 'sauvegarde.zip');
    }
  });

  it('utilise directement le téléchargement lorsque showSaveFilePicker est absent', async () => {
    const fallbackDownload = vi.fn();
    const result = await saveArchiveBlob(blob, 'sauvegarde.zip', { fallbackDownload });

    expect(result).toEqual({ saved: true, method: 'download' });
    expect(fallbackDownload).toHaveBeenCalledWith(blob, 'sauvegarde.zip');
  });

  it('chiffre puis déchiffre une archive ZIP complète avec ses images locales', async () => {
    const NOW = '2026-11-15T10:00:00.000Z';
    let state = createInitialState();
    state = reduce(state, { type: 'create_project', id: 'p1', name: 'Coffre', now: NOW }).nextState;
    state = reduce(state, {
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Tâche protégée',
      now: NOW,
    }).nextState;
    state = reduce(state, {
      type: 'register_asset',
      asset: {
        id: 'a1',
        mimeType: 'image/png',
        sizeBytes: 3,
        filename: 'secret.png',
        createdAt: NOW,
      },
    }).nextState;

    const { manifest, data } = buildBackupPayload(state, { now: NOW, appVersion: '0.2.0' });
    const assetBlobs = new Map([
      ['a1', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })],
    ]);

    const encryptedBlob = await buildArchiveZipBlob({
      manifest,
      data,
      assetBlobs,
      password: 'PhraseSecrete#19',
    });

    const withoutPw = await parseArchiveFile(encryptedBlob);
    expect(withoutPw.ok).toBe(false);
    if (!withoutPw.ok) {
      expect(withoutPw.needsPassword).toBe(true);
    }

    const withWrongPw = await parseArchiveFile(encryptedBlob, { password: 'Faux' });
    expect(withWrongPw.ok).toBe(false);
    if (!withWrongPw.ok) {
      expect(withWrongPw.needsPassword).toBe(true);
      expect(withWrongPw.wrongPassword).toBe(true);
    }

    const unlocked = await parseArchiveFile(encryptedBlob, { password: 'PhraseSecrete#19' });
    expect(unlocked.ok).toBe(true);
    if (unlocked.ok) {
      expect(unlocked.encrypted).toBe(true);
      expect(unlocked.data.projects[0]?.name).toBe('Coffre');
      expect(unlocked.data.tasks[0]?.title).toBe('Tâche protégée');
      expect(unlocked.blobs.get('a1')?.size).toBe(3);
    }
  });
});

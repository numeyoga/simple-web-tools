import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chooseExportDirectory,
  forgetExportDirectory,
  getExportDirectoryName,
  initializeExportDirectory,
  saveBlobToExportDirectory,
  supportsExportDirectory,
} from '../../src/adapters/export-directory.js';
import { saveArchiveBlob } from '../../src/adapters/archive-file.js';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const write = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  const abort = vi.fn(async () => {});
  const directory = {
    kind: 'directory',
    name: 'Exports',
    requestPermission: vi.fn(async () => 'granted'),
    getFileHandle: vi.fn(async () => ({ createWritable: async () => ({ write, close, abort }) })),
  };
  const picker = vi.fn(async () => directory);
  vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: picker });
  const db = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
  const initialize = () =>
    initializeExportDirectory(
      /** @type {import('idb').IDBPDatabase} */ (/** @type {unknown} */ (db)),
    );
  return { write, close, abort, directory, picker, db, initialize };
}

describe('dossier des exports', () => {
  it('détecte les navigateurs compatibles et exige un contexte sécurisé', () => {
    setup();
    expect(supportsExportDirectory()).toBe(true);
    vi.stubGlobal('window', { isSecureContext: false, showDirectoryPicker: vi.fn() });
    expect(supportsExportDirectory()).toBe(false);
    vi.stubGlobal('window', { isSecureContext: true });
    expect(supportsExportDirectory()).toBe(false);
  });

  it('mémorise le dossier dans les métadonnées et y enregistre les exports', async () => {
    const f = setup();
    await f.initialize();
    expect(await chooseExportDirectory()).toEqual({ remembered: true });
    expect(f.db.put).toHaveBeenCalledWith('meta', { key: 'exportDirectory', value: f.directory });
    const blob = new Blob(['notes']);
    const fallbackDownload = vi.fn();
    expect(await saveArchiveBlob(blob, 'notes.md', { fallbackDownload })).toEqual({
      saved: true,
      method: 'directory',
    });
    expect(f.directory.getFileHandle).toHaveBeenCalledWith('notes.md', { create: true });
    expect(f.write).toHaveBeenCalledWith(blob);
    expect(f.close).toHaveBeenCalledOnce();
    expect(fallbackDownload).not.toHaveBeenCalled();
  });

  it('restaure le choix sans demander d’autorisation au démarrage', async () => {
    const f = setup();
    f.db.get.mockResolvedValue({ value: f.directory });
    await f.initialize();
    expect(getExportDirectoryName()).toBe('Exports');
    expect(f.directory.requestPermission).not.toHaveBeenCalled();
    await saveBlobToExportDirectory(new Blob(['x']), 'notes.md');
    expect(f.directory.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('conserve le choix courant après annulation du sélecteur', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    f.picker.mockRejectedValue(new DOMException('Annulé', 'AbortError'));
    await expect(chooseExportDirectory()).rejects.toMatchObject({ name: 'AbortError' });
    expect(getExportDirectoryName()).toBe('Exports');
  });

  it('garde le dossier utilisable lorsque la mémorisation échoue', async () => {
    const f = setup();
    await f.initialize();
    f.db.put.mockRejectedValue(new Error('Quota'));
    expect(await chooseExportDirectory()).toEqual({ remembered: false });
    expect(await saveBlobToExportDirectory(new Blob(['x']), 'notes.md')).toBe(true);
  });

  it('signale un refus d’accès sans écrire ni télécharger silencieusement', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    f.directory.requestPermission.mockResolvedValue('denied');
    const fallbackDownload = vi.fn();
    await expect(
      saveArchiveBlob(new Blob(['x']), 'notes.md', { fallbackDownload }),
    ).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(f.directory.getFileHandle).not.toHaveBeenCalled();
    expect(fallbackDownload).not.toHaveBeenCalled();
  });

  it('annule le flux en cas d’échec et propage l’erreur disque', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    f.write.mockRejectedValue(new Error('Disque plein'));
    await expect(saveBlobToExportDirectory(new Blob(['x']), 'notes.md')).rejects.toThrow(
      'Disque plein',
    );
    expect(f.abort).toHaveBeenCalledOnce();
    expect(f.close).not.toHaveBeenCalled();
  });

  it('retire le choix sans supprimer les fichiers', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    await forgetExportDirectory();
    expect(f.db.delete).toHaveBeenCalledWith('meta', 'exportDirectory');
    expect(getExportDirectoryName()).toBeNull();
    expect(await saveBlobToExportDirectory(new Blob(['x']), 'notes.md')).toBe(false);
    expect(f.directory.getFileHandle).not.toHaveBeenCalled();
  });

  it('refuse les chemins relatifs et noms spéciaux', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    for (const name of ['', '..', '../notes.md', 'dir\\notes.md']) {
      await expect(saveBlobToExportDirectory(new Blob(['x']), name)).rejects.toThrow(TypeError);
    }
    expect(f.directory.getFileHandle).not.toHaveBeenCalled();
  });
});

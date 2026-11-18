import { describe, it, expect } from 'vitest';
import {
  buildBackupPayload,
  formatBackupAgeLabel,
  prepareBackupMerge,
  validateArchiveContents,
} from '../../src/core/backup.js';
import { createInitialState, reduce } from '../../src/core/store.js';

describe('backup', () => {
  const NOW = '2026-11-13T10:00:00.000Z';

  it('formate l’ancienneté de la dernière sauvegarde ZIP selon le délai écoulé', () => {
    const baseMs = Date.parse(NOW);
    expect(formatBackupAgeLabel(null, baseMs)).toBe('Aucune sauvegarde ZIP');
    expect(formatBackupAgeLabel('invalide', baseMs)).toBe('Aucune sauvegarde ZIP');
    expect(formatBackupAgeLabel(new Date(baseMs - 10_000).toISOString(), baseMs)).toBe(
      'À l’instant',
    );
    expect(formatBackupAgeLabel(new Date(baseMs - 5 * 60_000).toISOString(), baseMs)).toBe(
      'Il y a 5 min',
    );
    expect(formatBackupAgeLabel(new Date(baseMs - 3 * 3_600_000).toISOString(), baseMs)).toBe(
      'Il y a 3 h',
    );
    expect(formatBackupAgeLabel(new Date(baseMs - 86_400_000).toISOString(), baseMs)).toBe(
      'Il y a 1 jour',
    );
    expect(formatBackupAgeLabel(new Date(baseMs - 4 * 86_400_000).toISOString(), baseMs)).toBe(
      'Il y a 4 jours',
    );
  });

  it('construit un manifeste et des données cohérents avec tableaux blancs puis valide la restauration', () => {
    let state = createInitialState();
    state = reduce(state, {
      type: 'set_task_statuses',
      statuses: [
        { id: 'todo', label: 'À faire' },
        { id: 'review', label: 'En revue' },
      ],
    }).nextState;
    state = reduce(state, { type: 'create_project', id: 'p1', name: 'Alpha', now: NOW }).nextState;
    state = reduce(state, {
      type: 'register_asset',
      asset: {
        id: 'a1',
        mimeType: 'image/png',
        sizeBytes: 4,
        filename: 'img.png',
        createdAt: NOW,
      },
    }).nextState;
    state = reduce(state, {
      type: 'create_note',
      id: 'n1',
      projectId: 'p1',
      title: 'Note avec image',
      assetIds: ['a1'],
      now: NOW,
    }).nextState;
    state = reduce(state, {
      type: 'create_whiteboard',
      id: 'wb1',
      projectId: 'p1',
      title: 'Tableau architecture',
      elements: [
        {
          id: 'el1',
          type: 'image',
          x: 20,
          y: 20,
          width: 120,
          height: 80,
          color: 'neutral',
          assetId: 'a1',
          zIndex: 0,
        },
      ],
      now: NOW,
    }).nextState;

    const { manifest, data } = buildBackupPayload(state, { now: NOW, appVersion: '0.2.0' });
    expect(manifest.format).toBe('locavern-archive');
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.counts).toEqual({
      projects: 1,
      tasks: 0,
      notes: 1,
      whiteboards: 1,
      assets: 1,
    });
    expect(data.whiteboards).toHaveLength(1);
    expect(data.taskStatuses).toEqual([
      { id: 'todo', label: 'À faire' },
      { id: 'review', label: 'En revue' },
    ]);

    const checkOk = validateArchiveContents(
      manifest,
      data,
      new Map([['a1', new Uint8Array([1, 2, 3, 4])]]),
    );
    expect(checkOk.ok).toBe(true);

    const checkMissingBlob = validateArchiveContents(manifest, data, new Map());
    expect(checkMissingBlob.ok).toBe(false);
  });

  it('rejette un type MIME non autorisé dans les métadonnées d’asset', () => {
    const { manifest, data } = buildBackupPayload(createInitialState(), {
      now: NOW,
      appVersion: '0.2.0',
    });
    const forged = {
      ...data,
      assets: [
        {
          id: 'a1',
          mimeType: 'image/svg+xml',
          sizeBytes: 10,
          filename: 'bad.svg',
          createdAt: NOW,
        },
      ],
    };
    const res = validateArchiveContents(manifest, forged, new Map([['a1', new Uint8Array(10)]]));
    expect(res.ok).toBe(false);
  });

  it('fusionne une archive sans écraser les identifiants existants et réassocie projets et images', () => {
    let localState = createInitialState();
    localState = reduce(localState, {
      type: 'create_project',
      id: 'p1',
      name: 'Local Existant',
      now: NOW,
    }).nextState;
    localState = reduce(localState, {
      type: 'register_asset',
      asset: {
        id: 'a1',
        mimeType: 'image/png',
        sizeBytes: 4,
        filename: 'local.png',
        createdAt: NOW,
      },
    }).nextState;
    localState = reduce(localState, {
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Tâche locale',
      now: NOW,
    }).nextState;

    let archiveState = createInitialState();
    archiveState = reduce(archiveState, {
      type: 'set_task_statuses',
      statuses: [
        { id: 'todo', label: 'À faire' },
        { id: 'qa', label: 'Recette' },
      ],
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_project',
      id: 'p1',
      name: 'Projet Importé',
      now: NOW,
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'register_asset',
      asset: {
        id: 'a1',
        mimeType: 'image/png',
        sizeBytes: 3,
        filename: 'import.png',
        createdAt: NOW,
      },
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Tâche importée',
      status: 'qa',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'localImage', attrs: { assetId: 'a1', alt: 'Schéma' } }],
      },
      assetIds: ['a1'],
      now: NOW,
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_whiteboard',
      id: 'wb1',
      projectId: 'p1',
      title: 'Tableau importé',
      elements: [
        {
          id: 'el1',
          type: 'image',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          color: 'neutral',
          assetId: 'a1',
          zIndex: 0,
        },
      ],
      assetIds: ['a1'],
      now: NOW,
    }).nextState;

    const { data } = buildBackupPayload(archiveState, { now: NOW, appVersion: '0.2.0' });
    const blob = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' });
    let seq = 0;
    const merged = prepareBackupMerge(localState, data, new Map([['a1', blob]]), {
      mode: 'merge',
      generateId: () => `gen-${++seq}`,
    });

    expect(merged.projects).toHaveLength(1);
    const importedProjectId = merged.projects[0]?.id;
    expect(importedProjectId).not.toBe('p1');
    expect(merged.assets).toHaveLength(1);
    const importedAssetId = merged.assets[0]?.id;
    expect(importedAssetId).not.toBe('a1');
    expect(merged.blobs.get(/** @type {string} */ (importedAssetId))).toBe(blob);

    expect(merged.tasks[0]?.id).not.toBe('t1');
    expect(merged.tasks[0]?.projectId).toBe(importedProjectId);
    expect(merged.tasks[0]?.assetIds).toEqual([importedAssetId]);
    expect(merged.tasks[0]?.descriptionDoc.content?.[0]?.attrs?.assetId).toBe(importedAssetId);

    expect(merged.whiteboards[0]?.projectId).toBe(importedProjectId);
    expect(merged.whiteboards[0]?.elements[0]?.assetId).toBe(importedAssetId);
    expect(merged.taskStatuses?.some((s) => s.id === 'qa')).toBe(true);

    const nextState = reduce(localState, {
      type: 'merge_backup',
      payload: {
        projects: merged.projects,
        tasks: merged.tasks,
        notes: merged.notes,
        whiteboards: merged.whiteboards,
        assets: merged.assets,
        taskStatuses: merged.taskStatuses,
      },
    }).nextState;
    expect(nextState.projects).toHaveLength(2);
    expect(nextState.tasks).toHaveLength(2);
    expect(nextState.assets).toHaveLength(2);
    expect(nextState.projects[0]?.name).toBe('Local Existant');
    expect(nextState.projects[1]?.name).toBe('Projet Importé');
  });

  it('importe uniquement les projets sélectionnés et leurs médias associés', () => {
    const localState = createInitialState();
    let archiveState = createInitialState();
    archiveState = reduce(archiveState, {
      type: 'create_project',
      id: 'p-keep',
      name: 'Gardé',
      now: NOW,
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_project',
      id: 'p-skip',
      name: 'Ignoré',
      now: NOW,
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'register_asset',
      asset: {
        id: 'a-keep',
        mimeType: 'image/png',
        sizeBytes: 2,
        filename: 'keep.png',
        createdAt: NOW,
      },
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'register_asset',
      asset: {
        id: 'a-skip',
        mimeType: 'image/png',
        sizeBytes: 2,
        filename: 'skip.png',
        createdAt: NOW,
      },
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_task',
      id: 't-keep',
      projectId: 'p-keep',
      title: 'Tâche gardée',
      assetIds: ['a-keep'],
      now: NOW,
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_task',
      id: 't-skip',
      projectId: 'p-skip',
      title: 'Tâche ignorée',
      assetIds: ['a-skip'],
      now: NOW,
    }).nextState;
    archiveState = reduce(archiveState, {
      type: 'create_note',
      id: 'n-free',
      projectId: null,
      title: 'Note libre',
      now: NOW,
    }).nextState;

    const { data } = buildBackupPayload(archiveState, { now: NOW, appVersion: '0.2.0' });
    const blobs = new Map([
      ['a-keep', new Blob([new Uint8Array([1, 2])], { type: 'image/png' })],
      ['a-skip', new Blob([new Uint8Array([3, 4])], { type: 'image/png' })],
    ]);

    const onlyKeep = prepareBackupMerge(localState, data, blobs, {
      mode: 'projects',
      selectedProjectIds: ['p-keep'],
      includeUnassigned: false,
    });
    expect(onlyKeep.projects.map((p) => p.id)).toEqual(['p-keep']);
    expect(onlyKeep.tasks.map((t) => t.id)).toEqual(['t-keep']);
    expect(onlyKeep.notes).toHaveLength(0);
    expect(onlyKeep.assets.map((a) => a.id)).toEqual(['a-keep']);
    expect([...onlyKeep.blobs.keys()]).toEqual(['a-keep']);

    const withUnassigned = prepareBackupMerge(localState, data, blobs, {
      mode: 'projects',
      selectedProjectIds: ['p-keep'],
      includeUnassigned: true,
    });
    expect(withUnassigned.notes.map((n) => n.id)).toEqual(['n-free']);
  });
});

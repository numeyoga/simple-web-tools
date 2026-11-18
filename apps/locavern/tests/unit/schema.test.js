import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  MAX_IMPORT_RECORDS,
  migrateBackupData,
  parseWhiteboard,
  validateBackupData,
} from '../../src/core/schema.js';

describe('schema', () => {
  const NOW = '2026-11-13T10:00:00.000Z';

  it('migre un payload v1 conforme vers v2 et assainit le texte enrichi', () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: NOW,
      projects: [
        {
          id: 'p1',
          name: 'Projet 1',
          description: '',
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      tasks: [
        {
          id: 't1',
          projectId: 'p1',
          title: 'Tâche',
          status: 'todo',
          priority: 'medium',
          dueDate: '2026-11-20',
          position: 0,
          descriptionDoc: {
            type: 'doc',
            content: [{ type: 'image', attrs: { src: 'https://evil.test/x.png' } }],
          },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [],
      assets: [],
    };

    const result = migrateBackupData(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schemaVersion).toBe(2);
      expect(result.data.whiteboards).toEqual([]);
      expect(result.data.tasks[0]?.descriptionDoc.content).toEqual([{ type: 'paragraph' }]);
    }
  });

  it('valide un payload v2 avec tableaux blancs et nettoie les éléments invalides', () => {
    const payload = {
      schemaVersion: 2,
      exportedAt: NOW,
      projects: [
        {
          id: 'p1',
          name: 'Projet 1',
          description: '',
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      tasks: [],
      notes: [],
      whiteboards: [
        {
          id: 'wb-1',
          projectId: 'p1',
          title: 'Diagramme',
          viewport: { panX: 12, panY: -8, zoom: 1.5 },
          elements: [
            {
              id: 'el-1',
              type: 'sticky',
              x: 20,
              y: 30,
              width: 160,
              height: 100,
              text: 'Note',
              color: 'accent',
              transparentBg: true,
              zIndex: 0,
            },
            {
              id: 'el-remote',
              type: 'image',
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              color: 'neutral',
              assetId: 'https://evil.test/remote.png',
              zIndex: 1,
            },
          ],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      assets: [],
    };

    const result = validateBackupData(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.whiteboards).toHaveLength(1);
      expect(result.data.whiteboards[0]?.elements).toHaveLength(1);
      expect(result.data.whiteboards[0]?.elements[0]?.transparentBg).toBe(true);
    }
  });

  it('rejette un tableau blanc rattaché à un projet inexistant', () => {
    const res = validateBackupData({
      schemaVersion: 2,
      exportedAt: NOW,
      projects: [],
      tasks: [],
      notes: [],
      whiteboards: [
        {
          id: 'wb-1',
          projectId: 'missing',
          title: 'Orphelin',
          viewport: { panX: 0, panY: 0, zoom: 1 },
          elements: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      assets: [],
    });
    expect(res.ok).toBe(false);
    expect(parseWhiteboard({ id: '', title: 'x' })).toBeNull();
  });

  it('rejette une version de schéma future inconnue', () => {
    const res = migrateBackupData({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(res.ok).toBe(false);
  });

  it('rejette une tâche orpheline dont le projet est absent', () => {
    const res = validateBackupData({
      schemaVersion: 2,
      exportedAt: NOW,
      projects: [],
      tasks: [
        {
          id: 't1',
          projectId: 'missing',
          title: 'Orpheline',
          status: 'todo',
          priority: 'low',
          dueDate: null,
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [],
      whiteboards: [],
      assets: [],
    });
    expect(res.ok).toBe(false);
  });

  it('rejette un import dépassant la limite maximale d’enregistrements', () => {
    const projects = Array.from({ length: MAX_IMPORT_RECORDS + 1 }, (_, i) => ({
      id: `p-${i}`,
      name: `P ${i}`,
      description: '',
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    }));
    const res = validateBackupData({
      schemaVersion: 2,
      exportedAt: NOW,
      projects,
      tasks: [],
      notes: [],
      whiteboards: [],
      assets: [],
    });
    expect(res.ok).toBe(false);
  });

  it('accepte des tâches sans statut, au statut personnalisé ou inconnu ainsi que taskStatuses dans la sauvegarde', () => {
    const res = validateBackupData({
      schemaVersion: 2,
      exportedAt: NOW,
      taskStatuses: [
        { id: 'todo', label: 'À faire' },
        { id: 'review', label: 'En revue' },
      ],
      projects: [
        {
          id: 'p1',
          name: 'P1',
          description: '',
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      tasks: [
        {
          id: 't-none',
          projectId: 'p1',
          title: 'Sans statut',
          status: null,
          priority: 'medium',
          dueDate: null,
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 't-custom',
          projectId: 'p1',
          title: 'Statut personnalisé',
          status: 'review',
          priority: 'high',
          dueDate: null,
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 't-unknown',
          projectId: 'p1',
          title: 'Statut supprimé',
          status: 'old_status',
          priority: 'low',
          dueDate: null,
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [],
      whiteboards: [],
      assets: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.taskStatuses).toEqual([
        { id: 'todo', label: 'À faire' },
        { id: 'review', label: 'En revue' },
      ]);
      expect(res.data.tasks.map((t) => [t.id, t.status])).toEqual([
        ['t-none', null],
        ['t-custom', 'review'],
        ['t-unknown', 'old_status'],
      ]);
    }
  });

  it('préserve une récurrence valide et assainit une valeur inconnue sur les tâches importées', () => {
    const res = validateBackupData({
      schemaVersion: 2,
      exportedAt: NOW,
      projects: [
        {
          id: 'p1',
          name: 'P1',
          description: '',
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      tasks: [
        {
          id: 't-valid-rec',
          projectId: 'p1',
          title: 'Hebdo',
          status: 'todo',
          priority: 'medium',
          dueDate: '2026-11-15',
          recurrence: 'weekly',
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: 't-bad-rec',
          projectId: 'p1',
          title: 'Invalide',
          status: 'todo',
          priority: 'low',
          dueDate: null,
          recurrence: 'hourly',
          position: 1,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [],
      whiteboards: [],
      assets: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.tasks[0]?.recurrence).toBe('weekly');
      expect(res.data.tasks[1]?.recurrence).toBeUndefined();
    }
  });

  it('préserve dueTime, les champs d’archive et les rôles de statut lors de la validation de sauvegarde', () => {
    const res = validateBackupData({
      schemaVersion: 2,
      exportedAt: NOW,
      taskStatuses: [
        { id: 'nouveau', label: 'Nouveau', isInitial: true },
        { id: 'cloture', label: 'Clôturé', isTerminal: true },
      ],
      projects: [
        {
          id: 'p1',
          name: 'P1',
          description: '',
          archived: true,
          archivedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      tasks: [
        {
          id: 't1',
          projectId: 'p1',
          title: 'Tâche soir',
          status: 'nouveau',
          priority: 'high',
          dueDate: '2026-11-20',
          dueTime: '21:15',
          archived: true,
          archivedAt: NOW,
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [
        {
          id: 'n1',
          projectId: 'p1',
          title: 'Note archivée',
          archived: true,
          archivedAt: NOW,
          contentDoc: { type: 'doc', content: [] },
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      whiteboards: [
        {
          id: 'w1',
          projectId: 'p1',
          title: 'WB archivé',
          archived: true,
          archivedAt: NOW,
          viewport: { panX: 0, panY: 0, zoom: 1 },
          elements: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      assets: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.taskStatuses?.[0]?.isInitial).toBe(true);
      expect(res.data.taskStatuses?.[1]?.isTerminal).toBe(true);
      expect(res.data.projects[0]?.archivedAt).toBe(NOW);
      expect(res.data.tasks[0]?.dueTime).toBe('21:15');
      expect(res.data.tasks[0]?.archived).toBe(true);
      expect(res.data.notes[0]?.archived).toBe(true);
      expect(res.data.whiteboards[0]?.archived).toBe(true);
    }
  });
});

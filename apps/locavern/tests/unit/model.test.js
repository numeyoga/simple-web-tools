import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_STATUSES,
  DEFAULT_WHITEBOARD_VIEWPORT,
  EMPTY_RICH_DOC,
  TASK_RECURRENCES,
  collectDocAssetIds,
  collectWhiteboardAssetIds,
  createNote,
  createProject,
  createTask,
  createTaskStatusId,
  createWhiteboard,
  getDefaultInitialTaskStatusId,
  getDefaultTerminalTaskStatusId,
  getTaskRecurrenceLabel,
  getTaskStatusMeta,
  getTaskStatusRole,
  inferLegacyTaskStatusRoles,
  isInitialTaskStatus,
  isTerminalTaskStatus,
  normalizeDueTime,
  getWhiteboardElementLayerBounds,
  normalizeTaskRecurrence,
  normalizeTaskStatuses,
  sanitizeRichTextDoc,
  stepWhiteboardElementLayer,
  sanitizeWhiteboardElements,
  sanitizeWhiteboardViewport,
} from '../../src/core/model.js';

describe('model', () => {
  const NOW = '2026-11-13T22:00:00.000Z';

  it('crée un projet valide et nettoie les espaces', () => {
    const project = createProject({
      id: 'proj-1',
      name: '  Refonte Locavern  ',
      description: '  Description  ',
      now: NOW,
    });

    expect(project).toEqual({
      id: 'proj-1',
      name: 'Refonte Locavern',
      description: 'Description',
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('rejette un projet sans nom', () => {
    expect(() => createProject({ id: 'proj-1', name: '   ', now: NOW })).toThrow();
  });

  it('crée une tâche avec les valeurs par défaut attendues', () => {
    const task = createTask({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Écrire les tests',
      now: NOW,
    });

    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.recurrence).toBeUndefined();
    expect(task.descriptionDoc).toEqual(EMPTY_RICH_DOC);
    expect(task.checklist).toEqual([]);
  });

  it('normalise la récurrence des tâches et fournit son libellé', () => {
    expect(TASK_RECURRENCES).toEqual(['daily', 'weekly', 'monthly']);
    expect(normalizeTaskRecurrence('daily')).toBe('daily');
    expect(normalizeTaskRecurrence('weekly')).toBe('weekly');
    expect(normalizeTaskRecurrence('monthly')).toBe('monthly');
    expect(normalizeTaskRecurrence('')).toBeNull();
    expect(normalizeTaskRecurrence('yearly')).toBeNull();
    expect(normalizeTaskRecurrence(null)).toBeNull();

    expect(getTaskRecurrenceLabel('daily')).toBe('Quotidienne');
    expect(getTaskRecurrenceLabel('weekly')).toBe('Hebdomadaire');
    expect(getTaskRecurrenceLabel('monthly')).toBe('Mensuelle');

    const recurring = createTask({
      id: 't-rec',
      projectId: 'p1',
      title: 'Sauvegarde',
      recurrence: 'weekly',
      now: NOW,
    });
    expect(recurring.recurrence).toBe('weekly');

    const nonRecurring = createTask({
      id: 't-norec',
      projectId: 'p1',
      title: 'Ponctuelle',
      // @ts-expect-error Vérifie l’assainissement d’une récurrence invalide
      recurrence: 'unknown',
      now: NOW,
    });
    expect(nonRecurring.recurrence).toBeUndefined();
  });

  it('rejette une tâche avec un statut invalide ou un titre vide', () => {
    expect(() => createTask({ id: 't1', projectId: 'p1', title: '', now: NOW })).toThrow();
    expect(() =>
      createTask({
        id: 't1',
        projectId: 'p1',
        title: 'Valide',
        status: 'archived',
        now: NOW,
      }),
    ).toThrow();
  });

  it('permet de créer une tâche sans statut (null) ou avec un statut personnalisé autorisé', () => {
    const noStatusTask = createTask({
      id: 't-none',
      projectId: 'p1',
      title: 'Tâche à trier',
      status: null,
      now: NOW,
    });
    expect(noStatusTask.status).toBeNull();

    const customStatusTask = createTask({
      id: 't-custom',
      projectId: 'p1',
      title: 'Tâche en revue',
      status: 'en_revue',
      allowedStatuses: ['todo', 'en_revue', 'done'],
      now: NOW,
    });
    expect(customStatusTask.status).toBe('en_revue');
  });

  it('normalise les statuts paramétrables, génère des identifiants uniques et identifie les statuts inconnus', () => {
    expect(normalizeTaskStatuses(undefined)).toEqual(DEFAULT_TASK_STATUSES);
    expect(normalizeTaskStatuses(null)).toEqual(DEFAULT_TASK_STATUSES);
    expect(normalizeTaskStatuses([])).toEqual([]);

    const normalized = normalizeTaskStatuses([
      { id: '  todo ', label: '  À faire  ' },
      { id: 'todo', label: 'Doublon ignoré' },
      { id: '', label: 'Sans id' },
      { id: 'bad', label: '   ' },
      { id: 'review', label: 'En revue' },
    ]);
    expect(normalized).toEqual([
      { id: 'todo', label: 'À faire' },
      { id: 'review', label: 'En revue' },
    ]);

    expect(createTaskStatusId('En révision !', ['todo', 'done'])).toBe('en_revision');
    expect(createTaskStatusId('En révision !', ['en_revision'])).toBe('en_revision_2');
    expect(createTaskStatusId('   !!!   ', ['statut'])).toBe('statut_2');

    expect(getTaskStatusMeta('todo', normalized)).toEqual({
      known: true,
      kind: 'known',
      label: 'À faire',
      badgeClass: 'cv-badge',
    });
    expect(getTaskStatusMeta('review', normalized)).toEqual({
      known: true,
      kind: 'known',
      label: 'En revue',
      badgeClass: 'cv-badge cv-badge--info',
    });
    expect(getTaskStatusMeta(null, normalized)).toEqual({
      known: false,
      kind: 'missing',
      label: 'Sans statut',
      badgeClass: 'cv-badge cv-badge--warning',
    });
    expect(getTaskStatusMeta('in_progress', normalized)).toEqual({
      known: false,
      kind: 'unknown',
      label: 'Statut inconnu (En cours)',
      badgeClass: 'cv-badge cv-badge--warning',
    });
    expect(getTaskStatusMeta('custom_orphan', normalized)).toEqual({
      known: false,
      kind: 'unknown',
      label: 'Statut inconnu (custom_orphan)',
      badgeClass: 'cv-badge cv-badge--warning',
    });
  });

  it('assainit un document Tiptap en supprimant les URL dangereuses et les images distantes', () => {
    const dirtyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Lien sûr',
              marks: [{ type: 'link', attrs: { href: 'https://example.org/' } }],
            },
            {
              type: 'text',
              text: 'Lien XSS',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        {
          type: 'image',
          attrs: { src: 'https://tracker.example/pixel.png', alt: 'distant' },
        },
        {
          type: 'localImage',
          attrs: { assetId: 'asset-1', alt: 'Capture locale' },
        },
      ],
    };

    const clean = sanitizeRichTextDoc(dirtyDoc);
    expect(clean.content).toHaveLength(2);
    expect(clean.content?.[0]?.content?.[0]?.marks).toEqual([
      {
        type: 'link',
        attrs: { href: 'https://example.org/', target: '_blank', rel: 'noopener noreferrer' },
      },
    ]);
    expect(clean.content?.[0]?.content?.[1]?.marks).toEqual([]);
    expect(clean.content?.[1]).toEqual({
      type: 'localImage',
      attrs: { assetId: 'asset-1', alt: 'Capture locale' },
    });
    expect(collectDocAssetIds(clean)).toEqual(['asset-1']);
  });

  it('crée une note autonome sans projet', () => {
    const note = createNote({
      id: 'note-1',
      projectId: null,
      title: 'Idées MVP',
      now: NOW,
    });
    expect(note.projectId).toBeNull();
    expect(note.contentDoc).toEqual(EMPTY_RICH_DOC);
    expect(note.assetIds).toEqual([]);
  });

  it('crée un tableau blanc valide avec valeurs par défaut et extrait les assetIds', () => {
    const wb = createWhiteboard({
      id: 'wb-1',
      projectId: null,
      title: '  Architecture système  ',
      elements: [
        {
          id: 'el-1',
          type: 'sticky',
          x: 40,
          y: 60,
          width: 180,
          height: 120,
          text: 'Idée clé',
          color: 'warning',
          zIndex: 1,
        },
        {
          id: 'el-2',
          type: 'image',
          x: 260,
          y: 80,
          width: 240,
          height: 160,
          color: 'neutral',
          assetId: 'img-local-1',
          zIndex: 2,
        },
      ],
      now: NOW,
    });

    expect(wb.title).toBe('Architecture système');
    expect(wb.projectId).toBeNull();
    expect(wb.viewport).toEqual(DEFAULT_WHITEBOARD_VIEWPORT);
    expect(wb.elements).toHaveLength(2);
    expect(wb.assetIds).toEqual(['img-local-1']);
  });

  it('rejette un tableau blanc sans titre ou sans identifiant', () => {
    expect(() =>
      createWhiteboard({ id: 'wb-1', projectId: null, title: '   ', now: NOW }),
    ).toThrow();
    expect(() =>
      createWhiteboard({ id: '   ', projectId: null, title: 'Valide', now: NOW }),
    ).toThrow();
  });

  it('assainit le viewport et les éléments du tableau blanc en bloquant les images distantes', () => {
    const vp = sanitizeWhiteboardViewport({ panX: 50000, panY: -99999, zoom: 10 });
    expect(vp).toEqual({ panX: 10000, panY: -10000, zoom: 3 });
    expect(sanitizeWhiteboardViewport({ panX: Number.NaN, panY: 0, zoom: 0.05 })).toEqual({
      panX: 0,
      panY: 0,
      zoom: 0.25,
    });

    const clean = sanitizeWhiteboardElements([
      {
        id: 'bad-remote-img',
        type: 'image',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        color: 'neutral',
        assetId: 'https://evil.test/img.png',
        zIndex: 0,
      },
      {
        id: 'bad-src-img',
        type: 'image',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        color: 'neutral',
        assetId: 'local-1',
        src: 'https://evil.test/img.png',
        zIndex: 0,
      },
      {
        id: 'bad-empty-img',
        type: 'image',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        color: 'neutral',
        zIndex: 0,
      },
      {
        id: 'ok-rect',
        type: 'rect',
        x: 10,
        y: 20,
        width: 4,
        height: 9999,
        text: 'a'.repeat(600),
        color: 'inconnue',
        zIndex: 1,
      },
      {
        id: 'ok-path',
        type: 'path',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color: 'accent',
        points: [
          [1, 2],
          ['bad', 4],
          [3, 4],
        ],
        zIndex: 2,
      },
      {
        id: 'ok-img',
        type: 'image',
        x: 50,
        y: 50,
        width: 200,
        height: 150,
        color: 'neutral',
        assetId: 'asset-42',
        zIndex: 3,
      },
    ]);

    expect(clean).toHaveLength(3);
    expect(clean[0]).toMatchObject({
      id: 'ok-rect',
      width: 16,
      height: 4000,
      color: 'neutral',
    });
    expect(clean[0]?.text).toHaveLength(500);
    expect(clean[1]?.points).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(collectWhiteboardAssetIds(clean)).toEqual(['asset-42']);
  });

  it('préserve transparentBg uniquement sur sticky, rect et ellipse', () => {
    const clean = sanitizeWhiteboardElements([
      {
        id: 'rect-t',
        type: 'rect',
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        color: 'accent',
        transparentBg: true,
        zIndex: 0,
      },
      {
        id: 'arrow-t',
        type: 'arrow',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        color: 'neutral',
        transparentBg: true,
        zIndex: 1,
      },
      {
        id: 'sticky-opaque',
        type: 'sticky',
        x: 10,
        y: 10,
        width: 140,
        height: 100,
        color: 'warning',
        transparentBg: false,
        zIndex: 2,
      },
    ]);

    expect(clean[0]?.transparentBg).toBe(true);
    expect(clean[1]?.transparentBg).toBeUndefined();
    expect(clean[2]?.transparentBg).toBeUndefined();
  });

  it('déplace un élément d’un niveau devant ou derrière en zIndex', () => {
    const base = sanitizeWhiteboardElements([
      { id: 'a', type: 'sticky', x: 0, y: 0, width: 100, height: 100, color: 'neutral', zIndex: 2 },
      { id: 'b', type: 'rect', x: 10, y: 10, width: 100, height: 100, color: 'accent', zIndex: 2 },
      {
        id: 'c',
        type: 'ellipse',
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        color: 'success',
        zIndex: 9,
      },
    ]);

    expect(getWhiteboardElementLayerBounds(base, 'a')).toEqual({
      canBringForward: true,
      canSendBackward: false,
    });
    expect(getWhiteboardElementLayerBounds(base, 'c')).toEqual({
      canBringForward: false,
      canSendBackward: true,
    });

    const step1 = stepWhiteboardElementLayer(base, 'a', 1);
    expect(step1.changed).toBe(true);
    expect(step1.elements.map((el) => [el.id, el.zIndex])).toEqual([
      ['a', 1],
      ['b', 0],
      ['c', 2],
    ]);

    const step2 = stepWhiteboardElementLayer(step1.elements, 'a', 1);
    expect(step2.changed).toBe(true);
    expect(step2.elements.map((el) => [el.id, el.zIndex])).toEqual([
      ['a', 2],
      ['b', 0],
      ['c', 1],
    ]);

    const stepBlocked = stepWhiteboardElementLayer(step2.elements, 'a', 1);
    expect(stepBlocked.changed).toBe(false);

    const stepBack = stepWhiteboardElementLayer(step2.elements, 'a', -1);
    expect(stepBack.changed).toBe(true);
    expect(stepBack.elements.map((el) => [el.id, el.zIndex])).toEqual([
      ['a', 1],
      ['b', 0],
      ['c', 2],
    ]);
  });

  it('gère les rôles sémantiques initial/terminal des statuts, l’heure limite et les indicateurs d’archive', () => {
    expect(DEFAULT_TASK_STATUSES[0]?.isInitial).toBe(true);
    expect(DEFAULT_TASK_STATUSES[2]?.isTerminal).toBe(true);
    expect(getTaskStatusRole('todo', DEFAULT_TASK_STATUSES)).toBe('initial');
    expect(getTaskStatusRole('in_progress', DEFAULT_TASK_STATUSES)).toBeNull();
    expect(getTaskStatusRole('done', DEFAULT_TASK_STATUSES)).toBe('terminal');
    expect(isInitialTaskStatus('todo', DEFAULT_TASK_STATUSES)).toBe(true);
    expect(isTerminalTaskStatus('done', DEFAULT_TASK_STATUSES)).toBe(true);
    expect(getDefaultInitialTaskStatusId(DEFAULT_TASK_STATUSES)).toBe('todo');
    expect(getDefaultTerminalTaskStatusId(DEFAULT_TASK_STATUSES)).toBe('done');

    // Inférence des statuts hérités
    const inferred = inferLegacyTaskStatusRoles([
      { id: 'todo', label: 'À faire' },
      { id: 'review', label: 'Revue' },
      { id: 'done', label: 'Terminé' },
    ]);
    expect(inferred[0]?.isInitial).toBe(true);
    expect(inferred[1]?.isInitial).toBeUndefined();
    expect(inferred[2]?.isTerminal).toBe(true);

    // Exclusion mutuelle : isTerminal prime si les deux booléens sont fournis
    const normalized = normalizeTaskStatuses([
      { id: 's1', label: 'Clôture', isInitial: true, isTerminal: true },
    ]);
    expect(normalized).toEqual([{ id: 's1', label: 'Clôture', isTerminal: true }]);

    // Normalisation dueTime et suppression sans date
    expect(normalizeDueTime('19:05')).toBe('19:05');
    expect(() => normalizeDueTime('25:00')).toThrow();
    const tTimed = createTask({
      id: 't-time',
      projectId: 'p1',
      title: 'Réunion tardive',
      dueDate: '2026-11-16',
      dueTime: '20:30',
      archived: true,
      archivedAt: NOW,
      now: NOW,
    });
    expect(tTimed.dueTime).toBe('20:30');
    expect(tTimed.archived).toBe(true);
    expect(tTimed.archivedAt).toBe(NOW);

    const tNoDate = createTask({
      id: 't-notime',
      projectId: 'p1',
      title: 'Sans date',
      dueDate: null,
      dueTime: '20:30',
      now: NOW,
    });
    expect(tNoDate.dueTime).toBeUndefined();
    expect(tNoDate.archived).toBeUndefined();

    const nArch = createNote({
      id: 'n-arch',
      projectId: null,
      title: 'Archive note',
      archived: true,
      archivedAt: NOW,
      now: NOW,
    });
    expect(nArch.archived).toBe(true);
    const wArch = createWhiteboard({
      id: 'w-arch',
      projectId: null,
      title: 'Archive WB',
      archived: true,
      archivedAt: NOW,
      now: NOW,
    });
    expect(wArch.archived).toBe(true);
  });
});

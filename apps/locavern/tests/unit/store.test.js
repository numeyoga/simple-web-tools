import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_STATUSES,
  createInitialState,
  createStore,
  reduce,
  selectAllTags,
  selectArchivedEntries,
  selectEntityLinkEntries,
  selectProjects,
  selectKanbanColumns,
  selectUnmappedKanbanTasks,
  selectNotes,
  selectOrphanedAssetIds,
  selectReferencedAssetIds,
  selectTasks,
  selectTodaySummary,
  selectTrashItems,
  selectWhiteboards,
} from '../../src/core/store.js';

describe('store', () => {
  const T1 = '2026-11-13T10:00:00.000Z';
  const T2 = '2026-11-13T11:00:00.000Z';

  it('gère la création de projet, de tâches et le réordonnancement Kanban', () => {
    const store = createStore(createInitialState());

    store.dispatch({
      type: 'create_project',
      id: 'p1',
      name: 'Locavern',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Première tâche',
      priority: 'high',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't2',
      projectId: 'p1',
      title: 'Deuxième tâche',
      priority: 'low',
      now: T1,
    });

    let cols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(cols.todo?.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(cols.in_progress).toEqual([]);

    store.dispatch({
      type: 'move_task',
      id: 't1',
      targetStatus: 'in_progress',
      targetIndex: 0,
      now: T2,
    });

    cols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(cols.todo?.map((t) => [t.id, t.position])).toEqual([['t2', 0]]);
    expect(cols.in_progress?.map((t) => [t.id, t.position])).toEqual([['t1', 0]]);
  });

  it('bloque les commandes d’écriture en mode lecture seule (Web Locks)', () => {
    const s0 = createInitialState();
    const { nextState: s1 } = reduce(s0, { type: 'set_read_only', readOnly: true });
    expect(s1.readOnly).toBe(true);

    const { nextState: s2, effects } = reduce(s1, {
      type: 'create_project',
      id: 'p1',
      name: 'Interdit',
      now: T1,
    });
    expect(s2.projects).toHaveLength(0);
    expect(effects).toEqual([]);
  });

  it('supprime les tâches associées et délie notes et tableaux blancs lors de la suppression d’un projet', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'P1', now: T1 });
    store.dispatch({ type: 'create_task', id: 't1', projectId: 'p1', title: 'T1', now: T1 });
    store.dispatch({ type: 'create_note', id: 'n1', projectId: 'p1', title: 'N1', now: T1 });
    store.dispatch({
      type: 'create_whiteboard',
      id: 'wb1',
      projectId: 'p1',
      title: 'WB1',
      now: T1,
    });
    store.dispatch({ type: 'select_project', projectId: 'p1' });

    const result = store.dispatch({ type: 'delete_project', id: 'p1' });
    expect(store.getState().projects).toHaveLength(0);
    expect(selectTasks(store.getState(), {})).toHaveLength(0);
    expect(store.getState().notes[0]?.projectId).toBeNull();
    expect(store.getState().whiteboards[0]?.projectId).toBeNull();
    expect(store.getState().preferences.selectedProjectId).toBeNull();
    const removeEffect = result.effects.find((e) => e.type === 'remove_project');
    expect(removeEffect).toBeDefined();
    if (removeEffect?.type === 'remove_project') {
      expect(removeEffect.updatedWhiteboards).toHaveLength(1);
    }
  });

  it('gère le CRUD des tableaux blancs, la sélection, les filtres et les assetIds référencés', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Design', now: T1 });

    const createRes = store.dispatch({
      type: 'create_whiteboard',
      id: 'wb-1',
      projectId: 'p1',
      title: 'Flux utilisateur',
      now: T1,
    });
    expect(createRes.effects.some((e) => e.type === 'persist_whiteboard')).toBe(true);
    expect(store.getState().preferences.selectedWhiteboardId).toBe('wb-1');

    store.dispatch({
      type: 'create_whiteboard',
      id: 'wb-2',
      projectId: null,
      title: 'Schéma libre',
      now: T2,
    });

    expect(selectWhiteboards(store.getState(), {}).map((w) => w.id)).toEqual(['wb-2', 'wb-1']);
    expect(selectWhiteboards(store.getState(), { projectId: 'p1' }).map((w) => w.id)).toEqual([
      'wb-1',
    ]);
    expect(selectWhiteboards(store.getState(), { query: 'flux' }).map((w) => w.id)).toEqual([
      'wb-1',
    ]);

    store.dispatch({
      type: 'update_whiteboard',
      id: 'wb-1',
      patch: {
        elements: [
          {
            id: 'img-el',
            type: 'image',
            x: 10,
            y: 10,
            width: 120,
            height: 90,
            color: 'neutral',
            assetId: 'asset-wb-1',
            zIndex: 0,
          },
        ],
      },
      now: T2,
    });
    expect(selectReferencedAssetIds(store.getState()).has('asset-wb-1')).toBe(true);

    const delRes = store.dispatch({ type: 'delete_whiteboard', id: 'wb-2' });
    expect(delRes.effects.some((e) => e.type === 'remove_whiteboard')).toBe(true);
    expect(store.getState().preferences.selectedWhiteboardId).toBe('wb-1');
  });

  it('étend la recherche locale aux descriptions, checklists, notes Tiptap et textes du tableau blanc', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Recherche', now: T1 });

    store.dispatch({
      type: 'create_task',
      id: 't-desc',
      projectId: 'p1',
      title: 'Déploiement serveur',
      descriptionDoc: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Configurer chiffrement AES-GCM hors ligne.' }],
          },
        ],
      },
      checklist: [{ id: 'c1', text: 'Exporter manifeste sécurité', done: false }],
      now: T1,
    });

    store.dispatch({
      type: 'create_task',
      id: 't-other',
      projectId: 'p1',
      title: 'Documentation',
      now: T1,
    });

    store.dispatch({
      type: 'create_note',
      id: 'n-rich',
      projectId: 'p1',
      title: 'Notes architecture',
      contentDoc: {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Utiliser IndexedDB transactionnel' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      now: T1,
    });

    store.dispatch({
      type: 'create_whiteboard',
      id: 'wb-text',
      projectId: 'p1',
      title: 'Schéma global',
      elements: [
        {
          id: 'el-1',
          type: 'sticky',
          x: 0,
          y: 0,
          width: 180,
          height: 120,
          color: 'warning',
          text: 'Connecteur synchrone',
          zIndex: 0,
        },
      ],
      now: T1,
    });

    expect(selectTasks(store.getState(), { query: 'AES-GCM' }).map((t) => t.id)).toEqual([
      't-desc',
    ]);
    expect(selectTasks(store.getState(), { query: 'securite' }).map((t) => t.id)).toEqual([
      't-desc',
    ]);
    expect(selectKanbanColumns(store.getState(), 'p1', 'manifeste').todo?.map((t) => t.id)).toEqual(
      ['t-desc'],
    );
    expect(selectNotes(store.getState(), { query: 'transactionnel' }).map((n) => n.id)).toEqual([
      'n-rich',
    ]);
    expect(selectWhiteboards(store.getState(), { query: 'connecteur' }).map((w) => w.id)).toEqual([
      'wb-text',
    ]);
  });

  it('paramètre et normalise le visuel de saisie par écran dans les préférences', () => {
    const s0 = createInitialState();
    expect(s0.preferences.inputPresentations).toEqual({
      tasks: 'drawer',
      projects: 'modal',
      notes: 'drawer',
      whiteboards: 'modal',
    });

    const store = createStore(s0);
    store.dispatch({
      type: 'hydrate',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
        preferences: {
          inputPresentations: {
            tasks: 'modal',
            // @ts-expect-error Vérifie la normalisation d’une valeur persistée invalide
            notes: 'invalid',
          },
        },
      },
    });
    expect(store.getState().preferences.inputPresentations).toEqual({
      tasks: 'modal',
      projects: 'modal',
      notes: 'drawer',
      whiteboards: 'modal',
    });

    const res1 = store.dispatch({
      type: 'set_input_presentation',
      screen: 'projects',
      presentation: 'drawer',
    });
    expect(store.getState().preferences.inputPresentations.projects).toBe('drawer');
    expect(res1.effects).toEqual([
      {
        type: 'persist_preferences',
        preferences: store.getState().preferences,
      },
    ]);

    const resNoop = store.dispatch({
      type: 'set_input_presentation',
      screen: 'projects',
      presentation: 'drawer',
    });
    expect(resNoop.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: true });
    const resReadOnly = store.dispatch({
      type: 'set_input_presentation',
      screen: 'whiteboards',
      presentation: 'drawer',
    });
    expect(store.getState().preferences.inputPresentations.whiteboards).toBe('drawer');
    expect(resReadOnly.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: false });
    store.dispatch({
      type: 'replace_all',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
      },
    });
    expect(store.getState().preferences.inputPresentations).toEqual({
      tasks: 'modal',
      projects: 'drawer',
      notes: 'drawer',
      whiteboards: 'drawer',
    });
  });

  it('paramètre et normalise la durée des toasts en secondes dans les préférences', () => {
    const s0 = createInitialState();
    expect(s0.preferences.toastDurationSeconds).toBe(6);

    const store = createStore(s0);
    store.dispatch({
      type: 'hydrate',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
        preferences: {
          // @ts-expect-error Vérifie la normalisation d’une valeur persistée invalide
          toastDurationSeconds: 'invalid',
        },
      },
    });
    expect(store.getState().preferences.toastDurationSeconds).toBe(6);

    store.dispatch({
      type: 'hydrate',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
        preferences: {
          toastDurationSeconds: 120,
        },
      },
    });
    expect(store.getState().preferences.toastDurationSeconds).toBe(60);

    const res1 = store.dispatch({ type: 'set_toast_duration', seconds: 3 });
    expect(store.getState().preferences.toastDurationSeconds).toBe(3);
    expect(res1.effects).toEqual([
      {
        type: 'persist_preferences',
        preferences: store.getState().preferences,
      },
    ]);

    const resNoop = store.dispatch({ type: 'set_toast_duration', seconds: 3 });
    expect(resNoop.effects).toEqual([]);

    const resClamped = store.dispatch({ type: 'set_toast_duration', seconds: 0 });
    expect(store.getState().preferences.toastDurationSeconds).toBe(1);
    expect(resClamped.effects).toHaveLength(1);

    const resInvalid = store.dispatch({ type: 'set_toast_duration', seconds: Number.NaN });
    expect(store.getState().preferences.toastDurationSeconds).toBe(1);
    expect(resInvalid.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: true });
    const resReadOnly = store.dispatch({ type: 'set_toast_duration', seconds: 10 });
    expect(store.getState().preferences.toastDurationSeconds).toBe(10);
    expect(resReadOnly.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: false });
    store.dispatch({
      type: 'replace_all',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
      },
    });
    expect(store.getState().preferences.toastDurationSeconds).toBe(10);
  });

  it('paramètre les statuts Kanban et exclut du Kanban les tâches sans statut ou au statut inconnu tout en les affichant dans la liste', () => {
    const store = createStore(createInitialState());
    expect(store.getState().preferences.taskStatuses).toEqual(DEFAULT_TASK_STATUSES);

    store.dispatch({ type: 'create_project', id: 'p1', name: 'Projet Statuts', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't-todo',
      projectId: 'p1',
      title: 'Tâche à faire',
      status: 'todo',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't-doing',
      projectId: 'p1',
      title: 'Tâche en cours',
      status: 'in_progress',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't-none',
      projectId: 'p1',
      title: 'Tâche sans statut',
      status: null,
      now: T1,
    });

    // La tâche sans statut est présente dans la liste mais absente du Kanban
    const initialCols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(Object.keys(initialCols)).toEqual(['todo', 'in_progress', 'done']);
    expect(initialCols.todo?.map((t) => t.id)).toEqual(['t-todo']);
    expect(initialCols.in_progress?.map((t) => t.id)).toEqual(['t-doing']);
    expect(initialCols.done).toEqual([]);
    expect(selectTasks(store.getState(), { projectId: 'p1' }).map((t) => t.id)).toEqual([
      't-todo',
      't-doing',
      't-none',
    ]);
    expect(
      selectTasks(store.getState(), { projectId: 'p1', status: '__none__' }).map((t) => t.id),
    ).toEqual(['t-none']);

    // Personnalisation des statuts : renommage, ajout de "review", suppression de "in_progress"
    const setRes = store.dispatch({
      type: 'set_task_statuses',
      statuses: [
        { id: 'todo', label: 'À traiter' },
        { id: 'review', label: 'En revue' },
        { id: 'done', label: 'Terminé' },
      ],
    });
    expect(setRes.effects).toEqual([
      {
        type: 'persist_preferences',
        preferences: store.getState().preferences,
      },
    ]);

    // La tâche qui avait "in_progress" a désormais un statut inconnu :
    // absente du Kanban, mais visible dans la liste et filtrable via "__unknown__"
    const customCols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(Object.keys(customCols)).toEqual(['todo', 'review', 'done']);
    expect(customCols.todo?.map((t) => t.id)).toEqual(['t-todo']);
    expect(customCols.review?.map((t) => t.id)).toEqual([]);
    expect(customCols.done?.map((t) => t.id)).toEqual([]);

    expect(selectTasks(store.getState(), { projectId: 'p1' }).map((t) => t.id)).toEqual([
      't-todo',
      't-doing',
      't-none',
    ]);
    expect(
      selectTasks(store.getState(), { projectId: 'p1', status: '__unknown__' }).map((t) => t.id),
    ).toEqual(['t-doing']);

    // On peut modifier le titre d’une tâche au statut inconnu sans écraser son statut
    store.dispatch({
      type: 'update_task',
      id: 't-doing',
      patch: { title: 'Tâche en cours (orpheline)' },
      now: T2,
    });
    expect(store.getState().tasks.find((t) => t.id === 't-doing')?.status).toBe('in_progress');

    // Puis la réassigner au nouveau statut personnalisé "review"
    store.dispatch({
      type: 'update_task',
      id: 't-doing',
      patch: { status: 'review' },
      now: T2,
    });
    expect(selectKanbanColumns(store.getState(), 'p1', '').review?.map((t) => t.id)).toEqual([
      't-doing',
    ]);
    expect(selectTasks(store.getState(), { projectId: 'p1', status: '__unknown__' })).toHaveLength(
      0,
    );

    // En mode lecture seule, set_task_statuses est bloqué
    store.dispatch({ type: 'set_read_only', readOnly: true });
    const roRes = store.dispatch({
      type: 'set_task_statuses',
      statuses: [{ id: 'todo', label: 'Interdit' }],
    });
    expect(roRes.effects).toEqual([]);
    expect(store.getState().preferences.taskStatuses.map((s) => s.id)).toEqual([
      'todo',
      'review',
      'done',
    ]);
  });

  it('identifie les images locales orphelines après modification ou suppression via selectOrphanedAssetIds et delete_asset', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Médias', now: T1 });
    store.dispatch({
      type: 'register_asset',
      asset: { id: 'a1', mimeType: 'image/png', sizeBytes: 10, filename: 'one.png', createdAt: T1 },
    });
    store.dispatch({
      type: 'register_asset',
      asset: { id: 'a2', mimeType: 'image/png', sizeBytes: 10, filename: 'two.png', createdAt: T1 },
    });
    store.dispatch({
      type: 'create_note',
      id: 'n1',
      projectId: 'p1',
      title: 'Note 1',
      assetIds: ['a1', 'a2'],
      now: T1,
    });
    store.dispatch({
      type: 'create_note',
      id: 'n2',
      projectId: 'p1',
      title: 'Note 2 partagée',
      assetIds: ['a1'],
      now: T1,
    });

    expect(selectOrphanedAssetIds(store.getState())).toEqual([]);

    // Supprimer n1 : a2 devient orphelin mais a1 reste utilisé par n2
    store.dispatch({ type: 'delete_note', id: 'n1' });
    expect(selectOrphanedAssetIds(store.getState())).toEqual(['a2']);

    const delRes = store.dispatch({ type: 'delete_asset', id: 'a2' });
    expect(delRes.effects).toEqual([{ type: 'remove_asset', id: 'a2' }]);
    expect(store.getState().assets.map((a) => a.id)).toEqual(['a1']);
  });

  it('agrège tâches en retard, échéances proches, priorités hautes et éléments récents dans selectTodaySummary', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'P1', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't-late',
      projectId: 'p1',
      title: 'En retard',
      priority: 'medium',
      dueDate: '2026-11-13',
      now: '2026-11-13T09:00:00.000Z',
    });
    store.dispatch({
      type: 'create_task',
      id: 't-today',
      projectId: 'p1',
      title: 'Pour aujourd’hui',
      priority: 'high',
      dueDate: '2026-11-15',
      now: '2026-11-14T09:00:00.000Z',
    });
    store.dispatch({
      type: 'create_task',
      id: 't-soon',
      projectId: 'p1',
      title: 'Dans 3 jours',
      priority: 'low',
      dueDate: '2026-11-18',
      now: '2026-11-14T10:00:00.000Z',
    });
    store.dispatch({
      type: 'create_task',
      id: 't-done',
      projectId: 'p1',
      title: 'Déjà terminée',
      status: 'done',
      priority: 'high',
      dueDate: '2026-11-10',
      now: '2026-11-15T08:00:00.000Z',
    });
    store.dispatch({
      type: 'create_note',
      id: 'n-recent',
      projectId: 'p1',
      title: 'Compte-rendu',
      now: '2026-11-15T12:00:00.000Z',
    });

    const summary = selectTodaySummary(store.getState(), '2026-11-15');
    expect(summary.overdueTasks.map((t) => t.id)).toEqual(['t-late']);
    expect(summary.dueTodayTasks.map((t) => t.id)).toEqual(['t-today']);
    expect(summary.upcomingTasks.map((t) => t.id)).toEqual(['t-soon']);
    expect(summary.highPriorityTasks.map((t) => t.id)).toEqual(['t-today']);
    expect(summary.recentItems[0]?.id).toBe('n-recent');
  });

  it('filtre le Kanban par priorité et échéance et isole les tâches hors colonnes', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'P1', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Retard haute',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-10',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't2',
      projectId: 'p1',
      title: 'Sans échéance basse',
      status: 'todo',
      priority: 'low',
      dueDate: null,
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't3',
      projectId: 'p1',
      title: 'Hors statut',
      status: null,
      priority: 'high',
      dueDate: '2026-11-15',
      now: T1,
    });

    const colsHigh = selectKanbanColumns(store.getState(), 'p1', '', {
      priority: 'high',
      todayIso: '2026-11-15',
    });
    expect(colsHigh.todo?.map((t) => t.id)).toEqual(['t1']);

    const colsUndated = selectKanbanColumns(store.getState(), 'p1', '', {
      due: 'undated',
      todayIso: '2026-11-15',
    });
    expect(colsUndated.todo?.map((t) => t.id)).toEqual(['t2']);

    const unmapped = selectUnmappedKanbanTasks(store.getState(), 'p1', {
      priority: 'high',
      due: 'today',
      todayIso: '2026-11-15',
    });
    expect(unmapped.map((t) => t.id)).toEqual(['t3']);
  });

  it('normalise les étiquettes transversales sur tâches et notes et filtre au-delà des projets', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Alpha', now: T1 });
    store.dispatch({ type: 'create_project', id: 'p2', name: 'Beta', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Tâche Alpha',
      tags: ['#Urgent', 'frontend', 'urgent'],
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't2',
      projectId: 'p2',
      title: 'Tâche Beta',
      tags: ['Urgent'],
      now: T1,
    });
    store.dispatch({
      type: 'create_note',
      id: 'n1',
      projectId: 'p2',
      title: 'Note Beta',
      tags: ['architecture', 'Frontend'],
      now: T1,
    });

    expect(selectAllTags(store.getState())).toEqual(['architecture', 'frontend', 'Urgent']);
    expect(selectTasks(store.getState(), { tag: 'urgent' }).map((t) => t.id)).toEqual(['t1', 't2']);
    expect(
      selectNotes(store.getState(), { projectId: 'all', tag: 'frontend' }).map((n) => n.id),
    ).toEqual(['n1']);

    store.dispatch({
      type: 'update_note',
      id: 'n1',
      patch: { tags: ['architecture'] },
      now: T2,
    });
    expect(selectNotes(store.getState(), { projectId: 'all', tag: 'frontend' })).toEqual([]);
  });

  it('lie tâches, notes et tableaux blancs par références internes et purge les liens rompus', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Locavern', now: T1 });
    store.dispatch({
      type: 'create_note',
      id: 'n1',
      projectId: 'p1',
      title: 'Spec technique',
      now: T1,
    });
    store.dispatch({
      type: 'create_whiteboard',
      id: 'w1',
      projectId: 'p1',
      title: 'Architecture',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Implémenter liens',
      links: [
        { kind: 'note', id: 'n1' },
        { kind: 'whiteboard', id: 'w1' },
        { kind: 'task', id: 't1' },
        { kind: 'note', id: 'n1' },
      ],
      now: T1,
    });

    const taskLinks = selectEntityLinkEntries(store.getState(), 'task', 't1');
    expect(taskLinks.outgoing.map((e) => `${e.kind}:${e.id}`)).toEqual([
      'note:n1',
      'whiteboard:w1',
    ]);

    const noteLinks = selectEntityLinkEntries(store.getState(), 'note', 'n1');
    expect(noteLinks.incoming.map((e) => `${e.kind}:${e.id}`)).toEqual(['task:t1']);

    // Suppression du tableau blanc -> lien automatiquement purgé de la tâche
    store.dispatch({ type: 'delete_whiteboard', id: 'w1' });
    const afterWbDelete = selectEntityLinkEntries(store.getState(), 'task', 't1');
    expect(afterWbDelete.outgoing.map((e) => `${e.kind}:${e.id}`)).toEqual(['note:n1']);
    expect(store.getState().tasks[0]?.links).toEqual([{ kind: 'note', id: 'n1' }]);
  });

  it('conserve les éléments supprimés en corbeille, préserve leurs images puis purge à expiration', () => {
    const store = createStore(createInitialState());
    store.dispatch({
      type: 'create_project',
      id: 'p1',
      name: 'Projet A',
      now: '2026-11-01T10:00:00.000Z',
    });
    store.dispatch({
      type: 'register_asset',
      asset: {
        id: 'a-trash',
        mimeType: 'image/png',
        sizeBytes: 12,
        filename: 't.png',
        createdAt: T1,
      },
    });
    store.dispatch({
      type: 'create_note',
      id: 'n1',
      projectId: 'p1',
      title: 'Note sensible',
      assetIds: ['a-trash'],
      now: '2026-11-01T10:00:00.000Z',
    });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Tâche liée',
      links: [{ kind: 'note', id: 'n1' }],
      now: '2026-11-01T10:00:00.000Z',
    });

    // Rétention configurée à 7 jours
    store.dispatch({ type: 'set_trash_retention_days', days: 7 });
    expect(store.getState().preferences.trashRetentionDays).toBe(7);

    // Mise en corbeille de la note -> absente des notes actives, présente en corbeille, asset préservé
    store.dispatch({
      type: 'trash_note',
      id: 'n1',
      trashId: 'tr-n1',
      now: '2026-11-02T10:00:00.000Z',
    });
    expect(store.getState().notes).toHaveLength(0);
    expect(selectTrashItems(store.getState()).map((i) => i.id)).toEqual(['tr-n1']);
    expect(selectOrphanedAssetIds(store.getState())).toEqual([]);

    // Restauration -> la note et son lien reviennent intacts
    store.dispatch({
      type: 'restore_trash_item',
      id: 'tr-n1',
      now: '2026-11-03T10:00:00.000Z',
    });
    expect(store.getState().notes).toHaveLength(1);
    expect(store.getState().trash).toHaveLength(0);
    expect(selectEntityLinkEntries(store.getState(), 'task', 't1').outgoing).toHaveLength(1);

    // Remise en corbeille puis expiration au bout de 7 jours (le 10 novembre)
    store.dispatch({
      type: 'trash_note',
      id: 'n1',
      trashId: 'tr-n1-b',
      now: '2026-11-02T10:00:00.000Z',
    });
    store.dispatch({
      type: 'purge_expired_trash',
      now: '2026-11-08T10:00:00.000Z',
    });
    expect(store.getState().trash).toHaveLength(1);

    store.dispatch({
      type: 'purge_expired_trash',
      now: '2026-11-10T10:00:00.000Z',
    });
    expect(store.getState().trash).toHaveLength(0);
    expect(selectOrphanedAssetIds(store.getState())).toEqual(['a-trash']);
    expect(store.getState().tasks[0]?.links).toEqual([]);
  });

  it('génère l’occurrence suivante à la complétion d’une tâche récurrente via update_task et move_task', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Ops', now: T1 });
    store.dispatch({ type: 'create_note', id: 'n1', projectId: 'p1', title: 'Runbook', now: T1 });

    // 1. Récurrence hebdomadaire complétée via update_task
    store.dispatch({
      type: 'create_task',
      id: 't-weekly',
      projectId: 'p1',
      title: 'Revue hebdo',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-15',
      recurrence: 'weekly',
      checklist: [
        { id: 'c1', text: 'Étape 1', done: true },
        { id: 'c2', text: 'Étape 2', done: true },
      ],
      tags: ['ops'],
      links: [{ kind: 'note', id: 'n1' }],
      assetIds: ['asset-1'],
      descriptionDoc: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Description récurrente' }] },
        ],
      },
      now: T1,
    });

    const updateRes = store.dispatch({
      type: 'update_task',
      id: 't-weekly',
      patch: { status: 'done' },
      nextOccurrenceId: 't-weekly-2',
      todayIso: '2026-11-15',
      now: T2,
    });

    expect(updateRes.effects.some((e) => e.type === 'persist_tasks')).toBe(true);
    const completedWeekly = store.getState().tasks.find((t) => t.id === 't-weekly');
    const spawnedWeekly = store.getState().tasks.find((t) => t.id === 't-weekly-2');
    expect(completedWeekly?.status).toBe('done');
    expect(spawnedWeekly).toBeDefined();
    expect(spawnedWeekly).toMatchObject({
      id: 't-weekly-2',
      projectId: 'p1',
      title: 'Revue hebdo',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-11-22',
      recurrence: 'weekly',
      tags: ['ops'],
      links: [{ kind: 'note', id: 'n1' }],
      assetIds: ['asset-1'],
    });
    expect(spawnedWeekly?.checklist.map((c) => ({ text: c.text, done: c.done }))).toEqual([
      { text: 'Étape 1', done: false },
      { text: 'Étape 2', done: false },
    ]);
    expect(spawnedWeekly?.checklist[0]?.id).not.toBe('c1');

    // Modifier une tâche déjà terminée ne crée pas de doublon
    store.dispatch({
      type: 'update_task',
      id: 't-weekly',
      patch: { title: 'Revue hebdo (archive)' },
      nextOccurrenceId: 't-weekly-dup',
      now: T2,
    });
    expect(store.getState().tasks.find((t) => t.id === 't-weekly-dup')).toBeUndefined();

    // Retirer la récurrence en terminant ne génère pas d’occurrence suivante
    store.dispatch({
      type: 'update_task',
      id: 't-weekly-2',
      patch: { status: 'done', recurrence: null },
      nextOccurrenceId: 't-weekly-3',
      now: T2,
    });
    expect(store.getState().tasks.find((t) => t.id === 't-weekly-3')).toBeUndefined();

    // 2. Récurrence mensuelle sans échéance initiale complétée via move_task (fallback todayIso + 1 mois)
    store.dispatch({
      type: 'create_task',
      id: 't-monthly',
      projectId: 'p1',
      title: 'Facturation',
      status: 'in_progress',
      dueDate: '2026-01-31',
      recurrence: 'monthly',
      now: T1,
    });
    const moveRes = store.dispatch({
      type: 'move_task',
      id: 't-monthly',
      targetStatus: 'done',
      targetIndex: 0,
      nextOccurrenceId: 't-monthly-2',
      todayIso: '2026-01-31',
      now: T2,
    });
    expect(moveRes.effects.some((e) => e.type === 'persist_tasks')).toBe(true);
    const spawnedMonthly = store.getState().tasks.find((t) => t.id === 't-monthly-2');
    expect(spawnedMonthly?.dueDate).toBe('2026-02-28');
    expect(spawnedMonthly?.status).toBe('todo');

    // 3. Garde readOnly bloque la complétion récurrente
    store.dispatch({ type: 'set_read_only', readOnly: true });
    const countBefore = store.getState().tasks.length;
    const roRes = store.dispatch({
      type: 'move_task',
      id: 't-monthly-2',
      targetStatus: 'done',
      targetIndex: 0,
      nextOccurrenceId: 't-monthly-3',
      now: T2,
    });
    expect(roRes.effects).toEqual([]);
    expect(store.getState().tasks).toHaveLength(countBefore);
  });

  it('interdit les nouveaux liens impliquant un statut terminal mais laisse consulter/supprimer les liens existants', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'P1', now: T1 });
    store.dispatch({ type: 'create_note', id: 'n1', projectId: 'p1', title: 'Note A', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't-active',
      projectId: 'p1',
      title: 'Tâche active',
      status: 'todo',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't-term',
      projectId: 'p1',
      title: 'Tâche terminale',
      status: 'todo',
      links: [{ kind: 'note', id: 'n1' }],
      now: T1,
    });

    // Passage en statut terminal conserve les liens existants
    store.dispatch({
      type: 'update_task',
      id: 't-term',
      patch: { status: 'done' },
      now: T2,
    });
    expect(store.getState().tasks.find((t) => t.id === 't-term')?.links).toEqual([
      { kind: 'note', id: 'n1' },
    ]);

    // Retirer un lien existant sur une tâche terminale reste autorisé
    store.dispatch({
      type: 'update_task',
      id: 't-term',
      patch: { links: [] },
      now: T2,
    });
    expect(store.getState().tasks.find((t) => t.id === 't-term')?.links).toEqual([]);

    // Ajouter un nouveau lien depuis la tâche terminale échoue
    expect(() =>
      store.dispatch({
        type: 'update_task',
        id: 't-term',
        patch: { links: [{ kind: 'note', id: 'n1' }] },
        now: T2,
      }),
    ).toThrow(/terminal/i);

    // Lier une note ou une tâche vers une tâche terminale échoue
    expect(() =>
      store.dispatch({
        type: 'update_note',
        id: 'n1',
        patch: { links: [{ kind: 'task', id: 't-term' }] },
        now: T2,
      }),
    ).toThrow(/terminal/i);
    expect(() =>
      store.dispatch({
        type: 'update_task',
        id: 't-active',
        patch: { links: [{ kind: 'task', id: 't-term' }] },
        now: T2,
      }),
    ).toThrow(/terminal/i);
  });

  it('archive et désarchive projets, tâches, notes et tableaux blancs et les isole dans selectArchivedEntries', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Alpha', now: T1 });
    store.dispatch({ type: 'create_project', id: 'p2', name: 'Beta', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Tâche Alpha',
      dueDate: '2026-11-20',
      dueTime: '19:30',
      tags: ['focus'],
      now: T1,
    });
    store.dispatch({
      type: 'create_note',
      id: 'n1',
      projectId: 'p2',
      title: 'Note Beta',
      tags: ['spec'],
      now: T1,
    });
    store.dispatch({
      type: 'create_whiteboard',
      id: 'w1',
      projectId: 'p1',
      title: 'WB Alpha',
      now: T1,
    });

    // Archiver une note et un tableau blanc individuellement
    store.dispatch({ type: 'toggle_archive_note', id: 'n1', archived: true, now: T2 });
    store.dispatch({ type: 'toggle_archive_whiteboard', id: 'w1', archived: true, now: T2 });
    expect(selectNotes(store.getState(), { projectId: 'all' })).toEqual([]);
    expect(selectWhiteboards(store.getState(), { projectId: 'all' })).toEqual([]);

    // Archiver le projet p1 masque aussi t1 des sélecteurs habituels
    store.dispatch({ type: 'toggle_archive_project', id: 'p1', archived: true, now: T2 });
    expect(selectProjects(store.getState()).map((p) => p.id)).toEqual(['p2']);
    expect(selectTasks(store.getState(), {})).toEqual([]);
    expect(selectTodaySummary(store.getState(), '2026-11-20').dueTodayTasks).toEqual([]);

    // Lier vers une entité archivée est refusé
    expect(() =>
      store.dispatch({
        type: 'create_task',
        id: 't-bad-link',
        projectId: 'p2',
        title: 'Lien interdit',
        links: [{ kind: 'note', id: 'n1' }],
        now: T2,
      }),
    ).toThrow(/archivé/i);

    // selectArchivedEntries expose tous les éléments archivés avec filtres
    const allArchived = selectArchivedEntries(store.getState(), {});
    expect(allArchived.map((e) => `${e.kind}:${e.id}`).sort()).toEqual([
      'note:n1',
      'project:p1',
      'task:t1',
      'whiteboard:w1',
    ]);
    expect(selectArchivedEntries(store.getState(), { kind: 'note' }).map((e) => e.id)).toEqual([
      'n1',
    ]);
    expect(selectArchivedEntries(store.getState(), { tag: 'focus' }).map((e) => e.id)).toEqual([
      't1',
    ]);
    expect(selectArchivedEntries(store.getState(), { projectId: 'p1' })).toHaveLength(3);

    // Désarchiver t1 réactive automatiquement son projet parent p1, mais w1 explicitement archivé reste archivé
    store.dispatch({ type: 'toggle_archive_task', id: 't1', archived: false, now: T2 });
    expect(selectProjects(store.getState()).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(selectTasks(store.getState(), {}).map((t) => t.id)).toEqual(['t1']);
    expect(selectWhiteboards(store.getState(), { projectId: 'all' })).toEqual([]);
  });
});

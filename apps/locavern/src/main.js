import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import './styles/app.css';

/** @import { LocalRef, ActiveView, AssetMeta, Note, Task, TaskDueFilter, TaskPriority, TaskStatus, TaskStatusFilter, Whiteboard } from './types.d.ts' */

import { getTodayIsoDate } from './core/dates.js';
import { getDefaultInitialTaskStatusId, getTaskStatusMeta } from './core/model.js';
import {
  extractNoteSearchText,
  extractTaskSearchText,
  extractWhiteboardSearchText,
} from './core/search.js';
import {
  createStore,
  isNoteEffectivelyArchived,
  isTaskEffectivelyArchived,
  isWhiteboardEffectivelyArchived,
  selectArchivedEntries,
  selectOrphanedAssetIds,
  selectProjectById,
  selectProjects,
  selectReferencedAssetIds,
} from './core/store.js';
import { validateImageFile } from './adapters/archive-file.js';
import { initializeExportDirectory } from './adapters/export-directory.js';
import {
  acquireWriteLock,
  applyStoreEffects,
  inspectStorageStatus,
  loadAssetBlob,
  loadHydrationPayload,
  onWriteLockReleased,
  openLocavernDb,
  saveAssetBlob,
  waitForWriteLock,
} from './adapters/storage-idb.js';
import { setupServiceWorkerUpdates } from './adapters/sw-update.js';
import { hideAllTooltips, initTooltips } from './adapters/dom/tooltip.js';
import {
  initCovenant,
  notify,
  openDialogById,
  renderReadOnlyBanner,
  renderSwUpdateBanner,
  setToastDurationSeconds,
  syncNavigationChrome,
  toggleColorScheme,
  wireAppShell,
} from './adapters/dom/app-shell.js';
import { renderArchivesView } from './adapters/dom/archives-view.js';
import { wireBackupModal } from './adapters/dom/backup-modal.js';
import { renderCalendarView } from './adapters/dom/calendar-view.js';
import { renderKanbanView } from './adapters/dom/kanban-view.js';
import { openNoteDialog } from './adapters/dom/note-dialog.js';
import { renderNotesView } from './adapters/dom/notes-view.js';
import { wirePreferencesModal } from './adapters/dom/preferences-modal.js';
import { openProjectModal, renderProjectsView } from './adapters/dom/project-view.js';
import { wireStatusModal } from './adapters/dom/status-modal.js';
import { wireTrashModal } from './adapters/dom/trash-modal.js';
import { openTaskDrawer } from './adapters/dom/task-drawer.js';
import { renderTaskListView } from './adapters/dom/task-list-view.js';
import { renderTodayView } from './adapters/dom/today-view.js';
import { openWhiteboardDialog } from './adapters/dom/whiteboard-dialog.js';
import { renderWhiteboardView } from './adapters/dom/whiteboard-view.js';

const APP_VERSION = '0.2.0';

async function bootstrap() {
  const viewContainer = document.getElementById('app-view');
  if (!viewContainer) return;
  const rootView = viewContainer;

  const db = await openLocavernDb();
  await initializeExportDirectory(db);
  let lockHandle = await acquireWriteLock();
  const payload = await loadHydrationPayload(db);
  await inspectStorageStatus({ requestPersist: lockHandle.acquired });

  const store = createStore();
  store.dispatch({
    type: 'hydrate',
    payload: {
      ...payload,
      readOnly: !lockHandle.acquired,
    },
  });
  setToastDurationSeconds(store.getState().preferences.toastDurationSeconds);

  /** @type {Map<string, string>} */
  const assetUrlCache = new Map();

  /** @param {string} assetId */
  function revokeAssetUrl(assetId) {
    const cachedUrl = assetUrlCache.get(assetId);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      assetUrlCache.delete(assetId);
    }
  }

  function revokeAllAssetUrls() {
    for (const url of assetUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    assetUrlCache.clear();
  }

  /** @type {ReadonlySet<string>} */
  const ASSET_MUTATING_COMMANDS = new Set([
    'delete_project',
    'delete_task',
    'update_task',
    'delete_note',
    'update_note',
    'delete_whiteboard',
    'update_whiteboard',
    'purge_trash_item',
    'empty_trash',
    'purge_expired_trash',
  ]);

  /**
   * Purge unreferenced local assets from store state and IndexedDB.
   * @param {Iterable<string>} [candidateIds]
   */
  function purgeOrphanedAssets(candidateIds) {
    const current = store.getState();
    if (current.readOnly || current.assets.length === 0) return;
    const orphaned = selectOrphanedAssetIds(current, candidateIds);
    for (const id of orphaned) {
      revokeAssetUrl(id);
      store.dispatch({ type: 'delete_asset', id });
    }
  }

  /**
   * Resolve a local IndexedDB assetId into an object URL (never external).
   * @param {string} assetId
   * @returns {Promise<string | null>}
   */
  async function resolveAssetUrl(assetId) {
    const cached = assetUrlCache.get(assetId);
    if (cached) return cached;
    const blob = await loadAssetBlob(db, assetId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    assetUrlCache.set(assetId, url);
    return url;
  }

  /**
   * Validate, store in IndexedDB, and register a local image File.
   * @param {File} file
   * @returns {Promise<{ assetId: string; alt: string } | null>}
   */
  async function uploadLocalImage(file) {
    if (store.getState().readOnly) {
      notify({
        status: 'warning',
        title: 'Mode lecture seule',
        text: 'Impossible d’ajouter une image tant qu’un autre onglet détient le verrou.',
      });
      return null;
    }
    const validation = validateImageFile(file);
    if (!validation.ok) {
      notify({
        status: 'danger',
        title: 'Image refusée',
        text: validation.error,
      });
      return null;
    }
    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();
    /** @type {AssetMeta} */
    const meta = Object.freeze({
      id: assetId,
      mimeType: validation.mimeType,
      sizeBytes: file.size,
      filename: (file.name || 'image-locale').slice(0, 255),
      createdAt: now,
    });
    await saveAssetBlob(db, meta, file);
    assetUrlCache.set(assetId, URL.createObjectURL(file));
    store.dispatch({ type: 'register_asset', asset: meta });
    return { assetId, alt: meta.filename };
  }

  /** @type {{ query: string; status: TaskStatusFilter; priority: TaskPriority | 'all'; tag: string | 'all'; sortBy: 'position' | 'dueDate' | 'priority' }} */
  const taskListFilters = {
    query: '',
    status: 'all',
    priority: 'all',
    tag: 'all',
    sortBy: 'position',
  };
  /** @type {{ query: string; priority: TaskPriority | 'all'; due: TaskDueFilter; tag: string | 'all' }} */
  const kanbanFilters = {
    query: '',
    priority: 'all',
    due: 'all',
    tag: 'all',
  };
  /** @type {{ projectId: string | null | 'all'; query: string; tag: string | 'all' }} */
  const notesFilters = {
    projectId: 'all',
    query: '',
    tag: 'all',
  };
  /** @type {{ projectId: string | null | 'all'; query: string }} */
  const whiteboardsFilters = {
    projectId: 'all',
    query: '',
  };
  /** @type {{ query: string; kind: 'all' | 'project' | 'task' | 'note' | 'whiteboard'; projectId: 'all' | '__none__' | string; tag: 'all' | string; sortBy: 'archivedAt' | 'updatedAt' | 'title'; selectedKey: string | null }} */
  const archivesFilters = {
    query: '',
    kind: 'all',
    projectId: 'all',
    tag: 'all',
    sortBy: 'archivedAt',
    selectedKey: null,
  };
  /** @type {{ mode: 'month' | 'week'; anchorDate: string; focusTaskId: string | null }} */
  const calendarState = {
    mode: 'month',
    anchorDate: getTodayIsoDate(),
    focusTaskId: null,
  };
  /** @type {{ noteId: string | null; mode: 'view' | 'edit' }} */
  const notesUiState = {
    noteId: store.getState().preferences.selectedNoteId ?? null,
    mode: 'view',
  };
  /** @type {{ whiteboardId: string | null; mode: 'view' | 'edit' }} */
  const whiteboardsUiState = {
    whiteboardId: store.getState().preferences.selectedWhiteboardId ?? null,
    mode: 'view',
  };

  /** @type {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean } | null} */
  let notesViewHandle = null;
  /** @type {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean } | null} */
  let whiteboardViewHandle = null;

  function flushActiveViewHandles() {
    if (notesViewHandle) {
      notesViewHandle.flushAndDestroy();
      notesViewHandle = null;
    }
    if (whiteboardViewHandle) {
      whiteboardViewHandle.flushAndDestroy();
      whiteboardViewHandle = null;
    }
  }

  /** @param {ReturnType<typeof store.getState>} state */
  function syncArchiveSidebarBadge(state) {
    const badge = document.getElementById('nav-archives-count');
    if (!badge) return;
    const count = selectArchivedEntries(state, {}).length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  /**
   * Jump directly to a linked local Task, Note, or Whiteboard (or open Archives if archived).
   * @param {LocalRef} ref
   */
  function handleNavigateLocalRef(ref) {
    const s = store.getState();
    flushActiveViewHandles();
    if (ref.kind === 'task') {
      const target = s.tasks.find((t) => t.id === ref.id);
      if (!target) return;
      if (isTaskEffectivelyArchived(target, s.projects)) {
        archivesFilters.query = '';
        archivesFilters.kind = 'all';
        archivesFilters.projectId = 'all';
        archivesFilters.tag = 'all';
        archivesFilters.selectedKey = `task:${target.id}`;
        store.dispatch({ type: 'set_view', view: 'archives' });
        return;
      }
      if (s.preferences.selectedProjectId && s.preferences.selectedProjectId !== target.projectId) {
        store.dispatch({ type: 'select_project', projectId: target.projectId });
      }
      store.dispatch({ type: 'set_view', view: 'tasks' });
      handleOpenTaskDrawer(target, { mode: 'view' });
      return;
    }
    if (ref.kind === 'note') {
      const target = s.notes.find((n) => n.id === ref.id);
      if (!target) return;
      if (isNoteEffectivelyArchived(target, s.projects)) {
        archivesFilters.query = '';
        archivesFilters.kind = 'all';
        archivesFilters.projectId = 'all';
        archivesFilters.tag = 'all';
        archivesFilters.selectedKey = `note:${target.id}`;
        store.dispatch({ type: 'set_view', view: 'archives' });
        return;
      }
      notesFilters.projectId = 'all';
      notesFilters.query = '';
      notesFilters.tag = 'all';
      notesUiState.noteId = target.id;
      notesUiState.mode = 'view';
      store.dispatch({ type: 'select_note', noteId: target.id });
      store.dispatch({ type: 'set_view', view: 'notes' });
      return;
    }
    if (ref.kind === 'whiteboard') {
      const target = s.whiteboards.find((w) => w.id === ref.id);
      if (!target) return;
      if (isWhiteboardEffectivelyArchived(target, s.projects)) {
        archivesFilters.query = '';
        archivesFilters.kind = 'all';
        archivesFilters.projectId = 'all';
        archivesFilters.tag = 'all';
        archivesFilters.selectedKey = `whiteboard:${target.id}`;
        store.dispatch({ type: 'set_view', view: 'archives' });
        return;
      }
      whiteboardsFilters.projectId = 'all';
      whiteboardsFilters.query = '';
      whiteboardsUiState.whiteboardId = target.id;
      whiteboardsUiState.mode = 'view';
      store.dispatch({ type: 'select_whiteboard', whiteboardId: target.id });
      store.dispatch({ type: 'set_view', view: 'whiteboards' });
    }
  }

  /**
   * @param {Task} [task]
   * @param {{
   *   defaultStatus?: TaskStatus | null;
   *   defaultDueDate?: string | null;
   *   defaultDueTime?: string | null;
   *   mode?: 'view' | 'edit';
   * }} [opts]
   */
  function handleOpenTaskDrawer(task, opts = {}) {
    openTaskDrawer({
      store,
      task,
      mode: opts.mode,
      defaultStatus: opts.defaultStatus,
      defaultDueDate: opts.defaultDueDate,
      defaultDueTime: opts.defaultDueTime,
      resolveAssetUrl,
      uploadLocalImage,
      onNavigateLocalRef: handleNavigateLocalRef,
    });
  }

  /**
   * @param {{ note?: Note; mode?: 'view' | 'edit'; defaultProjectId?: string | null }} [opts]
   */
  function handleOpenNoteDialog(opts = {}) {
    openNoteDialog({
      store,
      note: opts.note,
      mode: opts.mode,
      defaultProjectId: opts.defaultProjectId,
      resolveAssetUrl,
      uploadLocalImage,
      onNavigateLocalRef: handleNavigateLocalRef,
      onAfterCreate() {
        if (store.getState().preferences.activeView !== 'notes') {
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'notes' });
        }
      },
    });
  }

  /**
   * @param {{ whiteboard?: Whiteboard; mode?: 'view' | 'edit'; defaultProjectId?: string | null }} [opts]
   */
  function handleOpenWhiteboardDialog(opts = {}) {
    openWhiteboardDialog({
      store,
      whiteboard: opts.whiteboard,
      mode: opts.mode,
      defaultProjectId: opts.defaultProjectId,
      onAfterCreate() {
        if (store.getState().preferences.activeView !== 'whiteboards') {
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
        }
      },
    });
  }

  /** @param {ReturnType<typeof store.getState>} state */
  function getActiveSelectedProjectId(state) {
    const id = state.preferences.selectedProjectId;
    if (!id) return null;
    return selectProjects(state).some((p) => p.id === id) ? id : null;
  }

  function renderCurrentViewContent() {
    const state = store.getState();
    const activeView = state.preferences.activeView;
    syncNavigationChrome(activeView);
    syncArchiveSidebarBadge(state);
    renderReadOnlyBanner(state.readOnly, () => {
      void retryAcquireLock();
    });

    if (activeView !== 'notes' && notesViewHandle) {
      notesViewHandle.flushAndDestroy();
      notesViewHandle = null;
    }
    if (activeView !== 'whiteboards' && whiteboardViewHandle) {
      whiteboardViewHandle.flushAndDestroy();
      whiteboardViewHandle = null;
    }

    if (activeView === 'today') {
      renderTodayView({
        container: rootView,
        store,
        onOpenTask: (task, mode = 'view') => handleOpenTaskDrawer(task, { mode }),
        onOpenNote(note, mode = 'view') {
          flushActiveViewHandles();
          notesFilters.projectId = 'all';
          notesFilters.query = '';
          notesUiState.noteId = note.id;
          notesUiState.mode = store.getState().readOnly ? 'view' : mode;
          store.dispatch({ type: 'select_note', noteId: note.id });
          store.dispatch({ type: 'set_view', view: 'notes' });
        },
        onOpenWhiteboard(wb, mode = 'view') {
          flushActiveViewHandles();
          whiteboardsFilters.projectId = 'all';
          whiteboardsFilters.query = '';
          whiteboardsUiState.whiteboardId = wb.id;
          whiteboardsUiState.mode = store.getState().readOnly ? 'view' : mode;
          store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
        },
        onNewTask() {
          const s = store.getState();
          if (s.readOnly) return;
          if (selectProjects(s).length === 0) {
            openProjectModal({ store });
          } else {
            handleOpenTaskDrawer(undefined, {
              defaultStatus: getDefaultInitialTaskStatusId(s.preferences.taskStatuses),
              mode: 'edit',
            });
          }
        },
        onNewNote() {
          const s = store.getState();
          if (s.readOnly) return;
          handleOpenNoteDialog({
            defaultProjectId: getActiveSelectedProjectId(s),
            mode: 'edit',
          });
        },
        onNewWhiteboard() {
          const s = store.getState();
          if (s.readOnly) return;
          handleOpenWhiteboardDialog({
            defaultProjectId: getActiveSelectedProjectId(s),
            mode: 'edit',
          });
        },
      });
      return;
    }

    if (activeView === 'projects') {
      renderProjectsView({
        container: rootView,
        store,
        onOpenProjectNotes(projectId) {
          notesFilters.projectId = projectId;
          notesFilters.query = '';
          notesUiState.mode = 'view';
          store.dispatch({ type: 'select_project', projectId });
          store.dispatch({ type: 'set_view', view: 'notes' });
        },
        onOpenProjectWhiteboards(projectId) {
          whiteboardsFilters.projectId = projectId;
          whiteboardsFilters.query = '';
          whiteboardsUiState.mode = 'view';
          store.dispatch({ type: 'select_project', projectId });
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
        },
      });
      return;
    }

    if (activeView === 'calendar') {
      renderCalendarView({
        container: rootView,
        store,
        calendarState,
        onOpenTask: (task, mode = 'view') => handleOpenTaskDrawer(task, { mode }),
        onNewTask: (defaultDueDate, defaultDueTime) => {
          handleOpenTaskDrawer(undefined, {
            defaultStatus: getDefaultInitialTaskStatusId(store.getState().preferences.taskStatuses),
            defaultDueDate: defaultDueDate ?? null,
            defaultDueTime: defaultDueTime ?? null,
            mode: 'edit',
          });
        },
        onOpenNewProject: () => openProjectModal({ store }),
      });
      return;
    }

    if (activeView === 'notes') {
      notesViewHandle?.flushAndDestroy();
      notesViewHandle = renderNotesView({
        container: rootView,
        store,
        filters: notesFilters,
        modeState: notesUiState,
        resolveAssetUrl,
        uploadLocalImage,
        onOpenNoteDialog: handleOpenNoteDialog,
        onNavigateLocalRef: handleNavigateLocalRef,
      });
      return;
    }

    if (activeView === 'whiteboards') {
      whiteboardViewHandle?.flushAndDestroy();
      whiteboardViewHandle = renderWhiteboardView({
        container: rootView,
        store,
        filters: whiteboardsFilters,
        modeState: whiteboardsUiState,
        resolveAssetUrl,
        uploadLocalImage,
        onOpenWhiteboardDialog: handleOpenWhiteboardDialog,
        onNavigateLocalRef: handleNavigateLocalRef,
      });
      return;
    }

    if (activeView === 'archives') {
      renderArchivesView({
        container: rootView,
        store,
        filters: archivesFilters,
        onNavigateLocalRef: handleNavigateLocalRef,
      });
      return;
    }

    if (state.preferences.taskDisplayMode === 'kanban') {
      renderKanbanView({
        container: rootView,
        store,
        filters: kanbanFilters,
        onOpenNewProject: () => openProjectModal({ store }),
        onOpenTaskDrawer: handleOpenTaskDrawer,
      });
      return;
    }

    renderTaskListView({
      container: rootView,
      store,
      filters: taskListFilters,
      onOpenNewProject: () => openProjectModal({ store }),
      onOpenTaskDrawer: handleOpenTaskDrawer,
    });
  }

  function renderCurrentView() {
    hideAllTooltips();
    renderCurrentViewContent();
    initTooltips(rootView);
  }

  /** @type {() => void} */
  let cancelLockWait = () => {};

  /**
   * Promote this tab from read-only to editable once the exclusive write lock is held.
   * @param {{ acquired: boolean; release: () => void }} nextLock
   */
  async function promoteWithLock(nextLock) {
    if (lockHandle.acquired) {
      nextLock.release();
      return;
    }
    lockHandle = nextLock;
    cancelLockWait();
    cancelLockWait = () => {};
    const fresh = await loadHydrationPayload(db);
    store.dispatch({
      type: 'hydrate',
      payload: { ...fresh, readOnly: false },
    });
    notify({
      status: 'success',
      title: 'Édition rétablie',
      text: 'Cet onglet détient maintenant le verrou d’écriture.',
    });
  }

  async function retryAcquireLock() {
    if (lockHandle.acquired) return;
    const nextLock = await acquireWriteLock();
    if (!nextLock.acquired) {
      notify({
        status: 'warning',
        title: 'Verrou toujours actif',
        text: 'Un autre onglet utilise encore Locavern en écriture.',
      });
      return;
    }
    await promoteWithLock(nextLock);
  }

  if (!lockHandle.acquired) {
    cancelLockWait = waitForWriteLock((grantedLock) => {
      void promoteWithLock(grantedLock);
    });
  }

  const stopLockListener = onWriteLockReleased(() => {
    if (store.getState().readOnly) {
      void retryAcquireLock();
    }
  });

  // Serialize IndexedDB effect writes sequentially so rapid edits preserve order.
  let persistChain = Promise.resolve();
  let pendingWrites = 0;

  store.subscribe(({ state, prevState, command, effects }) => {
    setToastDurationSeconds(state.preferences.toastDurationSeconds);
    syncArchiveSidebarBadge(state);

    if (effects.length > 0) {
      pendingWrites += 1;
      document.documentElement.dataset.persisting = 'true';
      persistChain = persistChain
        .then(() => applyStoreEffects(db, effects))
        .catch(() => {
          notify({
            status: 'danger',
            title: 'Erreur de persistance',
            text: 'Impossible d’enregistrer la modification dans IndexedDB.',
          });
        })
        .finally(() => {
          pendingWrites -= 1;
          if (pendingWrites <= 0) {
            pendingWrites = 0;
            delete document.documentElement.dataset.persisting;
          }
        });
    }

    if (command.type === 'delete_project' || command.type === 'trash_project') {
      if (notesFilters.projectId === command.id) {
        notesFilters.projectId = 'all';
      }
      if (whiteboardsFilters.projectId === command.id) {
        whiteboardsFilters.projectId = 'all';
      }
    }

    if (command.type === 'replace_all') {
      notesFilters.projectId = 'all';
      notesFilters.query = '';
      notesFilters.tag = 'all';
      taskListFilters.tag = 'all';
      kanbanFilters.tag = 'all';
      whiteboardsFilters.projectId = 'all';
      whiteboardsFilters.query = '';
      archivesFilters.query = '';
      archivesFilters.kind = 'all';
      archivesFilters.projectId = 'all';
      archivesFilters.tag = 'all';
      archivesFilters.sortBy = 'archivedAt';
      archivesFilters.selectedKey = null;
    }

    if (state.readOnly) {
      notesUiState.mode = 'view';
      whiteboardsUiState.mode = 'view';
    } else if (command.type === 'hydrate' || command.type === 'replace_all') {
      notesUiState.noteId = state.preferences.selectedNoteId ?? null;
      notesUiState.mode = 'view';
      whiteboardsUiState.whiteboardId = state.preferences.selectedWhiteboardId ?? null;
      whiteboardsUiState.mode = 'view';
    } else if (command.type === 'create_note') {
      notesUiState.noteId = command.id;
      notesUiState.mode = 'edit';
    } else if (command.type === 'create_whiteboard') {
      whiteboardsUiState.whiteboardId = command.id;
      whiteboardsUiState.mode = 'edit';
    }

    if (command.type === 'delete_asset') {
      revokeAssetUrl(command.id);
    } else if (ASSET_MUTATING_COMMANDS.has(command.type) && !state.readOnly) {
      purgeOrphanedAssets(selectReferencedAssetIds(prevState));
    }

    if (
      command.type === 'update_note' &&
      state.preferences.activeView === 'notes' &&
      prevState.preferences.activeView === 'notes' &&
      notesViewHandle?.isDispatchingInline()
    ) {
      // Notes inline autosave already preserves cursor/focus and updates sidebar title in place.
      return;
    }

    if (
      command.type === 'update_whiteboard' &&
      state.preferences.activeView === 'whiteboards' &&
      prevState.preferences.activeView === 'whiteboards' &&
      whiteboardViewHandle?.isDispatchingInline()
    ) {
      // Whiteboard inline autosave already preserves SVG focus and updates sidebar title in place.
      return;
    }

    if (
      command.type === 'register_asset' ||
      command.type === 'delete_asset' ||
      command.type === 'set_input_presentation' ||
      command.type === 'set_toast_duration' ||
      command.type === 'set_trash_retention_days' ||
      command.type === 'create_template' ||
      command.type === 'delete_template'
    ) {
      return;
    }

    renderCurrentView();
  });

  wireAppShell({
    onSelectView(/** @type {ActiveView} */ view) {
      flushActiveViewHandles();
      if (view === 'notes') notesUiState.mode = 'view';
      if (view === 'whiteboards') whiteboardsUiState.mode = 'view';
      store.dispatch({ type: 'set_view', view });
    },
    getCommandItems() {
      const state = store.getState();
      const statuses = state.preferences.taskStatuses;
      const items = [];

      for (const project of selectProjects(state)) {
        items.push({
          value: `open:project:${project.id}`,
          label: project.name,
          meta: 'Projet',
          icon: 'ph-folder-open',
          searchText: `${project.name} ${project.description}`,
        });
      }

      for (const task of state.tasks) {
        if (isTaskEffectivelyArchived(task, state.projects)) continue;
        const projName = selectProjectById(state, task.projectId)?.name ?? 'Projet';
        const statusLabel = getTaskStatusMeta(task.status, statuses).label;
        items.push({
          value: `open:task:${task.id}`,
          label: task.title,
          meta: `Tâche · ${projName} · ${statusLabel}`,
          icon: 'ph-check-square',
          searchText: `${extractTaskSearchText(task)} ${projName} ${statusLabel}`,
        });
      }

      for (const note of state.notes) {
        if (isNoteEffectivelyArchived(note, state.projects)) continue;
        const projName = note.projectId ? selectProjectById(state, note.projectId)?.name : null;
        items.push({
          value: `open:note:${note.id}`,
          label: note.title,
          meta: projName ? `Note · ${projName}` : 'Note',
          icon: 'ph-notebook',
          searchText: `${extractNoteSearchText(note)} ${projName ?? ''}`,
        });
      }

      for (const wb of state.whiteboards) {
        if (isWhiteboardEffectivelyArchived(wb, state.projects)) continue;
        const projName = wb.projectId ? selectProjectById(state, wb.projectId)?.name : null;
        items.push({
          value: `open:whiteboard:${wb.id}`,
          label: wb.title,
          meta: projName ? `Tableau blanc · ${projName}` : 'Tableau blanc',
          icon: 'ph-chalkboard-simple',
          searchText: `${extractWhiteboardSearchText(wb)} ${projName ?? ''}`,
        });
      }

      return items;
    },
    onCommand(commandId) {
      const state = store.getState();
      if (commandId.startsWith('open:project:')) {
        const id = commandId.slice('open:project:'.length);
        const project = state.projects.find((p) => p.id === id);
        if (!project) return;
        flushActiveViewHandles();
        store.dispatch({ type: 'select_project', projectId: project.id });
        store.dispatch({ type: 'set_view', view: 'tasks' });
        return;
      }
      if (commandId.startsWith('open:task:')) {
        const id = commandId.slice('open:task:'.length);
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        flushActiveViewHandles();
        if (
          state.preferences.selectedProjectId &&
          state.preferences.selectedProjectId !== task.projectId
        ) {
          store.dispatch({ type: 'select_project', projectId: task.projectId });
        }
        if (state.preferences.activeView !== 'tasks') {
          store.dispatch({ type: 'set_view', view: 'tasks' });
        }
        handleOpenTaskDrawer(task, { mode: 'view' });
        return;
      }
      if (commandId.startsWith('open:note:')) {
        const id = commandId.slice('open:note:'.length);
        const note = state.notes.find((n) => n.id === id);
        if (!note) return;
        flushActiveViewHandles();
        if (notesFilters.projectId !== 'all' && notesFilters.projectId !== note.projectId) {
          notesFilters.projectId = 'all';
        }
        notesFilters.query = '';
        notesUiState.noteId = note.id;
        notesUiState.mode = 'view';
        store.dispatch({ type: 'select_note', noteId: note.id });
        store.dispatch({ type: 'set_view', view: 'notes' });
        return;
      }
      if (commandId.startsWith('open:whiteboard:')) {
        const id = commandId.slice('open:whiteboard:'.length);
        const wb = state.whiteboards.find((w) => w.id === id);
        if (!wb) return;
        flushActiveViewHandles();
        if (
          whiteboardsFilters.projectId !== 'all' &&
          whiteboardsFilters.projectId !== wb.projectId
        ) {
          whiteboardsFilters.projectId = 'all';
        }
        whiteboardsFilters.query = '';
        whiteboardsUiState.whiteboardId = wb.id;
        whiteboardsUiState.mode = 'view';
        store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
        store.dispatch({ type: 'set_view', view: 'whiteboards' });
        return;
      }

      switch (commandId) {
        case 'view:today':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'today' });
          break;
        case 'view:tasks':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'tasks' });
          break;
        case 'view:projects':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'projects' });
          break;
        case 'view:calendar':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'calendar' });
          break;
        case 'view:notes':
          flushActiveViewHandles();
          notesUiState.mode = 'view';
          store.dispatch({ type: 'set_view', view: 'notes' });
          break;
        case 'view:whiteboards':
          flushActiveViewHandles();
          whiteboardsUiState.mode = 'view';
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
          break;
        case 'view:archives':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'archives' });
          break;
        case 'action:new-task':
          if (state.readOnly) return;
          if (selectProjects(state).length === 0) {
            openProjectModal({ store });
          } else {
            handleOpenTaskDrawer(undefined, {
              defaultStatus: getDefaultInitialTaskStatusId(state.preferences.taskStatuses),
              mode: 'edit',
            });
          }
          break;
        case 'action:new-project':
          if (state.readOnly) return;
          openProjectModal({ store });
          break;
        case 'action:new-note':
          if (state.readOnly) return;
          handleOpenNoteDialog({
            defaultProjectId: getActiveSelectedProjectId(state),
            mode: 'edit',
          });
          break;
        case 'action:new-whiteboard':
          if (state.readOnly) return;
          handleOpenWhiteboardDialog({
            defaultProjectId: getActiveSelectedProjectId(state),
            mode: 'edit',
          });
          break;
        case 'action:open-statuses':
          openDialogById('modal-statuses');
          break;
        case 'action:open-backup':
          openDialogById('modal-backup');
          break;
        case 'action:open-trash':
          openDialogById('modal-trash');
          break;
        case 'action:open-preferences':
          openDialogById('modal-preferences');
          break;
        case 'action:toggle-theme':
          toggleColorScheme();
          break;
      }
    },
  });

  if (!store.getState().readOnly) {
    const expiredBefore = store.getState().trash.length;
    const { state: afterPurge } = store.dispatch({
      type: 'purge_expired_trash',
      now: new Date().toISOString(),
    });
    if (afterPurge.trash.length < expiredBefore) {
      purgeOrphanedAssets();
    }
  }

  wireBackupModal({
    db,
    store,
    appVersion: APP_VERSION,
    onBeforeReplace() {
      flushActiveViewHandles();
      revokeAllAssetUrls();
    },
  });

  wirePreferencesModal({ store });
  wireStatusModal({ store });
  wireTrashModal({ store });

  /** @type {() => void} */
  let cleanupSwUpdates = () => {};

  window.addEventListener('beforeunload', () => {
    cleanupSwUpdates();
    flushActiveViewHandles();
    cancelLockWait();
    stopLockListener();
    lockHandle.release();
    revokeAllAssetUrls();
  });

  initCovenant(document);
  purgeOrphanedAssets();
  renderCurrentView();

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const registerSw = () => {
      void setupServiceWorkerUpdates({
        register: () => navigator.serviceWorker.register('./sw.js', { scope: './' }),
        onUpdateReady(applyUpdate) {
          renderSwUpdateBanner(true, {
            onReload() {
              flushActiveViewHandles();
              applyUpdate();
            },
          });
        },
      }).then((dispose) => {
        cleanupSwUpdates = dispose;
      });
    };
    if (document.readyState === 'complete') {
      registerSw();
    } else {
      window.addEventListener('load', registerSw, { once: true });
    }
  }
}

void bootstrap();

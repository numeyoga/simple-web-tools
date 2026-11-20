// Application store. Holds the state, calls the pure domain rules of `src/core`, persists
// (debounced) to IndexedDB, emits onState / onTick and owns the one-second timer.
//
// Single-writer model (decision 0004): the tab that holds the Web Lock `chrono-write-lock` writes;
// every other tab is read-only. Its actions are refused (see `onRefused`), it re-reads the
// database when the writer announces a change on the workspace channel, and it becomes the
// writer when the lock is released.

import { acquireWriteLock, onWriteLockReleased, waitForWriteLock } from '@simple-web-tools/storage';
import { migrateRelativeDueDates } from '../core/due-dates.js';
import * as attendance from '../core/attendance.js';
import * as projects from '../core/projects.js';
import { seed } from '../core/seed.js';
import * as sessions from '../core/sessions.js';
import * as todos from '../core/todos.js';
import { buildExport } from './backup.js';
import { importFallbackOnce } from './fallback.js';
import { idbAll, idbSync, openDB } from './idb.js';
import { uid } from './ids.js';
import { copyLegacyDatabases } from './legacy-databases.js';
import { APP, channelName } from './names.js';
import { STORE_NAMES, wsActiveId } from './workspace-list.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').CollectionName} CollectionName */

export function createStore() {
  const state = {
    loaded: false,
    /** True in a tab that does not hold the write lock: it only reads. */
    readOnly: false,
    /** @type {ChronoData['projects']} */ projects: [],
    /** @type {ChronoData['todos']} */ todos: [],
    /** @type {ChronoData['sessions']} */ sessions: [],
    /** @type {ChronoData['attendance']} */ attendance: [],
  };

  /** @typedef {(s: typeof state) => void} Listener */
  /** @type {Set<Listener>} */
  const stateListeners = new Set();
  /** @type {Set<Listener>} */
  const tickListeners = new Set();
  /** @type {ReturnType<typeof setTimeout> | null} */
  let saveTimer = null;
  /** @type {Set<CollectionName>} */
  const dirtyStores = new Set();

  /** @param {Listener} fn */
  function onState(fn) {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  }
  /** @param {Listener} fn */
  function onTick(fn) {
    tickListeners.add(fn);
    return () => tickListeners.delete(fn);
  }

  function emitState() {
    stateListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  }
  function emitTick() {
    tickListeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /** @param {CollectionName} which */
  function scheduleSave(which) {
    if (state.readOnly) return;
    dirtyStores.add(which);
    if (!state.loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 80);
  }

  // Snapshot of what was written or read in IndexedDB: id -> object (reference).
  /** @type {Record<CollectionName, Map<string, unknown>>} */
  const persisted = {
    projects: new Map(),
    todos: new Map(),
    sessions: new Map(),
    attendance: new Map(),
  };
  function resetPersisted() {
    for (const n of STORE_NAMES) persisted[n] = new Map(state[n].map((it) => [it.id, it]));
  }

  /** @type {BroadcastChannel | null} */
  let channel = null; // the writer announces its writes here, the readers listen

  /** @type {Set<() => void>} */
  const refusedListeners = new Set();
  /**
   * Called when a read-only tab refuses an action, so that the UI can tell the user.
   * @param {() => void} fn
   */
  function onRefused(fn) {
    refusedListeners.add(fn);
    return () => refusedListeners.delete(fn);
  }

  async function flush() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (state.readOnly) return;
    const names = STORE_NAMES.filter((n) => dirtyStores.has(n));
    dirtyStores.clear();
    let written = false;
    await Promise.all(
      names.map(async (n) => {
        const items = state[n];
        try {
          if (await idbSync(n, items, persisted[n])) written = true;
          persisted[n] = new Map(items.map((it) => [it.id, it]));
        } catch (e) {
          console.warn('[db] write failed (' + n + ')', e);
          dirtyStores.add(n); // to retry on the next flush
        }
      }),
    );
    if (written) announceChange();
  }

  /** Tells the read-only tabs of this workspace that the database changed. */
  function announceChange() {
    try {
      channel?.postMessage('update');
    } catch {
      /* ignore */
    }
  }

  // Flushes the pending writes right away (tab closed or hidden).
  function flushNow() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (state.loaded && !state.readOnly && dirtyStores.size) flush();
  }
  window.addEventListener('pagehide', flushNow);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow();
    });
  }

  /**
   * Replaces the state with what the database holds. Old relative due dates are migrated; the
   * writer saves the migrated todos.
   * @returns {Promise<boolean>} whether todos were migrated (and must be written by the writer)
   */
  async function readDatabase() {
    const r = await Promise.all(STORE_NAMES.map(idbAll));
    STORE_NAMES.forEach((n, i) => {
      Object.assign(state, { [n]: r[i] ?? [] });
    });
    resetPersisted(); // snapshot BEFORE migration: migrated todos are thus rewritten
    const migration = migrateRelativeDueDates(state.todos, Date.now());
    state.todos = migration.todos;
    return migration.change;
  }

  // The writer announced a change: a read-only tab re-reads the database.
  async function reloadFromStorage() {
    if (!state.loaded || !state.readOnly) return;
    await readDatabase();
    emitState();
  }

  /** @type {() => void} */
  let cancelLockWait = () => {};
  /** @type {() => void} */
  let stopLockListener = () => {};

  /**
   * This tab gets the write lock: it re-reads the database (the former writer may have written
   * until its last moment) and starts to write.
   * @param {{ release: () => void }} granted
   */
  async function promote(granted) {
    if (!state.readOnly) {
      granted.release();
      return;
    }
    cancelLockWait();
    cancelLockWait = () => {};
    // Read first: the tab must not act on a state older than the former writer's last write.
    const migrated = await readDatabase();
    state.readOnly = false;
    if (migrated) scheduleSave('todos');
    emitState();
  }

  async function retryAcquireLock() {
    if (!state.readOnly) return;
    const next = await acquireWriteLock(APP);
    if (next.acquired) await promote(next);
  }

  /**
   * "Resume editing" of the banner: takes the write lock if the other tab let it go.
   * @returns {Promise<boolean>} whether this tab is now the writer
   */
  async function retryWriteLock() {
    await retryAcquireLock();
    return !state.readOnly;
  }

  /* --- initial load --- */
  async function init() {
    const handle = await acquireWriteLock(APP);
    state.readOnly = !handle.acquired;
    try {
      // Only the writer touches the databases of the other workspaces.
      if (!state.readOnly) await copyLegacyDatabases();
      const db = await openDB();
      if (!state.readOnly) await importFallbackOnce(db, wsActiveId(), Date.now());
    } catch (error) {
      handle.release(); // nothing was written: let another tab try
      throw error;
    }
    const migrated = await readDatabase();
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(channelName(wsActiveId()));
      channel.onmessage = () => {
        reloadFromStorage();
      };
    }
    if (state.readOnly) {
      cancelLockWait = waitForWriteLock(APP, (granted) => {
        void promote(granted);
      });
      stopLockListener = onWriteLockReleased(APP, () => {
        void retryAcquireLock();
      });
    }
    state.loaded = true;
    // After state.loaded: scheduleSave writes nothing before.
    if (migrated) scheduleSave('todos');
    emitState();
    setInterval(emitTick, 1000);
  }

  window.addEventListener('pagehide', (event) => {
    if (/** @type {PageTransitionEvent} */ (event).persisted) return;
    cancelLockWait();
    stopLockListener();
  });

  /* ============= Actions ============= */

  /** @returns {ChronoData} */
  const currentData = () => ({
    projects: state.projects,
    todos: state.todos,
    sessions: state.sessions,
    attendance: state.attendance,
  });

  /**
   * Adopts the data returned by a core function: every collection whose array changed is
   * stored and scheduled for writing, then the listeners are notified.
   * @param {ChronoData} next
   */
  function apply(next) {
    for (const n of STORE_NAMES) {
      if (next[n] !== state[n]) {
        Object.assign(state, { [n]: next[n] });
        scheduleSave(n);
      }
    }
    emitState();
  }

  // SESSIONS
  // Several timers can run IN PARALLEL: starting one never stops the others. The "active"
  // timers are simply all the sessions whose status is not 'done' (running or paused).
  function activeSessions() {
    return sessions.activeSessions(state.sessions);
  }

  /**
   * @param {string} projectId
   * @param {string} [description]
   */
  function startSession(projectId, description = '') {
    const newId = uid('s');
    apply(sessions.startSession(currentData(), { projectId, description }, Date.now(), newId));
    return newId;
  }

  // --- Control of ONE timer ---
  /** @param {string} id */
  function pauseSession(id) {
    apply(sessions.pauseSession(currentData(), { id }, Date.now()));
  }
  /** @param {string} id */
  function resumeSession(id) {
    apply(sessions.resumeSession(currentData(), { id }, Date.now()));
  }
  /** @param {string} id */
  function stopSession(id) {
    apply(sessions.stopSession(currentData(), { id }, Date.now()));
  }

  // --- GROUPED control of all the active timers (1+) ---
  /**
   * Applies a grouped change: nothing happens (no write, no notification) when it changed nothing.
   * @param {(d: ChronoData, now: number) => ChronoData} fn
   */
  function applyToAll(fn) {
    const before = currentData();
    const after = fn(before, Date.now());
    if (after !== before) apply(after);
  }
  function pauseAll() {
    applyToAll(sessions.pauseAll);
  }
  function resumeAll() {
    applyToAll(sessions.resumeAll);
  }
  function stopAll() {
    applyToAll(sessions.stopAll);
  }

  /** @param {string} id */
  function deleteSession(id) {
    apply(sessions.deleteSession(currentData(), { id }));
  }

  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Session>} patch
   */
  function updateSession(id, patch) {
    apply(sessions.updateSession(currentData(), { id, patch }));
  }

  // Manual entry of an already finished session (correction / catch-up).
  /** @param {{ projectId: string, description?: string, start: number, end: number }} entry */
  function addManualSession(entry) {
    const before = currentData();
    const id = uid('s');
    const after = sessions.addManualSession(before, entry, id);
    if (after === before) return null;
    apply(after);
    return id;
  }

  // TODOS
  /**
   * @param {string} title
   * @param {string | null | undefined} projectId
   * @param {string | null} [dueDate]
   * @param {string} [description]
   */
  function addTodo(title, projectId, dueDate = null, description = '') {
    apply(
      todos.addTodo(
        currentData(),
        { title, projectId, dueDate, description },
        Date.now(),
        uid('t'),
      ),
    );
  }
  /** @param {string} id */
  function toggleTodo(id) {
    apply(todos.toggleTodo(currentData(), { id }));
  }
  /** @param {string} id */
  function deleteTodo(id) {
    apply(todos.deleteTodo(currentData(), { id }));
  }
  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Todo>} patch
   */
  function updateTodo(id, patch) {
    apply(todos.updateTodo(currentData(), { id, patch }));
  }

  // PROJECTS
  /**
   * @param {string} name
   * @param {string} [client]
   * @param {{ category?: number | null, customColor?: string | null }} [color] without one, the
   *   next category of the default order
   */
  function addProject(name, client = '', color = {}) {
    const id = uid('p');
    apply(projects.addProject(currentData(), { name, client, ...color }, id));
    return id;
  }
  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Project>} patch
   */
  function updateProject(id, patch) {
    apply(projects.updateProject(currentData(), { id, patch }));
  }
  /** @param {string} id */
  function toggleProjectArchived(id) {
    apply(projects.toggleProjectArchived(currentData(), { id }));
  }
  /** @param {string} id */
  function deleteProject(id) {
    apply(projects.deleteProject(currentData(), { id }));
  }

  // ATTENDANCE
  function attendanceState() {
    return attendance.attendanceState(state.attendance, Date.now());
  }
  /** @param {import('../types.js').AttendanceType} type */
  function recordAttendance(type) {
    apply(attendance.recordAttendance(currentData(), { type }, Date.now(), uid('pt')));
  }
  /**
   * @param {import('../types.js').AttendanceType} type
   * @param {number} at
   */
  function addAttendance(type, at) {
    apply(attendance.addAttendance(currentData(), { type, at }, uid('pt')));
  }
  /**
   * @param {string} id
   * @param {Partial<import('../types.js').AttendanceEvent>} patch
   */
  function updateAttendance(id, patch) {
    apply(attendance.updateAttendance(currentData(), { id, patch }));
  }
  /** @param {string} id */
  function deleteAttendance(id) {
    apply(attendance.deleteAttendance(currentData(), { id }));
  }

  // DEMO DATA: never loaded on its own, only when the user asks, in an empty workspace.
  /** @returns {boolean} */
  const isEmpty = () => STORE_NAMES.every((n) => state[n].length === 0);

  /** @returns {boolean} whether the demo data was loaded */
  function loadDemoData() {
    if (!isEmpty()) return false;
    apply(seed(Date.now()));
    return true;
  }

  /* --- export (current workspace) --- */
  async function exportJson() {
    // Make sure the pending writes are flushed before the export.
    await flush();
    return buildExport(currentData(), Date.now());
  }

  /**
   * A read-only tab refuses the action and tells the listeners; the writer runs it. The
   * refused call returns `undefined`, which the callers that read a result (a new id) treat as
   * "nothing was created".
   * @template {(...args: never[]) => unknown} F
   * @param {F} action
   * @returns {F}
   */
  function writerOnly(action) {
    const guarded = (/** @type {never[]} */ ...args) => {
      if (state.readOnly) {
        refusedListeners.forEach((fn) => fn());
        return undefined;
      }
      return action(...args);
    };
    // The cast keeps the signature of the action for the callers (justified above).
    return /** @type {F} */ (/** @type {unknown} */ (guarded));
  }

  const actions = {
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    pauseAll,
    resumeAll,
    stopAll,
    deleteSession,
    updateSession,
    addManualSession,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    addProject,
    updateProject,
    toggleProjectArchived,
    deleteProject,
    recordAttendance,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    loadDemoData,
  };

  return {
    state,
    init,
    onState,
    onTick,
    onRefused,
    retryWriteLock,
    actions: /** @type {typeof actions} */ (
      Object.fromEntries(Object.entries(actions).map(([name, fn]) => [name, writerOnly(fn)]))
    ),
    attendanceState,
    activeSessions,
    isEmpty,
    exportJson,
    flush,
    reloadFromStorage,
  };
}

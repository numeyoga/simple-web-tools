// Application store. Holds the state, calls the pure domain rules of `src/core`, persists
// (debounced) to IndexedDB with a localStorage fallback, emits onState / onTick, owns the
// one-second timer and the BroadcastChannel of the active workspace.
//
// Several tabs may write at the same time (multi-writer model): each tab writes only what it
// changed and re-reads everything when another tab announces a write.

import { migrateRelativeDueDates } from '../core/due-dates.js';
import * as attendance from '../core/attendance.js';
import * as projects from '../core/projects.js';
import { emptyData, seed } from '../core/seed.js';
import * as sessions from '../core/sessions.js';
import * as todos from '../core/todos.js';
import { buildExport } from './backup.js';
import { loadFallback, saveFallback } from './fallback.js';
import { idbAll, idbBulkPut, idbSync, openDB } from './idb.js';
import { uid } from './ids.js';
import { channelName, fallbackKey } from './names.js';
import { STORE_NAMES, isDemoEnabled, wsActiveId } from './workspace-list.js';

/** @typedef {import('../types.js').ChronoData} ChronoData */
/** @typedef {import('../types.js').CollectionName} CollectionName */

export function createStore() {
  const state = {
    loaded: false,
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
  let usingIdb = false;
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
  let channel = null; // BroadcastChannel of the workspace (several tabs, IndexedDB)

  async function flush() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (usingIdb) {
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
      if (written && channel) {
        try {
          channel.postMessage('update');
        } catch {
          /* ignore */
        }
      }
    } else if (dirtyStores.size) {
      dirtyStores.clear();
      saveFallback(state);
    }
  }

  // Flushes the pending writes right away (tab closed or hidden).
  function flushNow() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (state.loaded && dirtyStores.size) flush();
  }
  window.addEventListener('pagehide', flushNow);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow();
    });
  }

  // Another tab wrote: flush our pending writes, re-read everything from the persistence,
  // replace the state and reset the snapshot.
  async function reloadFromStorage() {
    if (!state.loaded) return;
    /** @type {Partial<ChronoData> | null} */
    let latest = null;
    for (let attempt = 0; attempt < 3 && !latest; attempt++) {
      await flush();
      /** @type {Partial<ChronoData> | null} */
      let fresh;
      if (usingIdb) {
        const r = await Promise.all(STORE_NAMES.map(idbAll));
        fresh = Object.fromEntries(STORE_NAMES.map((n, i) => [n, r[i]]));
      } else {
        fresh = loadFallback();
      }
      if (!fresh) return;
      if (!dirtyStores.size) latest = fresh; // otherwise a local change came in meanwhile: retry
    }
    if (!latest) return;
    const readBack = latest;
    for (const n of STORE_NAMES) {
      const v = readBack[n];
      Object.assign(state, { [n]: Array.isArray(v) ? v : [] });
    }
    resetPersisted(); // snapshot BEFORE migration: migrated todos are thus rewritten
    const migration = migrateRelativeDueDates(state.todos, Date.now());
    state.todos = migration.todos;
    emitState();
    if (migration.change) scheduleSave('todos');
  }

  /* --- initial load --- */
  async function init({ seedIfEmpty = true } = {}) {
    const db = await openDB();
    if (db) {
      usingIdb = true;
      const [storedProjects, storedTodos, storedSessions, storedAttendance] = await Promise.all([
        idbAll('projects'),
        idbAll('todos'),
        idbAll('sessions'),
        idbAll('attendance'),
      ]);
      const isFresh =
        /** @type {any[]} */ (storedProjects).length === 0 &&
        /** @type {any[]} */ (storedTodos).length === 0 &&
        /** @type {any[]} */ (storedSessions).length === 0 &&
        /** @type {any[]} */ (storedAttendance).length === 0;
      if (isFresh && seedIfEmpty && isDemoEnabled(wsActiveId())) {
        const s = seed(Date.now());
        await Promise.all([
          idbBulkPut('projects', s.projects),
          idbBulkPut('todos', s.todos),
          idbBulkPut('sessions', s.sessions),
          idbBulkPut('attendance', s.attendance),
        ]);
        state.projects = s.projects;
        state.todos = s.todos;
        state.sessions = s.sessions;
        state.attendance = s.attendance;
      } else {
        state.projects = /** @type {any} */ (storedProjects);
        state.todos = /** @type {any} */ (storedTodos);
        state.sessions = /** @type {any} */ (storedSessions);
        state.attendance = /** @type {any} */ (storedAttendance);
      }
      resetPersisted();
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(channelName(wsActiveId()));
        channel.onmessage = () => {
          reloadFromStorage();
        };
      }
    } else {
      usingIdb = false;
      const ls = loadFallback();
      if (ls) {
        Object.assign(state, ls);
      } else if (seedIfEmpty && isDemoEnabled(wsActiveId())) {
        Object.assign(state, seed(Date.now()));
      } else {
        Object.assign(state, emptyData());
      }
      // localStorage fallback: another tab wrote the workspace key.
      const key = fallbackKey(wsActiveId());
      window.addEventListener('storage', (e) => {
        if (e.key == null || e.key === key) reloadFromStorage();
      });
    }
    // Old relative due dates -> absolute dates. With IndexedDB, resetPersisted() has already run
    // on the data read: the migrated todos differ from the snapshot and will be written.
    const migration = migrateRelativeDueDates(state.todos, Date.now());
    state.todos = migration.todos;
    state.loaded = true;
    if (migration.change) scheduleSave('todos'); // after state.loaded: scheduleSave writes nothing before
    emitState();
    setInterval(emitTick, 1000);
  }

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
   * @param {string} [color]
   */
  function addProject(name, client = '', color = '#2563eb') {
    const id = uid('p');
    apply(projects.addProject(currentData(), { name, client, color }, id));
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

  /* --- export (current workspace) --- */
  async function exportJson() {
    // Make sure the pending writes are flushed before the export.
    await flush();
    return buildExport(currentData(), Date.now());
  }

  return {
    state,
    init,
    onState,
    onTick,
    actions: {
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
    },
    attendanceState,
    activeSessions,
    exportJson,
    flush,
    reloadFromStorage,
  };
}

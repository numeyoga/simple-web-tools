// Application store. Holds the state, calls the pure domain rules of `src/core`, persists
// (debounced) to IndexedDB with a localStorage fallback, emits onState / onTick, owns the
// one-second timer and the BroadcastChannel of the active workspace.
//
// Several tabs may write at the same time (multi-writer model): each tab writes only what it
// changed and re-reads everything when another tab announces a write.

import { migrerEcheancesTodos } from '../core/echeances.js';
import { construireExport } from '../core/import-export.js';
import * as pointage from '../core/pointage.js';
import * as projets from '../core/projets.js';
import { emptyData, seed } from '../core/seed.js';
import * as sessions from '../core/sessions.js';
import * as todos from '../core/todos.js';
import { lsLoad, lsSave } from './fallback.js';
import { idbAll, idbBulkPut, idbSync, openDB } from './idb.js';
import { uid } from './ids.js';
import { STORE_NAMES, channelNameFor, lsKeyFor, wsActive, wsActiveId } from './workspace-list.js';

/** @typedef {import('../types.js').Donnees} Donnees */
/** @typedef {import('../types.js').NomCollection} NomCollection */

export function createStore() {
  const state = {
    loaded: false,
    /** @type {Donnees['projets']} */ projets: [],
    /** @type {Donnees['todos']} */ todos: [],
    /** @type {Donnees['sessions']} */ sessions: [],
    /** @type {Donnees['pointage']} */ pointage: [],
  };

  /** @typedef {(s: typeof state) => void} Listener */
  /** @type {Set<Listener>} */
  const stateListeners = new Set();
  /** @type {Set<Listener>} */
  const tickListeners = new Set();
  let usingIDB = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let saveTimer = null;
  /** @type {Set<NomCollection>} */
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

  /** @param {NomCollection} which */
  function scheduleSave(which) {
    dirtyStores.add(which);
    if (!state.loaded) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 80);
  }

  // Snapshot of what was written or read in IndexedDB: id -> object (reference).
  /** @type {Record<NomCollection, Map<string, unknown>>} */
  const persiste = {
    projets: new Map(),
    todos: new Map(),
    sessions: new Map(),
    pointage: new Map(),
  };
  function resetPersiste() {
    for (const n of STORE_NAMES) persiste[n] = new Map(state[n].map((it) => [it.id, it]));
  }

  /** @type {BroadcastChannel | null} */
  let canal = null; // BroadcastChannel of the workspace (several tabs, IndexedDB)

  async function flush() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (usingIDB) {
      const noms = STORE_NAMES.filter((n) => dirtyStores.has(n));
      dirtyStores.clear();
      let ecrit = false;
      await Promise.all(
        noms.map(async (n) => {
          const items = state[n];
          try {
            if (await idbSync(n, items, persiste[n])) ecrit = true;
            persiste[n] = new Map(items.map((it) => [it.id, it]));
          } catch (e) {
            console.warn('[db] écriture échouée (' + n + ')', e);
            dirtyStores.add(n); // to retry on the next flush
          }
        }),
      );
      if (ecrit && canal) {
        try {
          canal.postMessage('maj');
        } catch {
          /* ignore */
        }
      }
    } else if (dirtyStores.size) {
      dirtyStores.clear();
      lsSave(state);
    }
  }

  // Flushes the pending writes right away (tab closed or hidden).
  function flushMaintenant() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (state.loaded && dirtyStores.size) flush();
  }
  window.addEventListener('pagehide', flushMaintenant);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushMaintenant();
    });
  }

  // Another tab wrote: flush our pending writes, re-read everything from the persistence,
  // replace the state and reset the snapshot.
  async function recharger() {
    if (!state.loaded) return;
    /** @type {Partial<Donnees> | null} */
    let lus = null;
    for (let essai = 0; essai < 3 && !lus; essai++) {
      await flush();
      /** @type {Partial<Donnees> | null} */
      let relu;
      if (usingIDB) {
        const r = await Promise.all(STORE_NAMES.map(idbAll));
        relu = Object.fromEntries(STORE_NAMES.map((n, i) => [n, r[i]]));
      } else {
        relu = lsLoad();
      }
      if (!relu) return;
      if (!dirtyStores.size) lus = relu; // otherwise a local change came in meanwhile: retry
    }
    if (!lus) return;
    const relus = lus;
    for (const n of STORE_NAMES) {
      const v = relus[n];
      Object.assign(state, { [n]: Array.isArray(v) ? v : [] });
    }
    resetPersiste(); // snapshot BEFORE migration: migrated todos are thus rewritten
    const mig = migrerEcheancesTodos(state.todos, Date.now());
    state.todos = mig.todos;
    emitState();
    if (mig.change) scheduleSave('todos');
  }

  /* --- initial load --- */
  async function init({ seedIfEmpty = true } = {}) {
    const db = await openDB();
    if (db) {
      usingIDB = true;
      const [pr, td, se, pt] = await Promise.all([
        idbAll('projets'),
        idbAll('todos'),
        idbAll('sessions'),
        idbAll('pointage'),
      ]);
      const isFresh =
        /** @type {any[]} */ (pr).length === 0 &&
        /** @type {any[]} */ (td).length === 0 &&
        /** @type {any[]} */ (se).length === 0 &&
        /** @type {any[]} */ (pt).length === 0;
      if (isFresh && seedIfEmpty && wsActive().seedOnInit !== false) {
        const s = seed(Date.now());
        await Promise.all([
          idbBulkPut('projets', s.projets),
          idbBulkPut('todos', s.todos),
          idbBulkPut('sessions', s.sessions),
          idbBulkPut('pointage', s.pointage),
        ]);
        state.projets = s.projets;
        state.todos = s.todos;
        state.sessions = s.sessions;
        state.pointage = s.pointage;
      } else {
        state.projets = /** @type {any} */ (pr);
        state.todos = /** @type {any} */ (td);
        state.sessions = /** @type {any} */ (se);
        state.pointage = /** @type {any} */ (pt);
      }
      resetPersiste();
      if (typeof BroadcastChannel !== 'undefined') {
        canal = new BroadcastChannel(channelNameFor(wsActiveId()));
        canal.onmessage = () => {
          recharger();
        };
      }
    } else {
      usingIDB = false;
      const ls = lsLoad();
      if (ls) {
        Object.assign(state, ls);
      } else if (seedIfEmpty && wsActive().seedOnInit !== false) {
        Object.assign(state, seed(Date.now()));
      } else {
        Object.assign(state, emptyData());
      }
      // localStorage fallback: another tab wrote the workspace key.
      const cle = lsKeyFor(wsActiveId());
      window.addEventListener('storage', (e) => {
        if (e.key == null || e.key === cle) recharger();
      });
    }
    // Old relative due dates -> absolute dates. With IndexedDB, resetPersiste() has already run
    // on the data read: the migrated todos differ from the snapshot and will be written.
    const mig = migrerEcheancesTodos(state.todos, Date.now());
    state.todos = mig.todos;
    state.loaded = true;
    if (mig.change) scheduleSave('todos'); // after state.loaded: scheduleSave writes nothing before
    emitState();
    setInterval(emitTick, 1000);
  }

  /* ============= Actions ============= */

  /** @returns {Donnees} */
  const donnees = () => ({
    projets: state.projets,
    todos: state.todos,
    sessions: state.sessions,
    pointage: state.pointage,
  });

  /**
   * Adopts the data returned by a core function: every collection whose array changed is
   * stored and scheduled for writing, then the listeners are notified.
   * @param {Donnees} next
   */
  function appliquer(next) {
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
  // timers are simply all the sessions whose status is not 'terminee' (running or paused).
  function sessionsActives() {
    return sessions.sessionsActives(state.sessions);
  }

  /**
   * @param {string} projetId
   * @param {string} [description]
   */
  function demarrer(projetId, description = '') {
    const newId = uid('s');
    appliquer(sessions.demarrer(donnees(), { projetId, description }, Date.now(), newId));
    return newId;
  }

  // --- Control of ONE timer ---
  /** @param {string} id */
  function pauserSession(id) {
    appliquer(sessions.pauserSession(donnees(), { id }, Date.now()));
  }
  /** @param {string} id */
  function reprendreSession(id) {
    appliquer(sessions.reprendreSession(donnees(), { id }, Date.now()));
  }
  /** @param {string} id */
  function arreterSession(id) {
    appliquer(sessions.arreterSession(donnees(), { id }, Date.now()));
  }

  // --- GROUPED control of all the active timers (1+) ---
  /**
   * Applies a grouped change: nothing happens (no write, no notification) when it changed nothing.
   * @param {(d: Donnees, now: number) => Donnees} fn
   */
  function groupe(fn) {
    const avant = donnees();
    const apres = fn(avant, Date.now());
    if (apres !== avant) appliquer(apres);
  }
  function pauserTout() {
    groupe(sessions.pauserTout);
  }
  function reprendreTout() {
    groupe(sessions.reprendreTout);
  }
  function arreterTout() {
    groupe(sessions.arreterTout);
  }

  /** @param {string} id */
  function supprimerSession(id) {
    appliquer(sessions.supprimerSession(donnees(), { id }));
  }

  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Session>} patch
   */
  function majSession(id, patch) {
    appliquer(sessions.majSession(donnees(), { id, patch }));
  }

  // Manual entry of an already finished session (correction / catch-up).
  /** @param {{ projetId: string, description?: string, debut: number, fin: number }} entree */
  function ajouterSessionManuelle(entree) {
    const avant = donnees();
    const id = uid('s');
    const apres = sessions.ajouterSessionManuelle(avant, entree, id);
    if (apres === avant) return null;
    appliquer(apres);
    return id;
  }

  // TODOS
  /**
   * @param {string} titre
   * @param {string | null | undefined} projetId
   * @param {string | null} [echeance]
   * @param {string} [description]
   */
  function ajouterTodo(titre, projetId, echeance = null, description = '') {
    appliquer(
      todos.ajouterTodo(
        donnees(),
        { titre, projetId, echeance, description },
        Date.now(),
        uid('t'),
      ),
    );
  }
  /** @param {string} id */
  function toggleTodo(id) {
    appliquer(todos.toggleTodo(donnees(), { id }));
  }
  /** @param {string} id */
  function supprimerTodo(id) {
    appliquer(todos.supprimerTodo(donnees(), { id }));
  }
  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Todo>} patch
   */
  function majTodo(id, patch) {
    appliquer(todos.majTodo(donnees(), { id, patch }));
  }

  // PROJETS
  /**
   * @param {string} nom
   * @param {string} [client]
   * @param {string} [couleur]
   */
  function ajouterProjet(nom, client = '', couleur = '#2563eb') {
    const id = uid('p');
    appliquer(projets.ajouterProjet(donnees(), { nom, client, couleur }, id));
    return id;
  }
  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Projet>} patch
   */
  function majProjet(id, patch) {
    appliquer(projets.majProjet(donnees(), { id, patch }));
  }
  /** @param {string} id */
  function archiverProjet(id) {
    appliquer(projets.archiverProjet(donnees(), { id }));
  }
  /** @param {string} id */
  function supprimerProjet(id) {
    appliquer(projets.supprimerProjet(donnees(), { id }));
  }

  // POINTAGE
  function etatPointage() {
    return pointage.etatPointage(state.pointage, Date.now());
  }
  /** @param {import('../types.js').TypePointage} type */
  function pointer(type) {
    appliquer(pointage.pointer(donnees(), { type }, Date.now(), uid('pt')));
  }
  /**
   * @param {import('../types.js').TypePointage} type
   * @param {number} at
   */
  function ajouterPointage(type, at) {
    appliquer(pointage.ajouterPointage(donnees(), { type, at }, uid('pt')));
  }
  /**
   * @param {string} id
   * @param {Partial<import('../types.js').Pointage>} patch
   */
  function majPointage(id, patch) {
    appliquer(pointage.majPointage(donnees(), { id, patch }));
  }
  /** @param {string} id */
  function supprimerPointage(id) {
    appliquer(pointage.supprimerPointage(donnees(), { id }));
  }

  /* --- export (current workspace) --- */
  async function exporterJSON() {
    // Make sure the pending writes are flushed before the export.
    await flush();
    return construireExport(donnees(), wsActive(), Date.now());
  }

  return {
    state,
    init,
    onState,
    onTick,
    actions: {
      demarrer,
      pauserSession,
      reprendreSession,
      arreterSession,
      pauserTout,
      reprendreTout,
      arreterTout,
      supprimerSession,
      majSession,
      ajouterSessionManuelle,
      ajouterTodo,
      toggleTodo,
      supprimerTodo,
      majTodo,
      ajouterProjet,
      majProjet,
      archiverProjet,
      supprimerProjet,
      pointer,
      ajouterPointage,
      majPointage,
      supprimerPointage,
    },
    etatPointage,
    sessionsActives,
    exporterJSON,
    flush,
    recharger,
  };
}

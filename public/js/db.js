// js/db.js — store applicatif. Persistance IndexedDB, fallback localStorage.
// Schéma :
//   projets  : { id, nom, couleur, client, archive, tarif }
//   todos    : { id, titre, fait, projetId, echeance, creeLe }
//   sessions : { id, projetId, description, debut, dernierDebut, fin, duree, statut }
//                statut : 'terminee' | 'en_cours' | 'en_pause'
//   pointage : { id, type, at } — type : 'arrivee' | 'pause_debut' | 'pause_fin' | 'depart'

const DB_NAME = 'chrono';
const DB_VERSION = 1;
const LS_FALLBACK_KEY = 'chrono.fallback.v1';

let _dbPromise = null;
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-idb')); return; }
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; console.warn('[db] indexedDB.open timed out, falling back to localStorage'); reject(new Error('idb-timeout')); }
    }, 1500);
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) { settled = true; clearTimeout(timeout); reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['projets','todos','sessions','pointage']) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => { if (!settled) { settled = true; clearTimeout(timeout); resolve(req.result); } };
    req.onerror = () => { if (!settled) { settled = true; clearTimeout(timeout); reject(req.error); } };
    req.onblocked = () => { if (!settled) { settled = true; clearTimeout(timeout); reject(new Error('idb-blocked')); } };
  }).catch((e) => { console.warn('[db] openDB fallback:', e?.message || e); return null; });
  return _dbPromise;
}

async function idbAll(store) {
  const db = await openDB(); if (!db) return null;
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function idbReplace(store, items) {
  const db = await openDB(); if (!db) return false;
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store); s.clear();
    items.forEach(it => s.put(it));
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGetMeta(key) {
  const db = await openDB(); if (!db) return null;
  return new Promise((res) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => res(req.result ? req.result.value : null);
    req.onerror = () => res(null);
  });
}
async function idbSetMeta(key, value) {
  const db = await openDB(); if (!db) return false;
  return new Promise((res) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key, value });
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}
async function idbBulkPut(store, items) {
  const db = await openDB(); if (!db) return false;
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    items.forEach(it => s.put(it));
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_FALLBACK_KEY) || 'null'); } catch (e) { return null; }
}
function lsSave(state) {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify({
      projets: state.projets, todos: state.todos, sessions: state.sessions,
      pointage: state.pointage, activeId: state.activeId,
    }));
  } catch (e) {}
}

/* ------------------------------------------------------------------ */
/* Données de démonstration                                            */

function at(h, m = 0, offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  d.setHours(h, m, 0, 0); return d.getTime();
}

function seed() {
  const projets = [
    { id: 'p1', nom: 'Refonte site — Orion SAS',   client: 'Orion SAS',   couleur: '#ea580c', archive: false, tarif: 95 },
    { id: 'p2', nom: 'Design system interne',      client: 'Interne',     couleur: '#2563eb', archive: false, tarif: 0  },
    { id: 'p3', nom: 'App mobile Helios',          client: 'Helios',      couleur: '#16a34a', archive: false, tarif: 110 },
    { id: 'p4', nom: 'Audit UX — Atlas',           client: 'Atlas Co.',   couleur: '#9333ea', archive: false, tarif: 120 },
    { id: 'p5', nom: 'Admin & compta',             client: 'Interne',     couleur: '#71717a', archive: false, tarif: 0   },
    { id: 'p6', nom: 'Migration v2 — Phoenix',     client: 'Phoenix Ltd', couleur: '#0891b2', archive: true,  tarif: 95  },
  ];

  const todos = [
    { id: 't1', titre: 'Valider la palette avec Orion',     fait: false, projetId: 'p1', echeance: 'today',    creeLe: at(8, 30, -1) },
    { id: 't2', titre: 'Maquette écran « panier »',         fait: false, projetId: 'p1', echeance: 'today',    creeLe: at(9, 0, -1) },
    { id: 't3', titre: 'Composants Input + Select v2',      fait: false, projetId: 'p2', echeance: 'tomorrow', creeLe: at(14, 0, -2) },
    { id: 't4', titre: 'Spec écran onboarding Helios',      fait: false, projetId: 'p3', echeance: 'fri',      creeLe: at(10, 0, -3) },
    { id: 't5', titre: 'Facture Orion — octobre',           fait: false, projetId: 'p5', echeance: 'today',    creeLe: at(8, 0) },
    { id: 't6', titre: 'Kick-off call Atlas',               fait: true,  projetId: 'p4', echeance: null,       creeLe: at(9, 0, -2) },
    { id: 't7', titre: 'Trier les références concurrentes', fait: true,  projetId: 'p4', echeance: null,       creeLe: at(11, 0, -2) },
    { id: 't8', titre: 'Tokens de couleur — contraste AA',  fait: false, projetId: 'p2', echeance: null,       creeLe: at(15, 0, -2) },
  ];

  const sessions = [
    { id: 's1',  projetId: 'p1', description: 'Maquette homepage v3',    debut: at(9, 5),   fin: at(10, 30), duree: (10*60+30 - 9*60-5)*60_000,  statut: 'terminee' },
    { id: 's2',  projetId: 'p5', description: 'Facture Orion — octobre', debut: at(10, 35), fin: at(11, 20), duree: (11*60+20 - 10*60-35)*60_000, statut: 'terminee' },
    { id: 's3',  projetId: 'p1', description: 'Revue wireframes panier', debut: at(11, 30), fin: at(12, 45), duree: (12*60+45 - 11*60-30)*60_000, statut: 'terminee' },
    { id: 's4',  projetId: 'p3', description: 'Onboarding — flow',       debut: at(9, 15, -1),  fin: at(11, 30, -1), duree: (11*60+30 - 9*60-15)*60_000,  statut: 'terminee' },
    { id: 's5',  projetId: 'p2', description: 'Tokens couleur',          debut: at(13, 30, -1), fin: at(15, 20, -1), duree: (15*60+20 - 13*60-30)*60_000, statut: 'terminee' },
    { id: 's6',  projetId: 'p4', description: 'Atlas — premières notes', debut: at(15, 40, -1), fin: at(17, 10, -1), duree: (17*60+10 - 15*60-40)*60_000, statut: 'terminee' },
    { id: 's7',  projetId: 'p1', description: 'Brief client',            debut: at(10, 0, -2),  fin: at(12, 0, -2),  duree: 2 * 3600_000,                  statut: 'terminee' },
    { id: 's8',  projetId: 'p3', description: 'Helios — wireframes',     debut: at(14, 0, -2),  fin: at(17, 30, -2), duree: 3.5 * 3600_000,                statut: 'terminee' },
    { id: 's9',  projetId: 'p2', description: 'DS — revue composants',   debut: at(9, 30, -3),  fin: at(12, 15, -3), duree: (12*60+15 - 9*60-30)*60_000,   statut: 'terminee' },
    { id: 's10', projetId: 'p1', description: 'Corrections maquettes',   debut: at(14, 0, -3),  fin: at(15, 45, -3), duree: 1.75 * 3600_000,               statut: 'terminee' },
    { id: 's11', projetId: 'p4', description: 'Audit Atlas — écrans',    debut: at(9, 0, -4),   fin: at(12, 30, -4), duree: 3.5 * 3600_000,                statut: 'terminee' },
    { id: 's12', projetId: 'p5', description: 'Note de frais',           debut: at(14, 0, -4),  fin: at(14, 40, -4), duree: 40 * 60_000,                   statut: 'terminee' },
  ];

  const pointage = [
    { id: 'pt1', type: 'arrivee',     at: at(8, 58) },
    { id: 'pt2', type: 'pause_debut', at: at(12, 45) },
    { id: 'pt3', type: 'arrivee',     at: at(9, 2, -1) },
    { id: 'pt4', type: 'pause_debut', at: at(12, 30, -1) },
    { id: 'pt5', type: 'pause_fin',   at: at(13, 15, -1) },
    { id: 'pt6', type: 'depart',      at: at(18, 5, -1) },
  ];

  return { projets, todos, sessions, pointage };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */

function createStore() {
  const state = {
    loaded: false,
    projets: [], todos: [], sessions: [], pointage: [],
    activeId: null,
  };

  const stateListeners = new Set();
  const tickListeners = new Set();
  let usingIDB = false;
  let saveTimer = null;
  let dirtyStores = new Set(); // 'projets','todos','sessions','pointage','meta'

  function onState(fn) { stateListeners.add(fn); return () => stateListeners.delete(fn); }
  function onTick(fn)  { tickListeners.add(fn);  return () => tickListeners.delete(fn); }

  function emitState() { stateListeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }
  function emitTick()  { tickListeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

  function scheduleSave(which) {
    dirtyStores.add(which);
    if (!state.loaded) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 80);
  }

  async function flush() {
    if (usingIDB) {
      const promises = [];
      if (dirtyStores.has('projets'))  promises.push(idbReplace('projets',  state.projets));
      if (dirtyStores.has('todos'))    promises.push(idbReplace('todos',    state.todos));
      if (dirtyStores.has('sessions')) promises.push(idbReplace('sessions', state.sessions));
      if (dirtyStores.has('pointage')) promises.push(idbReplace('pointage', state.pointage));
      if (dirtyStores.has('meta'))     promises.push(idbSetMeta('activeSessionId', state.activeId));
      dirtyStores.clear();
      await Promise.all(promises);
    } else {
      dirtyStores.clear();
      lsSave(state);
    }
  }

  /* --- chargement initial --- */
  async function init() {
    const db = await openDB();
    if (db) {
      usingIDB = true;
      const [pr, td, se, pt, act] = await Promise.all([
        idbAll('projets'), idbAll('todos'), idbAll('sessions'), idbAll('pointage'),
        idbGetMeta('activeSessionId'),
      ]);
      if (pr.length === 0) {
        const s = seed();
        await Promise.all([
          idbBulkPut('projets', s.projets),
          idbBulkPut('todos', s.todos),
          idbBulkPut('sessions', s.sessions),
          idbBulkPut('pointage', s.pointage),
        ]);
        state.projets = s.projets; state.todos = s.todos; state.sessions = s.sessions; state.pointage = s.pointage;
      } else {
        state.projets = pr; state.todos = td; state.sessions = se; state.pointage = pt;
      }
      state.activeId = act || null;
    } else {
      usingIDB = false;
      const ls = lsLoad() || seed();
      Object.assign(state, ls);
    }
    state.loaded = true;
    emitState();
    // Horloge globale
    setInterval(emitTick, 1000);
  }

  /* ============= Actions ============= */

  // SESSIONS
  function demarrer(projetId, description = '') {
    const now = Date.now();
    const newId = UI.uid('s');
    let sessions = state.sessions.slice();
    if (state.activeId) {
      const cur = sessions.find(s => s.id === state.activeId);
      if (cur && cur.statut !== 'terminee') {
        const fin = now;
        const addDuree = cur.statut === 'en_cours' ? (fin - cur.dernierDebut) : 0;
        sessions = sessions.map(s => s.id === cur.id
          ? { ...s, fin, duree: (s.duree || 0) + addDuree, statut: 'terminee', dernierDebut: null }
          : s);
      }
    }
    sessions.push({
      id: newId, projetId, description: description || '',
      debut: now, dernierDebut: now, fin: null, duree: 0, statut: 'en_cours',
    });
    state.sessions = sessions;
    state.activeId = newId;
    scheduleSave('sessions'); scheduleSave('meta'); emitState();
    return newId;
  }

  function pauserActive() {
    if (!state.activeId) return;
    const now = Date.now();
    state.sessions = state.sessions.map(s => {
      if (s.id !== state.activeId || s.statut !== 'en_cours') return s;
      const addDuree = now - s.dernierDebut;
      return { ...s, duree: (s.duree || 0) + addDuree, dernierDebut: null, statut: 'en_pause' };
    });
    scheduleSave('sessions'); emitState();
  }

  function reprendreActive() {
    if (!state.activeId) return;
    const now = Date.now();
    state.sessions = state.sessions.map(s => s.id === state.activeId && s.statut === 'en_pause'
      ? { ...s, statut: 'en_cours', dernierDebut: now }
      : s
    );
    scheduleSave('sessions'); emitState();
  }

  function arreter() {
    if (!state.activeId) return;
    const now = Date.now();
    state.sessions = state.sessions.map(s => {
      if (s.id !== state.activeId) return s;
      const addDuree = s.statut === 'en_cours' ? (now - s.dernierDebut) : 0;
      return { ...s, fin: now, duree: (s.duree || 0) + addDuree, dernierDebut: null, statut: 'terminee' };
    });
    state.activeId = null;
    scheduleSave('sessions'); scheduleSave('meta'); emitState();
  }

  function supprimerSession(id) {
    state.sessions = state.sessions.filter(s => s.id !== id);
    if (state.activeId === id) state.activeId = null;
    scheduleSave('sessions'); scheduleSave('meta'); emitState();
  }

  // TODOS
  function ajouterTodo(titre, projetId, echeance = null) {
    state.todos = [
      { id: UI.uid('t'), titre, fait: false, projetId, echeance, creeLe: Date.now() },
      ...state.todos,
    ];
    scheduleSave('todos'); emitState();
  }
  function toggleTodo(id) {
    state.todos = state.todos.map(t => t.id === id ? { ...t, fait: !t.fait } : t);
    scheduleSave('todos'); emitState();
  }
  function supprimerTodo(id) {
    state.todos = state.todos.filter(t => t.id !== id);
    scheduleSave('todos'); emitState();
  }
  function majTodo(id, patch) {
    state.todos = state.todos.map(t => t.id === id ? { ...t, ...patch } : t);
    scheduleSave('todos'); emitState();
  }

  // PROJETS
  function ajouterProjet(nom, client = '', couleur = '#2563eb', tarif = 0) {
    const id = UI.uid('p');
    state.projets = [...state.projets, { id, nom, client, couleur, archive: false, tarif }];
    scheduleSave('projets'); emitState();
    return id;
  }
  function majProjet(id, patch) {
    state.projets = state.projets.map(p => p.id === id ? { ...p, ...patch } : p);
    scheduleSave('projets'); emitState();
  }
  function archiverProjet(id) {
    state.projets = state.projets.map(p => p.id === id ? { ...p, archive: !p.archive } : p);
    scheduleSave('projets'); emitState();
  }

  // POINTAGE
  function etatPointage() {
    const today = UI.startOfDay();
    const events = state.pointage.filter(p => p.at >= today).sort((a,b) => a.at - b.at);
    if (events.length === 0) return { statut: 'pas_arrive', events };
    const last = events[events.length - 1];
    if (last.type === 'arrivee' || last.type === 'pause_fin') return { statut: 'present', depuis: last.at, events };
    if (last.type === 'pause_debut') return { statut: 'pause',   depuis: last.at, events };
    if (last.type === 'depart')      return { statut: 'parti', events };
    return { statut: 'present', events };
  }
  function pointer(type) {
    state.pointage = [...state.pointage, { id: UI.uid('pt'), type, at: Date.now() }];
    scheduleSave('pointage'); emitState();
  }

  return {
    state,
    init, onState, onTick,
    actions: {
      demarrer, pauserActive, reprendreActive, arreter, supprimerSession,
      ajouterTodo, toggleTodo, supprimerTodo, majTodo,
      ajouterProjet, majProjet, archiverProjet,
      pointer,
    },
    etatPointage,
  };
}

window.createStore = createStore;

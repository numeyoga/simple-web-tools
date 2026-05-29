// js/db.js — store applicatif. Persistance IndexedDB, fallback localStorage.
//
// Espaces de sauvegarde (workspaces) :
//   Chaque workspace possède son propre IndexedDB (`chrono__<id>`) et son propre
//   fallback localStorage (`chrono.fallback.<id>.v1`). La liste des workspaces
//   et l'identifiant actif sont conservés en localStorage. Changer d'espace
//   recharge la page : le store est entièrement reconstruit.
//
// Schéma IDB :
//   projets  : { id, nom, couleur, client, archive, tarif }
//   todos    : { id, titre, fait, projetId, echeance, creeLe }
//   sessions : { id, projetId, description, debut, dernierDebut, fin, duree, statut }
//                statut : 'terminee' | 'en_cours' | 'en_pause'
//   pointage : { id, type, at } — type : 'arrivee' | 'pause_debut' | 'pause_fin' | 'depart'
//   meta     : { key, value }

const DB_VERSION = 1;
const STORE_NAMES = ['projets', 'todos', 'sessions', 'pointage'];

/* ------------------------------------------------------------------ */
/* Workspaces                                                          */

const WS_LIST_KEY    = 'chrono.workspaces';
const WS_ACTIVE_KEY  = 'chrono.workspace.active';

function wsDefaultList() {
  return [{ id: 'default', label: 'Espace principal', creeLe: Date.now() }];
}

function wsLoadList() {
  try {
    const raw = localStorage.getItem(WS_LIST_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch (e) { /* ignore */ }
  const fresh = wsDefaultList();
  localStorage.setItem(WS_LIST_KEY, JSON.stringify(fresh));
  return fresh;
}
function wsSaveList(list) {
  localStorage.setItem(WS_LIST_KEY, JSON.stringify(list));
}
function wsActiveId() {
  const id = localStorage.getItem(WS_ACTIVE_KEY);
  if (id && wsLoadList().some(w => w.id === id)) return id;
  return wsLoadList()[0].id;
}
function wsSetActiveId(id) {
  localStorage.setItem(WS_ACTIVE_KEY, id);
}
function wsActive() {
  const id = wsActiveId();
  return wsLoadList().find(w => w.id === id) || wsLoadList()[0];
}

const dbNameFor = id => `chrono__${id}`;
const lsKeyFor  = id => `chrono.fallback.${id}.v1`;

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'espace';
}
function uniqueId(base, list) {
  let id = base; let n = 2;
  while (list.some(w => w.id === id)) id = `${base}-${n++}`;
  return id;
}

/* ------------------------------------------------------------------ */
/* IndexedDB helpers                                                   */

let _dbPromise = null;
function openDB() {
  if (_dbPromise) return _dbPromise;
  const dbName = dbNameFor(wsActiveId());
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('no-idb')); return; }
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; console.warn('[db] indexedDB.open timed out, falling back to localStorage'); reject(new Error('idb-timeout')); }
    }, 1500);
    let req;
    try {
      req = indexedDB.open(dbName, DB_VERSION);
    } catch (e) { settled = true; clearTimeout(timeout); reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORE_NAMES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => { if (!settled) { settled = true; clearTimeout(timeout); resolve(req.result); } };
    req.onerror   = () => { if (!settled) { settled = true; clearTimeout(timeout); reject(req.error); } };
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

/* Supprime totalement la base d'un workspace (utilisé pour delete + import "replace"). */
function idbDeleteDatabase(id) {
  return new Promise((res) => {
    if (!('indexedDB' in window)) return res(false);
    const req = indexedDB.deleteDatabase(dbNameFor(id));
    req.onsuccess = () => res(true);
    req.onerror   = () => res(false);
    req.onblocked = () => res(false);
  });
}

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(lsKeyFor(wsActiveId())) || 'null'); } catch (e) { return null; }
}
function lsSave(state) {
  try {
    localStorage.setItem(lsKeyFor(wsActiveId()), JSON.stringify({
      projets: state.projets, todos: state.todos, sessions: state.sessions,
      pointage: state.pointage,
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
    { id: 'p1', nom: 'Refonte site — Orion SAS',   client: 'Orion SAS',   couleur: '#ea580c', archive: false },
    { id: 'p2', nom: 'Design system interne',      client: 'Interne',     couleur: '#2563eb', archive: false },
    { id: 'p3', nom: 'App mobile Helios',          client: 'Helios',      couleur: '#16a34a', archive: false },
    { id: 'p4', nom: 'Audit UX — Atlas',           client: 'Atlas Co.',   couleur: '#9333ea', archive: false },
    { id: 'p5', nom: 'Admin & compta',             client: 'Interne',     couleur: '#71717a', archive: false },
    { id: 'p6', nom: 'Migration v2 — Phoenix',     client: 'Phoenix Ltd', couleur: '#0891b2', archive: true  },
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
    // — Aujourd'hui : une session qui CHEVAUCHE les autres (démontre les voies parallèles sur la timeline).
    { id: 's13', projetId: 'p3', description: 'Helios — atelier specs',    debut: at(9, 30),  fin: at(12, 0),  duree: (12*60 - 9*60-30)*60_000,    statut: 'terminee' },
  ];

  // — Deux chronos ACTIFS en parallèle maintenant (l'un en cours, l'autre en pause).
  const nowTs = Date.now();
  const liveSessions = [
    { id: 's14', projetId: 'p2', description: 'Design system — tokens v2', debut: nowTs - 38 * 60_000, dernierDebut: nowTs - 38 * 60_000, fin: null, duree: 0,            statut: 'en_cours' },
    { id: 's15', projetId: 'p4', description: 'Atlas — synthèse audit',    debut: nowTs - 72 * 60_000, dernierDebut: null,                  fin: null, duree: 26 * 60_000,   statut: 'en_pause' },
  ];

  const pointage = [
    { id: 'pt1', type: 'arrivee',     at: at(8, 58) },
    { id: 'pt2', type: 'pause_debut', at: at(12, 45) },
    { id: 'pt7', type: 'pause_fin',   at: at(13, 30) },
    { id: 'pt3', type: 'arrivee',     at: at(9, 2, -1) },
    { id: 'pt4', type: 'pause_debut', at: at(12, 30, -1) },
    { id: 'pt5', type: 'pause_fin',   at: at(13, 15, -1) },
    { id: 'pt6', type: 'depart',      at: at(18, 5, -1) },
  ];

  return { projets, todos, sessions: [...sessions, ...liveSessions], pointage };
}

function emptyData() {
  return { projets: [], todos: [], sessions: [], pointage: [] };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */

function createStore() {
  const state = {
    loaded: false,
    projets: [], todos: [], sessions: [], pointage: [],
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
      dirtyStores.clear();
      await Promise.all(promises);
    } else {
      dirtyStores.clear();
      lsSave(state);
    }
  }

  /* --- chargement initial --- */
  async function init({ seedIfEmpty = true } = {}) {
    const db = await openDB();
    if (db) {
      usingIDB = true;
      const [pr, td, se, pt] = await Promise.all([
        idbAll('projets'), idbAll('todos'), idbAll('sessions'), idbAll('pointage'),
      ]);
      const isFresh = pr.length === 0 && td.length === 0 && se.length === 0 && pt.length === 0;
      if (isFresh && seedIfEmpty && wsActive().seedOnInit !== false) {
        const s = seed();
        await Promise.all([
          idbBulkPut('projets',  s.projets),
          idbBulkPut('todos',    s.todos),
          idbBulkPut('sessions', s.sessions),
          idbBulkPut('pointage', s.pointage),
        ]);
        state.projets = s.projets; state.todos = s.todos; state.sessions = s.sessions; state.pointage = s.pointage;
      } else {
        state.projets = pr; state.todos = td; state.sessions = se; state.pointage = pt;
      }
    } else {
      usingIDB = false;
      const ls = lsLoad();
      if (ls) {
        Object.assign(state, ls);
      } else if (seedIfEmpty && wsActive().seedOnInit !== false) {
        Object.assign(state, seed());
      } else {
        Object.assign(state, emptyData());
      }
    }
    state.loaded = true;
    emitState();
    setInterval(emitTick, 1000);
  }

  /* ============= Actions ============= */

  // SESSIONS
  // Plusieurs chronos peuvent tourner EN PARALLÈLE : démarrer un chrono
  // n'arrête jamais les autres. Les chronos « actifs » sont simplement toutes
  // les sessions dont le statut n'est pas 'terminee' (en cours ou en pause).
  function sessionsActives() {
    return state.sessions.filter(s => s.statut !== 'terminee');
  }

  function demarrer(projetId, description = '') {
    const now = Date.now();
    const newId = UI.uid('s');
    state.sessions = [...state.sessions, {
      id: newId, projetId, description: description || '',
      debut: now, dernierDebut: now, fin: null, duree: 0, statut: 'en_cours',
    }];
    scheduleSave('sessions'); emitState();
    return newId;
  }

  // --- Contrôle d'UN chrono précis ---
  function pauserSession(id) {
    const now = Date.now();
    state.sessions = state.sessions.map(s => {
      if (s.id !== id || s.statut !== 'en_cours') return s;
      return { ...s, duree: (s.duree || 0) + (now - s.dernierDebut), dernierDebut: null, statut: 'en_pause' };
    });
    scheduleSave('sessions'); emitState();
  }
  function reprendreSession(id) {
    const now = Date.now();
    state.sessions = state.sessions.map(s => s.id === id && s.statut === 'en_pause'
      ? { ...s, statut: 'en_cours', dernierDebut: now }
      : s);
    scheduleSave('sessions'); emitState();
  }
  function arreterSession(id) {
    const now = Date.now();
    state.sessions = state.sessions.map(s => {
      if (s.id !== id || s.statut === 'terminee') return s;
      const addDuree = s.statut === 'en_cours' ? (now - s.dernierDebut) : 0;
      return { ...s, fin: now, duree: (s.duree || 0) + addDuree, dernierDebut: null, statut: 'terminee' };
    });
    scheduleSave('sessions'); emitState();
  }

  // --- Contrôle GROUPÉ de tous les chronos actifs (1+) ---
  function pauserTout() {
    const now = Date.now();
    let changed = false;
    state.sessions = state.sessions.map(s => {
      if (s.statut !== 'en_cours') return s;
      changed = true;
      return { ...s, duree: (s.duree || 0) + (now - s.dernierDebut), dernierDebut: null, statut: 'en_pause' };
    });
    if (changed) { scheduleSave('sessions'); emitState(); }
  }
  function reprendreTout() {
    const now = Date.now();
    let changed = false;
    state.sessions = state.sessions.map(s => {
      if (s.statut !== 'en_pause') return s;
      changed = true;
      return { ...s, statut: 'en_cours', dernierDebut: now };
    });
    if (changed) { scheduleSave('sessions'); emitState(); }
  }
  function arreterTout() {
    const now = Date.now();
    let changed = false;
    state.sessions = state.sessions.map(s => {
      if (s.statut === 'terminee') return s;
      changed = true;
      const addDuree = s.statut === 'en_cours' ? (now - s.dernierDebut) : 0;
      return { ...s, fin: now, duree: (s.duree || 0) + addDuree, dernierDebut: null, statut: 'terminee' };
    });
    if (changed) { scheduleSave('sessions'); emitState(); }
  }

  function supprimerSession(id) {
    state.sessions = state.sessions.filter(s => s.id !== id);
    scheduleSave('sessions'); emitState();
  }

  function majSession(id, patch) {
    state.sessions = state.sessions.map(s => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      if (next.statut === 'terminee' && next.debut != null && next.fin != null) {
        next.duree = Math.max(0, next.fin - next.debut);
      } else if (next.statut === 'en_cours' && patch.debut != null) {
        // Pour une session encore en cours qui n'a jamais été mise en pause
        // (duree accumulée = 0 et dernierDebut suivait debut), on resynchronise
        // dernierDebut sur le nouveau debut pour que la durée vivante reflète
        // immédiatement la correction d'heure et que la taille du bloc sur la
        // timeline soit cohérente.
        if ((s.duree || 0) === 0 && s.dernierDebut === s.debut) {
          next.dernierDebut = patch.debut;
        }
      } else if (next.statut === 'en_pause' && patch.debut != null) {
        // En pause, la durée accumulée n'est plus liée à l'heure d'arrivée :
        // si la session n'a jamais effectivement tourné (duree=0), on ne touche
        // à rien ; sinon, duree reste celle déjà capitalisée. Aucun ajustement
        // automatique requis ici.
      }
      return next;
    });
    scheduleSave('sessions'); emitState();
  }

  // Saisie manuelle d'une session déjà terminée (correction / rattrapage).
  // La session n'est PAS rendue active : elle a un début et une fin, donc
  // statut 'terminee' et duree calculée immédiatement.
  function ajouterSessionManuelle({ projetId, description = '', debut, fin }) {
    if (!projetId || debut == null || fin == null) return null;
    if (fin < debut) return null;
    const id = UI.uid('s');
    const session = {
      id, projetId,
      description: (description || '').trim(),
      debut, fin,
      dernierDebut: null,
      duree: Math.max(0, fin - debut),
      statut: 'terminee',
    };
    state.sessions = [...state.sessions, session];
    scheduleSave('sessions'); emitState();
    return id;
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
  function ajouterProjet(nom, client = '', couleur = '#2563eb') {
    const id = UI.uid('p');
    state.projets = [...state.projets, { id, nom, client, couleur, archive: false }];
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
  function supprimerProjet(id) {
    state.projets  = state.projets.filter(p => p.id !== id);
    state.sessions = state.sessions.filter(s => s.projetId !== id);
    state.todos    = state.todos.filter(t => t.projetId !== id);
    scheduleSave('projets'); scheduleSave('sessions'); scheduleSave('todos');
    emitState();
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
    const now = Date.now();
    const evt = { id: UI.uid('pt'), type, at: now };
    let sessionsChanged = false;

    // -- Départ du soir : on arrête TOUS les chronos encore actifs (en cours ou en pause).
    //    (Aucune reprise automatique le lendemain : les sessions sont marquées 'terminee'.)
    if (type === 'depart') {
      state.sessions = state.sessions.map(s => {
        if (s.statut === 'terminee') return s;
        sessionsChanged = true;
        const addDuree = s.statut === 'en_cours' ? (now - s.dernierDebut) : 0;
        return { ...s, fin: now, duree: (s.duree || 0) + addDuree, dernierDebut: null, statut: 'terminee' };
      });
    }

    // -- Début de pause : on met en pause TOUS les chronos en cours et on mémorise
    //    lesquels, pour pouvoir reprendre exactement ceux-là à la fin de la pause.
    if (type === 'pause_debut') {
      const suspendus = [];
      state.sessions = state.sessions.map(s => {
        if (s.statut !== 'en_cours') return s;
        suspendus.push(s.id);
        return { ...s, duree: (s.duree || 0) + (now - s.dernierDebut), dernierDebut: null, statut: 'en_pause' };
      });
      if (suspendus.length) {
        evt.sessionsSuspenduesIds = suspendus;
        sessionsChanged = true;
      }
    }

    // -- Fin de pause : on reprend tous les chronos suspendus par la dernière
    //    pause_debut, à condition qu'ils soient toujours en pause.
    if (type === 'pause_fin') {
      const today = UI.startOfDay();
      const lastDebut = state.pointage
        .filter(p => p.type === 'pause_debut' && p.at >= today)
        .sort((a, b) => a.at - b.at)
        .slice(-1)[0];
      // Rétro-compat : ancien champ singulier sessionSuspendueId.
      const ids = lastDebut
        ? (lastDebut.sessionsSuspenduesIds
            || (lastDebut.sessionSuspendueId ? [lastDebut.sessionSuspendueId] : []))
        : [];
      if (ids.length) {
        const setIds = new Set(ids);
        state.sessions = state.sessions.map(s => (setIds.has(s.id) && s.statut === 'en_pause')
          ? { ...s, statut: 'en_cours', dernierDebut: now }
          : s);
        sessionsChanged = true;
      }
    }

    state.pointage = [...state.pointage, evt];
    scheduleSave('pointage');
    if (sessionsChanged) scheduleSave('sessions');
    emitState();
  }
  function ajouterPointage(type, at) {
    state.pointage = [...state.pointage, { id: UI.uid('pt'), type, at }];
    scheduleSave('pointage'); emitState();
  }
  function majPointage(id, patch) {
    state.pointage = state.pointage.map(p => p.id === id ? { ...p, ...patch } : p);
    scheduleSave('pointage'); emitState();
  }
  function supprimerPointage(id) {
    state.pointage = state.pointage.filter(p => p.id !== id);
    scheduleSave('pointage'); emitState();
  }

  /* --- export / import (workspace courant) --- */
  async function exporterJSON() {
    // S'assure que les écritures en attente sont flushées avant export.
    await flush();
    return {
      version: 1,
      exporteLe: new Date().toISOString(),
      workspace: wsActive(),
      data: {
        projets: state.projets, todos: state.todos,
        sessions: state.sessions, pointage: state.pointage,
      },
    };
  }

  return {
    state,
    init, onState, onTick,
    actions: {
      demarrer, pauserSession, reprendreSession, arreterSession,
      pauserTout, reprendreTout, arreterTout,
      supprimerSession, majSession,
      ajouterSessionManuelle,
      ajouterTodo, toggleTodo, supprimerTodo, majTodo,
      ajouterProjet, majProjet, archiverProjet, supprimerProjet,
      pointer, ajouterPointage, majPointage, supprimerPointage,
    },
    etatPointage,
    sessionsActives,
    exporterJSON,
  };
}

window.createStore = createStore;

/* ------------------------------------------------------------------ */
/* API workspaces exposée                                              */

async function importerJSONDansWorkspace(id, payload) {
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') throw new Error('format invalide');
  const projets  = Array.isArray(data.projets)  ? data.projets  : [];
  const todos    = Array.isArray(data.todos)    ? data.todos    : [];
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const pointage = Array.isArray(data.pointage) ? data.pointage : [];
  const activeId = data.activeId || null;

  // Si on importe dans le workspace courant, on doit fermer la connexion ouverte.
  if (id === wsActiveId() && _dbPromise) {
    const db = await _dbPromise.catch(() => null);
    if (db) db.close();
    _dbPromise = null;
  }

  // On va viser directement le bon DB. On l'ouvre, on écrase chaque store.
  const dbName = dbNameFor(id);
  const db = await new Promise((res, rej) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of STORE_NAMES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
  await new Promise((res, rej) => {
    const tx = db.transaction([...STORE_NAMES, 'meta'], 'readwrite');
    const put = (name, items) => {
      const s = tx.objectStore(name);
      s.clear();
      items.forEach(it => s.put(it));
    };
    put('projets',  projets);
    put('todos',    todos);
    put('sessions', sessions);
    put('pointage', pointage);
    const m = tx.objectStore('meta'); m.clear();
    if (activeId) m.put({ key: 'activeSessionId', value: activeId });
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
  db.close();
}

window.WORKSPACES = {
  getList: () => wsLoadList().slice(),
  getActiveId: wsActiveId,
  getActive: wsActive,

  switchTo(id) {
    if (!wsLoadList().some(w => w.id === id)) throw new Error('workspace inconnu');
    wsSetActiveId(id);
    location.reload();
  },

  create({ label, seedDemo = false } = {}) {
    const list = wsLoadList();
    const id = uniqueId(slugify(label || 'espace'), list);
    const ws = { id, label: (label || id).trim(), creeLe: Date.now(), seedOnInit: !!seedDemo };
    list.push(ws);
    wsSaveList(list);
    return ws;
  },

  rename(id, label) {
    const list = wsLoadList();
    const i = list.findIndex(w => w.id === id);
    if (i < 0) throw new Error('workspace inconnu');
    list[i] = { ...list[i], label: String(label).trim() || list[i].label };
    wsSaveList(list);
    return list[i];
  },

  async remove(id) {
    const list = wsLoadList();
    if (list.length <= 1) throw new Error('on ne peut pas supprimer le dernier espace');
    const filtered = list.filter(w => w.id !== id);
    wsSaveList(filtered);
    if (wsActiveId() === id) wsSetActiveId(filtered[0].id);
    await idbDeleteDatabase(id);
    try { localStorage.removeItem(lsKeyFor(id)); } catch (e) {}
    return filtered;
  },

  importJSON: importerJSONDansWorkspace,

  /* Téléchargement direct du workspace courant en JSON. */
  async downloadCurrentJSON(store) {
    const payload = await store.exporterJSON();
    const ws = wsActive();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chrono-${ws.id}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

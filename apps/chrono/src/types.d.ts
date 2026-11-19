// Data model of Chrono. Field names are French on purpose: they are the persisted format
// (IndexedDB records and JSON export) and are renamed in a later step.

export type StatutSession = 'terminee' | 'en_cours' | 'en_pause';
export type TypePointage = 'arrivee' | 'pause_debut' | 'pause_fin' | 'depart';

export interface Projet {
  id: string;
  nom: string;
  couleur: string;
  client: string;
  archive: boolean;
}

export interface Todo {
  id: string;
  titre: string;
  description?: string;
  fait: boolean;
  projetId: string | null;
  /** Local calendar date `YYYY-MM-DD`, or null. */
  echeance: string | null;
  creeLe: number;
}

export interface Session {
  id: string;
  projetId: string;
  description: string;
  debut: number;
  dernierDebut?: number | null;
  fin: number | null;
  duree: number;
  statut: StatutSession;
}

export interface Pointage {
  id: string;
  type: TypePointage;
  at: number;
  sessionsSuspenduesIds?: string[];
  /** Legacy singular field, still read for old data. */
  sessionSuspendueId?: string;
}

/** The four persisted collections. */
export interface Donnees {
  projets: Projet[];
  todos: Todo[];
  sessions: Session[];
  pointage: Pointage[];
}

export type NomCollection = keyof Donnees;

export interface Plage {
  debut: number;
  fin: number;
}

export interface EtatPointage {
  statut: 'pas_arrive' | 'present' | 'pause' | 'parti';
  depuis?: number;
  events: Pointage[];
}

export interface EspaceDeSauvegarde {
  id: string;
  label: string;
  creeLe: number;
  seedOnInit?: boolean;
}

export interface ExportJSON {
  version: 1;
  exporteLe: string;
  workspace: EspaceDeSauvegarde;
  data: Donnees;
}

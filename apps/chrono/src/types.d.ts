// Data model of Chrono, schema version 2: the persisted shape (IndexedDB records and the
// `chrono-workspace` JSON export). The previous shape (version 1, French field names) is
// described by the `*V1` types at the end; `src/core/migrations.js` converts one into the
// other, see the field table in README.md.

export type SessionStatus = 'done' | 'running' | 'paused';
export type AttendanceType = 'arrival' | 'break_start' | 'break_end' | 'departure';

export interface Project {
  id: string;
  name: string;
  color: string;
  client: string;
  archived: boolean;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  done: boolean;
  projectId: string | null;
  /**
   * Local calendar date `YYYY-MM-DD`, or null. A record migrated from version 1 may still
   * hold a relative label (`today`, `fri`...) until the due-date migration of the store
   * turns it into a date.
   */
  dueDate: string | null;
  createdAt: number;
}

export interface Session {
  id: string;
  projectId: string;
  description: string;
  start: number;
  lastStart?: number | null;
  end: number | null;
  duration: number;
  status: SessionStatus;
}

export interface AttendanceEvent {
  id: string;
  type: AttendanceType;
  at: number;
  /** Sessions paused by a `break_start`, resumed by the matching `break_end`. */
  suspendedSessionIds?: string[];
}

/** The four persisted collections. */
export interface ChronoData {
  projects: Project[];
  todos: Todo[];
  sessions: Session[];
  attendance: AttendanceEvent[];
}

export type CollectionName = keyof ChronoData;

export interface TimeRange {
  start: number;
  end: number;
}

export interface AttendanceState {
  status: 'not_arrived' | 'present' | 'on_break' | 'left';
  since?: number;
  events: AttendanceEvent[];
}

/* ---------------------------- Schema version 1 (legacy) ---------------------------- */

export type SessionStatusV1 = 'terminee' | 'en_cours' | 'en_pause';
export type AttendanceTypeV1 = 'arrivee' | 'pause_debut' | 'pause_fin' | 'depart';

export interface ProjectV1 {
  id: string;
  nom: string;
  couleur: string;
  client: string;
  archive: boolean;
}

export interface TodoV1 {
  id: string;
  titre: string;
  description?: string;
  fait: boolean;
  projetId: string | null;
  /** `YYYY-MM-DD`, null, or an old relative label. */
  echeance: string | null;
  creeLe: number;
}

export interface SessionV1 {
  id: string;
  projetId: string;
  description: string;
  debut: number;
  dernierDebut?: number | null;
  fin: number | null;
  duree: number;
  statut: SessionStatusV1;
}

export interface AttendanceEventV1 {
  id: string;
  type: AttendanceTypeV1;
  at: number;
  sessionsSuspenduesIds?: string[];
  /** Older singular form of `sessionsSuspenduesIds`. */
  sessionSuspendueId?: string;
}

export interface ChronoDataV1 {
  projets: ProjectV1[];
  todos: TodoV1[];
  sessions: SessionV1[];
  pointage: AttendanceEventV1[];
}

/** Entry of the version 1 workspace list (`localStorage` key `chrono.workspaces`). */
export interface WorkspaceEntryV1 {
  id: string;
  label: string;
  creeLe: number;
  /** `false` on a workspace created without demo data. */
  seedOnInit?: boolean;
}

/** Version 1 export file: a bare object, not an envelope. */
export interface ExportV1 {
  version: 1;
  exporteLe: string;
  workspace: WorkspaceEntryV1;
  data: ChronoDataV1;
}

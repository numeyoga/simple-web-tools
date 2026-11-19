// v1ToV2 and the record conversions of core/migrations.js: pure, table-driven.
import { describe, expect, test } from 'vitest';
import {
  attendanceV1ToV2,
  projectV1ToV2,
  sessionV1ToV2,
  todoV1ToV2,
  v1ToV2,
  workspaceV1ToV2,
} from '../../src/core/migrations.js';

/** @type {[string, (record: unknown) => unknown, unknown, unknown][]} */
const RECORDS = [
  [
    'project',
    projectV1ToV2,
    { id: 'p1', nom: 'A', couleur: '#fff', client: 'C', archive: true },
    { id: 'p1', name: 'A', color: '#fff', client: 'C', archived: true },
  ],
  [
    'todo',
    todoV1ToV2,
    {
      id: 't1',
      titre: 'T',
      fait: true,
      projetId: 'p1',
      echeance: '2026-11-20',
      creeLe: 5,
      description: 'd',
    },
    {
      id: 't1',
      title: 'T',
      done: true,
      projectId: 'p1',
      dueDate: '2026-11-20',
      createdAt: 5,
      description: 'd',
    },
  ],
  [
    'todo with a relative due date (kept for the due-date migration)',
    todoV1ToV2,
    { id: 't2', titre: 'T', fait: false, projetId: null, echeance: 'fri', creeLe: 5 },
    { id: 't2', title: 'T', done: false, projectId: null, dueDate: 'fri', createdAt: 5 },
  ],
  [
    'session, finished',
    sessionV1ToV2,
    {
      id: 's',
      projetId: 'p',
      description: '',
      debut: 1,
      dernierDebut: null,
      fin: 2,
      duree: 1,
      statut: 'terminee',
    },
    {
      id: 's',
      projectId: 'p',
      description: '',
      start: 1,
      lastStart: null,
      end: 2,
      duration: 1,
      status: 'done',
    },
  ],
  [
    'session, running',
    sessionV1ToV2,
    { id: 's', projetId: 'p', debut: 1, dernierDebut: 3, fin: null, duree: 0, statut: 'en_cours' },
    { id: 's', projectId: 'p', start: 1, lastStart: 3, end: null, duration: 0, status: 'running' },
  ],
  [
    'session, paused',
    sessionV1ToV2,
    {
      id: 's',
      projetId: 'p',
      debut: 1,
      dernierDebut: null,
      fin: null,
      duree: 9,
      statut: 'en_pause',
    },
    {
      id: 's',
      projectId: 'p',
      start: 1,
      lastStart: null,
      end: null,
      duration: 9,
      status: 'paused',
    },
  ],
  [
    'session with an unknown status (kept, the import validation drops it)',
    sessionV1ToV2,
    { id: 's', statut: 'bizarre' },
    { id: 's', status: 'bizarre' },
  ],
  [
    'attendance, arrival',
    attendanceV1ToV2,
    { id: 'a', type: 'arrivee', at: 1 },
    { id: 'a', type: 'arrival', at: 1 },
  ],
  [
    'attendance, break start with the list of suspended sessions',
    attendanceV1ToV2,
    { id: 'a', type: 'pause_debut', at: 1, sessionsSuspenduesIds: ['s1', 's2'] },
    { id: 'a', type: 'break_start', at: 1, suspendedSessionIds: ['s1', 's2'] },
  ],
  [
    'attendance, break end',
    attendanceV1ToV2,
    { id: 'a', type: 'pause_fin', at: 1 },
    { id: 'a', type: 'break_end', at: 1 },
  ],
  [
    'attendance, departure',
    attendanceV1ToV2,
    { id: 'a', type: 'depart', at: 1 },
    { id: 'a', type: 'departure', at: 1 },
  ],
  [
    'attendance, legacy singular field is folded into the list',
    attendanceV1ToV2,
    { id: 'a', type: 'pause_debut', at: 1, sessionSuspendueId: 's1' },
    { id: 'a', type: 'break_start', at: 1, suspendedSessionIds: ['s1'] },
  ],
  [
    'attendance, the list wins over the singular field (as in version 1)',
    attendanceV1ToV2,
    {
      id: 'a',
      type: 'pause_debut',
      at: 1,
      sessionsSuspenduesIds: ['s2'],
      sessionSuspendueId: 's1',
    },
    { id: 'a', type: 'break_start', at: 1, suspendedSessionIds: ['s2'] },
  ],
  [
    'attendance, an empty list is kept (nothing was suspended)',
    attendanceV1ToV2,
    { id: 'a', type: 'pause_debut', at: 1, sessionsSuspenduesIds: [] },
    { id: 'a', type: 'break_start', at: 1, suspendedSessionIds: [] },
  ],
  [
    'attendance, an unusable singular field is kept as it is',
    attendanceV1ToV2,
    { id: 'a', type: 'pause_debut', at: 1, sessionSuspendueId: '' },
    { id: 'a', type: 'break_start', at: 1, sessionSuspendueId: '' },
  ],
  [
    'unknown extra fields are kept',
    projectV1ToV2,
    { id: 'p', nom: 'A', note: 'kept', nested: { a: [1] } },
    { id: 'p', name: 'A', note: 'kept', nested: { a: [1] } },
  ],
  [
    'a version 2 field already present is not overwritten',
    projectV1ToV2,
    { id: 'p', nom: 'old', name: 'new' },
    { id: 'p', nom: 'old', name: 'new' },
  ],
  [
    'a record without version 1 fields is left as it is',
    todoV1ToV2,
    { id: 't', title: 'x' },
    { id: 't', title: 'x' },
  ],
  ['a non-record is kept', projectV1ToV2, 'text', 'text'],
  ['null is kept', sessionV1ToV2, null, null],
];

describe('record conversions', () => {
  test.each(RECORDS)('%s', (_name, convert, input, expected) => {
    const snapshot = structuredClone(input);

    expect(convert(input)).toEqual(expected);
    expect(input).toEqual(snapshot); // the input is not mutated
  });

  test('the conversion is idempotent on version 2 records', () => {
    for (const [, convert, , expected] of RECORDS) {
      expect(convert(expected)).toEqual(expected);
    }
  });
});

describe('v1ToV2', () => {
  const v1 = {
    projets: [{ id: 'p', nom: 'A' }, null],
    todos: [{ id: 't', titre: 'T' }],
    sessions: [{ id: 's', statut: 'terminee' }],
    pointage: [{ id: 'a', type: 'arrivee', at: 1 }],
    activeId: 'zz',
  };

  test('renames the collections, converts every record, keeps other keys', () => {
    const copy = structuredClone(v1);

    expect(v1ToV2(v1)).toEqual({
      projects: [{ id: 'p', name: 'A' }, null],
      todos: [{ id: 't', title: 'T' }],
      sessions: [{ id: 's', status: 'done' }],
      attendance: [{ id: 'a', type: 'arrival', at: 1 }],
      activeId: 'zz',
    });
    expect(v1).toEqual(copy);
  });

  test.each([
    [
      'only the collections that are present',
      { projets: [{ id: 'p', nom: 'A' }] },
      { projects: [{ id: 'p', name: 'A' }] },
    ],
    [
      'an empty workspace',
      { projets: [], todos: [], sessions: [], pointage: [] },
      { projects: [], todos: [], sessions: [], attendance: [] },
    ],
    ['a collection that is not an array is carried over', { pointage: 'x' }, { attendance: 'x' }],
    [
      'data that already is version 2',
      { projects: [{ id: 'p', name: 'A' }] },
      { projects: [{ id: 'p', name: 'A' }] },
    ],
    ['null', null, null],
    ['an array', [], []],
  ])('%s', (_name, input, expected) => {
    expect(v1ToV2(input)).toEqual(expected);
  });
});

describe('workspaceV1ToV2', () => {
  test.each([
    [
      'a default workspace',
      { id: 'default', label: 'Espace principal', creeLe: 10 },
      { workspace: { id: 'default', label: 'Espace principal', createdAt: 10 }, demo: true },
    ],
    [
      'created without demo data',
      { id: 'perso', label: 'Perso', creeLe: 20, seedOnInit: false },
      { workspace: { id: 'perso', label: 'Perso', createdAt: 20 }, demo: false },
    ],
    [
      'created with demo data',
      { id: 'demo', label: 'Démo', creeLe: 30, seedOnInit: true },
      { workspace: { id: 'demo', label: 'Démo', createdAt: 30 }, demo: true },
    ],
    [
      'no creation time and a blank label',
      { id: 'x', label: '  ' },
      { workspace: { id: 'x', label: 'x', createdAt: 99 }, demo: true },
    ],
    ['no id', { label: 'x', creeLe: 1 }, null],
    ['not a record', 'x', null],
  ])('%s', (_name, entry, expected) => {
    expect(workspaceV1ToV2(entry, 99)).toEqual(expected);
  });
});

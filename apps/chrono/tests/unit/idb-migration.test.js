// The IndexedDB schema steps of adapters/idb.js, opened with `openDatabase` of the storage
// package. Databases of the previous release are written with the raw IndexedDB API, exactly as
// its `openDB()` did (support/idb.js).
import { openDatabase } from '@simple-web-tools/storage';
import { describe, expect, test } from 'vitest';
import { migrations } from '../../src/adapters/idb.js';
import { createV1Database, createV2Database, describeDatabase, readStore } from './support/idb.js';

let counter = 0;
/** A database name that no other test uses. */
const freshName = () => `chrono__migration-${(counter += 1)}`;

const V2_LAYOUT = {
  attendance: 'id',
  meta: 'key',
  projects: 'id',
  sessions: 'id',
  todos: 'id',
};

/** @param {string} name */
async function openAndClose(name) {
  const db = await openDatabase({ name, migrations });
  db.close();
}

describe('a database written by version 1', () => {
  const day = Date.UTC(2026, 10, 18, 9);
  const v1 = {
    projets: [
      { id: 'p1', nom: 'Alpha', couleur: '#2563eb', client: 'Orion', archive: false },
      { id: 'p2', nom: 'Beta', couleur: '#16a34a', client: '', archive: true, note: 'extra' },
    ],
    todos: [
      {
        id: 't1',
        titre: 'Absolute',
        fait: false,
        projetId: 'p1',
        echeance: '2026-11-20',
        creeLe: day,
      },
      // A relative due date: it is only renamed here, the store turns it into a date on load.
      {
        id: 't2',
        titre: 'Relative',
        fait: true,
        projetId: null,
        echeance: 'fri',
        creeLe: day,
        description: 'd',
      },
    ],
    sessions: [
      {
        id: 's1',
        projetId: 'p1',
        description: 'done',
        debut: 1,
        dernierDebut: null,
        fin: 2,
        duree: 1,
        statut: 'terminee',
      },
      {
        id: 's2',
        projetId: 'p1',
        description: 'run',
        debut: 3,
        dernierDebut: 4,
        fin: null,
        duree: 5,
        statut: 'en_cours',
      },
      {
        id: 's3',
        projetId: 'p2',
        description: 'pause',
        debut: 6,
        dernierDebut: null,
        fin: null,
        duree: 7,
        statut: 'en_pause',
      },
    ],
    pointage: [
      { id: 'a1', type: 'arrivee', at: 10 },
      { id: 'a2', type: 'pause_debut', at: 11, sessionsSuspenduesIds: ['s2'] },
      { id: 'a3', type: 'pause_fin', at: 12 },
      { id: 'a4', type: 'pause_debut', at: 13, sessionSuspendueId: 's3' },
      { id: 'a5', type: 'depart', at: 14 },
    ],
    meta: [{ key: 'note', value: 'kept' }],
  };

  test('is upgraded to version 2 records and layout', async () => {
    const name = freshName();
    await createV1Database(name, v1);
    expect((await describeDatabase(name)).version).toBe(1);

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 2, stores: V2_LAYOUT });
    expect(await readStore(name, 'projects')).toEqual([
      { id: 'p1', name: 'Alpha', color: '#2563eb', client: 'Orion', archived: false },
      { id: 'p2', name: 'Beta', color: '#16a34a', client: '', archived: true, note: 'extra' },
    ]);
    expect(await readStore(name, 'todos')).toEqual([
      {
        id: 't1',
        title: 'Absolute',
        done: false,
        projectId: 'p1',
        dueDate: '2026-11-20',
        createdAt: day,
      },
      {
        id: 't2',
        title: 'Relative',
        done: true,
        projectId: null,
        dueDate: 'fri',
        createdAt: day,
        description: 'd',
      },
    ]);
    expect(
      (await readStore(name, 'sessions')).map((s) => [
        s.id,
        s.status,
        s.start,
        s.lastStart,
        s.end,
        s.duration,
        s.projectId,
      ]),
    ).toEqual([
      ['s1', 'done', 1, null, 2, 1, 'p1'],
      ['s2', 'running', 3, 4, null, 5, 'p1'],
      ['s3', 'paused', 6, null, null, 7, 'p2'],
    ]);
    expect(await readStore(name, 'attendance')).toEqual([
      { id: 'a1', type: 'arrival', at: 10 },
      { id: 'a2', type: 'break_start', at: 11, suspendedSessionIds: ['s2'] },
      { id: 'a3', type: 'break_end', at: 12 },
      { id: 'a4', type: 'break_start', at: 13, suspendedSessionIds: ['s3'] },
      { id: 'a5', type: 'departure', at: 14 },
    ]);
    expect(await readStore(name, 'meta')).toEqual([{ key: 'note', value: 'kept' }]);
  });

  test('an empty version 1 database is upgraded too', async () => {
    const name = freshName();
    await createV1Database(name);

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 2, stores: V2_LAYOUT });
    expect(await readStore(name, 'projects')).toEqual([]);
  });

  test('a failing step aborts the upgrade: the database stays in version 1', async () => {
    const name = freshName();
    await createV1Database(name, v1);
    const failing = [
      ...migrations.slice(0, 1),
      /** @type {import('@simple-web-tools/storage').Migration} */ (
        (db, tx, oldVersion) => {
          migrations[1]?.(db, tx, oldVersion);
          throw new Error('boom');
        }
      ),
    ];

    await expect(openDatabase({ name, migrations: failing })).rejects.toThrow();

    const after = await describeDatabase(name);
    expect(after.version).toBe(1);
    expect(Object.keys(after.stores).sort()).toEqual([
      'meta',
      'pointage',
      'projets',
      'sessions',
      'todos',
    ]);
    expect(await readStore(name, 'projets')).toEqual(v1.projets);
  });
});

describe('a new database', () => {
  test('gets the version 2 layout, empty', async () => {
    const name = freshName();

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 2, stores: V2_LAYOUT });
    for (const store of ['projects', 'todos', 'sessions', 'attendance', 'meta']) {
      expect(await readStore(name, store)).toEqual([]);
    }
  });
});

describe('a version 2 database', () => {
  test('is not migrated again', async () => {
    const name = freshName();
    // A record that a second pass of the version 1 conversion would rename (`creeLe`).
    const todo = { id: 't1', title: 'x', done: false, projectId: null, dueDate: null, creeLe: 5 };
    await createV2Database(name, {
      projects: [{ id: 'p1', name: 'A', color: '#000', client: '', archived: false }],
      todos: [todo],
    });

    await openAndClose(name);
    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 2, stores: V2_LAYOUT });
    expect(await readStore(name, 'todos')).toEqual([todo]);
    expect(await readStore(name, 'projects')).toHaveLength(1);
  });

  test('is refused by a version that does not know it', async () => {
    const name = freshName();
    await createV2Database(name);

    await expect(openDatabase({ name, migrations: migrations.slice(0, 1) })).rejects.toThrow();
  });
});

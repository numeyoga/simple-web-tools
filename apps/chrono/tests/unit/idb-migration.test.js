// The IndexedDB schema steps of adapters/idb.js, opened with `openDatabase` of the storage
// package. Databases of the previous release are written with the raw IndexedDB API, exactly as
// its `openDB()` did (support/idb.js).
import { openDatabase } from '@simple-web-tools/storage';
import { describe, expect, test } from 'vitest';
import { migrations } from '../../src/adapters/idb.js';
import {
  createV1Database,
  createV2Database,
  describeDatabase,
  putRecords,
  readStore,
} from './support/idb.js';

let counter = 0;
/** A database name that no other test uses. */
const freshName = () => `chrono__migration-${(counter += 1)}`;

const LAYOUT = {
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

  test('is upgraded to version 3 records and layout, in one open', async () => {
    const name = freshName();
    await createV1Database(name, v1);
    expect((await describeDatabase(name)).version).toBe(1);

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 3, stores: LAYOUT });
    expect(await readStore(name, 'projects')).toEqual([
      { id: 'p1', name: 'Alpha', category: 9, customColor: null, client: 'Orion', archived: false },
      {
        id: 'p2',
        name: 'Beta',
        category: 5,
        customColor: null,
        client: '',
        archived: true,
        note: 'extra',
      },
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

    expect(await describeDatabase(name)).toEqual({ version: 3, stores: LAYOUT });
    expect(await readStore(name, 'projects')).toEqual([]);
  });

  test('a failing step aborts the upgrade: the database stays in version 1', async () => {
    const name = freshName();
    await createV1Database(name, v1);
    const failing = [
      ...migrations.slice(0, 1),
      /** @type {import('@simple-web-tools/storage').Migration} */ (
        (db, tx, oldVersion) => {
          // The step's own promise rejects when the transaction aborts: nobody awaits it here.
          Promise.resolve(migrations[1]?.(db, tx, oldVersion)).catch(() => {});
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
  test('gets the version 3 layout, empty', async () => {
    const name = freshName();

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 3, stores: LAYOUT });
    for (const store of ['projects', 'todos', 'sessions', 'attendance', 'meta']) {
      expect(await readStore(name, store)).toEqual([]);
    }
  });
});

describe('a version 2 database', () => {
  const v2Projects = [
    { id: 'p1', name: 'Orange', color: '#ea580c', client: 'Orion', archived: false },
    { id: 'p2', name: 'Slate', color: '#475569', client: '', archived: true, note: 'extra' },
    { id: 'p3', name: 'Free', color: '#FFFF00', client: '', archived: false },
    { id: 'p4', name: 'Short', color: '#abc', client: '', archived: false },
    { id: 'p5', name: 'Missing', client: '', archived: false },
  ];
  const v2Todo = {
    id: 't1',
    title: 'x',
    done: false,
    projectId: 'p1',
    dueDate: null,
    createdAt: 5,
  };

  test('is upgraded to version 3: the projects change, nothing else does', async () => {
    const name = freshName();
    await createV2Database(name, { projects: v2Projects, todos: [v2Todo] });
    expect((await describeDatabase(name)).version).toBe(2);

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 3, stores: LAYOUT });
    expect(await readStore(name, 'projects')).toEqual([
      {
        id: 'p1',
        name: 'Orange',
        category: 1,
        customColor: null,
        client: 'Orion',
        archived: false,
      },
      {
        id: 'p2',
        name: 'Slate',
        category: 16,
        customColor: null,
        client: '',
        archived: true,
        note: 'extra',
      },
      {
        id: 'p3',
        name: 'Free',
        category: null,
        customColor: '#ffff00',
        client: '',
        archived: false,
      },
      {
        id: 'p4',
        name: 'Short',
        category: null,
        customColor: '#aabbcc',
        client: '',
        archived: false,
      },
      // No colour: the first category of the default order that no active project uses.
      { id: 'p5', name: 'Missing', category: 9, customColor: null, client: '', archived: false },
    ]);
    expect(await readStore(name, 'todos')).toEqual([v2Todo]);
  });

  test('an empty version 2 database is upgraded too', async () => {
    const name = freshName();
    await createV2Database(name);

    await openAndClose(name);

    expect(await describeDatabase(name)).toEqual({ version: 3, stores: LAYOUT });
    expect(await readStore(name, 'projects')).toEqual([]);
  });

  test('is not migrated again once it is in version 3', async () => {
    const name = freshName();
    await createV2Database(name, { projects: v2Projects.slice(0, 1) });
    await openAndClose(name);
    // A record in the version 2 shape that a second pass of step 2 would convert.
    await putRecords(name, { projects: [v2Projects[1] ?? {}] });

    await openAndClose(name);

    expect(await readStore(name, 'projects')).toEqual([
      {
        id: 'p1',
        name: 'Orange',
        category: 1,
        customColor: null,
        client: 'Orion',
        archived: false,
      },
      v2Projects[1],
    ]);
  });

  test('a failing step 2 aborts the upgrade: the database stays in version 2', async () => {
    const name = freshName();
    await createV2Database(name, { projects: v2Projects });
    const failing = [
      ...migrations.slice(0, 2),
      /** @type {import('@simple-web-tools/storage').Migration} */ (
        (db, tx, oldVersion) => {
          // The step's own promise rejects when the transaction aborts: nobody awaits it here.
          Promise.resolve(migrations[2]?.(db, tx, oldVersion)).catch(() => {});
          throw new Error('boom');
        }
      ),
    ];

    await expect(openDatabase({ name, migrations: failing })).rejects.toThrow();

    expect((await describeDatabase(name)).version).toBe(2);
    expect(await readStore(name, 'projects')).toEqual(v2Projects);
  });

  test('is refused by a version that does not know it', async () => {
    const name = freshName();
    await createV2Database(name);
    await openAndClose(name);

    await expect(openDatabase({ name, migrations: migrations.slice(0, 2) })).rejects.toThrow();
  });
});

describe('a version 1 database and a version 2 one end in the same shape', () => {
  test('the colour of a project is the same whichever release wrote it', async () => {
    const fromV1 = freshName();
    const fromV2 = freshName();
    await createV1Database(fromV1, {
      projets: [
        { id: 'a', nom: 'A', couleur: '#0D9488', client: '', archive: false },
        { id: 'b', nom: 'B', couleur: '#123456', client: '', archive: false },
      ],
    });
    await createV2Database(fromV2, {
      projects: [
        { id: 'a', name: 'A', color: '#0D9488', client: '', archived: false },
        { id: 'b', name: 'B', color: '#123456', client: '', archived: false },
      ],
    });

    await openAndClose(fromV1);
    await openAndClose(fromV2);

    const expected = [
      { id: 'a', name: 'A', category: 6, customColor: null, client: '', archived: false },
      { id: 'b', name: 'B', category: null, customColor: '#123456', client: '', archived: false },
    ];
    expect(await readStore(fromV1, 'projects')).toEqual(expected);
    expect(await readStore(fromV2, 'projects')).toEqual(expected);
  });
});

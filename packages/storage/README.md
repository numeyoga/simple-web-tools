# @simple-web-tools/storage

Storage primitives shared by the apps, extracted from Locavern (the reference app,
[decision 0004](../../docs/decisions/0004-reference-architecture.md)) with the workspace
concept taken from Chrono. Private workspace package: it is not published.

## Runtime dependency: `idb`

`openDatabase` is built on [`idb`](https://github.com/jakearchibald/idb) (about 1 kB, MIT),
the micro-library Locavern already ships ([decision 0003](../../docs/decisions/0003-no-runtime-framework.md)).
It turns IndexedDB requests and transactions into promises, which keeps the upgrade
transaction, `blocked` and `blocking` handling short and correct. The databases it opens are
plain IndexedDB, so an app can stop using the package without migrating data.

## Rules

- **Every name is prefixed** ([decision 0005](../../docs/decisions/0005-single-origin-hosting.md)).
  `names.js` is the only place that builds a persisted name; apps never concatenate one.
- **No clock.** Time comes in as an argument (`exportedAt`) or an injected `now()` (workspaces).
- **Injectable.** Workspaces take a `localStorage`-like object; tests pass a `Map`-backed one.
- **No schema change by accident.** Names and versions are the app's: this package never
  renames or re-versions an existing database.

## Names

| Function                                     | Result                              |
| -------------------------------------------- | ----------------------------------- |
| `databaseName('locavern')`                   | `locavern-db`                       |
| `writeLockName('locavern')`                  | `locavern-write-lock`               |
| `lockChannelName('locavern')`                | `locavern-lock-channel`             |
| `storageName('chrono', 'foo')`               | `chrono-foo` (any `<app>-<suffix>`) |
| `workspaceDatabaseName('chrono', 'default')` | `chrono__default`                   |

App names are lowercase letters, digits and single hyphens, starting with a letter (at most 32
characters); suffixes and workspace ids use lowercase letters, digits and hyphens. Anything
else throws a `TypeError`.

## Opening a database and migrating

```js
import { createStoresIfMissing, databaseName, openDatabase } from '@simple-web-tools/storage';

const db = await openDatabase({
  name: databaseName('myapp'),
  migrations: [
    // version 0 -> 1
    (db) => createStoresIfMissing(db, [{ name: 'meta', keyPath: 'key' }]),
    // version 1 -> 2
    (db, tx) => db.createObjectStore('items', { keyPath: 'id' }),
  ],
  onBlocked: ({ currentVersion, blockedVersion }) => {}, // another tab keeps an old connection
  onVersionChange: () => location.reload(), // this connection was closed for another tab
});
```

- The version is `migrations.length`; step `i` upgrades version `i` to `i + 1`.
- Steps run synchronously inside the upgrade transaction, in order, and only from the version
  found on disk. A failing step aborts the whole upgrade: nothing is half-applied.
- A database newer than the last step is never touched: the open fails with `VersionError`.
- On `versionchange` (another tab upgrades or deletes the database) the connection is closed
  so the other tab can proceed, and `onVersionChange` is called. `blocked` is surfaced through
  `onBlocked`; the open stays pending until the other connection closes.
- Adding a schema change means **appending** a step and adding a test that opens a database
  written by the previous version. Never edit or reorder existing steps.

`createStoresIfMissing(db, stores)` makes a step idempotent. `deleteDatabase(name)` resolves
`true` once the database is gone, `false` if another connection blocks it.

## Single-writer Web Lock

```js
import { acquireWriteLock, waitForWriteLock, onWriteLockReleased } from '@simple-web-tools/storage';

const { acquired, release } = await acquireWriteLock('myapp'); // ifAvailable: never waits
const cancel = waitForWriteLock('myapp', ({ release }) => {}); // queued, AbortController cancel
const stop = onWriteLockReleased('myapp', () => {}); // BroadcastChannel notification
```

Without `navigator.locks` the tab counts as the writer (`acquired: true`), and
`waitForWriteLock` does nothing. Without `BroadcastChannel`, release notifications are skipped.
Real cross-tab behaviour is covered by Locavern's `persistence-and-locks` Playwright spec.

## Workspaces

```js
import { createWorkspaceRegistry, deleteDatabase, openDatabase } from '@simple-web-tools/storage';

const workspaces = createWorkspaceRegistry({ app: 'chrono', storage: localStorage, now: Date.now });
workspaces.list(); // [{ id: 'default', label: 'Main workspace', createdAt }]
const w = workspaces.create('Clients'); // id 'clients', unique-ified
workspaces.setActive(w.id);
await openDatabase({ name: workspaces.databaseName(workspaces.activeId()), migrations });
workspaces.rename(w.id, 'Customers');
workspaces.remove(w.id); // registry only: then deleteDatabase(workspaces.databaseName(w.id))
```

The list and the active id are stored under `<app>-workspaces` and `<app>-workspace-active`.
The last workspace cannot be removed; an unreadable list falls back to a default workspace.
`workspaces.importWorkspaces(entries, activeId)` seeds a registry that has no stored list yet,
for an app that moves its list from an older storage layout (Chrono does it once at startup).
It returns `false` and writes nothing when a list is already stored; invalid and duplicate
entries are skipped.
Locavern does not use workspaces.

## JSON export and import

Envelope: `{ app, format, version, exportedAt, data }`. The app owns `data`.

```js
import { createExportEnvelope, parseExport, serializeExport } from '@simple-web-tools/storage';

const text = serializeExport(
  createExportEnvelope({
    app: 'chrono',
    format: 'chrono-workspace',
    version: 2,
    exportedAt: now.toISOString(),
    data,
  }),
);

const { data, originalVersion } = parseExport(text, {
  app: 'chrono',
  format: 'chrono-workspace',
  version: 2,
  upgrades: { 1: (data) => migrateV1ToV2(data) }, // upgrades[n]: version n -> n + 1
});
```

`parseExport` throws an `ExportError` whose `code` is one of `invalid-json`, `not-an-envelope`,
`wrong-app`, `wrong-format`, `invalid-version`, `newer-version`, `unsupported-version` or
`upgrade-failed`, with a message fit to show to the user. Locavern's ZIP backup format
(`format: 'locavern-archive'`) is separate and unchanged.

## Storage status

`inspectStorageStatus({ requestPersist })` wraps `navigator.storage` (persistence, usage,
quota) and degrades to `supported: false` / `null` values.

## Tests

```bash
npm test -w @simple-web-tools/storage
```

Vitest with the fake IndexedDB from `@simple-web-tools/test-utils`. The migration tests open
databases written with the raw IndexedDB API, as an older release would have left them.

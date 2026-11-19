// Single-writer model (decision 0004): one tab holds `chrono-write-lock` and writes, the other
// tabs are read-only, re-read what the writer announces and take over when the writer goes away.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { closeDatabase } from '../../src/adapters/idb.js';
import { createStore } from '../../src/adapters/store.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';
import { h } from './support/data.js';
import { readStore } from './support/idb.js';

const DB = 'chrono__default';
const LOCK = 'chrono-write-lock';

/** @type {ReturnType<typeof installBrowser>} */
let nav;
beforeEach(() => {
  nav = installBrowser({ now: h(9) });
});
afterEach(uninstallBrowser);

async function newStore() {
  const store = createStore();
  await store.init();
  return store;
}

/** Two tabs of the same workspace: the first one is the writer. */
async function twoTabs() {
  const writer = await newStore();
  const reader = await newStore();
  return { writer, reader };
}

const names = async (/** @type {string} */ collection) =>
  (await readStore(DB, collection)).map((x) => x.name).sort();

describe('who writes', () => {
  test('the first tab is the writer, the next ones are read-only', async () => {
    const { writer, reader } = await twoTabs();

    expect(writer.state.readOnly).toBe(false);
    expect(reader.state.readOnly).toBe(true);
    expect(nav.locks.isHeld(LOCK)).toBe(true);
  });

  test('a read-only tab refuses every action, tells the listeners and writes nothing', async () => {
    const { writer, reader } = await twoTabs();
    writer.actions.addProject('Alpha');
    await writer.flush();
    await vi.waitFor(() => expect(reader.state.projects).toHaveLength(1));
    const refused = vi.fn();
    reader.onRefused(refused);

    const id = reader.actions.addProject('Beta');
    reader.actions.startSession('x', 'y');
    reader.actions.loadDemoData();
    await reader.flush();

    expect(id).toBeUndefined();
    expect(refused).toHaveBeenCalledTimes(3);
    expect(reader.state.projects.map((p) => p.name)).toEqual(['Alpha']);
    expect(reader.state.sessions).toEqual([]);
    expect(await names('projects')).toEqual(['Alpha']);
  });

  test('a read-only tab keeps its 1 s tick, so the durations keep updating', async () => {
    const { reader } = await twoTabs();
    const ticks = vi.fn();
    reader.onTick(ticks);

    const tick = vi.mocked(setInterval).mock.calls.at(-1);
    expect(tick?.[1]).toBe(1000);
    const emitTick = /** @type {() => void} */ (tick?.[0]);
    emitTick();

    expect(ticks).toHaveBeenCalledTimes(1);
  });

  test('a read-only tab does not migrate and write the old due dates', async () => {
    const writer = await newStore();
    writer.actions.addTodo('a', null, null);
    await writer.flush();
    const reader = await newStore();

    await reader.flush();

    expect(reader.state.readOnly).toBe(true);
    expect(await readStore(DB, 'todos')).toHaveLength(1);
  });
});

describe('what the writer changes reaches the readers', () => {
  test('a change of the writer appears in the read-only tab', async () => {
    const { writer, reader } = await twoTabs();
    const onState = vi.fn();
    reader.onState(onState);

    writer.actions.addProject('Alpha');
    await writer.flush();

    await vi.waitFor(() => expect(reader.state.projects.map((p) => p.name)).toEqual(['Alpha']));
    expect(onState).toHaveBeenCalled();
  });

  test('a deletion by the writer disappears from the read-only tab', async () => {
    const writer = await newStore();
    const id = /** @type {string} */ (writer.actions.addProject('Alpha'));
    await writer.flush();
    const reader = await newStore();
    expect(reader.state.projects).toHaveLength(1);

    writer.actions.deleteProject(id);
    await writer.flush();

    await vi.waitFor(() => expect(reader.state.projects).toEqual([]));
  });
});

describe('when the writer goes away', () => {
  test('the read-only tab takes the lock, re-reads the database and can write', async () => {
    const { writer, reader } = await twoTabs();
    writer.actions.addProject('Alpha');
    await writer.flush();
    // The writer closes (its tab dies) right after its last write.
    nav.locks.crash(LOCK);

    await vi.waitFor(() => expect(reader.state.readOnly).toBe(false));
    expect(reader.state.projects.map((p) => p.name)).toEqual(['Alpha']);
    reader.actions.addProject('Beta');
    await reader.flush();
    expect(await names('projects')).toEqual(['Alpha', 'Beta']);
  });

  test('the promotion is announced to the listeners of the state', async () => {
    const { reader } = await twoTabs();
    /** @type {boolean[]} */
    const roles = [];
    reader.onState((s) => roles.push(s.readOnly));

    nav.locks.crash(LOCK);

    await vi.waitFor(() => expect(roles.at(-1)).toBe(false));
  });

  test('"resume editing" does nothing while the other tab still writes', async () => {
    const { reader } = await twoTabs();

    expect(await reader.retryWriteLock()).toBe(false);
    expect(reader.state.readOnly).toBe(true);
  });

  test('only one of two waiting tabs becomes the writer', async () => {
    const writer = await newStore();
    const second = await newStore();
    const third = await newStore();
    writer.actions.addProject('Alpha');
    await writer.flush();

    nav.locks.crash(LOCK);

    await vi.waitFor(() =>
      expect([second, third].filter((s) => !s.state.readOnly)).toHaveLength(1),
    );
    await closeDatabase();
  });
});

describe('demo data', () => {
  test('a new workspace starts empty and nothing is written', async () => {
    const store = await newStore();

    expect(store.state).toMatchObject({ projects: [], todos: [], sessions: [], attendance: [] });
    expect(store.isEmpty()).toBe(true);
    await store.flush();
    expect(await readStore(DB, 'projects')).toEqual([]);
  });

  test('the user can load the demo data into an empty workspace, once', async () => {
    const store = await newStore();

    expect(store.actions.loadDemoData()).toBe(true);
    await store.flush();

    expect(store.state.projects.length).toBeGreaterThan(0);
    expect((await readStore(DB, 'projects')).length).toBe(store.state.projects.length);
    expect(store.actions.loadDemoData()).toBe(false); // not empty any more
  });

  test('the demo data never replaces existing data', async () => {
    const store = await newStore();
    store.actions.addProject('Mine');

    expect(store.actions.loadDemoData()).toBe(false);

    expect(store.state.projects.map((p) => p.name)).toEqual(['Mine']);
  });
});

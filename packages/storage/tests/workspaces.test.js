import { describe, it, expect } from 'vitest';
import { createWorkspaceRegistry, slugifyWorkspaceLabel } from '../src/index.js';

/**
 * In-memory `localStorage`.
 * @param {Record<string, string>} [initial]
 */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    /** @param {string} key */
    getItem: (key) => map.get(key) ?? null,
    /** @param {string} key @param {string} value */
    setItem: (key, value) => void map.set(key, String(value)),
    /** @param {string} key */
    removeItem: (key) => void map.delete(key),
  };
}

/** @param {Record<string, string>} [initial] */
function setup(initial) {
  const storage = memoryStorage(initial);
  let time = 1000;
  const registry = createWorkspaceRegistry({
    app: 'chrono',
    storage,
    now: () => (time += 1),
    defaultLabel: 'Main',
  });
  return { storage, registry };
}

describe('workspace registry', () => {
  it('starts with a default workspace, stored under prefixed keys', () => {
    const { storage, registry } = setup();
    expect(registry.list()).toEqual([{ id: 'default', label: 'Main', createdAt: 1001 }]);
    expect(registry.activeId()).toBe('default');
    expect([...storage.map.keys()]).toEqual(['chrono-workspaces']);
  });

  it('creates workspaces with unique ids derived from the label', () => {
    const { registry } = setup();
    const a = registry.create('  Clients été  ');
    const b = registry.create('Clients ete');
    expect(a).toMatchObject({ id: 'clients-ete', label: 'Clients été' });
    expect(b.id).toBe('clients-ete-2');
    expect(registry.list().map((w) => w.id)).toEqual(['default', 'clients-ete', 'clients-ete-2']);
    expect(registry.databaseName(a.id)).toBe('chrono__clients-ete');
  });

  it('refuses an empty name', () => {
    const { registry } = setup();
    expect(() => registry.create('   ')).toThrow();
    expect(() => registry.rename('default', '')).toThrow();
  });

  it('renames without changing the id', () => {
    const { registry } = setup();
    const renamed = registry.rename('default', 'Home');
    expect(renamed).toMatchObject({ id: 'default', label: 'Home' });
    expect(registry.get('default')?.label).toBe('Home');
    expect(() => registry.rename('nope', 'x')).toThrow(/Unknown workspace/);
  });

  it('switches the active workspace and persists the choice', () => {
    const { storage, registry } = setup();
    const w = registry.create('Side');
    registry.setActive(w.id);
    expect(registry.active().id).toBe('side');
    expect(storage.getItem('chrono-workspace-active')).toBe('side');
    expect(() => registry.setActive('nope')).toThrow(/Unknown workspace/);
  });

  it('removes a workspace, moves the active one, and keeps the last one', () => {
    const { registry } = setup();
    const w = registry.create('Side');
    registry.setActive(w.id);
    const remaining = registry.remove(w.id);
    expect(remaining.map((x) => x.id)).toEqual(['default']);
    expect(registry.activeId()).toBe('default');
    expect(() => registry.remove('default')).toThrow(/last workspace/);
    expect(() => registry.remove('nope')).toThrow(/Unknown workspace/);
  });

  it('falls back to the first workspace when the stored active id vanished', () => {
    const { storage, registry } = setup();
    storage.setItem('chrono-workspace-active', 'ghost');
    expect(registry.activeId()).toBe('default');
  });

  it('survives a second registry on the same storage', () => {
    const { storage, registry } = setup();
    registry.create('Side');
    const other = createWorkspaceRegistry({ app: 'chrono', storage, now: () => 0 });
    expect(other.list().map((w) => w.id)).toEqual(['default', 'side']);
  });

  it('recovers from unreadable or invalid stored data', () => {
    const { registry } = setup({ 'chrono-workspaces': '{not json' });
    expect(registry.list().map((w) => w.id)).toEqual(['default']);
    const second = setup({
      'chrono-workspaces': JSON.stringify([
        { id: 'Bad Id', label: 1 },
        { id: 'ok', label: 'OK', createdAt: 5 },
      ]),
    });
    expect(second.registry.list()).toEqual([{ id: 'ok', label: 'OK', createdAt: 5 }]);
  });

  it('does not touch the keys of another app', () => {
    const storage = memoryStorage({ 'locavern-workspaces': 'x' });
    createWorkspaceRegistry({ app: 'chrono', storage, now: () => 1 }).list();
    expect(storage.getItem('locavern-workspaces')).toBe('x');
  });

  it('validates the app name', () => {
    expect(() =>
      createWorkspaceRegistry({ app: 'Bad', storage: memoryStorage(), now: () => 0 }),
    ).toThrow(TypeError);
  });
});

describe('slugifyWorkspaceLabel', () => {
  it('produces a clean ASCII slug, with a fallback', () => {
    expect(slugifyWorkspaceLabel('Été 2026 / Clients!')).toBe('ete-2026-clients');
    expect(slugifyWorkspaceLabel('???')).toBe('workspace');
    expect(slugifyWorkspaceLabel('a'.repeat(60))).toHaveLength(40);
  });
});

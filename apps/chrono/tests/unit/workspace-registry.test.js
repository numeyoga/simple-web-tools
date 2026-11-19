// The registry of workspaces over localStorage, and the one-time import of the version 1 keys
// (`chrono.workspaces`, `chrono.workspace.active`).
import { afterEach, describe, expect, test } from 'vitest';
import { isDemoEnabled, getRegistry, wsActiveId } from '../../src/adapters/workspace-list.js';
import { installBrowser, uninstallBrowser } from './support/browser.js';

const LEGACY_LIST = 'chrono.workspaces';
const LEGACY_ACTIVE = 'chrono.workspace.active';
const NOW = new Date(2026, 10, 18, 10, 0).getTime();

const legacyList = [
  { id: 'default', label: 'Espace principal', creeLe: 1700000000000 },
  { id: 'perso', label: 'Perso', creeLe: 1700000100000, seedOnInit: false },
  { id: 'demo', label: 'Démo', creeLe: 1700000200000, seedOnInit: true },
];

afterEach(uninstallBrowser);

describe('migration of the version 1 workspace list', () => {
  test('imports the ids, labels, creation times and the active workspace', () => {
    const nav = installBrowser({ now: NOW });
    nav.localStorage.setItem(LEGACY_LIST, JSON.stringify(legacyList));
    nav.localStorage.setItem(LEGACY_ACTIVE, 'perso');

    const registry = getRegistry();

    expect(registry.list()).toEqual([
      { id: 'default', label: 'Espace principal', createdAt: 1700000000000 },
      { id: 'perso', label: 'Perso', createdAt: 1700000100000 },
      { id: 'demo', label: 'Démo', createdAt: 1700000200000 },
    ]);
    expect(registry.activeId()).toBe('perso');
    expect(wsActiveId()).toBe('perso');
    // The database names still match the ones of version 1.
    expect(registry.databaseName('perso')).toBe('chrono__perso');
    expect(nav.localStorage.keys().sort()).toEqual([
      'chrono-workspace-active',
      'chrono-workspaces',
      'chrono-workspaces-no-demo',
      LEGACY_ACTIVE,
      LEGACY_LIST,
    ]);
  });

  test('never touches the version 1 keys', () => {
    const nav = installBrowser({ now: NOW });
    const rawList = JSON.stringify(legacyList);
    nav.localStorage.setItem(LEGACY_LIST, rawList);
    nav.localStorage.setItem(LEGACY_ACTIVE, 'demo');

    getRegistry().create('Another');
    getRegistry().setActive('default');
    getRegistry().remove('perso');

    expect(nav.localStorage.getItem(LEGACY_LIST)).toBe(rawList);
    expect(nav.localStorage.getItem(LEGACY_ACTIVE)).toBe('demo');
  });

  test('keeps the "without demo data" flag of the workspaces created that way', () => {
    const nav = installBrowser({ now: NOW });
    nav.localStorage.setItem(LEGACY_LIST, JSON.stringify(legacyList));

    getRegistry();

    expect(isDemoEnabled('default')).toBe(true);
    expect(isDemoEnabled('perso')).toBe(false); // seedOnInit: false
    expect(isDemoEnabled('demo')).toBe(true);
  });

  test('runs once: afterwards the new keys win', () => {
    const nav = installBrowser({ now: NOW });
    nav.localStorage.setItem(LEGACY_LIST, JSON.stringify(legacyList));
    getRegistry().remove('perso');
    nav.localStorage.setItem(
      LEGACY_LIST,
      JSON.stringify([{ id: 'other', label: 'Other', creeLe: 1 }]),
    );

    expect(
      getRegistry()
        .list()
        .map((w) => w.id),
    ).toEqual(['default', 'demo']);
  });

  test('without version 1 keys, a fresh registry has the default workspace', () => {
    const nav = installBrowser({ now: NOW });

    expect(getRegistry().list()).toEqual([
      { id: 'default', label: 'Espace principal', createdAt: NOW },
    ]);
    expect(nav.localStorage.keys()).toEqual(['chrono-workspaces']);
  });

  test('an unknown active id falls back to the first workspace', () => {
    const nav = installBrowser({ now: NOW });
    nav.localStorage.setItem(LEGACY_LIST, JSON.stringify(legacyList));
    nav.localStorage.setItem(LEGACY_ACTIVE, 'removed');

    expect(getRegistry().activeId()).toBe('default');
  });

  test('an unreadable version 1 list is ignored', () => {
    const nav = installBrowser({ now: NOW });
    nav.localStorage.setItem(LEGACY_LIST, '{broken');

    expect(
      getRegistry()
        .list()
        .map((w) => w.id),
    ).toEqual(['default']);
  });

  test('entries that are not usable are skipped', () => {
    const nav = installBrowser({ now: NOW });
    nav.localStorage.setItem(
      LEGACY_LIST,
      JSON.stringify([null, 'x', { label: 'no id' }, { id: 'ok', label: 'Ok', creeLe: 3 }]),
    );

    expect(getRegistry().list()).toEqual([{ id: 'ok', label: 'Ok', createdAt: 3 }]);
  });
});

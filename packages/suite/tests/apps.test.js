import { describe, expect, it } from 'vitest';
import { APPS, appHref, findApp } from '../src/index.js';
import { fromPackage, fs } from './support/node-fs.js';

describe('APPS', () => {
  it('lists the apps in a fixed order', () => {
    expect(APPS.map((app) => app.id)).toEqual([
      'chrono',
      'locavern',
      'transient-notes',
      'favoris',
      'dashboard',
    ]);
  });

  it('has unique ids, names and complete entries', () => {
    expect(new Set(APPS.map((app) => app.id)).size).toBe(APPS.length);
    expect(new Set(APPS.map((app) => app.name)).size).toBe(APPS.length);
    for (const app of APPS) {
      expect(app.name).not.toBe('');
      expect(app.icon).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(APPS)).toBe(true);
    for (const app of APPS) expect(Object.isFrozen(app)).toBe(true);
  });

  it('matches the folders of apps/, so a new app has to be registered', () => {
    const folders = fs
      .readdirSync(fromPackage('../../apps/'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect([...folders].sort()).toEqual(APPS.map((app) => app.id).sort());
  });
});

describe('findApp', () => {
  it('returns the entry of an id', () => {
    expect(findApp('locavern')).toEqual({ id: 'locavern', name: 'Locavern', icon: 'kanban' });
  });

  it('throws on an unknown id', () => {
    expect(() => findApp('nope')).toThrow('Unknown app: nope');
  });
});

describe('appHref', () => {
  it('is relative to the root of the current app', () => {
    expect(appHref('chrono')).toBe('../chrono/');
    expect(appHref('transient-notes')).toBe('../transient-notes/');
  });

  it('resolves to a sibling on the assembled site, whatever the fragment', () => {
    for (const from of [
      'https://example.test/site/locavern/',
      'https://example.test/site/locavern/#tasks',
    ]) {
      expect(new URL(appHref('chrono'), from).href).toBe('https://example.test/site/chrono/');
    }
  });

  it('throws on an unknown id', () => {
    expect(() => appHref('nope')).toThrow('Unknown app');
  });
});

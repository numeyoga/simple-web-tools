import { describe, expect, it } from 'vitest';
import { APPS } from '../src/apps.js';
import { createAppBrand, createAppSwitcher } from '../src/dom.js';
import { asFake, createFakeDocument } from './support/fake-dom.js';
import { fromPackage, fs } from './support/node-fs.js';

const doc = createFakeDocument();

describe('createAppBrand', () => {
  it('builds the Covenant sidebar brand: icon and name', () => {
    const brand = asFake(createAppBrand('locavern', { doc }));
    expect(brand.tagName).toBe('DIV');
    expect(brand.classes).toEqual(['cv-sidebar__brand']);
    const [icon, name] = brand.children;
    expect(icon?.tagName).toBe('I');
    expect(icon?.getAttribute('class')).toBe('ph-bold ph-kanban cv-icon swt-brand__icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(name?.tagName).toBe('SPAN');
    expect(name?.textContent).toBe('Locavern');
    expect(brand.children).toHaveLength(2);
  });

  it('shows the icon and name of each app', () => {
    for (const app of APPS) {
      const brand = asFake(createAppBrand(app.id, { doc }));
      expect(brand.children[0]?.classes).toContain(`ph-${app.icon}`);
      expect(brand.textContent).toBe(app.name);
    }
  });

  it('throws on an unknown app', () => {
    expect(() => createAppBrand('nope', { doc })).toThrow('Unknown app');
  });
});

describe('createAppSwitcher', () => {
  const build = (/** @type {string} */ id) => asFake(createAppSwitcher(id, { label: 'Apps', doc }));

  it('builds a labelled list inside a plain block, not a nested nav', () => {
    const switcher = build('chrono');
    expect(switcher.tagName).toBe('DIV');
    expect(switcher.classes).toEqual(['swt-switcher']);
    expect(switcher.findAll((el) => el.tagName === 'NAV')).toEqual([]);
    const [heading, list] = switcher.children;
    expect(heading?.tagName).toBe('DIV');
    expect(heading?.classes).toEqual(['cv-overline', 'cv-sidebar__group']);
    expect(heading?.getAttribute('id')).toBe('swt-switcher-heading');
    expect(heading?.textContent).toBe('Apps');
    expect(list?.tagName).toBe('UL');
    expect(list?.getAttribute('aria-labelledby')).toBe('swt-switcher-heading');
  });

  it('uses the label it is given', () => {
    const switcher = asFake(createAppSwitcher('chrono', { label: 'Applications', doc }));
    expect(switcher.children[0]?.textContent).toBe('Applications');
  });

  it('has one link per app, in registry order, with its icon and name', () => {
    const items = build('locavern').children[1]?.children ?? [];
    expect(items).toHaveLength(APPS.length);
    items.forEach((item, index) => {
      const app = APPS[index];
      expect(item.tagName).toBe('LI');
      const link = item.children[0];
      expect(link?.tagName).toBe('A');
      expect(link?.classes).toEqual(['cv-nav-item', 'swt-switcher__link']);
      const [icon, name] = link?.children ?? [];
      expect(icon?.getAttribute('class')).toBe(`ph ph-${app?.icon} cv-icon`);
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(name?.tagName).toBe('SPAN');
      expect(name?.textContent).toBe(app?.name);
    });
  });

  it('links to the siblings with ../<id>/ and to the current app with ./', () => {
    const links = build('locavern').findAll((el) => el.tagName === 'A');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '../chrono/',
      './',
      '../transient-notes/',
      '../favoris/',
    ]);
  });

  it('marks only the current app with aria-current="page"', () => {
    for (const app of APPS) {
      const links = build(app.id).findAll((el) => el.tagName === 'A');
      const current = links.filter((link) => link.getAttribute('aria-current') !== null);
      expect(current).toHaveLength(1);
      expect(current[0]?.getAttribute('aria-current')).toBe('page');
      expect(current[0]?.textContent).toBe(app.name);
    }
  });

  it('throws on an unknown app', () => {
    expect(() => createAppSwitcher('nope', { label: 'Apps', doc })).toThrow('Unknown app');
  });
});

describe('dom.js source', () => {
  it('never builds markup from a string', () => {
    const source = fs.readFileSync(fromPackage('src/dom.js'), 'utf8');
    expect(source).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });
});

describe('suite.css', () => {
  it('uses Covenant tokens only', () => {
    const css = fs.readFileSync(fromPackage('src/suite.css'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(css).not.toMatch(/var\(--cv-(neutral|accent|success|warning|danger|info)-[0-9]+\)/);
  });
});

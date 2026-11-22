import { describe, expect, test } from 'vitest';
import { ADMIN_PAGES, parseRoute, routeHash, sameRoute } from '../../src/core/route.js';
import { emptyViewMemory, parseViewMemory, rememberView } from '../../src/core/view.js';

describe('routes', () => {
  test('an application', () => {
    expect(parseRoute('#/app/abc-123')).toEqual({ screen: 'app', appId: 'abc-123' });
    expect(parseRoute('/app/x')).toEqual({ screen: 'app', appId: 'x' });
  });

  test('an admin screen, with the selected template where there is a list', () => {
    expect(parseRoute('#/admin/templates/t%201')).toEqual({
      screen: 'admin',
      page: 'templates',
      templateId: 't 1',
    });
    expect(parseRoute('#/admin/metadata')).toEqual({
      screen: 'admin',
      page: 'metadata',
      templateId: null,
    });
    expect(parseRoute('#/admin/tags/ignored')).toEqual({
      screen: 'admin',
      page: 'tags',
      templateId: null,
    });
  });

  test('anything else is the application opened at the start', () => {
    for (const hash of ['', '#', '#/', '#/nowhere', '#/admin', '#/admin/unknown', '#/app']) {
      expect(parseRoute(hash)).toEqual({ screen: 'app', appId: null });
    }
  });

  test('a malformed escape does not throw', () => {
    expect(parseRoute('#/app/%E0%A4%A')).toEqual({ screen: 'app', appId: '%E0%A4%A' });
  });

  test('an address reads back to the same route', () => {
    for (const route of /** @type {import('../../src/core/route.js').Route[]} */ ([
      { screen: 'app', appId: null },
      { screen: 'app', appId: 'a/b c' },
      ...ADMIN_PAGES.map((page) => ({
        screen: /** @type {const} */ ('admin'),
        page,
        templateId: null,
      })),
      { screen: 'admin', page: 'templates', templateId: 't 1' },
    ])) {
      expect(parseRoute(routeHash(route))).toEqual(route);
    }
    expect(sameRoute({ screen: 'app', appId: 'a' }, parseRoute('#/app/a'))).toBe(true);
    expect(sameRoute({ screen: 'app', appId: 'a' }, { screen: 'app', appId: 'b' })).toBe(false);
  });
});

describe('what was looked at last', () => {
  test('reads a stored value, and an empty memory for anything else', () => {
    expect(parseViewMemory('{"appId":"a","envs":{"a":"prod","b":3}}')).toEqual({
      appId: 'a',
      envs: { a: 'prod' },
    });
    for (const raw of [null, undefined, '', 'nope', '[]', '3', '{"appId":3}']) {
      expect(parseViewMemory(raw)).toEqual(
        raw === '{"appId":3}' ? emptyViewMemory() : emptyViewMemory(),
      );
    }
  });

  test('remembers an application and the environment, and returns the same memory when nothing changed', () => {
    const first = rememberView(emptyViewMemory(), 'a', 'prod');
    expect(first).toEqual({ appId: 'a', envs: { a: 'prod' } });
    expect(rememberView(first, 'a', 'prod')).toBe(first);
    expect(rememberView(first, 'a', null)).toBe(first);
    expect(rememberView(first, 'b', null)).toEqual({ appId: 'b', envs: { a: 'prod' } });
    expect(rememberView(first, 'a', 'dev')).toEqual({ appId: 'a', envs: { a: 'dev' } });
  });
});

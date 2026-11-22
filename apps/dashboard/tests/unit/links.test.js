import { describe, expect, test } from 'vitest';
import {
  availablePlaceholders,
  classifyUrl,
  missingByEnv,
  placeholdersOf,
  renderPattern,
  resolveLink,
  resolveLinks,
} from '../../src/core/links.js';
import { app, template } from './support/data.js';

const values = {
  env: 'prod',
  slug: 'mon-app',
  jiraKey: 'MCP',
  meta: { cluster: 'ocp-1', env: 'meta-env' },
};

describe('renderPattern', () => {
  test('fills in {env}, {slug}, {jiraKey} and the metadata, as {meta.key} or as {key}', () => {
    expect(renderPattern('https://x/{slug}-{env}/{jiraKey}', values)).toEqual({
      url: 'https://x/mon-app-prod/MCP',
      missing: [],
    });
    expect(renderPattern('https://{meta.cluster}.x/{cluster}', values).url).toBe(
      'https://ocp-1.x/ocp-1',
    );
  });

  test('the three built-in names win over a metadata field of the same name, which {meta.env} reaches', () => {
    expect(renderPattern('{env} {meta.env}', values).url).toBe('prod meta-env');
  });

  test('a placeholder with no value stays as written and is reported once', () => {
    expect(renderPattern('https://x/{owner}/{meta.region}/{owner}', values)).toEqual({
      url: 'https://x/{owner}/{meta.region}/{owner}',
      missing: ['{owner}', '{meta.region}'],
    });
    expect(renderPattern('{jiraKey}', { ...values, jiraKey: '' }).missing).toEqual(['{jiraKey}']);
  });

  test('braces that are not a placeholder are left alone', () => {
    expect(renderPattern('https://x/?q={"a": 1}&b={a b}', values)).toEqual({
      url: 'https://x/?q={"a": 1}&b={a b}',
      missing: [],
    });
  });

  test('placeholdersOf lists each placeholder once', () => {
    expect(placeholdersOf('{a}{meta.b}{a}')).toEqual(['{a}', '{meta.b}']);
  });
});

describe('classifyUrl: only http and https addresses are opened', () => {
  test.each([
    ['https://example.invalid/a?b=c#d', null],
    ['http://localhost:3000/x', null],
    ['HTTPS://EXAMPLE.INVALID', null],
    ['', 'empty'],
    ['   ', 'empty'],
    ['javascript:alert(1)', 'unsafe'],
    ['JavaScript:alert(1)', 'unsafe'],
    ['data:text/html,<b>x</b>', 'unsafe'],
    ['file:///etc/passwd', 'unsafe'],
    ['mailto:someone@example.invalid', 'unsafe'],
    ['ftp://example.invalid/x', 'unsafe'],
    ['example.invalid/path', 'invalid'],
    ['localhost:3000/x', 'invalid'],
    ['https:example.invalid', 'invalid'],
    ['https://', 'invalid'],
    ['//example.invalid', 'invalid'],
  ])('%j is %s', (url, expected) => {
    expect(classifyUrl(url)).toBe(expected);
  });
});

describe('resolving the links of an application', () => {
  const tpl = template({ id: 't1' });
  const [gitLink, webLink] =
    /** @type {[import('../../src/types.d.ts').TemplateLink, import('../../src/types.d.ts').TemplateLink]} */ (
      tpl.links
    );
  const base = app({
    id: 'a1',
    templateId: 't1',
    slug: 'acc',
    envs: {
      dev: { meta: { cluster: 'c1' }, overrides: {} },
      prod: { meta: {}, overrides: { 't1-git': 'https://custom.example.invalid/acc' } },
    },
  });

  test('a pattern is filled in with the environment and the metadata', () => {
    const [git, web] = resolveLinks(base, tpl, 'dev');

    expect(git).toMatchObject({ url: 'https://git.example.invalid/acc', problem: null });
    expect(web).toMatchObject({
      url: 'https://acc-dev.example.invalid/c1',
      problem: null,
      overridden: false,
    });
  });

  test('an override replaces the pattern', () => {
    expect(resolveLink(base, 'prod', gitLink).overridden).toBe(true);
    expect(resolveLink(base, 'prod', gitLink).url).toBe('https://custom.example.invalid/acc');
  });

  test('a value still to fill in is reported, with what is missing', () => {
    const web = resolveLink(base, 'prod', webLink);

    expect(web).toMatchObject({ problem: 'unresolved', missing: ['{meta.cluster}'] });
  });

  test('a pattern that resolves to something else than http or https is not openable', () => {
    const evil = {
      id: 'l',
      name: 'x',
      tag: '',
      scope: /** @type {const} */ ('env'),
      pattern: 'javascript:alert({slug})',
    };

    expect(resolveLink(base, 'dev', evil)).toMatchObject({ problem: 'unsafe' });
    expect(resolveLink(base, 'dev', { ...evil, pattern: '' })).toMatchObject({ problem: 'empty' });
    expect(resolveLink(base, 'dev', { ...evil, pattern: '{meta.cluster}/x' })).toMatchObject({
      problem: 'invalid',
    });
  });

  test('a value that brings the scheme makes a scheme-less pattern an address', () => {
    const link = {
      id: 'l',
      name: 'x',
      tag: '',
      scope: /** @type {const} */ ('env'),
      pattern: '{meta.base}/x',
    };
    const filled = app({
      id: 'a',
      templateId: 't1',
      envs: { dev: { meta: { base: 'https://base.example.invalid' }, overrides: {} } },
    });

    expect(resolveLink(filled, 'dev', link)).toMatchObject({
      url: 'https://base.example.invalid/x',
      problem: null,
    });
  });

  test('an environment the application has no data for resolves with nothing filled in', () => {
    expect(resolveLink(base, 'unknown', webLink).problem).toBe('unresolved');
  });

  test('counts, per environment, the links with something to fill in', () => {
    expect(missingByEnv(base, tpl)).toEqual({ dev: 0, prod: 1 });
  });

  test('lists the placeholders a template offers', () => {
    expect(availablePlaceholders(tpl)).toEqual(['{env}', '{slug}', '{jiraKey}', '{meta.cluster}']);
  });
});

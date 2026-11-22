// The sample dashboard: it is what "Load sample" puts in a workspace, so it must be a valid, fully
// formed dashboard in both languages, on hosts that can never resolve.
import { createTranslator } from '@simple-web-tools/i18n';
import { describe, expect, test } from 'vitest';
import { catalogs } from '../../src/i18n/index.js';
import { missingByEnv, resolveLinks } from '../../src/core/links.js';
import { cleanData } from '../../src/core/model.js';
import { buildSample, defaultTags } from '../../src/core/sample.js';

/** Ids `s1`, `s2`... */
function counter() {
  let n = 0;
  return () => `s${(n += 1)}`;
}

/** @param {string} locale */
const sample = (locale) => {
  const { t } = createTranslator({ locale, catalogs });
  return buildSample({ makeId: counter(), t });
};

describe.each(['en', 'fr'])('the sample in %s', (locale) => {
  const data = sample(locale);

  test('has four templates and twelve applications', () => {
    expect(data.templates).toHaveLength(4);
    expect(data.apps).toHaveLength(12);
  });

  test('is clean: cleaning it skips nothing and changes nothing', () => {
    const { data: cleaned, skipped } = cleanData(data, { sorted: true });

    expect(skipped).toEqual({ templates: 0, apps: 0, parts: 0, unsafeUrls: 0 });
    expect(cleaned).toEqual(data);
  });

  test('has unique ids, slugs and tag keys, and every application has a template', () => {
    const ids = [
      ...data.templates.flatMap((t) => [t.id, ...t.links.map((l) => l.id)]),
      ...data.apps.flatMap((a) => [a.id, ...a.extras.map((x) => x.id)]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(data.apps.map((a) => a.slug)).size).toBe(12);
    expect(new Set(data.settings.tags.map((t) => t.key)).size).toBe(data.settings.tags.length);
    for (const a of data.apps) expect(data.templates.some((t) => t.id === a.templateId)).toBe(true);
    expect(data.settings.defaultAppId).toBe(data.apps[0]?.id);
  });

  test('every link and extra link is on example.invalid, and every link of a filled-in environment opens', () => {
    for (const t of data.templates) {
      for (const l of t.links) expect(l.pattern).toMatch(/^https:\/\/[^/]*example\.invalid/);
    }
    for (const a of data.apps) {
      for (const x of a.extras) expect(new URL(x.url).hostname).toMatch(/example\.invalid$/);
    }
    // Only the UAT environment of one application is left to fill in, to show what that looks like.
    const missing = data.apps.flatMap((a) => {
      const t = data.templates.find((tpl) => tpl.id === a.templateId);
      return t
        ? Object.entries(missingByEnv(a, t)).flatMap(([env, n]) =>
            n > 0 ? [`${a.slug}:${env}`] : [],
          )
        : [];
    });
    expect(missing).toEqual(['hr-backoffice:uat']);
    const hr = data.apps.find((a) => a.slug === 'hr-backoffice');
    const tpl = data.templates.find((t) => t.id === hr?.templateId);
    if (hr && tpl) {
      expect(resolveLinks(hr, tpl, 'prod').every((r) => r.problem === null)).toBe(true);
    }
  });

  test('has its texts in the language: no catalog key is left showing', () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/sample\./);
  });
});

test('the default tags are the nine of the earlier version, in its order', () => {
  expect(defaultTags((key) => key).map((t) => t.key)).toEqual([
    'cicd',
    'app',
    'monitoring',
    'logs',
    'quality',
    'tickets',
    'docs',
    'archi',
    'team',
  ]);
});

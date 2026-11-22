// The JSON backup: this version's envelope, and the file the earlier version of the dashboard
// exported (on GitLab Pages, another origin: its export file is the only way over), wrapped as
// `{ version: 1, exportedAt, data }` or as the bare object. The fixtures in tests/fixtures are in
// that format.
import { describe, expect, test } from 'vitest';
import { readBackup, serializeBackup } from '../../src/adapters/backup.js';
import {
  BackupError,
  backupFileName,
  buildBackupData,
  legacyDashboard,
  validateBackupData,
} from '../../src/core/backup.js';
import { resolveLinks } from '../../src/core/links.js';
import { templateOf } from '../../src/core/selectors.js';
import { createInitialState, reduce } from '../../src/core/store.js';
import bare from '../fixtures/legacy-dashboard-bare.json';
import wrapped from '../fixtures/legacy-dashboard.json';
import { app, settings, template } from './support/data.js';

/** Ids `b1`, `b2`... */
function counter() {
  let n = 0;
  return () => `b${(n += 1)}`;
}

const data = {
  settings: settings({ dashboardName: 'Mine' }),
  templates: [template({ id: 't1' })],
  apps: [app({ id: 'a1', templateId: 't1' })],
};
const envelope = (/** @type {unknown} */ payload, /** @type {object} */ over = {}) => ({
  app: 'dashboard',
  format: 'dashboard-workspace',
  version: 1,
  exportedAt: '2026-11-22T10:00:00.000Z',
  data: payload,
  ...over,
});

describe('this version’s file', () => {
  test('the data of a backup reads back the same, in the same order', () => {
    const back = validateBackupData(buildBackupData(data), counter());

    expect(back.data).toEqual(data);
    expect(back.skipped).toEqual({ templates: 0, apps: 0, parts: 0, unsafeUrls: 0 });
  });

  test('is read from its text, through the envelope', () => {
    const result = readBackup(JSON.stringify(envelope(buildBackupData(data))), counter());

    expect(result.legacy).toBe(false);
    expect(result.data.apps.map((a) => a.id)).toEqual(['a1']);
  });

  test('a record that cannot be used is skipped and counted, not fatal', () => {
    const result = readBackup(
      JSON.stringify(
        envelope({
          settings: {},
          templates: [data.templates[0], 3],
          apps: [
            data.apps[0],
            { id: 'x' },
            { id: 'e', templateId: 't1', extras: [{ url: 'javascript:alert(1)' }] },
          ],
        }),
      ),
      counter(),
    );

    expect(result.data.apps.map((a) => a.id)).toEqual(['a1', 'e']);
    expect(result.skipped).toEqual({ templates: 1, apps: 1, parts: 0, unsafeUrls: 1 });
  });

  test.each([
    ['not JSON', '{nope', 'invalid-json'],
    ['not an object', '[1, 2]', 'not-an-envelope'],
    ['another app', JSON.stringify(envelope({}, { app: 'favoris' })), 'wrong-app'],
    ['another format', JSON.stringify(envelope({}, { format: 'other' })), 'wrong-format'],
    ['a newer version', JSON.stringify(envelope({}, { version: 2 })), 'newer-version'],
    ['no data', JSON.stringify(envelope(null)), 'not-an-envelope'],
  ])('refuses %s', (_what, text, code) => {
    expect(() => readBackup(text)).toThrow(expect.objectContaining({ code }));
  });

  test('refuses data without the two lists', () => {
    for (const payload of [{ templates: [] }, { apps: [] }, {}]) {
      expect(() => readBackup(JSON.stringify(envelope(payload)))).toThrow(BackupError);
    }
    for (const payload of [[], 'x']) {
      expect(() => readBackup(JSON.stringify(envelope(payload)))).toThrow();
    }
  });

  test('a backup is named after the workspace and the local date', () => {
    expect(backupFileName({ workspaceId: 'work', date: '2026-11-22' })).toBe(
      'dashboard-work-2026-11-22.json',
    );
  });

  test('serializing an envelope gives text that reads back', () => {
    const text = serializeBackup(envelope(buildBackupData(data)));
    expect(readBackup(text).data.templates[0]?.id).toBe('t1');
  });
});

describe('the earlier version’s export', () => {
  test('is told apart from this version’s file', () => {
    expect(legacyDashboard(wrapped)).toBe(wrapped.data);
    expect(legacyDashboard(bare)).toBe(bare);
    expect(legacyDashboard(envelope(buildBackupData(data)))).toBeNull();
    expect(legacyDashboard({ data: { apps: [] } })).toBeNull(); // the two lists are required
    expect(legacyDashboard({ apps: [], templates: 'x' })).toBeNull();
    expect(legacyDashboard('x')).toBeNull();
    expect(legacyDashboard(null)).toBeNull();
  });

  test.each([
    ['wrapped', () => JSON.stringify(wrapped)],
    ['bare', () => JSON.stringify(bare)],
  ])('the %s file is imported, record by record', (_name, text) => {
    const result = readBackup(text(), counter());

    expect(result.legacy).toBe(true);
    // Two records are not applications (no template, not an object); an override and an extra
    // link carry a `javascript:` or `data:` address and are dropped.
    expect(result.skipped).toEqual({ templates: 0, apps: 2, parts: 0, unsafeUrls: 2 });
    const { settings: s, templates, apps } = result.data;
    expect(s).toEqual({
      dashboardName: 'Mon Backoffice perso',
      defaultAppId: 'app_mcp001',
      defaultEnv: 'last',
      tags: [
        { key: 'cicd', label: 'CI / CD', icon: 'git-branch' },
        { key: 'app', label: 'Application', icon: 'browser' },
        { key: 'monitoring', label: 'Monitoring', icon: 'gauge' },
        { key: 'docs', label: 'Docs', icon: 'book-open' },
        { key: 'team', label: 'Équipe', icon: 'users-three' },
      ],
    });
    expect(templates.map((t) => [t.id, t.envs.map((e) => e.key), t.links.length])).toEqual([
      ['tpl_web0001', ['dev', 'test', 'prod'], 6],
      ['tpl_batch01', ['dev', 'prod'], 2],
    ]);
    expect(templates[0]?.metaFields.map((f) => [f.key, f.type])).toEqual([
      ['cluster', 'mono'],
      ['namespace', 'mono'],
      ['region', 'select'],
      ['owner', 'text'],
      ['lastDeploy', 'date'],
    ]);
    expect(templates[0]?.metaFields[2]?.options).toEqual(['eu-west-3', 'eu-west-1']);
    expect(apps.map((a) => a.id)).toEqual(['app_mcp001', 'app_pay001', 'app_orph001']);
    const first = apps[0];
    expect(first?.extras.map((x) => x.id)).toEqual(['ex_conf001', 'ex_chat001']);
    expect(first?.envs.test?.overrides).toEqual({
      lnk_graf01: 'https://grafana.example.invalid/d/custom-test',
    });
    expect(first?.envs.prod?.overrides).toEqual({});
    expect(first?.envs.prod?.meta.cluster).toBe('ocp-prod-paris');
    expect(first?.envs.dev?.meta.lastDeploy).toBe('2025-03-04');
  });

  test('the wrapped and the bare file give the same dashboard', () => {
    expect(readBackup(JSON.stringify(wrapped), counter()).data).toEqual(
      readBackup(JSON.stringify(bare), counter()).data,
    );
  });

  test('its theme and density are the person’s preferences here, not data', () => {
    const result = readBackup(JSON.stringify(bare), counter());

    expect(Object.keys(result.data.settings).sort()).toEqual([
      'dashboardName',
      'defaultAppId',
      'defaultEnv',
      'tags',
    ]);
  });

  test('its links resolve: {key} placeholders read the metadata, and an unsafe pattern is not opened', () => {
    const { data: imported } = readBackup(JSON.stringify(bare), counter());
    const state = reduce(createInitialState(), { type: 'hydrate', payload: imported }).nextState;
    const [first, , orphan] =
      /** @type {[import('../../src/types.d.ts').App, unknown, import('../../src/types.d.ts').App]} */ (
        /** @type {unknown} */ (state.apps)
      );
    const tpl = templateOf(state, first);
    expect(tpl?.id).toBe('tpl_web0001');
    if (!tpl) return;

    const prod = resolveLinks(first, tpl, 'prod');
    expect(prod.map((r) => [r.link.name, r.problem])).toEqual([
      ['GoCD pipeline', null],
      ['Git repo', null],
      ['OpenShift console', null],
      ['Grafana', null],
      ['Jira board', null],
      ['Lien piégé', 'unsafe'],
    ]);
    expect(prod[2]?.url).toBe(
      'https://console.ocp-prod-paris.openshift.example.invalid/k8s/ns/mcp-prod/deployments',
    );
    expect(prod[4]?.url).toBe('https://jira.example.invalid/secure/RapidBoard.jspa?projectKey=MCP');
    // The dropped override leaves the pattern in charge; the kept one replaces it.
    expect(prod[0]?.overridden).toBe(false);
    expect(resolveLinks(first, tpl, 'test')[3]).toMatchObject({
      overridden: true,
      url: 'https://grafana.example.invalid/d/custom-test',
    });
    // An application whose template is gone is kept, and says so.
    expect(templateOf(state, orphan)).toBeNull();
  });

  test('a file that has not the two lists is not the earlier version’s', () => {
    expect(() => readBackup(JSON.stringify({ version: 1, data: { apps: [] } }))).toThrow(
      expect.objectContaining({ code: 'wrong-app' }),
    );
  });
});

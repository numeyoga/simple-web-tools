/** @import { App, Env, Extra, MetaField, Settings, Tag, Template, TemplateLink, WorkspaceData } from '../types.d.ts' */

// The sample dashboard ("Load sample"): four templates and twelve applications, so a new person
// can see what a filled-in dashboard looks like. Every host is on `example.invalid`, a name that
// can never resolve. The texts come from the catalog through `t`; ids are made by the caller.
// Pure: nothing here reads a clock or a random number.

import { renumber } from './model.js';

/** @typedef {(key: string) => string} Translate */

/** The tags of a new workspace and of the sample. @param {Translate} t @returns {Tag[]} */
export function defaultTags(t) {
  return [
    { key: 'cicd', label: t('sample.tags.cicd'), icon: 'git-branch' },
    { key: 'app', label: t('sample.tags.app'), icon: 'browser' },
    { key: 'monitoring', label: t('sample.tags.monitoring'), icon: 'gauge' },
    { key: 'logs', label: t('sample.tags.logs'), icon: 'list-magnifying-glass' },
    { key: 'quality', label: t('sample.tags.quality'), icon: 'check-square' },
    { key: 'tickets', label: t('sample.tags.tickets'), icon: 'kanban' },
    { key: 'docs', label: t('sample.tags.docs'), icon: 'book-open' },
    { key: 'archi', label: t('sample.tags.archi'), icon: 'sitemap' },
    { key: 'team', label: t('sample.tags.team'), icon: 'users-three' },
  ];
}

/**
 * @param {readonly string[]} keys
 * @returns {Env[]}
 */
const envs = (keys) => keys.map((key) => ({ key, label: key.toUpperCase() }));

/**
 * @param {string} key
 * @param {string} label
 * @param {MetaField['type']} [type]
 * @param {readonly string[]} [options]
 * @returns {MetaField}
 */
const field = (key, label, type = 'text', options = []) => ({ key, label, type, options });

/**
 * @param {() => string} makeId
 * @param {string} name
 * @param {string} tag
 * @param {'env' | 'global'} scope
 * @param {string} pattern
 * @returns {TemplateLink}
 */
const link = (makeId, name, tag, scope, pattern) => ({ id: makeId(), name, tag, scope, pattern });

/**
 * The sample.
 * @param {{ makeId: () => string, t: Translate }} input
 * @returns {WorkspaceData}
 */
export function buildSample({ makeId, t }) {
  const gocd = (/** @type {string} */ name) =>
    link(makeId, name, 'cicd', 'env', 'https://gocd.example.invalid/pipelines/{slug}-{env}');
  const sonar = () =>
    link(
      makeId,
      t('sample.links.sonar'),
      'quality',
      'global',
      'https://sonar.example.invalid/dashboard?id={slug}',
    );
  const git = (/** @type {string} */ group) =>
    link(
      makeId,
      t('sample.links.git'),
      'cicd',
      'global',
      `https://git.example.invalid/${group}/{slug}`,
    );
  const openshift = () =>
    link(
      makeId,
      t('sample.links.console'),
      'app',
      'env',
      'https://console.{meta.cluster}.example.invalid/k8s/ns/{meta.namespace}/deployments',
    );
  const grafana = () =>
    link(
      makeId,
      t('sample.links.grafana'),
      'monitoring',
      'env',
      'https://grafana.example.invalid/d/{slug}-{env}',
    );
  const kibana = () =>
    link(
      makeId,
      t('sample.links.kibana'),
      'logs',
      'env',
      'https://kibana.example.invalid/discover?ns={meta.namespace}',
    );

  /** @type {Template} */
  const webapp = {
    id: makeId(),
    name: 'webapp-spring',
    description: t('sample.templates.webapp'),
    envs: envs(['dev', 'test', 'uat', 'prod']),
    metaFields: [
      field('cluster', t('sample.meta.cluster'), 'mono'),
      field('namespace', t('sample.meta.namespace'), 'mono'),
      field('region', t('sample.meta.region'), 'select', [
        'eu-west-3',
        'eu-west-1',
        'eu-central-1',
      ]),
      field('owner', t('sample.meta.owner')),
      field('lastDeploy', t('sample.meta.lastDeploy'), 'date'),
    ],
    links: [
      gocd(t('sample.links.pipeline')),
      git('backoffice'),
      link(makeId, t('sample.links.appUrl'), 'app', 'env', 'https://{slug}-{env}.example.invalid'),
      openshift(),
      grafana(),
      link(
        makeId,
        t('sample.links.dynatrace'),
        'monitoring',
        'env',
        'https://dt.example.invalid/apps/{slug}?env={env}',
      ),
      kibana(),
      sonar(),
      link(
        makeId,
        t('sample.links.jira'),
        'tickets',
        'global',
        'https://jira.example.invalid/board?projectKey={jiraKey}',
      ),
    ],
    position: 0,
  };

  /** @type {Template} */
  const micro = {
    id: makeId(),
    name: 'microservice-node',
    description: t('sample.templates.micro'),
    envs: envs(['dev', 'rec', 'prod']),
    metaFields: [
      field('cluster', t('sample.meta.cluster'), 'mono'),
      field('namespace', t('sample.meta.namespace'), 'mono'),
      field('owner', t('sample.meta.owner')),
    ],
    links: [
      gocd(t('sample.links.pipeline')),
      git('api'),
      link(
        makeId,
        t('sample.links.swagger'),
        'app',
        'env',
        'https://{slug}-{env}.example.invalid/swagger-ui',
      ),
      openshift(),
      grafana(),
      kibana(),
      sonar(),
    ],
    position: 1,
  };

  /** @type {Template} */
  const batch = {
    id: makeId(),
    name: 'batch-java',
    description: t('sample.templates.batch'),
    envs: envs(['dev', 'test', 'prod']),
    metaFields: [
      field('controlM', t('sample.meta.controlM'), 'mono'),
      field('owner', t('sample.meta.owner')),
    ],
    links: [
      gocd(t('sample.links.pipeline')),
      git('batch'),
      link(
        makeId,
        t('sample.links.scheduler'),
        'app',
        'env',
        'https://scheduler.example.invalid/folder/{meta.controlM}?env={env}',
      ),
      link(
        makeId,
        t('sample.links.grafana'),
        'monitoring',
        'env',
        'https://grafana.example.invalid/d/batch/{slug}-{env}',
      ),
      link(
        makeId,
        t('sample.links.kibana'),
        'logs',
        'env',
        'https://kibana.example.invalid/discover?batch={slug}',
      ),
      sonar(),
    ],
    position: 2,
  };

  /** @type {Template} */
  const front = {
    id: makeId(),
    name: 'frontend-react',
    description: t('sample.templates.front'),
    envs: envs(['dev', 'test', 'prod']),
    metaFields: [
      field('cdn', t('sample.meta.cdn'), 'mono'),
      field('owner', t('sample.meta.owner')),
    ],
    links: [
      gocd(t('sample.links.pipeline')),
      git('web'),
      link(makeId, t('sample.links.appUrl'), 'app', 'env', 'https://{slug}-{env}.example.invalid'),
      link(
        makeId,
        t('sample.links.storybook'),
        'app',
        'env',
        'https://{slug}-{env}.example.invalid/storybook',
      ),
      link(
        makeId,
        t('sample.links.cdn'),
        'monitoring',
        'global',
        'https://cdn.example.invalid/distributions/{meta.cdn}',
      ),
      sonar(),
    ],
    position: 3,
  };

  /**
   * @param {string} name
   * @param {string} url
   * @param {string} tag
   * @returns {Extra}
   */
  const extra = (name, url, tag) => ({ id: makeId(), name, url, tag });

  /**
   * @param {Template} template
   * @param {Record<string, Record<string, string>>} values the metadata, by environment
   * @returns {App['envs']}
   */
  const envData = (template, values) =>
    Object.fromEntries(
      template.envs.map((env) => [env.key, { meta: values[env.key] ?? {}, overrides: {} }]),
    );

  /**
   * @param {{ name: string, slug: string, template: Template, jira: string, description: string,
   *   values: Record<string, Record<string, string>>, extras?: Extra[] }} spec
   * @returns {App}
   */
  const app = ({ name, slug, template, jira, description, values, extras = [] }) => ({
    id: makeId(),
    name,
    slug,
    templateId: template.id,
    jiraKey: jira,
    description,
    envs: envData(template, values),
    extras,
    position: 0,
  });

  /**
   * The same metadata in every environment of a template, with the cluster and the namespace named
   * after the environment.
   * @param {Template} template
   * @param {string} prefix
   * @param {string} owner
   * @param {Record<string, string>} [more]
   */
  const standard = (template, prefix, owner, more = {}) =>
    Object.fromEntries(
      template.envs.map((env) => [
        env.key,
        { cluster: `ocp-${env.key}-1`, namespace: `${prefix}-${env.key}`, owner, ...more },
      ]),
    );

  const apps = [
    app({
      name: 'AccountPortal',
      slug: 'account-portal',
      template: webapp,
      jira: 'ACC',
      description: t('sample.apps.accountPortal'),
      values: standard(webapp, 'acc', 'alice', { region: 'eu-west-3', lastDeploy: '2026-11-19' }),
      extras: [
        extra(t('sample.extras.wiki'), 'https://wiki.example.invalid/display/ACC', 'docs'),
        extra(
          t('sample.extras.openapi'),
          'https://git.example.invalid/backoffice/account-portal/openapi.yaml',
          'docs',
        ),
        extra(
          t('sample.extras.runbook'),
          'https://wiki.example.invalid/runbooks/account-portal',
          'docs',
        ),
        extra(t('sample.extras.c4'), 'https://architecture.example.invalid/workspace/acc', 'archi'),
        extra(t('sample.extras.chat'), 'https://chat.example.invalid/channels/acc', 'team'),
        extra(t('sample.extras.oncall'), 'https://oncall.example.invalid/teams/acc', 'team'),
      ],
    }),
    app({
      name: 'ProPortal',
      slug: 'pro-portal',
      template: webapp,
      jira: 'PRO',
      description: t('sample.apps.proPortal'),
      values: standard(webapp, 'pro', 'bruno', { region: 'eu-west-3', lastDeploy: '2026-11-18' }),
      extras: [
        extra(t('sample.extras.wiki'), 'https://wiki.example.invalid/display/PRO', 'docs'),
        extra(t('sample.extras.chat'), 'https://chat.example.invalid/channels/pro', 'team'),
      ],
    }),
    app({
      name: 'PaymentCore',
      slug: 'payment-core',
      template: micro,
      jira: 'PAY',
      description: t('sample.apps.paymentCore'),
      values: standard(micro, 'pay', 'chloe'),
      extras: [
        extra(t('sample.extras.audit'), 'https://wiki.example.invalid/display/PAY/audit', 'archi'),
      ],
    }),
    app({
      name: 'AuthGateway',
      slug: 'auth-gateway',
      template: micro,
      jira: 'AUTH',
      description: t('sample.apps.authGateway'),
      values: standard(micro, 'auth', 'david'),
      extras: [
        extra(t('sample.extras.wiki'), 'https://wiki.example.invalid/display/AUTH', 'docs'),
        extra(t('sample.extras.oncall'), 'https://oncall.example.invalid/teams/auth', 'team'),
      ],
    }),
    app({
      name: 'NotifService',
      slug: 'notif-service',
      template: micro,
      jira: 'NOTIF',
      description: t('sample.apps.notifService'),
      values: standard(micro, 'notif', 'erika'),
    }),
    app({
      name: 'CatalogApi',
      slug: 'catalog-api',
      template: micro,
      jira: 'CAT',
      description: t('sample.apps.catalogApi'),
      values: standard(micro, 'cat', 'fabrice'),
    }),
    app({
      name: 'FraudCheck',
      slug: 'fraud-check',
      template: micro,
      jira: 'FRAUD',
      description: t('sample.apps.fraudCheck'),
      values: standard(micro, 'fraud', 'georges'),
    }),
    app({
      name: 'ReportingHub',
      slug: 'reporting-hub',
      template: batch,
      jira: 'REPORT',
      description: t('sample.apps.reportingHub'),
      values: Object.fromEntries(
        batch.envs.map((env) => [
          env.key,
          { controlM: `REPORT_${env.key.toUpperCase()}`, owner: 'helena' },
        ]),
      ),
      extras: [
        extra(
          t('sample.extras.calendar'),
          'https://scheduler.example.invalid/calendar/report',
          'docs',
        ),
      ],
    }),
    app({
      name: 'ArchiveLegacy',
      slug: 'archive-legacy',
      template: batch,
      jira: 'ARCH',
      description: t('sample.apps.archiveLegacy'),
      values: Object.fromEntries(
        batch.envs.map((env) => [
          env.key,
          { controlM: `ARCH_${env.key.toUpperCase()}`, owner: 'ivan' },
        ]),
      ),
    }),
    app({
      name: 'HrBackoffice',
      slug: 'hr-backoffice',
      template: webapp,
      jira: 'HR',
      description: t('sample.apps.hrBackoffice'),
      // UAT is not filled in yet: its links show what is missing.
      values: {
        ...standard(webapp, 'hr', 'julie', { region: 'eu-west-3', lastDeploy: '2026-11-17' }),
        uat: {},
      },
      extras: [extra(t('sample.extras.wiki'), 'https://wiki.example.invalid/display/HR', 'docs')],
    }),
    app({
      name: 'OnboardingFlow',
      slug: 'onboarding-flow',
      template: front,
      jira: 'ONB',
      description: t('sample.apps.onboardingFlow'),
      values: Object.fromEntries(
        front.envs.map((env) => [env.key, { cdn: `d1onb${env.key}`, owner: 'karim' }]),
      ),
    }),
    app({
      name: 'SearchIndex',
      slug: 'search-index',
      template: micro,
      jira: 'SRCH',
      description: t('sample.apps.searchIndex'),
      values: standard(micro, 'search', 'lola'),
    }),
  ];

  /** @type {Settings} */
  const settings = {
    dashboardName: t('sample.name'),
    defaultAppId: apps[0]?.id ?? null,
    defaultEnv: 'last',
    tags: defaultTags(t),
  };

  return {
    settings,
    templates: [webapp, micro, batch, front],
    apps: renumber(apps),
  };
}

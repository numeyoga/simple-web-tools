import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

/** WCAG 2.0 A and AA, 2.1 AA and 2.2 AA: the conformance target of every app. */
export const WCAG_TAGS = Object.freeze(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);

/**
 * @typedef {object} A11yOptions
 * @property {string[]} [include] CSS selectors: only these subtrees are analyzed
 * @property {string[]} [exclude] CSS selectors left out of the analysis
 * @property {string[]} [tags] replaces {@link WCAG_TAGS}
 */

/**
 * Formats axe violations as one block per rule: id, impact, help text and failing targets.
 * @param {import('axe-core').Result[]} violations
 * @returns {string}
 */
export function formatViolations(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => `    - ${node.target.join(' ')}`).join('\n');
      return `${violation.id} (${violation.impact ?? 'no impact'}): ${violation.help}\n${targets}`;
    })
    .join('\n\n');
}

/**
 * Runs axe on the page and returns the violations.
 * @param {import('@playwright/test').Page} page
 * @param {A11yOptions} [options]
 * @returns {Promise<import('axe-core').Result[]>}
 */
export async function findA11yViolations(page, options = {}) {
  const builder = new AxeBuilder({ page }).withTags(options.tags ?? [...WCAG_TAGS]);
  for (const selector of options.include ?? []) builder.include(selector);
  for (const selector of options.exclude ?? []) builder.exclude(selector);
  return (await builder.analyze()).violations;
}

/**
 * Asserts that axe finds no WCAG violation. A failure lists each rule with its impact and
 * the selectors of the offending elements.
 * @param {import('@playwright/test').Page} page
 * @param {A11yOptions} [options]
 * @returns {Promise<void>}
 */
export async function expectNoA11yViolations(page, options = {}) {
  const violations = await findA11yViolations(page, options);
  expect(violations, formatViolations(violations)).toEqual([]);
}

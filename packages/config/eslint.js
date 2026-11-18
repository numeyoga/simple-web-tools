// Shared ESLint building blocks (flat config). Each helper returns one config object, so an
// app composes its own `eslint.config.js` from the file globs it actually has.
import js from '@eslint/js';
import globals from 'globals';

/** @typedef {import('eslint').Linter.Config} Config */

/** Project rules, applied to the files covered by `browserModule` and `node`. */
export const rules = /** @type {NonNullable<Config['rules']>} */ ({
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'prefer-const': 'error',
  'no-var': 'error',
});

/**
 * Ignores plus the `@eslint/js` recommended rules: put it first.
 * @param {string[]} [ignores] Globs to ignore, in addition to `node_modules/**`.
 * @returns {Config[]}
 */
export function base(ignores = []) {
  return [{ ignores: ['node_modules/**', ...ignores] }, js.configs.recommended];
}

/**
 * ES modules that run in the browser, with the project rules.
 * @param {string[]} files
 * @returns {Config}
 */
export function browserModule(files) {
  return {
    files,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2025 },
    },
    rules,
  };
}

/**
 * ES modules that run in Node.js, with the project rules.
 * @param {string[]} files
 * @returns {Config}
 */
export function node(files) {
  return {
    files,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2025 },
    },
    rules,
  };
}

/**
 * Adds the Node.js globals to files already covered by another preset (tool config files).
 * @param {string[]} files
 * @returns {Config}
 */
export function nodeGlobals(files) {
  return { files, languageOptions: { globals: { ...globals.node } } };
}

/**
 * Classic (non-module) script run by a service worker.
 * @param {string[]} files
 * @returns {Config}
 */
export function serviceWorker(files) {
  return {
    files,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
  };
}

/**
 * Classic (non-module) script loaded by a page.
 * @param {string[]} files
 * @returns {Config}
 */
export function classicScript(files) {
  return {
    files,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  };
}

/**
 * Test files, which may use both Node.js and browser globals.
 * @param {string[]} files
 * @returns {Config}
 */
export function tests(files) {
  return {
    files,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  };
}

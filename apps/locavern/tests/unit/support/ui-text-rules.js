// Two ESLint rules, run by the unit tests through the `Linter` API (so they need no plugin
// setup and read the real syntax tree, not a regular expression over the source):
//
// - `no-ui-literals`: a string literal with words in it, in a view, is a user-facing string
//   that skipped the catalogs (decision 0002). A literal is fine where it is technical: an
//   import path, an object key, the value of a class, role, type, id... property, the argument
//   of `el('div')`, `querySelector(...)`, `addEventListener(...)`, a comparison, a style value.
//   Whatever is left is listed, with its reason, in the allowlist of the test.
// - `collect-translation-keys`: records every key given to `t()`, `failure()` and
//   `new LocavernError()`, and every call whose key is not a plain string (a computed key cannot be checked against the catalogs).

import { Linter } from 'eslint';

/** Property names whose string value is a code, not text. */
const TECHNICAL_KEYS = new Set([
  'class',
  'className',
  'type',
  'role',
  'id',
  'name',
  'for',
  'htmlFor',
  'href',
  'variant',
  'ctaVariant',
  'size',
  'icon',
  'status',
  'weight',
  'mode',
  'value',
  'preset',
  'action',
  'tone',
  'scope',
  'colspan',
  'autocomplete',
  'accept',
  'rel',
  'target',
  'inputmode',
  'style',
  'weekday',
  'day',
  'month',
  'year',
  'hour',
  'minute',
  'dateStyle',
  'timeStyle',
]);

/** `aria-*` attributes that hold text for the user. Every other `aria-*` holds a code. */
const TEXT_ARIA = new Set([
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-placeholder',
  'aria-valuetext',
]);

/** Calls whose arguments (all of them, or the listed positions) are codes: tags, selectors... */
const TECHNICAL_CALLS = {
  el: [0],
  t: [0],
  createElement: '*',
  querySelector: '*',
  querySelectorAll: '*',
  closest: '*',
  matches: '*',
  getElementById: '*',
  getAttribute: '*',
  hasAttribute: '*',
  removeAttribute: '*',
  toggleAttribute: '*',
  setAttribute: [0],
  addEventListener: '*',
  removeEventListener: '*',
  matchMedia: '*',
  getComputedStyle: '*',
  escape: '*',
  hasOwnProperty: '*',
  getItem: '*',
  setItem: [0],
  removeItem: '*',
  add: '*',
  remove: '*',
  toggle: '*',
  contains: '*',
  includes: '*',
  split: '*',
  Set: '*',
  Event: '*',
  MouseEvent: '*',
  CustomEvent: '*',
  fieldId: '*',
  fieldGroupName: '*',
  icon: [0],
  withFocusKey: [1],
  projectName: [1],
  legendItem: [0, 1],
  recordAttendance: '*',
  weekdayName: [1],
  normalize: '*',
  startsWith: '*',
  endsWith: '*',
  // The key of a message of the catalogs, for an error or a failed result of the core.
  failure: [0],
  LocavernError: [0],
  errorText: [2],
  DOMException: [1],
  // The messages of the errors a developer reads are English (decision 0002), not interface text.
  Error: '*',
  TypeError: '*',
  RangeError: '*',
};

/** Attributes whose value is text for the user. */
const TEXT_ATTRIBUTES = new Set(['title', 'placeholder', 'alt', ...TEXT_ARIA]);

/** Assigned properties that hold a code. */
const TECHNICAL_ASSIGNED = new Set(['className', 'type', 'id', 'name', 'value']);

/** @param {any} node @returns {string | null} the name of a property key or a callee */
function nameOf(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal') return String(node.value);
  if (node.type === 'MemberExpression' && !node.computed) return nameOf(node.property);
  return null;
}

/**
 * Climbs out of the syntax that only carries a value to where it goes: the branches of a
 * conditional, a template, a default value, an array, a concatenation.
 * @param {any} node
 * @returns {{ parent: any, child: any }}
 */
function destination(node) {
  let child = node;
  let parent = node.parent;
  while (parent) {
    const carries =
      (parent.type === 'ConditionalExpression' && parent.test !== child) ||
      parent.type === 'LogicalExpression' ||
      parent.type === 'TemplateLiteral' ||
      parent.type === 'ArrayExpression' ||
      (parent.type === 'AssignmentPattern' && parent.right === child) ||
      (parent.type === 'BinaryExpression' && parent.operator === '+');
    if (!carries) break;
    child = parent;
    parent = parent.parent;
  }
  return { parent, child };
}

/** @param {any} node a Literal or a TemplateElement @returns {string} its text */
function textOf(node) {
  return node.type === 'TemplateElement' ? (node.value.cooked ?? '') : String(node.value);
}

/** @param {any} node whether a style or dataset object holds this node */
function insideStyle(node) {
  for (let up = node.parent; up; up = up.parent) {
    if (up.type === 'Property' && ['style', 'dataset'].includes(nameOf(up.key) ?? '')) return true;
  }
  return false;
}

/** Property names whose string value is a text for the user, even when it is one lowercase word. */
const TEXT_KEYS = new Set([
  'label',
  'title',
  'text',
  'message',
  'body',
  'hint',
  'description',
  'placeholder',
  'tooltip',
  'heading',
  'caption',
  'summary',
  'confirmLabel',
  'emptyText',
  'textContent',
  'innerText',
  'alt',
]);

/** Calls whose arguments are texts for the user. */
const TEXT_CALLS = new Set(['createTextNode', 'append', 'prepend', 'setTooltip', 'notify']);

/**
 * Whether a node is where a text for the user goes: the value of a text property, an assignment to
 * `textContent`, a text node. Anywhere else a lowercase token is a code.
 * @param {any} node
 */
function isTextSink(node) {
  const { parent, child } = destination(node);
  if (parent?.type === 'Property') return TEXT_KEYS.has(nameOf(parent.key) ?? '');
  if (parent?.type === 'AssignmentExpression' && parent.right === child) {
    return (
      parent.left.type === 'MemberExpression' && TEXT_KEYS.has(nameOf(parent.left.property) ?? '')
    );
  }
  if (parent?.type === 'CallExpression') {
    const callee = nameOf(parent.callee) ?? '';
    if (TEXT_CALLS.has(callee)) return true;
    return callee === 'setAttribute' && parent.arguments.indexOf(child) === 1;
  }
  return false;
}

/**
 * @param {any} node a Literal or a TemplateElement
 * @returns {boolean} whether it sits where a code goes, not a text
 */
function isTechnical(node) {
  if (insideStyle(node)) return true;
  const text = textOf(node);
  if (
    (looksLikeToken(text) ||
      looksLikeCode(text) ||
      looksLikeSelector(text) ||
      looksLikeMarkup(text) ||
      looksLikeConstant(text) ||
      looksLikeMime(text)) &&
    !isTextSink(node)
  ) {
    return true;
  }
  const { parent, child } = destination(node);
  switch (parent?.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
    case 'ImportExpression':
    case 'SwitchCase':
      return true;
    case 'BinaryExpression':
      return ['===', '!==', '==', '!=', 'in', 'instanceof'].includes(parent.operator);
    case 'MemberExpression':
      return parent.computed && parent.property === child;
    case 'Property': {
      if (parent.key === child && !parent.computed) return true;
      const key = nameOf(parent.key) ?? '';
      return TECHNICAL_KEYS.has(key) || key.startsWith('data-') || isTechnicalAria(key);
    }
    case 'AssignmentExpression': {
      if (parent.right !== child) return false;
      if (parent.left.type === 'Identifier') return looksLikeCode(textOf(node));
      if (parent.left.type !== 'MemberExpression') return false;
      for (let up = parent.left; up?.type === 'MemberExpression'; up = up.object) {
        if (['style', 'dataset'].includes(nameOf(up.property) ?? '')) return true;
      }
      return TECHNICAL_ASSIGNED.has(nameOf(parent.left.property) ?? '');
    }
    case 'VariableDeclarator':
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return looksLikeCode(textOf(node));
    case 'CallExpression':
    case 'NewExpression': {
      if (parent.callee === child) return false;
      const callee = nameOf(parent.callee) ?? '';
      if (parent.callee.type === 'MemberExpression' && nameOf(parent.callee.object) === 'console') {
        return true;
      }
      const index = parent.arguments.indexOf(child);
      // The value of an attribute is a code, unless the attribute holds text.
      if (callee === 'setAttribute' && index === 1) {
        const name = parent.arguments[0];
        return name?.type === 'Literal' && !TEXT_ATTRIBUTES.has(String(name.value));
      }
      const positions = /** @type {Record<string, '*' | number[]>} */ (TECHNICAL_CALLS)[callee];
      return positions === '*' || !!positions?.includes(index);
    }
    default:
      return false;
  }
}

/** @param {string} key */
const isTechnicalAria = (key) => key.startsWith('aria-') && !TEXT_ARIA.has(key);

/**
 * A code that is not text for the user: a lowercase token (`running`), or tokens of a class
 * list (`ph-bold ph-x`). It passes where a value goes into a variable, a default parameter or
 * a non-text property, never as an argument or a child: a lowercase word kept in a variable
 * (`const word = ok ? 'en cours' : 'en pause'`) is still reported, because it has two words.
 * The gap: a lowercase one-word text kept in a variable.
 * @param {string} text
 */
function looksLikeCode(text) {
  const tokens = text.trim().split(/\s+/);
  return (
    tokens.every((token) => /^[a-z0-9_-]+$/.test(token)) &&
    (tokens.length === 1 || tokens.every((token) => /[-_0-9]/.test(token)))
  );
}

/**
 * A code that is one word starting lowercase, with no space (`edit`, `cmd-menu`, `text/plain`, `-input`,
 * `delete_project`, `px`). It is a code wherever it goes but a text sink (`isTextSink`).
 * @param {string} text
 */
function looksLikeToken(text) {
  return /^[-_:./#@]*[a-z0-9][A-Za-z0-9_:./#@-]*$/.test(text);
}

/** A piece of SVG or XML source: `<rect x="`, `" height="`, `</tspan>`, `&amp;`. @param {string} text */
const looksLikeMarkup = (text) => /^&|<\/?[a-z?]|\/>|="/.test(text);

/** A piece of a CSS selector: `[data-id="`, `#btn-save`, `.cv-badge`. @param {string} text */
const looksLikeSelector = (text) => /^[[#.][A-Za-z_-]|^[a-z]+\[/.test(text);

/**
 * An uppercase constant or protocol field, with no space: `COMPLETED`, `SHA-256`,
 * `BEGIN:VCALENDAR`, `DTSTART;VALUE=DATE:`, `UID:locavern-task-`.
 * @param {string} text
 */
const looksLikeConstant = (text) =>
  /^[A-Z][A-Z0-9_.-]+$/.test(text) || /^[A-Z][A-Z0-9_-]*[:;=]\S*$/.test(text);

/** A media type or a list of them: `image/svg+xml`, `text/calendar;charset=utf-8`. @param {string} text */
const looksLikeMime = (text) =>
  /^[a-z]+\/[a-z0-9.+-]+(;[\w=-]+)?(,[a-z]+\/[a-z0-9.+-]+)*$/.test(text);

/** @param {string} text whether it has a word in it (two letters in a row) */
const hasWords = (text) => /\p{L}{2,}/u.test(text);

/**
 * @typedef {object} Allowed
 * @property {string} file base name of the file
 * @property {string} text the exact text of the literal
 * @property {string} why
 */

/** @type {any} */
export const noUiLiterals = {
  meta: { type: 'problem', schema: [{ type: 'object' }] },
  create(/** @type {any} */ context) {
    const file = String(context.filename).split('/').pop();
    const allowed = /** @type {Allowed[]} */ (context.options[0]?.allow ?? []);
    /** @param {any} node @param {string} text */
    function check(node, text) {
      if (!hasWords(text) || isTechnical(node)) return;
      if (allowed.some((entry) => entry.file === file && entry.text === text)) return;
      context.report({ node, message: `UI text outside the catalogs: ${JSON.stringify(text)}` });
    }
    return {
      Literal(/** @type {any} */ node) {
        if (typeof node.value === 'string' && node.parent.type !== 'ExpressionStatement') {
          check(node, node.value);
        }
      },
      TemplateElement(/** @type {any} */ node) {
        check(node, node.value.cooked ?? '');
      },
    };
  },
};

/** The calls whose first argument is a key of the catalogs. */
const KEY_CALLS = new Map([
  ['t', 0],
  ['failure', 0],
  ['LocavernError', 0],
  // `errorText(error, t, fallbackKey)`: the key of the message when the error has none.
  ['errorText', 2],
]);

/** What the last `translationKeys` call found (ESLint copies a rule's options: no sink there). */
const found = { keys: /** @type {string[]} */ ([]), dynamic: /** @type {string[]} */ ([]) };

/** @type {any} */
export const collectTranslationKeys = {
  meta: { type: 'problem', schema: [{ type: 'object' }] },
  create(/** @type {any} */ context) {
    /** @param {any} node */
    function collect(node) {
      const callee = nameOf(node.callee);
      if (!callee || !KEY_CALLS.has(callee)) return;
      const first = node.arguments[KEY_CALLS.get(callee) ?? 0];
      if (first?.type === 'Literal' && typeof first.value === 'string')
        found.keys.push(first.value);
      else found.dynamic.push(`${context.filename}:${node.loc.start.line}`);
    }
    return { CallExpression: collect, NewExpression: collect };
  },
};

/**
 * The keys a source text gives to `t()`, `failure()` and `new LocavernError()`, and the calls whose key is not a plain
 * string (a computed key cannot be checked against the catalogs).
 * @param {string} code
 * @param {string} path
 * @returns {{ keys: string[], dynamic: string[], problems: string[] }}
 */
export function translationKeys(code, path) {
  found.keys = [];
  found.dynamic = [];
  const problems = lint('collect-translation-keys', code, path);
  return { keys: found.keys, dynamic: found.dynamic, problems };
}

/**
 * Runs one rule over a source text.
 * @param {string} rule `no-ui-literals` or `collect-translation-keys`
 * @param {string} code
 * @param {string} path
 * @param {object} options the rule's options
 * @returns {string[]} the messages
 */
export function lint(rule, code, path, options = {}) {
  // A path relative to the test (`../../src/x.js`) is outside the configuration's base.
  const filename = path.replace(/^(\.\.\/)+/, '');
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(
    code,
    [
      {
        files: ['**/*.js'],
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        plugins: {
          local: {
            rules: {
              'no-ui-literals': noUiLiterals,
              'collect-translation-keys': collectTranslationKeys,
            },
          },
        },
        rules: { [`local/${rule}`]: ['error', options] },
      },
    ],
    { filename },
  );
  return messages.map((m) => `${filename}:${m.line} ${m.message}`);
}

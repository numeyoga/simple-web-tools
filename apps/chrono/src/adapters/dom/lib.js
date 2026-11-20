// Small DOM helpers (el, mount, icon, fieldId) and formatting. No framework, no dependencies.
// The pure computations (durations, presence, dates) live in src/core; this module only
// supplies the current time to them, as the legacy lib.js did.

import {
  formatLocalDate as coreFormatLocalDate,
  formatDuration,
  startOfDay as coreStartOfDay,
} from '../../core/dates.js';
import {
  presenceDuration as corePresenceDuration,
  liveDuration as coreLiveDuration,
  presenceRanges as corePresenceRanges,
} from '../../core/presence.js';
import { uid } from '../ids.js';

/** @typedef {import('./types.js').Child} Child */
/** @typedef {import('./types.js').Props} Props */
/** @typedef {import('../../types.js').Project} Project */
/** @typedef {import('../../types.js').Session} Session */
/** @typedef {import('../../types.js').AttendanceEvent} AttendanceEvent */

// Properties that would parse a string as HTML: el() refuses them.
const HTML_PROPS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

/* ------------------------------------------------------------------ */
/* Ergonomic DOM element builder. Usage:
     el('div', { class: 'card', style: { width: 120 }, onclick: fn },
        el('h2', null, 'Title'),
        'plain text',
        items.map(i => el('li', null, i.label))
     )
   A number in `style` is a length in px at the standard text scale and is written in rem
   (`width: 120` gives `7.5rem`), so every size follows the text size of the user. */
/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Props} [props] attributes, properties, `style`, `dataset` and `on...` handlers
 * @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (HTML_PROPS.has(k)) {
        throw new Error(`el(): '${k}' would parse HTML; build children instead`);
      }
      if (k === 'style' && typeof v === 'object') {
        const style = /** @type {Record<string, unknown>} */ (v);
        for (const sk in style) {
          const sv = style[sk];
          if (sv == null || sv === false) continue;
          // A CSS property assigned by name: the style object has no index signature.
          /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node.style))[sk] =
            typeof sv === 'number' && !UNITLESS.has(sk) ? `${sv / 16}rem` : sv;
        }
      } else if (k === 'class' || k === 'className') {
        node.className = String(v);
      } else if (k === 'dataset') {
        Object.assign(node.dataset, v);
      } else if (k === 'ref' && typeof v === 'function') {
        v(node);
      } else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), /** @type {EventListener} */ (v));
      } else if (
        k in node &&
        typeof (/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node))[k]) !==
          'object' &&
        k !== 'list'
      ) {
        try {
          /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (node))[k] = v;
        } catch {
          node.setAttribute(k, String(v));
        }
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  appendChildren(node, children);
  return node;
}

const UNITLESS = new Set([
  'opacity',
  'zIndex',
  'fontWeight',
  'flex',
  'flexGrow',
  'flexShrink',
  'lineHeight',
  'order',
  'zoom',
]);

/**
 * @param {Element} node
 * @param {Child[]} children
 */
export function appendChildren(node, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) {
      appendChildren(node, c);
      continue;
    }
    // append() inserts a string as a Text node, never as HTML. CodeQL does not see the
    // instanceof guard of the previous form and reported js/xss-through-dom here.
    node.append(c instanceof Node ? c : String(c));
  }
}

/* Replaces the content of a node with a new node (used by the views). */
/**
 * @param {Element} host
 * @param {Node} node
 */
export function mount(host, node) {
  host.replaceChildren(node);
}

/* Phosphor icon, as in the Icons page of the skill: regular, or bold for one level of emphasis
   (the package ships no other weight). `className` adds app classes (a colour role, a size). */
/**
 * @param {string} name
 * @param {{ weight?: 'regular' | 'bold', className?: string }} [opts]
 */
export function icon(name, opts = {}) {
  const base = opts.weight === 'bold' ? 'ph-bold' : 'ph';
  return el('i', {
    class: `${base} ph-${name} cv-icon${opts.className ? ' ' + opts.className : ''}`,
    'aria-hidden': 'true',
  });
}

/* ------------------------------------------------------------------ */
/* Project colours: Covenant draws them from `data-cat` (see CategoryColor.md of the skill). */

/**
 * Gives an element the colour of a project: its category (`data-cat`), or its free colour
 * through `Covenant.setCategory`, which derives the marker and the fill and keeps the label at
 * 4.5:1. The element and its children then use the `cv-cat-*` recipes. Without a project, or
 * without a colour, nothing is set and Covenant's default (slate) applies.
 * @template {HTMLElement} T
 * @param {T} node
 * @param {Pick<Project, 'category' | 'customColor'> | null | undefined} project
 * @returns {T}
 */
export function setProjectColor(node, project) {
  if (project?.category) node.dataset.cat = String(project.category);
  else if (project?.customColor) window.Covenant?.setCategory?.(node, project.customColor);
  return node;
}

/**
 * The name of a project after its dot: the marker recipe of lists and legends. The name is
 * always written next to the colour, which never carries meaning alone.
 * @param {Pick<Project, 'name' | 'category' | 'customColor'>} project
 * @param {string} [className] added to the name
 * @returns {HTMLElement}
 */
export function projectName(project, className = '') {
  return setProjectColor(
    el(
      'span',
      { class: 'cv-cat-name' },
      el('span', { class: 'cv-cat-dot', 'aria-hidden': 'true' }),
      el('span', { class: `ch-ellipsis${className ? ' ' + className : ''}` }, project.name),
    ),
    project,
  );
}

let fieldCounter = 0;
/**
 * A unique id for a label, a hint or an error, so that `for`, `aria-describedby` and
 * `aria-labelledby` can point at it.
 * @param {string} [prefix]
 */
export function fieldId(prefix = 'ch-field') {
  fieldCounter += 1;
  return `${prefix}-${fieldCounter}`;
}

/* ------------------------------------------------------------------ */
/* Formatting of durations / times / days                             */

export { formatDuration };

/** @param {number} ts */
export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** @param {Date | number} [d] */
export function startOfDay(d = new Date()) {
  return coreStartOfDay(d);
}

/* Live duration of a session: adds the time since lastStart when it is running. */
/** @param {Session | null | undefined} session */
export function liveDuration(session) {
  return coreLiveDuration(session, Date.now());
}

/* Presence ranges of a day from its attendance events. */
/**
 * @param {Pick<AttendanceEvent, 'type' | 'at'>[] | null | undefined} events
 * @param {number} [now]
 */
export function presenceRanges(events, now = Date.now()) {
  return corePresenceRanges(events, now);
}

/* Presence duration of a day. */
/**
 * @param {Pick<AttendanceEvent, 'type' | 'at'>[] | null | undefined} events
 * @param {number} [now]
 */
export function presenceDuration(events, now = Date.now()) {
  return corePresenceDuration(events, now);
}

/* Local date in YYYY-MM-DD format. */
/** @param {Date | number} [d] */
export function formatLocalDate(d = new Date()) {
  return coreFormatLocalDate(d);
}

export { uid };

/**
 * A timestamp as the value of a `datetime-local` field (local time, minutes).
 * @param {number} ts
 */
export function timestampToLocal(ts) {
  const d = new Date(ts);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The timestamp of the value of a `datetime-local` field; null when it is empty or invalid.
 * @param {string} v
 * @returns {number | null}
 */
export function localToTimestamp(v) {
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}

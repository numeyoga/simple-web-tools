// Small DOM helpers (el, mount, icon) and formatting. No framework, no dependencies.
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

// Properties that would parse a string as HTML: el() refuses them.
const HTML_PROPS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

/* ------------------------------------------------------------------ */
/* Ergonomic DOM element builder. Usage:
     el('div', { class: 'card', style: { padding: 12 }, onclick: fn },
        el('h2', null, 'Title'),
        'plain text',
        items.map(i => el('li', null, i.label))
     )
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
        for (const sk in v) {
          const sv = v[sk];
          if (sv == null || sv === false) continue;
          node.style[sk] = typeof sv === 'number' && !UNITLESS.has(sk) ? sv + 'px' : sv;
        }
      } else if (k === 'class' || k === 'className') {
        node.className = v;
      } else if (k === 'dataset') {
        Object.assign(node.dataset, v);
      } else if (k === 'ref' && typeof v === 'function') {
        v(node);
      } else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k in node && typeof node[k] !== 'object' && k !== 'list') {
        try {
          node[k] = v;
        } catch {
          node.setAttribute(k, v);
        }
      } else {
        node.setAttribute(k, v);
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

function appendChildren(node, children) {
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
export function mount(host, node) {
  host.replaceChildren(node);
}

/* Phosphor icon: shortcut. */
export function icon(name, opts = {}) {
  const weight = opts.weight ? '-' + opts.weight : '';
  return el('i', {
    class: `ph${weight} ph-${name}`,
    style: { fontSize: opts.size || 16, ...(opts.style || {}) },
    'aria-hidden': 'true',
  });
}

/* ------------------------------------------------------------------ */
/* Formatting of durations / times / days                             */

export { formatDuration };

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function startOfDay(d = new Date()) {
  return coreStartOfDay(d);
}

/* Live duration of a session: adds the time since lastStart when it is running. */
export function liveDuration(session) {
  return coreLiveDuration(session, Date.now());
}

/* Presence ranges of a day from its attendance events. */
export function presenceRanges(events, now = Date.now()) {
  return corePresenceRanges(events, now);
}

/* Presence duration of a day. */
export function presenceDuration(events, now = Date.now()) {
  return corePresenceDuration(events, now);
}

/* Local date in YYYY-MM-DD format. */
export function formatLocalDate(d = new Date()) {
  return coreFormatLocalDate(d);
}

export { uid };

// Petites aides DOM (el, mount, icon) et formatage. Pas de framework, pas de dépendances.
// Les calculs purs (durées, présence, dates) vivent dans src/core ; ce module ne fait que
// leur fournir l'heure courante, comme le faisait l'ancien lib.js.

import {
  fmtDateISO as coreFmtDateISO,
  fmtDuree,
  startOfDay as coreStartOfDay,
} from '../../core/dates.js';
import {
  dureePresence as coreDureePresence,
  dureeVivante as coreDureeVivante,
  plagesPresence as corePlagesPresence,
} from '../../core/presence.js';
import { uid } from '../ids.js';

// Properties that would parse a string as HTML: el() refuses them.
const HTML_PROPS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);

/* ------------------------------------------------------------------ */
/* Constructeur d'éléments DOM ergonomique. Utilisation :
     el('div', { class: 'card', style: { padding: 12 }, onclick: fn },
        el('h2', null, 'Titre'),
        'texte brut',
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

/* Remplace le contenu d'un noeud par un nouveau noeud (utilisé par les vues). */
export function mount(host, node) {
  host.replaceChildren(node);
}

/* Icone Phosphor — raccourci. */
export function icon(name, opts = {}) {
  const weight = opts.weight ? '-' + opts.weight : '';
  return el('i', {
    class: `ph${weight} ph-${name}`,
    style: { fontSize: opts.size || 16, ...(opts.style || {}) },
    'aria-hidden': 'true',
  });
}

/* ------------------------------------------------------------------ */
/* Formatage durée / heure / jour                                     */

export { fmtDuree };

export function fmtHeure(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function startOfDay(d = new Date()) {
  return coreStartOfDay(d);
}

/* Durée vivante d'une session : ajoute le delta depuis dernierDebut si en cours. */
export function dureeVivante(session) {
  return coreDureeVivante(session, Date.now());
}

/* Plages de présence d'une journée à partir des pointages. */
export function plagesPresence(events, now = Date.now()) {
  return corePlagesPresence(events, now);
}

/* Durée de présence d'une journée. */
export function dureePresence(events, now = Date.now()) {
  return coreDureePresence(events, now);
}

/* Date locale au format AAAA-MM-JJ. */
export function fmtDateISO(d = new Date()) {
  return coreFmtDateISO(d);
}

export { uid };

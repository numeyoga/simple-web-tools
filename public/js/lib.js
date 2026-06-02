// js/lib.js — petites aides DOM + formatage.
// Pas de framework, pas de dépendances.

/* ------------------------------------------------------------------ */
/* Constructeur d'éléments DOM ergonomique. Utilisation :
     el('div', { class: 'card', style: { padding: 12 }, onclick: fn },
        el('h2', null, 'Titre'),
        'texte brut',
        items.map(i => el('li', null, i.label))
     )
*/
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
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
      } else if (k === 'html') {
        node.innerHTML = v;
      } else if (k === 'ref' && typeof v === 'function') {
        v(node);
      } else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k in node && typeof node[k] !== 'object' && k !== 'list') {
        try { node[k] = v; } catch { node.setAttribute(k, v); }
      } else {
        node.setAttribute(k, v);
      }
    }
  }
  appendChildren(node, children);
  return node;
}

const UNITLESS = new Set([
  'opacity','zIndex','fontWeight','flex','flexGrow','flexShrink','lineHeight','order','zoom'
]);

function appendChildren(node, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) { appendChildren(node, c); continue; }
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/* Remplace le contenu d'un noeud par un nouveau noeud (utilisé par les vues). */
function mount(host, node) {
  host.replaceChildren(node);
}

/* Icone Phosphor — raccourci. */
function icon(name, opts = {}) {
  const weight = opts.weight ? '-' + opts.weight : '';
  return el('i', {
    class: `ph${weight} ph-${name}`,
    style: { fontSize: opts.size || 16, ...(opts.style || {}) },
    'aria-hidden': 'true',
  });
}

/* ------------------------------------------------------------------ */
/* Formatage durée / heure / jour                                     */

function fmtDuree(ms, opts = {}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (opts.withSeconds) {
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  if (opts.compact) {
    if (h === 0 && m === 0) return `${s}s`;
    if (h === 0) return `${m}m`;
    return `${h}h${String(m).padStart(2,'0')}`;
  }
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function fmtHeure(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/* Durée vivante d'une session : ajoute le delta depuis dernierDebut si en cours. */
function dureeVivante(session) {
  if (!session) return 0;
  if (session.statut === 'en_cours' && session.dernierDebut) {
    return (session.duree || 0) + (Date.now() - session.dernierDebut);
  }
  return session.duree || 0;
}

/* Durée de présence d'une journée à partir des pointages (arrivée/pauses/départ).
   Parcourt les évènements triés et additionne les plages « présent ».
   Si la journée n'est pas clôturée, ajoute le temps jusqu'à `now`. */
function dureePresence(events, now = Date.now()) {
  const evs = (events || []).slice().sort((a, b) => a.at - b.at);
  let total = 0;
  let openAt = null;
  for (const e of evs) {
    if (e.type === 'arrivee' || e.type === 'pause_fin') {
      if (openAt == null) openAt = e.at;
    } else if (e.type === 'pause_debut' || e.type === 'depart') {
      if (openAt != null) { total += Math.max(0, e.at - openAt); openAt = null; }
    }
  }
  if (openAt != null) total += Math.max(0, now - openAt);
  return total;
}

/* ------------------------------------------------------------------ */
/* Id court                                                            */
function uid(p = '') { return p + Math.random().toString(36).slice(2, 9); }

window.UI = Object.assign(window.UI || {}, { el, mount, icon, fmtDuree, fmtHeure, startOfDay, dureeVivante, dureePresence, uid });

// DOM helpers and formatting. The element builder (el, mount, icon, fieldId) is
// `@simple-web-tools/dom`, re-exported here so that the views get it with the rest from `UI`.
// The pure computations (durations, presence, dates) live in src/core; this module only
// supplies the current time to them, as the legacy lib.js did.

import {
  formatLocalDate as coreFormatLocalDate,
  startOfDay as coreStartOfDay,
} from '../../core/dates.js';
import { createFormatters } from '../../core/format.js';
import {
  presenceDuration as corePresenceDuration,
  liveDuration as coreLiveDuration,
  presenceRanges as corePresenceRanges,
} from '../../core/presence.js';
import { i18n } from '../i18n.js';
import { uid } from '../ids.js';
import {
  appendChildren,
  createTNodes,
  el,
  fieldId,
  icon,
  initCovenant,
  mount,
} from '@simple-web-tools/dom';

export { appendChildren, el, fieldId, icon, initCovenant, mount };

/** @typedef {import('../../types.js').Project} Project */
/** @typedef {import('../../types.js').Session} Session */
/** @typedef {import('../../types.js').AttendanceEvent} AttendanceEvent */

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

/* ------------------------------------------------------------------ */
/* Text and formatting, in the language of the interface (adapters/i18n.js)  */

export const t = i18n.t;
export const formatNumber = i18n.formatNumber;

/**
 * A message with DOM nodes in place of some of its placeholders (`{key}` holds a `<kbd>`, a
 * styled figure...). The translator writes the sentence, so a language can move the node.
 */
export const tNodes = createTNodes(t);

const formatters = createFormatters(i18n);
export const {
  formatDuration,
  formatTime,
  formatHour,
  formatDay,
  formatIsoDate,
  capitalize,
  weekdayName,
} = formatters;

/** The language of the interface, for `localeCompare` and the like. */
export const locale = i18n.locale;

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

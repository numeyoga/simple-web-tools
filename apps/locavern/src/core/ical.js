/** @import { Project, Task, TaskPriority, TaskStatusConfig } from '../types.d.ts' */

import { parseIsoDate, parseTimeHhMm, shiftIsoDate } from './dates.js';
import {
  DEFAULT_TASK_STATUSES,
  getTaskStatusMeta,
  isInitialTaskStatus,
  isTerminalTaskStatus,
} from './model.js';
import { extractRichTextPlainText } from './search.js';

const utf8Encoder = new TextEncoder();

/** @type {Readonly<Record<TaskPriority, { label: string; icsPriority: number }>>} */
const PRIORITY_INFO = {
  high: { label: 'Haute', icsPriority: 1 },
  medium: { label: 'Moyenne', icsPriority: 5 },
  low: { label: 'Basse', icsPriority: 9 },
};

/**
 * Escape RFC 5545 TEXT values (\, ;, ,, and line breaks).
 * @param {string} raw
 * @returns {string}
 */
export function escapeIcsText(raw) {
  return String(raw)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Fold an RFC 5545 content line at 75 UTF-8 octets without splitting multi-byte characters.
 * @param {string} line
 * @returns {string}
 */
export function foldIcsLine(line) {
  if (utf8Encoder.encode(line).length <= 75) {
    return line;
  }

  /** @type {string[]} */
  const segments = [];
  let current = '';
  let currentBytes = 0;
  let maxBytes = 75;

  for (const ch of line) {
    const chBytes = utf8Encoder.encode(ch).length;
    if (currentBytes + chBytes > maxBytes && current.length > 0) {
      segments.push(current);
      current = ` ${ch}`;
      currentBytes = 1 + chBytes;
      maxBytes = 75;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments.join('\r\n');
}

/**
 * Format YYYY-MM-DD as RFC 5545 DATE (YYYYMMDD).
 * @param {string} isoDate
 * @returns {string}
 */
export function formatIcsDateValue(isoDate) {
  return isoDate.replace(/-/g, '');
}

/**
 * Format an ISO timestamp (or fallback) as RFC 5545 UTC DATE-TIME (YYYYMMDDTHHMMSSZ).
 * @param {string | null | undefined} isoTimestamp
 * @param {string} [fallbackIso]
 * @returns {string}
 */
export function formatIcsUtcStamp(isoTimestamp, fallbackIso = '2026-11-15T00:00:00.000Z') {
  const parsed = isoTimestamp ? new Date(isoTimestamp) : new Date(fallbackIso);
  const date = Number.isNaN(parsed.getTime()) ? new Date(fallbackIso) : parsed;
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

/**
 * Map internal task status id and role to RFC 5545 VEVENT STATUS.
 * @param {string | null} status
 * @param {readonly TaskStatusConfig[]} [statuses]
 * @returns {'COMPLETED' | 'CONFIRMED' | 'TENTATIVE'}
 */
function mapTaskStatusToIcs(status, statuses = DEFAULT_TASK_STATUSES) {
  if (isTerminalTaskStatus(status, statuses) || status === 'done') return 'COMPLETED';
  if (isInitialTaskStatus(status, statuses)) return 'TENTATIVE';
  if (status === 'in_progress') return 'CONFIRMED';
  return status ? 'CONFIRMED' : 'TENTATIVE';
}

/**
 * Sanitize a Locavern entity ID into an RFC-safe UID local part.
 * @param {string} id
 * @returns {string}
 */
function toSafeUidPart(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Build a readable plain-text description block for a task event.
 * @param {Task} task
 * @param {readonly TaskStatusConfig[]} [statuses]
 * @param {string | null} [projectName]
 * @returns {string}
 */
function buildTaskDescription(task, statuses, projectName) {
  const statusMeta = getTaskStatusMeta(task.status, statuses);
  const prioMeta = PRIORITY_INFO[task.priority] ?? PRIORITY_INFO.medium;
  /** @type {string[]} */
  const sections = [];

  const metaParts = [`Statut : ${statusMeta.label}`, `Priorité : ${prioMeta.label}`];
  if (projectName) metaParts.unshift(`Projet : ${projectName}`);
  sections.push(metaParts.join(' · '));

  const bodyText = extractRichTextPlainText(task.descriptionDoc);
  if (bodyText) {
    sections.push(bodyText);
  }

  if (task.checklist.length > 0) {
    const items = task.checklist.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`);
    sections.push(`Sous-tâches :\n${items.join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Build an RFC 5545 iCalendar (.ics) string for all dated non-archived tasks in the input list.
 * Tasks without a valid `dueDate` are excluded.
 *
 * @param {readonly Task[]} tasks
 * @param {readonly Project[]} projects
 * @param {{
 *   calName?: string;
 *   statuses?: readonly TaskStatusConfig[];
 *   now?: string;
 * }} [opts]
 * @returns {{ icsContent: string; exportedCount: number }}
 */
export function buildTasksIcsCalendar(tasks, projects, opts = {}) {
  const calName = opts.calName ?? 'Locavern — Échéances';
  const nowIso = opts.now ?? new Date().toISOString();
  const statuses = opts.statuses ?? DEFAULT_TASK_STATUSES;
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  /** @type {Task[]} */
  const datedTasks = [];
  for (const task of tasks) {
    if (task.archived) continue;
    const parent = projectsById.get(task.projectId);
    if (parent?.archived) continue;
    if (task.dueDate && parseIsoDate(task.dueDate)) {
      datedTasks.push(task);
    }
  }

  datedTasks.sort((a, b) => {
    const cmpDate = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    if (cmpDate !== 0) return cmpDate;
    const cmpTime = (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
    if (cmpTime !== 0) return cmpTime;
    return a.title.localeCompare(b.title, 'fr');
  });

  /** @type {string[]} */
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Locavern//Locavern PWA//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
  ];

  for (const task of datedTasks) {
    const dueDate = /** @type {string} */ (task.dueDate);
    const timeParts = parseTimeHhMm(task.dueTime);
    const nextDate = shiftIsoDate(dueDate, 1);
    const project = projectsById.get(task.projectId);
    const projectName = project?.name ?? null;
    const prioInfo = PRIORITY_INFO[task.priority] ?? PRIORITY_INFO.medium;
    const dtStamp = formatIcsUtcStamp(task.updatedAt || nowIso, nowIso);
    const description = buildTaskDescription(task, statuses, projectName);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:locavern-task-${toSafeUidPart(task.id)}@locavern.local`);
    lines.push(`DTSTAMP:${dtStamp}`);
    if (timeParts) {
      const startDateCompact = formatIcsDateValue(dueDate);
      const hh = String(timeParts.hour).padStart(2, '0');
      const mm = String(timeParts.minute).padStart(2, '0');
      const endTotalMinutes = timeParts.hour * 60 + timeParts.minute + 60;
      const endDateCompact =
        endTotalMinutes >= 1440 ? formatIcsDateValue(nextDate) : startDateCompact;
      const clampedMinutes = endTotalMinutes % 1440;
      const endHh = String(Math.floor(clampedMinutes / 60)).padStart(2, '0');
      const endMm = String(clampedMinutes % 60).padStart(2, '0');
      lines.push(`DTSTART:${startDateCompact}T${hh}${mm}00`);
      lines.push(`DTEND:${endDateCompact}T${endHh}${endMm}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDateValue(dueDate)}`);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDateValue(nextDate)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(task.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    lines.push(`STATUS:${mapTaskStatusToIcs(task.status, statuses)}`);
    lines.push(`PRIORITY:${prioInfo.icsPriority}`);
    if (projectName) {
      lines.push(`CATEGORIES:${escapeIcsText(projectName)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const folded = lines.map((line) => foldIcsLine(line));
  return {
    icsContent: `${folded.join('\r\n')}\r\n`,
    exportedCount: datedTasks.length,
  };
}

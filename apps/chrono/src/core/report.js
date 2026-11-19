// Weekly report: aggregation per day and per project, and the CSV text.

import { liveDuration } from './presence.js';

/** @typedef {import('../types.js').Session} Session */
/** @typedef {import('../types.js').Project} Project */

/**
 * @typedef {object} ReportDay
 * @property {Date} date
 * @property {Session[]} sessions sessions that started that day
 * @property {Record<string, number>} byProject duration per project id
 * @property {number} total
 */

/**
 * @typedef {object} WeekReport
 * @property {Date} monday
 * @property {Date} sunday
 * @property {Session[]} weekSessions sessions that started during the week
 * @property {ReportDay[]} byDay Monday to Sunday
 * @property {number} weekTotal
 * @property {number} maxDay at least 8 hours
 * @property {number} weekTarget weekly target, in ms
 * @property {number} targetProgress 0..1
 * @property {{ id: string, duration: number, project: Project }[]} sortedProjects projects of the week, longest first
 * @property {number} totalSessions
 * @property {number} activeDays
 */

/**
 * Bounds of the week shifted by `weekOffset` weeks from `now` (Monday 00:00 to Sunday 23:59:59.999).
 * Days are added with setDate: a daylight-saving day is not 24 h long.
 * @param {number} weekOffset
 * @param {number} now
 * @returns {{ monday: Date, sunday: Date, days: Date[] }}
 */
export function weekBounds(weekOffset, now) {
  const ref = new Date(now);
  ref.setDate(ref.getDate() + weekOffset * 7);
  const dow = (ref.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - dow);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return { monday, sunday, days };
}

/**
 * Aggregates the sessions of a week.
 * @param {Session[]} sessions
 * @param {Project[]} projects
 * @param {number} weekOffset 0 = this week, -1 = last week...
 * @param {number} now
 * @returns {WeekReport}
 */
export function aggregateWeek(sessions, projects, weekOffset, now) {
  const { monday, sunday, days } = weekBounds(weekOffset, now);

  const weekSessions = sessions.filter(
    (s) => s.start >= monday.getTime() && s.start <= sunday.getTime(),
  );

  const byDay = days.map((j) => {
    const dStart = new Date(j);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = new Date(j);
    dEnd.setHours(23, 59, 59, 999);
    const daySessions = weekSessions.filter(
      (s) => s.start >= dStart.getTime() && s.start <= dEnd.getTime(),
    );
    /** @type {Record<string, number>} */
    const byProject = {};
    for (const s of daySessions)
      byProject[s.projectId] = (byProject[s.projectId] || 0) + liveDuration(s, now);
    const total = Object.values(byProject).reduce((a, b) => a + b, 0);
    return { date: j, sessions: daySessions, byProject, total };
  });

  const weekTotal = byDay.reduce((s, j) => s + j.total, 0);
  const maxDay = Math.max(...byDay.map((j) => j.total), 8 * 3600_000);
  const weekTarget = 35 * 3600_000;
  const targetProgress = Math.min(1, weekTotal / weekTarget);

  /** @type {Record<string, number>} */
  const byProject = {};
  for (const s of weekSessions)
    byProject[s.projectId] = (byProject[s.projectId] || 0) + liveDuration(s, now);
  const sortedProjects = Object.entries(byProject)
    .map(([id, duration]) => ({ id, duration, project: projects.find((p) => p.id === id) }))
    .filter(
      /** @returns {x is { id: string, duration: number, project: Project }} */ (x) =>
        Boolean(x.project),
    )
    .sort((a, b) => b.duration - a.duration);

  return {
    monday,
    sunday,
    weekSessions,
    byDay,
    weekTotal,
    maxDay,
    weekTarget,
    targetProgress,
    sortedProjects,
    totalSessions: weekSessions.length,
    activeDays: byDay.filter((j) => j.total > 0).length,
  };
}

/**
 * Builds the CSV text of the report, ready for Excel in French: UTF-8 BOM (accents),
 * `;` separator, decimal comma, CRLF line ends.
 * @param {Session[] | null | undefined} sessions
 * @param {Pick<Project, 'id' | 'name' | 'client'>[] | null | undefined} projects
 * @param {number} now end of the running sessions
 * @returns {string}
 */
export function buildReportCsv(sessions, projects, now) {
  // Neutralises formula injection: a text cell starting with = + - @ (or tab / carriage
  // return) would be interpreted as a formula by the spreadsheet.
  const safeText = (/** @type {unknown} */ v) => {
    const t = String(v ?? '');
    return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
  };
  const cell = (/** @type {unknown} */ v) => `"${String(v).replace(/"/g, '""')}"`;
  const hhmm = (/** @type {number} */ ts) =>
    new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const rows = [['Date', 'Projet', 'Client', 'Description', 'Début', 'Fin', 'Durée (h)']];
  for (const s of (sessions || []).slice().sort((a, b) => a.start - b.start)) {
    const p = (projects || []).find((pr) => pr.id === s.projectId);
    const hours = liveDuration(s, now) / 3600_000;
    rows.push([
      new Date(s.start).toLocaleDateString('fr-FR'),
      safeText(p?.name),
      safeText(p?.client),
      safeText(s.description),
      hhmm(s.start),
      s.end ? hhmm(s.end) : '',
      hours.toFixed(2).replace('.', ','),
    ]);
  }
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

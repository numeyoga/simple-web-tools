// weekly report view: stats, day-by-day bars, projects table, CSV export.
import { aggregateWeek, buildReportCsv as buildCsv } from '../../core/report.js';
import * as UI from './ui.js';

const { el, formatDuration, formatDay, formatNumber, locale, t, weekdayName, capitalize } = UI;

/** @typedef {import('../../core/report.js').ReportDay} ReportDay */
/** @typedef {import('../../core/report.js').WeekReport} WeekReport */
/** @typedef {import('../../types.js').Session} Session */
/** @typedef {import('../../types.js').Project} Project */

/** @type {import('./types.js').ViewFactory} */
export function createReportView(store) {
  let weekOffset = 0;

  const host = el('div', { class: 'ch-view' });

  /**
   * @param {string} label
   * @param {string} value
   * @param {string | null} subtext
   * @param {{ extra?: import('./types.js').Child }} [options]
   */
  function statCard(label, value, subtext, { extra } = {}) {
    return el(
      'div',
      { class: 'cv-card cv-card--compact' },
      el('div', { class: 'cv-overline' }, label),
      el('div', { class: 'cv-num ch-kpi ch-kpi--lg' }, value),
      subtext ? el('div', { class: 'ch-subtle' }, subtext) : null,
      extra || null,
    );
  }

  /**
   * @param {ReportDay[]} byDay
   * @param {Project[]} projects
   * @param {number} maxDay
   */
  function weekBars(byDay, projects, maxDay) {
    const H = 180;
    // Room under the baseline for the day labels: two lines, since the name and the date wrap
    // below 400 px. The bars start on the baseline, never over the labels.
    const L = 34;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxH = Math.ceil(maxDay / 3600_000 / 2) * 2;
    const steps = Array.from({ length: Math.max(1, maxH / 2) + 1 }, (_, i) => i * 2);

    const axisY = el('div', {
      class: 'ch-shrink-0',
      style: { height: H + L, position: 'relative', width: 34 },
    });
    for (const h of steps) {
      axisY.appendChild(
        el(
          'div',
          {
            class: 'ch-chart-label cv-num',
            style: {
              position: 'absolute',
              bottom: L + (h / maxH) * H,
              right: 0,
              transform: 'translateY(50%)',
            },
          },
          `${h}h`,
        ),
      );
    }

    const bars = el('div', {
      class: 'ch-row ch-gap-3',
      style: { flex: 1, alignItems: 'flex-end', height: H + L, position: 'relative' },
    });
    for (const h of steps) {
      bars.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: L + (h / maxH) * H,
            borderTop:
              h === 0 ? '1px solid var(--cv-border-strong)' : '1px dashed var(--cv-border)',
            pointerEvents: 'none',
          },
        }),
      );
    }

    byDay.forEach((j, i) => {
      const isToday = j.date.getTime() === today.getTime();
      const isWeekend = i >= 5;
      const totalHeight = (j.total / (maxH * 3600_000)) * H;
      const segs = Object.entries(j.byProject)
        .flatMap(([pid, d]) => {
          const project = projects.find((p) => p.id === pid);
          return project ? [{ project, duration: d }] : [];
        })
        .sort((a, b) => b.duration - a.duration);

      const segNodes = segs.map((seg, si) =>
        UI.setProjectColor(
          el('div', {
            class: 'cv-cat-segment',
            title: `${seg.project.name} · ${formatDuration(seg.duration)}`,
            style: {
              height: (seg.duration / j.total) * totalHeight,
              borderBottom: si > 0 ? '1px solid var(--cv-surface)' : 'none',
            },
          }),
          seg.project,
        ),
      );

      bars.appendChild(
        el(
          'div',
          {
            class: 'ch-stack ch-gap-3',
            style: { flex: 1, alignItems: 'center', position: 'relative', zIndex: 1 },
          },
          el(
            'div',
            {
              class: `ch-chart-label cv-num ch-meta`,
              style: {
                position: 'absolute',
                bottom: L + totalHeight + 4,
                whiteSpace: 'nowrap',
              },
            },
            j.total > 0 ? formatDuration(j.total, { compact: true }) : '',
          ),

          el(
            'div',
            {
              class: `ch-row${isWeekend ? '' : ' ch-bar-track'}`,
              style: {
                width: '100%',
                maxWidth: 68,
                height: totalHeight,
                flexDirection: 'column-reverse',
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: isToday ? '0 0 0 2px var(--cv-brand-accent)' : 'none',
                position: 'absolute',
                bottom: L,
                left: '50%',
                transform: 'translateX(-50%)',
              },
            },
            segNodes,
          ),

          el(
            'div',
            {
              class: isToday ? 'ch-accent-text ch-strong' : isWeekend ? 'ch-subtle' : 'ch-fg',
              style: {
                position: 'absolute',
                bottom: 0,
                width: '100%',
                textAlign: 'center',
                fontSize: 12,
                lineHeight: 1.2,
              },
            },
            `${weekdayName(i, 'short')} ${j.date.getDate()}`,
          ),
        ),
      );
    });

    return el('div', { class: 'ch-row ch-gap-5' }, axisY, bars);
  }

  // Summary table of the distribution per day: one row per day,
  // one column per project with time this week, plus a Total column.
  // Lets the figures be read without hovering over each segment of the chart.
  /**
   * @param {ReportDay[]} byDay
   * @param {WeekReport['sortedProjects']} sortedProjects
   * @param {number} weekTotal
   */
  function dayTable(byDay, sortedProjects, weekTotal) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cols = sortedProjects; // [{ id, duration, project }]

    if (cols.length === 0) return null;

    const cellTxt = (/** @type {number} */ ms) => (ms > 0 ? formatDuration(ms) : '·');

    const projectTotals = cols.map((c) =>
      byDay.reduce((acc, j) => acc + (j.byProject[c.id] || 0), 0),
    );
    const captionId = UI.fieldId('ch-caption');

    return el(
      'div',
      { class: 'cv-table-wrap ch-mt-5', role: 'region', 'aria-labelledby': captionId, tabindex: 0 },
      el(
        'table',
        { class: 'cv-table' },
        el('caption', { id: captionId }, t('report.detail')),
        el(
          'thead',
          null,
          el(
            'tr',
            null,
            el('th', { scope: 'col' }, t('report.day')),
            ...cols.map((c) =>
              el(
                'th',
                { scope: 'col', class: 'ch-th-end' },
                el(
                  'span',
                  { class: 'ch-row ch-justify-end', style: { maxWidth: 120, marginLeft: 'auto' } },
                  UI.projectName(c.project),
                ),
              ),
            ),
            el('th', { scope: 'col', class: 'ch-th-end' }, t('common.total')),
          ),
        ),
        el(
          'tbody',
          null,
          byDay.map((j, i) => {
            const isToday = j.date.getTime() === today.getTime();
            return el(
              'tr',
              { class: isToday ? 'ch-today-row' : null },
              el(
                'th',
                {
                  scope: 'row',
                  class: `ch-row-head${isToday ? ' ch-strong' : ''}${j.total === 0 ? ' ch-muted-cell' : ''}`,
                },
                `${capitalize(weekdayName(i))} ${j.date.getDate()}`,
              ),
              ...cols.map((c) => {
                const v = j.byProject[c.id] || 0;
                return el('td', { class: `cv-num${v === 0 ? ' ch-muted-cell' : ''}` }, cellTxt(v));
              }),
              el(
                'td',
                { class: `cv-num${j.total === 0 ? ' ch-muted-cell' : ' ch-strong'}` },
                j.total > 0 ? formatDuration(j.total) : '·',
              ),
            );
          }),
          el(
            'tr',
            { class: 'ch-total-row' },
            el('th', { scope: 'row', class: 'ch-row-head' }, t('common.total')),
            ...projectTotals.map((v) => el('td', { class: 'cv-num' }, cellTxt(v))),
            el('td', { class: 'cv-num' }, formatDuration(weekTotal)),
          ),
        ),
      ),
    );
  }

  /**
   * @param {Session[]} weekSessions
   * @param {Project[]} projects
   * @param {Date} monday
   */
  function exportCSV(weekSessions, projects, monday) {
    const csv = buildCsv(weekSessions, projects, Date.now(), { locale });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // Local date (not toISOString, which switches to UTC: Monday 00:00 becomes Sunday).
    a.href = url;
    a.download = t('report.csvFileName', { date: UI.formatLocalDate(monday) });
    a.click();
    URL.revokeObjectURL(url);
  }

  function render() {
    const { projects, sessions } = store.state;
    const {
      monday,
      sunday,
      weekSessions,
      byDay,
      weekTotal,
      maxDay,
      targetProgress,
      sortedProjects,
      totalSessions,
      activeDays,
    } = aggregateWeek(sessions, projects, weekOffset, Date.now());

    const weekLabel =
      weekOffset === 0
        ? t('report.thisWeek')
        : weekOffset === -1
          ? t('report.lastWeek')
          : weekOffset < 0
            ? t('report.weeksAgo', { count: -weekOffset })
            : t('report.weeksAhead', { count: weekOffset });
    const dayMonth = /** @type {const} */ ({ day: 'numeric', month: 'short' });
    const weekDates = t('report.weekRange', {
      start: formatDay(monday, dayMonth),
      end: formatDay(sunday, dayMonth),
    });

    const projectsTableId = UI.fieldId('ch-caption');
    host.replaceChildren(
      // Header
      el(
        'div',
        { class: 'ch-row ch-wrap ch-align-end ch-gap-5' },
        el(
          'div',
          { class: 'ch-row ch-center ch-gap-3' },
          UI.IconButton({
            icon: 'caret-left',
            label: t('report.previousWeek'),
            onclick: () => {
              weekOffset--;
              render();
            },
          }),
          el(
            'div',
            null,
            el('h2', { class: 'cv-h2 ch-page-title' }, weekLabel),
            el('div', { class: 'ch-meta ch-capitalize ch-mt-1' }, weekDates),
          ),
          UI.IconButton({
            icon: 'caret-right',
            label: t('report.nextWeek'),
            disabled: weekOffset >= 0,
            onclick: () => {
              weekOffset++;
              render();
            },
          }),
          weekOffset !== 0
            ? UI.Button({
                size: 'sm',
                variant: 'ghost',
                children: t('report.thisWeek'),
                onclick: () => {
                  weekOffset = 0;
                  render();
                },
              })
            : null,
        ),
        UI.Button({
          icon: 'file-arrow-down',
          children: t('report.exportCsv'),
          className: 'ch-end',
          onclick: () => exportCSV(weekSessions, projects, monday),
        }),
      ),

      // Stats top
      el(
        'div',
        { class: 'ch-grid-stats' },
        statCard(t('report.weekTotal'), formatDuration(weekTotal), t('report.target'), {
          extra: el(
            'div',
            {
              class: `ch-track ch-mt-3 ${targetProgress >= 1 ? 'ch-track--success' : 'ch-track--accent'}`,
              'aria-hidden': 'true',
            },
            el('span', { style: { width: `${targetProgress * 100}%` } }),
          ),
        }),
        statCard(
          t('common.sessions'),
          formatNumber(totalSessions),
          t('report.spreadOver', { count: activeDays }),
        ),
        statCard(
          t('report.averagePerDay'),
          formatDuration(activeDays > 0 ? weekTotal / activeDays : 0),
          activeDays > 0 ? t('report.overDaysWorked') : t('report.noDayWorked'),
        ),
      ),

      // Chart
      el(
        'section',
        { class: 'cv-card' },
        el(
          'div',
          { class: 'ch-row ch-baseline ch-wrap ch-gap-4 ch-mb-4' },
          el('h2', { class: 'cv-card__title' }, t('report.distribution')),
          el('div', { class: 'ch-meta ch-end' }, t('report.coloredSegments')),
        ),
        weekBars(byDay, projects, maxDay),
        sortedProjects.length > 0
          ? el(
              'ul',
              { class: 'cv-cat-legend ch-mt-4', 'aria-label': t('report.legend') },
              sortedProjects.map(({ project }) =>
                UI.setProjectColor(
                  el(
                    'li',
                    null,
                    el('span', { class: 'cv-cat-dot', 'aria-hidden': 'true' }),
                    project.name,
                  ),
                  project,
                ),
              ),
            )
          : null,
        dayTable(byDay, sortedProjects, weekTotal),
      ),

      // Projects table
      sortedProjects.length === 0
        ? UI.EmptyState({ icon: 'chart-bar', title: t('report.none') })
        : el(
            'div',
            {
              class: 'cv-table-wrap',
              role: 'region',
              'aria-labelledby': projectsTableId,
              tabindex: 0,
            },
            el(
              'table',
              { class: 'cv-table' },
              el('caption', { id: projectsTableId }, t('report.byProject')),
              el(
                'thead',
                null,
                el(
                  'tr',
                  null,
                  el('th', { scope: 'col' }, t('common.project')),
                  el('th', { scope: 'col' }, t('common.client')),
                  el('th', { scope: 'col', class: 'ch-th-end' }, t('common.sessions')),
                  el('th', { scope: 'col', class: 'ch-th-end' }, t('report.time')),
                  el('th', { scope: 'col', class: 'ch-th-end' }, t('report.share')),
                ),
              ),
              el(
                'tbody',
                null,
                sortedProjects.map(({ id, duration, project }) => {
                  const sessionsCount = weekSessions.filter((s) => s.projectId === id).length;
                  const part = weekTotal > 0 ? (duration / weekTotal) * 100 : 0;
                  return el(
                    'tr',
                    null,
                    el(
                      'th',
                      { scope: 'row', class: 'ch-row-head' },
                      UI.projectName(project, 'ch-strong'),
                    ),
                    el('td', { class: 'ch-muted-cell' }, project.client || t('common.dash')),
                    el('td', { class: 'cv-num' }, formatNumber(sessionsCount)),
                    el('td', { class: 'cv-num' }, formatDuration(duration)),
                    el(
                      'td',
                      { class: 'cv-num ch-muted-cell' },
                      t('report.percent', { value: part.toFixed(0) }),
                    ),
                  );
                }),
                el(
                  'tr',
                  { class: 'ch-total-row' },
                  el('th', { scope: 'row', colspan: 2, class: 'ch-row-head' }, t('common.total')),
                  el('td', { class: 'cv-num' }, formatNumber(totalSessions)),
                  el('td', { class: 'cv-num' }, formatDuration(weekTotal)),
                  el('td', { class: 'cv-num ch-muted-cell' }, t('report.percent', { value: 100 })),
                ),
              ),
            ),
          ),
    );
  }

  render();
  const offState = store.onState(render);

  return {
    el: host,
    destroy() {
      offState();
    },
  };
}

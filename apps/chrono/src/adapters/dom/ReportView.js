// weekly report view: stats, day-by-day bars, projects table, CSV export.
import { aggregateWeek, buildReportCsv as buildCsv } from '../../core/report.js';
import * as UI from './ui.js';

const { el, formatDuration } = UI;

/** @typedef {import('../../core/report.js').ReportDay} ReportDay */
/** @typedef {import('../../core/report.js').WeekReport} WeekReport */
/** @typedef {import('../../types.js').Session} Session */
/** @typedef {import('../../types.js').Project} Project */

/** @type {import('./types.js').ViewFactory} */
export function createReportView(store) {
  let weekOffset = 0;

  const host = el('div', { class: 'ch-pile ch-g20' });

  /**
   * @param {string} label
   * @param {string} value
   * @param {string | null} subtext
   * @param {{ accent?: boolean, mono?: boolean, extra?: import('./types.js').Child }} [options]
   */
  function statCard(label, value, subtext, { accent, mono = true, extra } = {}) {
    return el(
      'div',
      {
        class: 'ch-carte',
        style: { padding: 16 },
      },
      el('div', { class: 'ch-surtitre' }, label),
      el(
        'div',
        {
          style: {
            marginTop: 8,
            font: `500 26px/1 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
            color: accent ? 'var(--cv-accent-600)' : 'var(--cv-fg)',
            letterSpacing: '-0.01em',
          },
        },
        value,
      ),
      subtext
        ? el(
            'div',
            {
              style: {
                marginTop: 4,
                font: '400 12px/1.2 var(--cv-font-sans)',
                color: 'var(--cv-fg-subtle)',
              },
            },
            subtext,
          )
        : null,
      extra || null,
    );
  }

  /**
   * @param {import('./types.js').Child} content
   * @param {string} [align]
   */
  function Th(content, align = 'left') {
    return el(
      'th',
      {
        class: 'ch-surtitre',
        style: { padding: '10px 16px', textAlign: align },
      },
      content,
    );
  }
  /**
   * @param {import('./types.js').Child} content
   * @param {{ align?: string, muted?: boolean, mono?: boolean, strong?: boolean, colSpan?: number, style?: import('./types.js').Style }} [opts]
   */
  function Td(content, opts = {}) {
    const { align = 'left', muted, mono, strong, colSpan, style } = opts;
    /** @type {Record<string, unknown>} */
    const attrs = {
      style: {
        padding: '12px 16px',
        textAlign: align,
        font: `${strong ? 600 : 400} 13px/1.3 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
        color: muted ? 'var(--cv-fg-muted)' : 'var(--cv-fg)',
        ...(style || {}),
      },
    };
    if (colSpan) attrs.colSpan = colSpan;
    return el('td', attrs, content);
  }

  /**
   * @param {ReportDay[]} byDay
   * @param {Project[]} projects
   * @param {number} maxDay
   */
  function weekBars(byDay, projects, maxDay) {
    const H = 180;
    const dayNames = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxH = Math.ceil(maxDay / 3600_000 / 2) * 2;
    const steps = Array.from({ length: Math.max(1, maxH / 2) + 1 }, (_, i) => i * 2);

    const axisY = el('div', {
      style: { height: H, position: 'relative', width: 34, flexShrink: 0 },
    });
    for (const h of steps) {
      axisY.appendChild(
        el(
          'div',
          {
            class: 'ch-mono-xs',
            style: {
              position: 'absolute',
              bottom: (h / maxH) * H,
              right: 0,
              transform: 'translateY(50%)',
            },
          },
          `${h}h`,
        ),
      );
    }

    const bars = el('div', {
      class: 'ch-flex ch-g8',
      style: { flex: 1, alignItems: 'flex-end', height: H, position: 'relative' },
    });
    for (const h of steps) {
      bars.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: (h / maxH) * H,
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
        el('div', {
          title: `${seg.project.name} · ${formatDuration(seg.duration)}`,
          style: {
            height: (seg.duration / j.total) * totalHeight,
            background: seg.project.color,
            borderBottom: si > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none',
          },
        }),
      );

      bars.appendChild(
        el(
          'div',
          {
            class: 'ch-pile ch-g6',
            style: { flex: 1, alignItems: 'center', position: 'relative', zIndex: 1 },
          },
          el(
            'div',
            {
              style: {
                position: 'absolute',
                bottom: totalHeight + 8,
                font: '500 11px/1 var(--cv-font-mono)',
                color: 'var(--cv-fg-muted)',
                opacity: j.total > 0 ? 1 : 0.3,
                whiteSpace: 'nowrap',
              },
            },
            j.total > 0 ? formatDuration(j.total, { compact: true }) : '',
          ),

          el(
            'div',
            {
              class: 'ch-flex',
              style: {
                width: '100%',
                maxWidth: 68,
                height: totalHeight,
                flexDirection: 'column-reverse',
                borderRadius: 4,
                overflow: 'hidden',
                background: isWeekend ? 'transparent' : 'var(--cv-neutral-100)',
                boxShadow: isToday ? '0 0 0 2px var(--cv-accent-500)' : 'none',
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
              },
            },
            segNodes,
          ),

          el(
            'div',
            {
              style: {
                position: 'absolute',
                bottom: 0,
                font: `${isToday ? 600 : 400} 12px/1 var(--cv-font-sans)`,
                color: isToday
                  ? 'var(--cv-accent-600)'
                  : isWeekend
                    ? 'var(--cv-fg-subtle)'
                    : 'var(--cv-fg)',
              },
            },
            `${dayNames[i]} ${j.date.getDate()}`,
          ),
        ),
      );
    });

    return el('div', { class: 'ch-flex ch-g16' }, axisY, bars);
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
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cols = sortedProjects; // [{ id, duration, project }]

    if (cols.length === 0) return el('div', { style: { display: 'none' } });

    const cellTxt = (/** @type {number} */ ms) => (ms > 0 ? formatDuration(ms) : '·');

    const projectTotals = cols.map((c) =>
      byDay.reduce((acc, j) => acc + (j.byProject[c.id] || 0), 0),
    );

    return el(
      'div',
      { style: { marginTop: 20, borderTop: '1px solid var(--cv-border)', overflowX: 'auto' } },
      el(
        'div',
        { class: 'ch-surtitre ch-surtitre--fort', style: { padding: '16px 0 10px' } },
        'Détail chiffré',
      ),
      el(
        'table',
        { style: { width: '100%', borderCollapse: 'collapse', minWidth: 480 } },
        el(
          'thead',
          null,
          el(
            'tr',
            { style: { borderBottom: '1px solid var(--cv-border)' } },
            Th('Jour'),
            ...cols.map((c) =>
              el(
                'th',
                {
                  style: {
                    padding: '8px 12px',
                    textAlign: 'right',
                    font: '500 11px/1.3 var(--cv-font-sans)',
                    color: 'var(--cv-fg-muted)',
                  },
                },
                el(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      justifyContent: 'flex-end',
                    },
                  },
                  el('span', {
                    class: 'ch-pastille',
                    style: { background: c.project.color, flexShrink: 0 },
                  }),
                  el('span', { class: 'ch-ellipse', style: { maxWidth: 120 } }, c.project.name),
                ),
              ),
            ),
            Th('Total', 'right'),
          ),
        ),
        el(
          'tbody',
          null,
          byDay.map((j, i) => {
            const isToday = j.date.getTime() === today.getTime();
            return el(
              'tr',
              {
                style: {
                  borderBottom: '1px solid var(--cv-border)',
                  background: isToday ? 'var(--cv-accent-50)' : 'transparent',
                },
              },
              Td(`${dayNames[i]} ${j.date.getDate()}`, { strong: isToday, muted: j.total === 0 }),
              ...cols.map((c) => {
                const v = j.byProject[c.id] || 0;
                return Td(cellTxt(v), { align: 'right', mono: true, muted: v === 0 });
              }),
              Td(j.total > 0 ? formatDuration(j.total) : '·', {
                align: 'right',
                mono: true,
                strong: j.total > 0,
                muted: j.total === 0,
              }),
            );
          }),
          el(
            'tr',
            { style: { background: 'var(--cv-neutral-50)' } },
            Td('Total', { strong: true }),
            ...projectTotals.map((v) =>
              Td(cellTxt(v), { align: 'right', mono: true, strong: true, muted: v === 0 }),
            ),
            Td(formatDuration(weekTotal), { align: 'right', mono: true, strong: true }),
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
    const csv = buildCsv(weekSessions, projects, Date.now());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // Local date (not toISOString, which switches to UTC: Monday 00:00 becomes Sunday).
    a.href = url;
    a.download = `rapport-${UI.formatLocalDate(monday)}.csv`;
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
        ? 'Cette semaine'
        : weekOffset === -1
          ? 'Semaine dernière'
          : weekOffset < 0
            ? `Il y a ${-weekOffset} semaines`
            : `Dans ${weekOffset} semaines`;
    const weekDates = `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

    host.replaceChildren(
      // Header
      el(
        'div',
        { class: 'ch-flex ch-g16', style: { alignItems: 'flex-end', flexWrap: 'wrap' } },
        el(
          'div',
          { class: 'ch-flex-c ch-g8' },
          UI.IconButton({
            icon: 'caret-left',
            label: 'Semaine précédente',
            onclick: () => {
              weekOffset--;
              render();
            },
          }),
          el(
            'div',
            null,
            el('div', { class: 'ch-titre-page' }, weekLabel),
            el(
              'div',
              { class: 'ch-meta', style: { marginTop: 2, textTransform: 'capitalize' } },
              weekDates,
            ),
          ),
          UI.IconButton({
            icon: 'caret-right',
            label: 'Semaine suivante',
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
                children: 'Cette semaine',
                onclick: () => {
                  weekOffset = 0;
                  render();
                },
              })
            : null,
        ),
        el('div', { style: { flex: 1 } }),
        UI.Button({
          icon: 'file-arrow-down',
          children: 'Exporter CSV',
          onclick: () => exportCSV(weekSessions, projects, monday),
        }),
      ),

      // Stats top
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 } },
        statCard('Total semaine', formatDuration(weekTotal), 'objectif 35h00', {
          extra: el(
            'div',
            {
              style: {
                height: 4,
                background: 'var(--cv-neutral-100)',
                borderRadius: 2,
                marginTop: 10,
                overflow: 'hidden',
              },
            },
            el('div', {
              style: {
                width: `${targetProgress * 100}%`,
                height: '100%',
                background: targetProgress >= 1 ? 'var(--cv-success-500)' : 'var(--cv-accent-500)',
                transition: 'width 300ms',
              },
            }),
          ),
        }),
        statCard(
          'Sessions',
          String(totalSessions),
          `réparties sur ${activeDays} jour${activeDays > 1 ? 's' : ''}`,
          { mono: false },
        ),
        statCard(
          'Moyenne / jour actif',
          formatDuration(activeDays > 0 ? weekTotal / activeDays : 0),
          activeDays > 0 ? 'sur jours travaillés' : 'aucun jour travaillé',
        ),
      ),

      // Chart
      el(
        'section',
        {
          class: 'ch-carte',
          style: { padding: 20 },
        },
        el(
          'div',
          { class: 'ch-flex', style: { alignItems: 'baseline', marginBottom: 16 } },
          el('div', { class: 'ch-titre-carte' }, 'Distribution par jour'),
          el(
            'div',
            { class: 'ch-legende', style: { marginLeft: 'auto' } },
            'Segments colorés = projets',
          ),
        ),
        weekBars(byDay, projects, maxDay),
        dayTable(byDay, sortedProjects, weekTotal),
      ),

      // Projects table
      el(
        'section',
        {
          class: 'ch-carte ch-carte--rogne',
        },
        el(
          'header',
          { style: { padding: '14px 20px', borderBottom: '1px solid var(--cv-border)' } },
          el('div', { class: 'ch-titre-carte' }, 'Par projet'),
        ),
        sortedProjects.length === 0
          ? el('div', { class: 'ch-vide' }, 'Aucune session sur cette semaine.')
          : el(
              'table',
              { style: { width: '100%', borderCollapse: 'collapse' } },
              el(
                'thead',
                null,
                el(
                  'tr',
                  {
                    style: {
                      borderBottom: '1px solid var(--cv-border)',
                      background: 'var(--cv-neutral-50)',
                    },
                  },
                  Th('Projet'),
                  Th('Client'),
                  Th('Sessions', 'right'),
                  Th('Temps', 'right'),
                  Th('Part', 'right'),
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
                    { style: { borderBottom: '1px solid var(--cv-border)' } },
                    Td(
                      el(
                        'div',
                        { class: 'ch-flex-c ch-g8' },
                        el('span', { class: 'ch-pastille', style: { background: project.color } }),
                        el('span', { class: 'ch-libelle' }, project.name),
                      ),
                    ),
                    Td(project.client || '—', { muted: true }),
                    Td(String(sessionsCount), { align: 'right', mono: true }),
                    Td(formatDuration(duration), { align: 'right', mono: true }),
                    Td(`${part.toFixed(0)}\u00a0%`, { align: 'right', mono: true, muted: true }),
                  );
                }),
                el(
                  'tr',
                  { style: { background: 'var(--cv-neutral-50)' } },
                  Td('Total', { colSpan: 2, strong: true }),
                  Td(String(totalSessions), { align: 'right', mono: true, strong: true }),
                  Td(formatDuration(weekTotal), { align: 'right', mono: true, strong: true }),
                  Td('100\u00a0%', { align: 'right', mono: true, muted: true }),
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

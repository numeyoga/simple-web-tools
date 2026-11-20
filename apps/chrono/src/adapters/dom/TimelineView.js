// "Timeline" view: date banner, stats, hourly chart, sessions, distribution.
import { dayBounds } from '../../core/dates.js';
import * as UI from './ui.js';

const { el, icon, formatDuration, formatTime, liveDuration, localToTimestamp, timestampToLocal } =
  UI;

const START_HOUR = 7;
const END_HOUR = 20;
const PX_PER_HOUR = 84;

const ATTENDANCE_TYPES = [
  { value: 'arrival', label: 'Arrivée', icon: 'sign-in', tone: 'ch-success-text' },
  { value: 'break_start', label: 'Début de pause', icon: 'pause', tone: 'ch-warning-text' },
  { value: 'break_end', label: 'Fin de pause', icon: 'play', tone: 'ch-warning-text' },
  { value: 'departure', label: 'Départ', icon: 'sign-out', tone: 'ch-muted-text' },
];
/** @type {Record<string, (typeof ATTENDANCE_TYPES)[number]>} */
const ATTENDANCE_META = Object.fromEntries(ATTENDANCE_TYPES.map((p) => [p.value, p]));

// Horizontal scale of the chart (px at the standard text scale, from the left edge of the content).
const CHART_PAD_X = 16;
/** @typedef {import('../../types.js').Session} Session */
/** @typedef {import('../../types.js').Project} Project */
/** @typedef {import('../../types.js').AttendanceEvent} AttendanceEvent */

const hourToPx = (/** @type {number} */ h) => (h - START_HOUR) * PX_PER_HOUR;
const tsToPx = (/** @type {number} */ ts) => {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  return hourToPx(h);
};

// Sets a stable focus key (dataset.focusKey) on an element that is already built. An icon button
// is wrapped in its tooltip: the key goes on the button, which is what takes the focus.
/**
 * @template {HTMLElement} T
 * @param {T} node
 * @param {string} key
 * @returns {T}
 */
const withFocusKey = (node, key) => {
  const target = node.querySelector('button') ?? node;
  target.dataset.focusKey = key;
  return node;
};

/** @type {import('./types.js').ViewFactory} */
export function createTimelineView(store, opts) {
  let dateOffset = 0;

  const host = el('div', { class: 'ch-view' });

  /**
   * @param {string} label
   * @param {string} value
   * @param {string | null} subtext
   */
  function statBlock(label, value, subtext) {
    return el(
      'div',
      null,
      el('div', { class: 'cv-overline' }, label),
      el('div', { class: 'cv-num ch-kpi ch-mt-2' }, value),
      subtext ? el('div', { class: 'ch-subtle ch-mt-1' }, subtext) : null,
    );
  }

  /**
   * A swatch of the chart legend: a fill and a border, both semantic roles.
   * @param {string} fill
   * @param {string} border
   * @param {string} label
   */
  function legendItem(fill, border, label) {
    return el(
      'span',
      { class: 'ch-row ch-center ch-gap-3' },
      el('span', {
        class: 'ch-legend-swatch',
        style: { background: fill, border: `1px solid ${border}` },
      }),
      label,
    );
  }

  /** @param {Session} s */
  function openSessionEditor(s) {
    const projects = store.state.projects;

    const projectW = UI.Select({
      label: 'Projet',
      value: s.projectId,
      options: projects.map((p) => ({
        value: p.id,
        label: p.name + (p.archived ? ' (archivé)' : ''),
      })),
    });
    const descW = UI.Input({
      label: 'Description',
      value: s.description || '',
      placeholder: 'Ex. maquette homepage v3',
    });
    const startW = UI.Input({
      label: 'Début',
      value: timestampToLocal(s.start),
      type: 'datetime-local',
      className: 'ch-field-wide',
    });
    const endW =
      s.status === 'done'
        ? UI.Input({
            label: 'Fin',
            value: timestampToLocal(/** @type {number} */ (s.end)),
            type: 'datetime-local',
            className: 'ch-field-wide',
          })
        : null;

    const displayedDuration = el(
      'div',
      { class: 'cv-num ch-kpi ch-kpi--md ch-mt-2' },
      formatDuration(liveDuration(s)),
    );
    // Same rule as updateSession (core/sessions.js): the break time already deducted from
    // the original session is kept, the recorded duration = block - breaks.
    const originalPauses =
      s.status === 'done' && s.start != null && s.end != null
        ? Math.max(0, s.end - s.start - (s.duration || 0))
        : 0;
    /** @param {number} ms */
    function pauseLabel(ms) {
      const min = Math.max(1, Math.round(ms / 60000));
      const h = Math.floor(min / 60);
      return h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
    }
    const breaksNote =
      originalPauses > 0
        ? el(
            'div',
            { class: 'ch-meta ch-mt-2' },
            `dont ${pauseLabel(originalPauses)} de pause déduites`,
          )
        : null;
    function recomputeDuration() {
      if (s.status !== 'done') return;
      const d = localToTimestamp(startW.input.value);
      const f = endW ? localToTimestamp(endW.input.value) : null;
      if (d != null && f != null && f >= d)
        displayedDuration.textContent = formatDuration(Math.max(0, f - d - originalPauses));
    }
    startW.input.addEventListener('input', () => {
      recomputeDuration();
      endW?.setError(null);
    });
    if (endW)
      endW.input.addEventListener('input', () => {
        recomputeDuration();
        endW.setError(null);
      });

    function save() {
      /** @type {Partial<Session>} */
      const patch = {
        projectId: projectW.input.value,
        description: descW.input.value.trim(),
      };
      // Only a time that was edited goes in the patch: a stored session whose start and end
      // are equal stays editable (description, project) without being refused.
      const start = localToTimestamp(startW.input.value);
      if (start != null && startW.input.value !== timestampToLocal(s.start)) patch.start = start;
      if (endW) {
        const end = localToTimestamp(endW.input.value);
        if (end != null && endW.input.value !== timestampToLocal(/** @type {number} */ (s.end)))
          patch.end = end;
        const newStart = patch.start ?? s.start;
        const newEnd = patch.end ?? s.end ?? newStart;
        if ((patch.start != null || patch.end != null) && newEnd <= newStart) {
          endW.setError('La fin est avant le début. Choisis une fin postérieure au début.');
          endW.input.focus();
          return;
        }
      }
      store.actions.updateSession(s.id, patch);
      modal.close();
    }

    function originalDelete() {
      store.actions.deleteSession(s.id);
      modal.close();
    }

    const modal = UI.Modal({
      title: 'Modifier la session',
      body: el(
        'div',
        { class: 'ch-stack ch-gap-4' },
        projectW,
        descW,
        el('div', { class: 'ch-row ch-wrap ch-gap-4' }, startW, endW),
        s.status === 'done'
          ? el(
              'div',
              null,
              el('div', { class: 'cv-overline' }, 'Durée calculée'),
              displayedDuration,
              breaksNote,
            )
          : UI.Alert({
              status: 'info',
              title: 'Session encore active.',
              text: 'La durée continue de courir.',
            }),
      ),
      footer: [
        UI.Button({
          variant: 'danger',
          children: 'Supprimer',
          onclick: originalDelete,
          className: 'ch-push',
        }),
        UI.Button({ children: 'Annuler', onclick: () => modal.close() }),
        UI.Button({
          variant: 'primary',
          children: 'Enregistrer',
          onclick: save,
        }),
      ],
    });
  }

  /* ----------------- TimelineChart ----------------- */
  /**
   * @param {number} dayStart
   * @param {Session[]} daySessions
   * @param {AttendanceEvent[]} dayAttendance
   * @param {Project[]} projects
   * @param {boolean} isToday
   */
  function timelineChart(dayStart, daySessions, dayAttendance, projects, isToday) {
    const totalHours = END_HOUR - START_HOUR;
    const dayEnd = dayBounds(dayStart).end; // the next midnight: the day lasts 23, 24 or 25 h
    const widthPx = totalHours * PX_PER_HOUR;
    const msToPx = (/** @type {number} */ ms) => (ms / 3600_000) * PX_PER_HOUR;

    // presence segments
    /** @type {{ start: number, end: number, ongoing?: boolean }[]} */
    const presenceSegs = [];
    /** @type {number | null} */
    let presentSince = null;
    for (const e of dayAttendance) {
      if ((e.type === 'arrival' || e.type === 'break_end') && presentSince == null)
        presentSince = e.at;
      else if ((e.type === 'break_start' || e.type === 'departure') && presentSince != null) {
        presenceSegs.push({ start: presentSince, end: e.at });
        presentSince = null;
      }
    }
    if (presentSince != null)
      presenceSegs.push({
        start: presentSince,
        end: isToday ? Date.now() : dayEnd,
        ongoing: true,
      });

    // breaks
    const pauseSegs = [];
    let breakStartedAt = null;
    for (const e of dayAttendance) {
      if (e.type === 'break_start') breakStartedAt = e.at;
      else if (e.type === 'break_end' && breakStartedAt != null) {
        pauseSegs.push({ start: breakStartedAt, end: e.at });
        breakStartedAt = null;
      }
    }
    if (breakStartedAt != null)
      pauseSegs.push({
        start: breakStartedAt,
        end: isToday ? Date.now() : dayEnd,
        ongoing: true,
      });

    const now = Date.now();

    const rule = el('div', { style: { position: 'relative', height: 22, width: widthPx } });
    for (let i = 0; i <= totalHours; i++) {
      const h = START_HOUR + i;
      rule.appendChild(
        el(
          'div',
          {
            class: 'ch-chart-label cv-num',
            style: {
              position: 'absolute',
              left: hourToPx(h),
              top: 0,
              transform: 'translateX(-50%)',
            },
          },
          `${String(h).padStart(2, '0')}:00`,
        ),
      );
    }

    const line = el('div', {
      style: { position: 'relative', height: 140, width: widthPx, marginTop: 6 },
    });

    // grids
    for (let i = 0; i <= totalHours; i++) {
      line.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: hourToPx(START_HOUR + i),
            top: 0,
            bottom: 0,
            borderLeft: `1px ${(START_HOUR + i) % 2 === 0 ? 'solid' : 'dashed'} var(--cv-border)`,
          },
        }),
      );
    }

    // presence bands
    for (const seg of presenceSegs) {
      line.appendChild(
        el('div', {
          title: `Présence : ${formatTime(seg.start)} → ${seg.ongoing ? 'en cours' : formatTime(seg.end)}`,
          style: {
            position: 'absolute',
            left: tsToPx(seg.start),
            width: Math.max(2, tsToPx(seg.end) - tsToPx(seg.start)),
            top: 0,
            bottom: 0,
            background: 'var(--cv-success-surface)',
            borderTop: '2px solid var(--cv-fg-success)',
            borderBottom: '2px solid var(--cv-fg-success)',
          },
        }),
      );
    }
    // break bands
    for (const seg of pauseSegs) {
      line.appendChild(
        el('div', {
          title: `Pause : ${formatTime(seg.start)} → ${seg.ongoing ? 'en cours' : formatTime(seg.end)}`,
          style: {
            position: 'absolute',
            left: tsToPx(seg.start),
            width: Math.max(2, tsToPx(seg.end) - tsToPx(seg.start)),
            top: 0,
            bottom: 0,
            background: 'var(--cv-warning-surface)',
            borderTop: '2px solid var(--cv-fg-warning)',
            borderBottom: '2px solid var(--cv-fg-warning)',
          },
        }),
      );
    }

    // sessions: placement in "lanes" (swim lanes) to handle
    // PARALLEL timers. The height of the band stays CONSTANT: the vertical
    // area reserved for the sessions is divided by the number of lanes needed
    // that day (maximum overlap). A single session => 1 full lane;
    // several in parallel => stacked lanes, without changing the total height.
    // Symmetric insets (16 px at the top / bottom of the 140 px plot) so that
    // the sessions stay centred in the presence "channel", whether there is
    // a single lane (full block, centred) or several stacked lanes.
    const SESSION_ZONE_TOP = 16;
    const SESSION_ZONE_H = 108;
    const LANE_GAP = 4;

    // Visual extent of each session: [start, start + displayed duration].
    /** @typedef {{ s: Session, durationMs: number, start: number, end: number, col: number, cols: number, colSpan: number }} Placed */
    /** @type {Placed[]} */
    const placed = daySessions
      .map((s) => {
        const durationMs = liveDuration(s);
        return {
          s,
          durationMs,
          start: s.start,
          end: s.start + Math.max(durationMs, 60_000),
          col: 0,
          cols: 1,
          colSpan: 1,
        };
      })
      .sort((a, b) => a.start - b.start);

    // Grouping into "clusters" of overlapping sessions (connected
    // components), then distribution into columns INSIDE each cluster.
    // Consequence: a session WITHOUT overlap takes the full height of the
    // area (so it is centred, equal margins at the top and bottom), while
    // really parallel timers share the height, without ever
    // changing the total height of the band, which stays constant.
    /** @type {{ items: Placed[], maxEnd: number }[]} */
    const clusters = [];
    /** @type {{ items: Placed[], maxEnd: number } | null} */
    let cur = null;
    for (const item of placed) {
      if (cur && item.start < cur.maxEnd - 1000) {
        cur.items.push(item);
        cur.maxEnd = Math.max(cur.maxEnd, item.end);
      } else {
        cur = { items: [item], maxEnd: item.end };
        clusters.push(cur);
      }
    }
    const overlaps = (/** @type {Placed} */ a, /** @type {Placed} */ b) =>
      a.start < b.end - 1000 && b.start < a.end - 1000;
    for (const cl of clusters) {
      /** @type {number[]} */
      const colEnds = [];
      for (const item of cl.items) {
        /** @type {number} */
        let col = colEnds.findIndex((end) => item.start >= end - 1000);
        if (col === -1) {
          col = colEnds.length;
          colEnds.push(0);
        }
        colEnds[col] = item.end;
        item.col = col;
      }
      const cols = Math.max(1, colEnds.length);
      // "Agenda"-style expansion: each block spreads over the free lanes
      // next to it (downwards) as long as NO other block really
      // overlaps it in time. The vertical space is thus always filled:
      // a block with no instantaneous neighbour takes all the remaining height, and the
      // top/bottom margins stay consistent between solo and multi.
      for (const item of cl.items) {
        let span = 1;
        for (let c = item.col + 1; c < cols; c++) {
          if (cl.items.some((o) => o !== item && o.col === c && overlaps(o, item))) break;
          span++;
        }
        item.cols = cols;
        item.colSpan = span;
      }
    }

    for (const item of placed) {
      const s = item.s;
      const project = projects.find((p) => p.id === s.projectId);
      const durationMs = item.durationMs;
      const left = tsToPx(s.start);
      const width = Math.max(10, msToPx(durationMs));
      const isActive = s.status !== 'done';
      const isRunning = s.status === 'running';
      const laneH = (SESSION_ZONE_H - LANE_GAP * (item.cols - 1)) / item.cols;
      const blockH = laneH * item.colSpan + LANE_GAP * (item.colSpan - 1);
      const compact = blockH < 46;
      const top = SESSION_ZONE_TOP + item.col * (laneH + LANE_GAP);
      const block = el('button', {
        type: 'button',
        class: `ch-session-block${compact ? ' ch-session-block--compact' : ''}`,
        dataset: { focusKey: `session-block:${s.id}` },
        title: `${project?.name || 'Sans projet'} · ${formatTime(s.start)} → ${s.end != null && s.status === 'done' ? formatTime(s.end) : 'en cours'} · ${formatDuration(durationMs)}`,
        onclick: () => openSessionEditor(s),
        style: {
          left,
          width,
          top,
          height: blockH,
          background: project?.color || 'var(--cv-cat-16-fill)',
          boxShadow: isRunning
            ? '0 0 0 2px var(--cv-border-selected), var(--cv-shadow-md)'
            : isActive
              ? 'var(--cv-shadow-md)'
              : 'var(--cv-shadow-sm)',
        },
      });
      const title = el(
        'div',
        { class: 'ch-grow' },
        el('div', { class: 'ch-ellipsis ch-strong' }, project?.name || 'Sans projet'),
        !compact && s.description && width > 80
          ? el('div', { class: 'ch-ellipsis ch-mt-1' }, s.description)
          : null,
      );
      const durationLine = el(
        'div',
        { class: 'cv-num ch-row ch-center ch-gap-2 ch-shrink-0' },
        el('span', null, formatDuration(durationMs)),
        isRunning ? el('span', { class: 'ch-dot-light' }) : null,
      );
      block.append(title, durationLine);
      line.appendChild(block);
    }

    // "now" cursor
    if (isToday) {
      line.appendChild(
        el(
          'div',
          {
            style: {
              position: 'absolute',
              left: tsToPx(now),
              top: -6,
              bottom: -6,
              width: 2,
              background: 'var(--cv-brand-accent)',
              pointerEvents: 'none',
            },
          },
          el('div', {
            style: {
              position: 'absolute',
              top: -4,
              left: -4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--cv-brand-accent)',
            },
          }),
          el(
            'div',
            {
              class: 'ch-now-label cv-num',
              style: { position: 'absolute', top: -24, left: 4 },
            },
            formatTime(now),
          ),
        ),
      );
    }

    return el(
      'div',
      {
        class: 'ch-chart-scroll',
        // A scrollable region is reachable with the keyboard (WCAG 2.1.1).
        role: 'region',
        'aria-label': 'Journée en continu',
        tabindex: 0,
        dataset: { role: 'timeline-scroll', day: String(dayStart), focusKey: 'chart-scroll' },
      },
      el(
        'div',
        {
          style: {
            boxSizing: 'content-box',
            width: widthPx,
            position: 'relative',
            paddingLeft: CHART_PAD_X,
            paddingRight: CHART_PAD_X,
          },
        },
        rule,
        line,
      ),
    );
  }

  /* ----------------- Sessions list ----------------- */
  /**
   * @param {Session[]} daySessions
   * @param {Project[]} projects
   */
  function sessionsList(daySessions, projects) {
    const list =
      daySessions.length === 0
        ? UI.EmptyState({
            icon: 'hourglass-low',
            title: 'Aucune session pour ce jour.',
            actions: [
              withFocusKey(
                UI.Button({
                  variant: 'primary',
                  icon: 'play',
                  children: 'Démarrer un chrono',
                  mutates: true,
                  onclick: opts.onOpenQuickAdd,
                }),
                'sessions-empty:start',
              ),
              // A brand new workspace: the demo data is offered, never loaded on its own.
              store.isEmpty()
                ? withFocusKey(
                    UI.Button({
                      icon: 'flask',
                      children: 'Charger des données de démonstration',
                      mutates: true,
                      onclick: () => store.actions.loadDemoData(),
                    }),
                    'sessions-empty:demo',
                  )
                : null,
            ],
          })
        : el(
            'div',
            null,
            daySessions.map((s) => {
              const project = projects.find((p) => p.id === s.projectId);
              const isActive = s.status !== 'done';
              const row = el(
                'div',
                {
                  class: `ch-line ch-line--click${isActive ? ' is-active' : ''}`,
                  onclick: (/** @type {import('./types.js').TargetMouseEvent} */ e) => {
                    // Avoids opening the editor when a button in the row is clicked.
                    if (e.target.closest('button')) return;
                    openSessionEditor(s);
                  },
                },
                el('div', {
                  class: 'ch-stripe',
                  style: { background: project?.color || 'var(--cv-cat-16-fill)' },
                }),
                el(
                  'div',
                  { class: 'ch-grow' },
                  el(
                    'div',
                    { class: 'ch-strong ch-ellipsis' },
                    s.description ||
                      el('span', { class: 'ch-subtle ch-italic' }, 'Sans description'),
                  ),
                  el(
                    'div',
                    { class: 'ch-meta ch-row ch-gap-3 ch-mt-1' },
                    el('span', null, project?.name || 'Sans projet'),
                    el('span', null, '·'),
                    el(
                      'span',
                      { class: 'cv-num' },
                      `${formatTime(s.start)} → ${s.end != null && s.status === 'done' ? formatTime(s.end) : 'en cours'}`,
                    ),
                  ),
                ),
                el(
                  'div',
                  { class: 'cv-num ch-figure ch-duration' },
                  formatDuration(liveDuration(s)),
                ),
                isActive && s.status === 'running'
                  ? el(
                      'div',
                      { class: 'ch-row ch-center ch-gap-3 ch-shrink-0' },
                      UI.Badge({ variant: 'accent', children: 'En cours' }),
                      withFocusKey(
                        UI.IconButton({
                          icon: 'pause',
                          label: 'Mettre en pause',
                          size: 'sm',
                          mutates: true,
                          onclick: () => store.actions.pauseSession(s.id),
                        }),
                        `session:${s.id}:pause`,
                      ),
                      withFocusKey(
                        UI.IconButton({
                          icon: 'stop',
                          label: 'Arrêter',
                          size: 'sm',
                          mutates: true,
                          onclick: () => store.actions.stopSession(s.id),
                        }),
                        `session:${s.id}:stop`,
                      ),
                    )
                  : isActive && s.status === 'paused'
                    ? el(
                        'div',
                        { class: 'ch-row ch-center ch-gap-3 ch-shrink-0' },
                        UI.Badge({ variant: 'warning', children: 'En pause' }),
                        withFocusKey(
                          UI.IconButton({
                            icon: 'play',
                            label: 'Reprendre',
                            size: 'sm',
                            mutates: true,
                            onclick: () => store.actions.resumeSession(s.id),
                          }),
                          `session:${s.id}:reprendre`,
                        ),
                        withFocusKey(
                          UI.IconButton({
                            icon: 'stop',
                            label: 'Arrêter',
                            size: 'sm',
                            mutates: true,
                            onclick: () => store.actions.stopSession(s.id),
                          }),
                          `session:${s.id}:stop`,
                        ),
                      )
                    : el(
                        'div',
                        { class: 'ch-row ch-gap-1 ch-shrink-0' },
                        withFocusKey(
                          UI.IconButton({
                            icon: 'play',
                            label: 'Reprendre ce projet',
                            mutates: true,
                            onclick: () => opts.onStartOnProject(s.projectId, s.description),
                          }),
                          `session:${s.id}:redemarrer`,
                        ),
                        withFocusKey(
                          UI.IconButton({
                            icon: 'pencil-simple',
                            label: 'Modifier',
                            size: 'sm',
                            onclick: () => openSessionEditor(s),
                          }),
                          `session:${s.id}:modifier`,
                        ),
                        withFocusKey(
                          UI.IconButton({
                            icon: 'trash',
                            label: 'Supprimer',
                            size: 'sm',
                            mutates: true,
                            onclick: () => store.actions.deleteSession(s.id),
                          }),
                          `session:${s.id}:supprimer`,
                        ),
                      ),
              );
              return row;
            }),
          );

    return el(
      'section',
      { class: 'cv-card ch-flush' },
      el(
        'header',
        { class: 'ch-card-header' },
        el('h2', { class: 'cv-card__title' }, 'Sessions du jour'),
        el(
          'div',
          { class: 'ch-end' },
          withFocusKey(
            UI.Button({
              size: 'sm',
              icon: 'plus',
              children: 'Nouvelle',
              mutates: true,
              onclick: opts.onOpenQuickAdd,
            }),
            'sessions:new',
          ),
        ),
      ),
      daySessions.length === 0 ? el('div', { class: 'ch-card-body' }, list) : list,
    );
  }

  /* ----------------- Distribution ----------------- */
  /**
   * @param {Session[]} daySessions
   * @param {Project[]} projects
   */
  function distribution(daySessions, projects) {
    const total = daySessions.reduce((s, x) => s + liveDuration(x), 0);
    /** @type {Record<string, number>} */
    const byProject = {};
    for (const s of daySessions) {
      byProject[s.projectId] = (byProject[s.projectId] || 0) + liveDuration(s);
    }
    const listEl = Object.entries(byProject)
      .flatMap(([id, d]) => {
        const project = projects.find((p) => p.id === id);
        return project ? [{ id, duration: d, project }] : [];
      })
      .sort((a, b) => b.duration - a.duration);

    return el(
      'section',
      { class: 'cv-card ch-flush' },
      el(
        'header',
        { class: 'ch-card-header ch-stack ch-align-start ch-gap-1' },
        el('h2', { class: 'cv-card__title' }, 'Répartition par projet'),
        el('div', { class: 'ch-meta' }, 'Clique pour relancer'),
      ),
      listEl.length === 0
        ? el(
            'div',
            { class: 'ch-card-body' },
            UI.EmptyState({
              icon: 'chart-pie-slice',
              title: 'Rien à afficher.',
              text: 'Lance un chrono.',
            }),
          )
        : el(
            'div',
            { class: 'ch-list-pad' },
            listEl.map(({ id, duration, project }) => {
              const pct = total > 0 ? (duration / total) * 100 : 0;
              return el(
                'button',
                {
                  type: 'button',
                  dataset: { focusKey: `distribution:${id}` },
                  'data-mutates': '',
                  onclick: () => opts.onStartOnProject(id),
                  class: 'ch-line-button ch-row ch-center ch-gap-4',
                },
                el(
                  'div',
                  { class: 'ch-grow' },
                  el(
                    'div',
                    { class: 'ch-row ch-center ch-gap-3 ch-mb-2' },
                    el('span', { class: 'ch-swatch', style: { background: project.color } }),
                    el('span', { class: 'ch-ellipsis ch-strong' }, project.name),
                    el('span', { class: 'cv-num ch-figure ch-end' }, formatDuration(duration)),
                  ),
                  el(
                    'div',
                    { class: 'ch-track', 'aria-hidden': 'true' },
                    el('span', { style: { width: `${pct}%`, background: project.color } }),
                  ),
                ),
                icon('play', { className: 'ch-subtle' }),
              );
            }),
          ),
    );
  }

  /* ----------------- Attendance (editing) ----------------- */

  /**
   * @param {AttendanceEvent | null} p
   * @param {number} dayStart
   */
  function openAttendanceEditor(p, dayStart) {
    const isNew = !p;
    const tsInitial = p?.at ?? dayStart + 9 * 3600_000;

    const typeW = UI.Select({
      label: 'Type',
      value: p?.type || 'arrival',
      options: ATTENDANCE_TYPES.map((t) => ({ value: t.value, label: t.label })),
    });
    const timeW = UI.Input({
      label: 'Heure',
      type: 'datetime-local',
      value: timestampToLocal(tsInitial),
      autoFocus: true,
    });

    function save() {
      const t = localToTimestamp(timeW.input.value);
      if (t == null) {
        timeW.setError('Heure illisible. Renseigne une date et une heure valides.');
        timeW.input.focus();
        return;
      }
      const type = /** @type {import('../../types.js').AttendanceType} */ (typeW.input.value);
      if (!p) store.actions.addAttendance(type, t);
      else store.actions.updateAttendance(p.id, { type, at: t });
      modal.close();
    }
    function originalDelete() {
      if (!p) return;
      store.actions.deleteAttendance(p.id);
      modal.close();
    }
    timeW.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
    });
    timeW.input.addEventListener('input', () => timeW.setError(null));

    const footer = [];
    if (!isNew)
      footer.push(
        UI.Button({
          variant: 'danger',
          children: 'Supprimer',
          onclick: originalDelete,
          className: 'ch-push',
        }),
      );
    footer.push(UI.Button({ children: 'Annuler', onclick: () => modal.close() }));
    footer.push(
      UI.Button({
        variant: 'primary',
        children: 'Enregistrer',
        onclick: save,
      }),
    );

    const modal = UI.Modal({
      title: isNew ? 'Ajouter un pointage' : 'Modifier le pointage',
      body: el('div', { class: 'ch-stack ch-gap-4' }, typeW, timeW),
      footer,
    });
  }

  /**
   * @param {AttendanceEvent[]} dayAttendance
   * @param {number} dayStart
   * @param {boolean} isToday
   */
  function attendanceSection(dayAttendance, dayStart, isToday) {
    const orders = dayAttendance.slice().sort((a, b) => a.at - b.at);
    const hasArrival = dayAttendance.some((e) => e.type === 'arrival');
    const nowBoundary = isToday ? Date.now() : dayBounds(dayStart).end;
    const presence = hasArrival ? UI.presenceDuration(dayAttendance, nowBoundary) : 0;
    return el(
      'section',
      { class: 'cv-card ch-flush' },
      el(
        'header',
        { class: 'ch-card-header ch-wrap' },
        el(
          'div',
          { class: 'ch-grow' },
          el('h2', { class: 'cv-card__title' }, 'Pointages du jour'),
          el(
            'div',
            { class: 'ch-meta ch-mt-1' },
            'Arrivée, pauses, départ. Clique pour corriger une heure.',
          ),
        ),
        hasArrival
          ? el(
              'div',
              { class: 'ch-end ch-text-right' },
              el('div', { class: 'cv-overline' }, 'Présence totale'),
              el('div', { class: 'cv-num ch-kpi ch-kpi--sm ch-mt-2' }, formatDuration(presence)),
            )
          : null,
        el(
          'div',
          { class: hasArrival ? null : 'ch-end' },
          withFocusKey(
            UI.Button({
              size: 'sm',
              icon: 'plus',
              children: 'Ajouter',
              mutates: true,
              onclick: () => openAttendanceEditor(null, dayStart),
            }),
            'attendance:add',
          ),
        ),
      ),
      orders.length === 0
        ? el(
            'div',
            { class: 'ch-card-body' },
            UI.EmptyState({
              icon: 'clock',
              title: 'Aucun pointage pour ce jour.',
              text: 'Utilise « Ajouter » pour reconstituer la journée.',
            }),
          )
        : el(
            'div',
            { class: 'ch-row ch-wrap ch-gap-3 ch-card-body' },
            orders.map((p) => {
              const meta = ATTENDANCE_META[p.type] ?? ATTENDANCE_TYPES[0];
              if (!meta) return null;
              return el(
                'button',
                {
                  type: 'button',
                  dataset: { focusKey: `attendance:${p.id ?? `${p.type}-${p.at}`}` },
                  onclick: () => openAttendanceEditor(p, dayStart),
                  class: 'cv-btn ch-attendance',
                },
                icon(meta.icon, { className: meta.tone }),
                el(
                  'span',
                  { class: 'ch-stack ch-gap-1' },
                  el('span', { class: 'cv-overline' }, meta.label),
                  el('span', { class: 'cv-num ch-figure' }, formatTime(p.at)),
                ),
              );
            }),
          ),
    );
  }

  /* ----------------- Render principal ----------------- */
  // Horizontal scroll of the chart, remembered per displayed day (key = start of the day).
  const scrollByDay = new Map();

  function render() {
    // Before rebuilding: remember the scroll of the chart (for the day it shows)
    // and the focused element. A container that is not displayed (scrollLeft forced to 0) is not remembered.
    const previousScroll = /** @type {HTMLElement | null} */ (
      host.querySelector('[data-role="timeline-scroll"]')
    );
    // Only a container that is already positioned is remembered: the very first render happens before
    // insertion in the document (clientWidth = 0), and its scrollLeft of 0 would otherwise overwrite
    // the initial centring on the current time.
    if (previousScroll && previousScroll.clientWidth > 0 && previousScroll.dataset.positioned) {
      scrollByDay.set(previousScroll.dataset.day ?? '', previousScroll.scrollLeft);
    }
    const active = document.activeElement;
    const focusKey =
      active && host.contains(active)
        ? /** @type {HTMLElement | null} */ (active.closest('[data-focus-key]'))?.dataset.focusKey
        : null;

    // The view is drawn again every second: the button whose tooltip the pointer is on is
    // remembered, and its tooltip is shown again below.
    const hoveredKey = /** @type {HTMLElement | null} */ (
      host.querySelector('.cv-tooltip-wrap:hover [data-focus-key]')
    )?.dataset.focusKey;

    const s = store.state;
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(baseDate.getDate() + dateOffset);
    const dayStart = baseDate.getTime();
    const dayEnd = dayBounds(dayStart).end;
    const isToday = dateOffset === 0;

    const daySessions = s.sessions
      .filter((x) => x.start >= dayStart && x.start < dayEnd)
      .sort((a, b) => a.start - b.start);
    const dayAttendance = s.attendance
      .filter((p) => p.at >= dayStart && p.at < dayEnd)
      .sort((a, b) => a.at - b.at);

    const totalWorked = daySessions.reduce((acc, x) => acc + liveDuration(x), 0);
    const arrival = dayAttendance.find((p) => p.type === 'arrival');
    const lastDeparture = [...dayAttendance].reverse().find((p) => p.type === 'departure');

    const dayLabel =
      dateOffset === 0
        ? "Aujourd'hui"
        : dateOffset === -1
          ? 'Hier'
          : new Date(dayStart).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
    const dayLabelDate = new Date(dayStart).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    host.replaceChildren(
      // Date banner + stats
      el(
        'div',
        { class: 'ch-row ch-align-end ch-wrap ch-gap-7' },
        el(
          'div',
          { class: 'ch-row ch-center ch-gap-3' },
          withFocusKey(
            UI.IconButton({
              icon: 'caret-left',
              label: 'Jour précédent',
              onclick: () => {
                dateOffset--;
                render();
              },
            }),
            'nav:precedent',
          ),
          el(
            'div',
            null,
            el('h1', { class: 'cv-h1 ch-page-title ch-capitalize' }, dayLabel),
            el('div', { class: 'ch-meta ch-capitalize ch-mt-1' }, dayLabelDate),
          ),
          withFocusKey(
            UI.IconButton({
              icon: 'caret-right',
              label: 'Jour suivant',
              disabled: dateOffset >= 0,
              onclick: () => {
                dateOffset++;
                render();
              },
            }),
            'nav:suivant',
          ),
          dateOffset !== 0
            ? withFocusKey(
                UI.Button({
                  size: 'sm',
                  variant: 'ghost',
                  children: "Aujourd'hui",
                  onclick: () => {
                    dateOffset = 0;
                    render();
                  },
                }),
                'nav:aujourdhui',
              )
            : null,
        ),
        el(
          'div',
          { class: 'ch-row ch-gap-7 ch-end' },
          statBlock(
            'Temps travaillé',
            formatDuration(totalWorked),
            `${daySessions.length} session${daySessions.length > 1 ? 's' : ''}`,
          ),
          statBlock(
            'Amplitude',
            arrival
              ? `${formatTime(arrival.at)} → ${lastDeparture ? formatTime(lastDeparture.at) : '···'}`
              : '—',
            arrival ? (lastDeparture ? 'journée clôturée' : 'en cours') : 'pas encore arrivé',
          ),
        ),
      ),

      // Timeline chart
      el(
        'section',
        { class: 'cv-card ch-flush' },
        el(
          'header',
          { class: 'ch-card-header ch-wrap' },
          el(
            'div',
            null,
            el('h2', { class: 'cv-card__title' }, 'Journée en continu'),
            el(
              'div',
              { class: 'ch-meta ch-mt-1' },
              'Les chronos en parallèle s’empilent en voies. Fais défiler pour voir le reste de la journée.',
            ),
          ),
          el(
            'div',
            { class: 'ch-row ch-center ch-gap-5 ch-meta ch-end' },
            legendItem('var(--cv-success-surface)', 'var(--cv-fg-success)', 'Présence'),
            legendItem('var(--cv-warning-surface)', 'var(--cv-fg-warning)', 'Pause'),
            legendItem('var(--cv-surface-inverse)', 'var(--cv-surface-inverse)', 'Session'),
          ),
        ),
        timelineChart(dayStart, daySessions, dayAttendance, s.projects, isToday),
      ),

      // Bottom: sessions + distribution
      el(
        'div',
        { class: 'ch-grid-day' },
        sessionsList(daySessions, s.projects),
        el(
          'div',
          { class: 'ch-stack ch-gap-6' },
          attendanceSection(dayAttendance, dayStart, isToday),
          distribution(daySessions, s.projects),
        ),
      ),
    );
    // Restores the scroll of the chart.
    const scroller = /** @type {HTMLElement | null} */ (
      host.querySelector('[data-role="timeline-scroll"]')
    );
    if (scroller && scroller.clientWidth > 0) {
      const remembered = scrollByDay.get(String(dayStart));
      if (remembered != null) {
        scroller.scrollLeft = remembered;
      } else if (isToday && scroller.scrollWidth > scroller.clientWidth) {
        // First display of the current day: the current time visible, around 2/3 of the width.
        // The chart is laid out in rem: its px size follows the root font size.
        const scale = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
        scroller.scrollLeft = Math.max(
          0,
          (CHART_PAD_X + tsToPx(Date.now())) * scale - (scroller.clientWidth * 2) / 3,
        );
      }
      scroller.dataset.positioned = '1';
    } else if (scroller && !scroller.isConnected) {
      // Not yet in the document (first render): position as soon as it is displayed.
      requestAnimationFrame(() => {
        if (scroller.isConnected && !scroller.dataset.positioned) render();
      });
    }

    // Restores the keyboard focus.
    if (focusKey) {
      const targetId = [
        .../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll('[data-focus-key]')),
      ].find((n) => n.dataset.focusKey === focusKey);
      if (targetId) targetId.focus({ preventScroll: true });
    }
    if (hoveredKey) {
      const hovered = [
        .../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll('[data-focus-key]')),
      ].find((n) => n.dataset.focusKey === hoveredKey);
      hovered?.closest('.cv-tooltip-wrap')?.dispatchEvent(new MouseEvent('mouseenter'));
    }
  }

  render();
  const offState = store.onState(render);
  const offTick = store.onTick(() => {
    if (dateOffset === 0) render();
  });

  return {
    el: host,
    destroy() {
      offState();
      offTick();
    },
  };
}

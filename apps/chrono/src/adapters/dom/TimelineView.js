// "Timeline" view: date banner, stats, hourly chart, sessions, distribution.
import * as UI from './ui.js';

const { el, icon, formatDuration, formatTime, liveDuration } = UI;

const START_HOUR = 7;
const END_HOUR = 20;
const PX_PER_HOUR = 84;

const ATTENDANCE_TYPES = [
  { value: 'arrival', label: 'Arrivée', icon: 'sign-in', color: 'var(--cv-success-600)' },
  { value: 'break_start', label: 'Début de pause', icon: 'pause', color: 'var(--cv-warning-700)' },
  { value: 'break_end', label: 'Fin de pause', icon: 'play', color: 'var(--cv-warning-700)' },
  { value: 'departure', label: 'Départ', icon: 'sign-out', color: 'var(--cv-fg-muted)' },
];
const ATTENDANCE_META = Object.fromEntries(ATTENDANCE_TYPES.map((p) => [p.value, p]));

// Horizontal scale of the chart (px from the left edge of the content).
const CHART_PAD_X = 16;
const hourToPx = (h) => (h - START_HOUR) * PX_PER_HOUR;
const tsToPx = (ts) => {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  return hourToPx(h);
};

// Sets a stable focus key (dataset.focusKey) on an element that is already built.
const withFocusKey = (node, key) => {
  node.dataset.focusKey = key;
  return node;
};

export function createTimelineView(store, opts) {
  let dateOffset = 0;

  const host = el('div', { class: 'ch-pile ch-g20' });

  function statBlock(label, value, subtext, { accent, mono = true } = {}) {
    return el(
      'div',
      null,
      el('div', { class: 'ch-surtitre' }, label),
      el(
        'div',
        {
          style: {
            marginTop: 4,
            font: `500 22px/1 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
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
                marginTop: 3,
                font: '400 11px/1.2 var(--cv-font-sans)',
                color: 'var(--cv-fg-subtle)',
              },
            },
            subtext,
          )
        : null,
    );
  }

  function legendItem(color, label, stripe) {
    return el(
      'span',
      { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
      el('span', {
        style: {
          width: 14,
          height: 8,
          borderRadius: 2,
          background: stripe
            ? `repeating-linear-gradient(135deg, ${color} 0 3px, transparent 3px 6px)`
            : color,
          border: stripe ? `1px solid ${color}` : 'none',
        },
      }),
      label,
    );
  }

  function openSessionEditor(s) {
    const projects = store.state.projects;
    let modal;

    function timestampToLocal(ts) {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function localToTimestamp(v) {
      const t = new Date(v).getTime();
      return isNaN(t) ? null : t;
    }

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
    });
    const endW =
      s.status === 'done'
        ? UI.Input({ label: 'Fin', value: timestampToLocal(s.end), type: 'datetime-local' })
        : null;

    const displayedDuration = el(
      'div',
      {
        style: { font: '500 18px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', marginTop: 4 },
      },
      formatDuration(liveDuration(s)),
    );
    // Same rule as updateSession (core/sessions.js): the break time already deducted from
    // the original session is kept, the recorded duration = block - breaks.
    const originalPauses =
      s.status === 'done' && s.start != null && s.end != null
        ? Math.max(0, s.end - s.start - (s.duration || 0))
        : 0;
    function pauseLabel(ms) {
      const min = Math.max(1, Math.round(ms / 60000));
      const h = Math.floor(min / 60);
      return h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
    }
    const breaksNote =
      originalPauses > 0
        ? el(
            'div',
            {
              class: 'ch-legende',
              style: { marginTop: 4 },
            },
            `dont ${pauseLabel(originalPauses)} de pause déduites`,
          )
        : null;
    function recomputeDuration() {
      if (s.status !== 'done') return;
      const d = localToTimestamp(startW.input.value);
      const f = localToTimestamp(endW.input.value);
      if (d != null && f != null && f >= d)
        displayedDuration.textContent = formatDuration(Math.max(0, f - d - originalPauses));
    }
    startW.input.addEventListener('input', recomputeDuration);
    if (endW) endW.input.addEventListener('input', recomputeDuration);

    function save() {
      const patch = {
        projectId: projectW.input.value,
        description: descW.input.value.trim(),
      };
      const start = localToTimestamp(startW.input.value);
      if (start != null) patch.start = start;
      if (endW) {
        const end = localToTimestamp(endW.input.value);
        if (end != null) patch.end = end;
        if (patch.start != null && patch.end != null && patch.end < patch.start) {
          alert('La fin doit être après le début.');
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

    modal = UI.Modal({
      title: 'Modifier la session',
      width: 480,
      body: el(
        'div',
        { class: 'ch-pile ch-g12' },
        projectW,
        descW,
        el(
          'div',
          { class: 'ch-flex ch-g10' },
          el('div', { style: { flex: 1 } }, startW),
          endW ? el('div', { style: { flex: 1 } }, endW) : null,
        ),
        s.status === 'done'
          ? el(
              'div',
              null,
              el(
                'div',
                {
                  style: {
                    font: '500 11px/1.3 var(--cv-font-sans)',
                    color: 'var(--cv-fg-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  },
                },
                'Durée calculée',
              ),
              displayedDuration,
              breaksNote,
            )
          : el(
              'div',
              {
                style: {
                  padding: '8px 10px',
                  background: 'var(--cv-accent-50)',
                  border: '1px solid var(--cv-accent-100)',
                  borderRadius: 6,
                  font: '400 12px/1.4 var(--cv-font-sans)',
                  color: 'var(--cv-accent-700)',
                },
              },
              'Session encore active — la durée continue de courir.',
            ),
      ),
      footer: [
        UI.Button({
          variant: 'destructive',
          icon: 'trash',
          children: 'Supprimer',
          onclick: originalDelete,
          style: { marginRight: 'auto' },
        }),
        UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
        UI.Button({
          variant: 'primary',
          icon: 'check',
          children: 'Enregistrer',
          onclick: save,
        }),
      ],
    });
  }

  /* ----------------- TimelineChart ----------------- */
  function timelineChart(dayStart, daySessions, dayAttendance, projects, isToday) {
    const totalHours = END_HOUR - START_HOUR;
    const widthPx = totalHours * PX_PER_HOUR;
    const msToPx = (ms) => (ms / 3600_000) * PX_PER_HOUR;

    // presence segments
    const presenceSegs = [];
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
        end: isToday ? Date.now() : dayStart + 86400000,
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
        end: isToday ? Date.now() : dayStart + 86400000,
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
            class: 'ch-mono-xs',
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
            background: 'var(--cv-success-50)',
            borderTop: '2px solid var(--cv-success-500)',
            borderBottom: '2px solid var(--cv-success-500)',
            opacity: 0.9,
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
            background:
              'repeating-linear-gradient(135deg, var(--cv-warning-100) 0 6px, var(--cv-warning-50) 6px 12px)',
            borderTop: '2px solid var(--cv-warning-500)',
            borderBottom: '2px solid var(--cv-warning-500)',
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
    const placed = daySessions
      .map((s) => {
        const durationMs = liveDuration(s);
        return { s, durationMs, start: s.start, end: s.start + Math.max(durationMs, 60_000) };
      })
      .sort((a, b) => a.start - b.start);

    // Grouping into "clusters" of overlapping sessions (connected
    // components), then distribution into columns INSIDE each cluster.
    // Consequence: a session WITHOUT overlap takes the full height of the
    // area (so it is centred, equal margins at the top and bottom), while
    // really parallel timers share the height, without ever
    // changing the total height of the band, which stays constant.
    const clusters = [];
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
    const overlaps = (a, b) => a.start < b.end - 1000 && b.start < a.end - 1000;
    for (const cl of clusters) {
      const colEnds = [];
      for (const item of cl.items) {
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
      const block = el('div', {
        dataset: { focusKey: `session-block:${s.id}` },
        title: `${project?.name || 'Sans projet'} · ${formatTime(s.start)} → ${s.status === 'done' ? formatTime(s.end) : 'en cours'} · ${formatDuration(durationMs)}`,
        onclick: () => openSessionEditor(s),
        style: {
          position: 'absolute',
          left,
          width,
          top,
          height: blockH,
          background: project?.color || 'var(--cv-neutral-500)',
          borderRadius: 6,
          boxShadow: isActive
            ? '0 0 0 2px rgba(234,88,12,0.30), var(--cv-shadow-md)'
            : 'var(--cv-shadow-sm)',
          color: '#fff',
          padding: compact ? '0 9px' : '7px 10px',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          alignItems: compact ? 'center' : 'stretch',
          justifyContent: 'space-between',
          gap: compact ? 8 : 0,
          outline: isRunning ? '2px solid var(--cv-accent-500)' : 'none',
        },
      });
      const title = el(
        'div',
        { class: 'ch-souple', style: { overflow: 'hidden' } },
        el(
          'div',
          {
            class: 'ch-ellipse',
            style: { font: '500 11px/1.2 var(--cv-font-sans)', opacity: 0.85 },
          },
          project?.name || 'Sans projet',
        ),
        !compact && s.description && width > 80
          ? el(
              'div',
              {
                class: 'ch-ellipse',
                style: { marginTop: 2, font: '500 12px/1.3 var(--cv-font-sans)' },
              },
              s.description,
            )
          : null,
      );
      const durationLine = el(
        'div',
        {
          class: 'ch-flex-c',
          style: { font: '500 11px/1 var(--cv-font-mono)', opacity: 0.95, gap: 5, flexShrink: 0 },
        },
        el('span', null, formatDuration(durationMs)),
        isRunning
          ? el('span', {
              class: 'ch-point',
              style: { background: '#fff', animation: 'cv-pulse 1.2s infinite' },
            })
          : null,
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
              background: 'var(--cv-accent-500)',
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
              background: 'var(--cv-accent-500)',
              boxShadow: '0 0 0 3px rgba(234,88,12,0.2)',
            },
          }),
          el(
            'div',
            {
              style: {
                position: 'absolute',
                top: -22,
                left: 4,
                background: 'var(--cv-accent-500)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
                font: '500 10px/1 var(--cv-font-mono)',
                whiteSpace: 'nowrap',
              },
            },
            formatTime(now),
          ),
        ),
      );
    }

    return el(
      'div',
      {
        dataset: { role: 'timeline-scroll', day: String(dayStart) },
        style: { overflowX: 'auto', overflowY: 'hidden', padding: '16px 0 12px' },
      },
      el(
        'div',
        {
          style: {
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
  function sessionsList(daySessions, projects) {
    const list =
      daySessions.length === 0
        ? el(
            'div',
            { class: 'ch-vide' },
            icon('hourglass-low', { size: 22, style: { color: 'var(--cv-fg-subtle)' } }),
            el('div', { style: { marginTop: 6 } }, 'Aucune session pour ce jour.'),
            withFocusKey(
              UI.Button({
                variant: 'primary',
                size: 'sm',
                icon: 'play',
                children: 'Démarrer un chrono',
                style: { marginTop: 12 },
                onclick: opts.onOpenQuickAdd,
              }),
              'sessions-empty:start',
            ),
          )
        : el(
            'div',
            null,
            daySessions.map((s) => {
              const project = projects.find((p) => p.id === s.projectId);
              const isActive = s.status !== 'done';
              const row = el(
                'div',
                {
                  class: isActive
                    ? 'ch-ligne est-actif ch-flex-c ch-g12'
                    : 'ch-ligne ch-flex-c ch-g12',
                  style: { padding: '10px 16px', cursor: 'pointer' },
                  onclick: (e) => {
                    // Avoids opening the editor when a button in the row is clicked.
                    if (e.target.closest('button')) return;
                    openSessionEditor(s);
                  },
                },
                el('div', {
                  style: {
                    width: 4,
                    alignSelf: 'stretch',
                    borderRadius: 2,
                    background: project?.color || 'var(--cv-neutral-400)',
                    flexShrink: 0,
                  },
                }),
                el(
                  'div',
                  { class: 'ch-souple' },
                  el(
                    'div',
                    {
                      class: 'ch-libelle ch-ellipse',
                    },
                    s.description ||
                      el(
                        'span',
                        { style: { color: 'var(--cv-fg-subtle)', fontStyle: 'italic' } },
                        'Sans description',
                      ),
                  ),
                  el(
                    'div',
                    { class: 'ch-legende ch-flex ch-g10', style: { marginTop: 2 } },
                    el('span', null, project?.name || 'Sans projet'),
                    el('span', null, '·'),
                    el(
                      'span',
                      { style: { fontFamily: 'var(--cv-font-mono)' } },
                      `${formatTime(s.start)} → ${s.status === 'done' ? formatTime(s.end) : 'en cours'}`,
                    ),
                  ),
                ),
                el(
                  'div',
                  {
                    style: {
                      font: '500 15px/1 var(--cv-font-mono)',
                      color: 'var(--cv-fg)',
                      minWidth: 56,
                      textAlign: 'right',
                    },
                  },
                  formatDuration(liveDuration(s)),
                ),
                isActive && s.status === 'running'
                  ? el(
                      'div',
                      { class: 'ch-flex-c ch-g6', style: { flexShrink: 0 } },
                      UI.Badge({ variant: 'accent', dot: true, children: 'en cours' }),
                      withFocusKey(
                        UI.IconButton({
                          icon: 'pause',
                          label: 'Mettre en pause',
                          size: 'sm',
                          onclick: () => store.actions.pauseSession(s.id),
                        }),
                        `session:${s.id}:pause`,
                      ),
                      withFocusKey(
                        UI.IconButton({
                          icon: 'stop',
                          label: 'Arrêter',
                          size: 'sm',
                          onclick: () => store.actions.stopSession(s.id),
                        }),
                        `session:${s.id}:stop`,
                      ),
                    )
                  : isActive && s.status === 'paused'
                    ? el(
                        'div',
                        { class: 'ch-flex-c ch-g6', style: { flexShrink: 0 } },
                        UI.Badge({ variant: 'warning', dot: true, children: 'pause' }),
                        withFocusKey(
                          UI.IconButton({
                            icon: 'play',
                            label: 'Reprendre',
                            size: 'sm',
                            onclick: () => store.actions.resumeSession(s.id),
                          }),
                          `session:${s.id}:reprendre`,
                        ),
                        withFocusKey(
                          UI.IconButton({
                            icon: 'stop',
                            label: 'Arrêter',
                            size: 'sm',
                            onclick: () => store.actions.stopSession(s.id),
                          }),
                          `session:${s.id}:stop`,
                        ),
                      )
                    : el(
                        'div',
                        { class: 'ch-flex ch-g2', style: { flexShrink: 0 } },
                        withFocusKey(
                          UI.IconButton({
                            icon: 'play',
                            label: 'Reprendre ce projet',
                            title: 'Redémarrer un chrono sur ce projet',
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
      {
        class: 'ch-carte ch-carte--rogne',
      },
      el(
        'header',
        { class: 'ch-carte-entete ch-flex-c' },
        el('div', { class: 'ch-titre-carte' }, 'Sessions du jour'),
        el(
          'div',
          { style: { marginLeft: 'auto' } },
          withFocusKey(
            UI.Button({
              size: 'sm',
              icon: 'plus',
              children: 'Nouvelle',
              onclick: opts.onOpenQuickAdd,
            }),
            'sessions:new',
          ),
        ),
      ),
      list,
    );
  }

  /* ----------------- Distribution ----------------- */
  function distribution(daySessions, projects) {
    const total = daySessions.reduce((s, x) => s + liveDuration(x), 0);
    const byProject = {};
    for (const s of daySessions) {
      byProject[s.projectId] = (byProject[s.projectId] || 0) + liveDuration(s);
    }
    const listEl = Object.entries(byProject)
      .map(([id, d]) => ({ id, duration: d, project: projects.find((p) => p.id === id) }))
      .filter((x) => x.project)
      .sort((a, b) => b.duration - a.duration);

    return el(
      'section',
      {
        class: 'ch-carte ch-carte--rogne',
      },
      el(
        'header',
        { class: 'ch-carte-entete' },
        el('div', { class: 'ch-titre-carte' }, 'Répartition par projet'),
        el('div', { class: 'ch-legende', style: { marginTop: 2 } }, 'Clique pour relancer'),
      ),
      listEl.length === 0
        ? el('div', { class: 'ch-vide' }, 'Rien à afficher — lance un chrono.')
        : el(
            'div',
            { style: { padding: '8px 0' } },
            listEl.map(({ id, duration, project }) => {
              const pct = total > 0 ? (duration / total) * 100 : 0;
              return el(
                'button',
                {
                  dataset: { focusKey: `distribution:${id}` },
                  onclick: () => opts.onStartOnProject(id),
                  class: 'ch-ligne-bouton ch-flex-c ch-g12',
                },
                el(
                  'div',
                  { class: 'ch-souple' },
                  el(
                    'div',
                    { class: 'ch-flex-c ch-g8', style: { marginBottom: 4 } },
                    el('span', {
                      class: 'ch-pastille',
                      style: { background: project.color, flexShrink: 0 },
                    }),
                    el(
                      'span',
                      {
                        class: 'ch-ellipse',
                        style: { font: '500 13px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)' },
                      },
                      project.name,
                    ),
                    el(
                      'span',
                      {
                        style: {
                          marginLeft: 'auto',
                          font: '500 13px/1 var(--cv-font-mono)',
                          color: 'var(--cv-fg)',
                        },
                      },
                      formatDuration(duration),
                    ),
                  ),
                  el(
                    'div',
                    {
                      style: {
                        height: 6,
                        background: 'var(--cv-neutral-100)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      },
                    },
                    el('div', {
                      style: {
                        width: `${pct}%`,
                        height: '100%',
                        background: project.color,
                        borderRadius: 3,
                        transition: 'width 300ms',
                      },
                    }),
                  ),
                ),
                icon('play', { size: 14, style: { color: 'var(--cv-fg-subtle)' } }),
              );
            }),
          ),
    );
  }

  /* ----------------- Attendance (editing) ----------------- */

  function timestampToLocal(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function localToTimestamp(v) {
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  }

  function openAttendanceEditor(p, dayStart) {
    const isNew = !p;
    let modal;
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
      if (t == null) return;
      const type = typeW.input.value;
      if (isNew) store.actions.addAttendance(type, t);
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

    const footer = [];
    if (!isNew)
      footer.push(
        UI.Button({
          variant: 'destructive',
          icon: 'trash',
          children: 'Supprimer',
          onclick: originalDelete,
          style: { marginRight: 'auto' },
        }),
      );
    footer.push(UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }));
    footer.push(
      UI.Button({
        variant: 'primary',
        icon: 'check',
        children: 'Enregistrer',
        onclick: save,
      }),
    );

    modal = UI.Modal({
      title: isNew ? 'Ajouter un pointage' : 'Modifier le pointage',
      width: 420,
      body: el('div', { class: 'ch-pile ch-g12' }, typeW, timeW),
      footer,
    });
  }

  function attendanceSection(dayAttendance, dayStart, isToday) {
    const orders = dayAttendance.slice().sort((a, b) => a.at - b.at);
    const hasArrival = dayAttendance.some((e) => e.type === 'arrival');
    const nowBoundary = isToday ? Date.now() : dayStart + 86400000;
    const presence = hasArrival ? UI.presenceDuration(dayAttendance, nowBoundary) : 0;
    const hasLeft = dayAttendance.some((e) => e.type === 'departure');
    return el(
      'section',
      {
        class: 'ch-carte ch-carte--rogne',
      },
      el(
        'header',
        { class: 'ch-carte-entete ch-flex-c ch-g12' },
        el(
          'div',
          { style: { minWidth: 0 } },
          el('div', { class: 'ch-titre-carte' }, 'Pointages du jour'),
          el(
            'div',
            { class: 'ch-legende', style: { marginTop: 2 } },
            'Arrivée, pauses, départ — clique pour corriger une heure.',
          ),
        ),
        hasArrival
          ? el(
              'div',
              { style: { marginLeft: 'auto', textAlign: 'right' } },
              el('div', { class: 'ch-surtitre ch-surtitre--xs' }, 'Présence totale'),
              el(
                'div',
                { class: 'ch-flex-c', style: { gap: 5, justifyContent: 'flex-end', marginTop: 4 } },
                isToday && !hasLeft
                  ? el('span', {
                      class: 'ch-point',
                      style: {
                        background: 'var(--cv-success-500)',
                        animation: 'cv-pulse 2s infinite',
                      },
                    })
                  : null,
                el(
                  'span',
                  {
                    style: {
                      font: '500 16px/1 var(--cv-font-mono)',
                      color: 'var(--cv-fg)',
                      letterSpacing: '-0.01em',
                    },
                  },
                  formatDuration(presence),
                ),
              ),
            )
          : null,
        el(
          'div',
          { style: { marginLeft: hasArrival ? 0 : 'auto' } },
          withFocusKey(
            UI.Button({
              size: 'sm',
              icon: 'plus',
              children: 'Ajouter',
              onclick: () => openAttendanceEditor(null, dayStart),
            }),
            'attendance:add',
          ),
        ),
      ),
      orders.length === 0
        ? el(
            'div',
            {
              class: 'ch-vide',
              style: { padding: '24px 16px' },
            },
            icon('clock', { size: 22, style: { color: 'var(--cv-fg-subtle)' } }),
            el('div', { style: { marginTop: 6 } }, 'Aucun pointage pour ce jour.'),
            el(
              'div',
              { style: { marginTop: 4, font: '400 12px/1.4 var(--cv-font-sans)' } },
              'Utilise « Ajouter » pour reconstituer la journée.',
            ),
          )
        : el(
            'div',
            { class: 'ch-flex ch-g8', style: { flexWrap: 'wrap', padding: 12 } },
            orders.map((p) => {
              const meta = ATTENDANCE_META[p.type] || ATTENDANCE_META.arrival;
              return el(
                'button',
                {
                  dataset: { focusKey: `attendance:${p.id ?? `${p.type}-${p.at}`}` },
                  onclick: () => openAttendanceEditor(p, dayStart),
                  title: 'Modifier ou supprimer ce pointage',
                  class: 'ch-chip ch-chip--teinte',
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                  },
                },
                icon(meta.icon, { size: 16, style: { color: meta.color } }),
                el(
                  'div',
                  { class: 'ch-pile ch-g2' },
                  el(
                    'div',
                    {
                      class: 'ch-surtitre ch-surtitre--xs',
                    },
                    meta.label,
                  ),
                  el(
                    'div',
                    { style: { font: '500 13px/1 var(--cv-font-mono)', color: 'var(--cv-fg)' } },
                    formatTime(p.at),
                  ),
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
    const previousScroll = host.querySelector('[data-role="timeline-scroll"]');
    // Only a container that is already positioned is remembered: the very first render happens before
    // insertion in the document (clientWidth = 0), and its scrollLeft of 0 would otherwise overwrite
    // the initial centring on the current time.
    if (previousScroll && previousScroll.clientWidth > 0 && previousScroll.dataset.positioned) {
      scrollByDay.set(previousScroll.dataset.day, previousScroll.scrollLeft);
    }
    const focusKey = host.contains(document.activeElement)
      ? document.activeElement.closest('[data-focus-key]')?.dataset.focusKey
      : null;

    const s = store.state;
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    baseDate.setDate(baseDate.getDate() + dateOffset);
    const dayStart = baseDate.getTime();
    const dayEnd = dayStart + 86400000;
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
        { class: 'ch-flex', style: { alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' } },
        el(
          'div',
          { class: 'ch-flex-c ch-g8' },
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
            el('div', { class: 'ch-titre-page', style: { textTransform: 'capitalize' } }, dayLabel),
            el(
              'div',
              { class: 'ch-meta', style: { textTransform: 'capitalize', marginTop: 2 } },
              dayLabelDate,
            ),
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
        el('div', { style: { flex: 1 } }),
        el(
          'div',
          { class: 'ch-flex', style: { gap: 28 } },
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
            { mono: false },
          ),
        ),
      ),

      // Timeline chart
      el(
        'section',
        { class: 'ch-carte ch-carte--rogne' },
        el(
          'header',
          { class: 'ch-carte-entete ch-flex-c ch-g12' },
          el(
            'div',
            null,
            el('div', { class: 'ch-titre-carte' }, 'Journée en continu'),
            el(
              'div',
              { class: 'ch-legende', style: { marginTop: 2 } },
              'Les chronos en parallèle s’empilent en voies · glisse pour faire défiler',
            ),
          ),
          el(
            'div',
            {
              class: 'ch-flex-c ch-g12',
              style: {
                marginLeft: 'auto',
                font: '400 11px/1 var(--cv-font-sans)',
                color: 'var(--cv-fg-muted)',
              },
            },
            legendItem('var(--cv-success-500)', 'Présence'),
            legendItem('var(--cv-warning-400)', 'Pause', true),
            legendItem('var(--cv-fg)', 'Session'),
          ),
        ),
        timelineChart(dayStart, daySessions, dayAttendance, s.projects, isToday),
      ),

      // Bottom: sessions + distribution
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 } },
        sessionsList(daySessions, s.projects),
        el(
          'div',
          { class: 'ch-pile ch-g20' },
          attendanceSection(dayAttendance, dayStart, isToday),
          distribution(daySessions, s.projects),
        ),
      ),
    );

    // Restores the scroll of the chart.
    const scroller = host.querySelector('[data-role="timeline-scroll"]');
    if (scroller && scroller.clientWidth > 0) {
      const remembered = scrollByDay.get(String(dayStart));
      if (remembered != null) {
        scroller.scrollLeft = remembered;
      } else if (isToday && scroller.scrollWidth > scroller.clientWidth) {
        // First display of the current day: the current time visible, around 2/3 of the width.
        scroller.scrollLeft = Math.max(
          0,
          CHART_PAD_X + tsToPx(Date.now()) - (scroller.clientWidth * 2) / 3,
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
      const targetId = [...host.querySelectorAll('[data-focus-key]')].find(
        (n) => n.dataset.focusKey === focusKey,
      );
      if (targetId) targetId.focus({ preventScroll: true });
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

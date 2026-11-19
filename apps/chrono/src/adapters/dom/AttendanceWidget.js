// sidebar widget: presence + active timer.
// Full re-render on every update (state OR tick). The component is small, so it does not matter.

import * as UI from './ui.js';

const { el, icon, formatDuration, formatTime, liveDuration } = UI;

/** @typedef {import('../../types.js').AttendanceEvent} AttendanceEvent */
/** @typedef {import('../../types.js').Session} Session */
/** @typedef {import('../../types.js').AttendanceType} AttendanceType */

/** @param {AttendanceEvent[]} events */
function totalPauses(events) {
  let total = 0;
  /** @type {number | null} */
  let pauseStart = null;
  for (const e of events) {
    if (e.type === 'break_start') pauseStart = e.at;
    else if (e.type === 'break_end' && pauseStart) {
      total += e.at - pauseStart;
      pauseStart = null;
    }
  }
  if (pauseStart) total += Date.now() - pauseStart;
  return total;
}

/**
 * @param {import('./types.js').Store} store
 * @param {{ onOpenQuickAdd: () => void }} opts
 */
export function createAttendanceWidget(store, opts) {
  const host = el('div', { class: 'ch-pile ch-g12' });

  function render() {
    const s = store.state;
    const attState = store.attendanceState();
    const actives = s.sessions.filter((x) => x.status !== 'done').sort((a, b) => a.start - b.start);
    const runningCount = actives.filter((x) => x.status === 'running').length;

    const status = attState.status;
    const arrival = attState.events.find((e) => e.type === 'arrival');
    const lastBreakStartEvent = attState.events
      .filter((e) => e.type === 'break_start')
      .slice(-1)[0];
    const presenceDuration = arrival ? Date.now() - arrival.at - totalPauses(attState.events) : 0;
    const currentBreakDuration =
      lastBreakStartEvent && status === 'on_break' ? Date.now() - lastBreakStartEvent.at : 0;

    /**
     * @type {Record<
     *   import('../../types.js').AttendanceState['status'],
     *   {
     *     label: string, color: string, dot: string, cta: string | null, ctaVariant: string,
     *     action: import('../../types.js').AttendanceType | null,
     *   }
     * >}
     */
    const metas = {
      not_arrived: {
        label: 'Pas encore arrivé',
        color: 'var(--cv-fg-muted)',
        dot: 'var(--cv-neutral-400)',
        action: 'arrival',
        cta: 'Pointer arrivée',
        ctaVariant: 'primary',
      },
      present: {
        label: 'Présent',
        color: 'var(--cv-success-700)',
        dot: 'var(--cv-success-500)',
        action: 'break_start',
        cta: 'Pause',
        ctaVariant: 'secondary',
      },
      on_break: {
        label: 'En pause',
        color: 'var(--cv-warning-700)',
        dot: 'var(--cv-warning-500)',
        action: 'break_end',
        cta: 'Reprendre',
        ctaVariant: 'primary',
      },
      left: {
        label: 'Journée terminée',
        color: 'var(--cv-fg-muted)',
        dot: 'var(--cv-neutral-400)',
        action: null,
        cta: null,
        ctaVariant: 'secondary',
      },
    };
    const meta = metas[status];

    // ----- presence block -----
    const presenceBlock = el(
      'section',
      {
        class: 'ch-panneau ch-pile ch-g10',
        style: { padding: 14 },
      },
      el(
        'div',
        { class: 'ch-flex-c ch-g8' },
        el('span', {
          style: {
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: meta.dot,
            animation: status === 'present' ? 'cv-pulse 2s infinite' : 'none',
            boxShadow: status === 'present' ? '0 0 0 3px rgba(22,163,74,0.15)' : 'none',
          },
        }),
        el(
          'span',
          {
            style: {
              font: '600 12px/1 var(--cv-font-sans)',
              color: meta.color,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            },
          },
          meta.label,
        ),
      ),

      arrival && status !== 'not_arrived'
        ? el(
            'div',
            { class: 'ch-pile ch-g6' },
            el(
              'div',
              { class: 'ch-flex ch-entre ch-g8', style: { alignItems: 'baseline' } },
              el(
                'div',
                {
                  style: { font: '500 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)' },
                },
                'Présence',
              ),
              el(
                'div',
                {
                  style: {
                    font: '500 20px/1 var(--cv-font-mono)',
                    color: 'var(--cv-fg)',
                    letterSpacing: '-0.02em',
                  },
                },
                formatDuration(presenceDuration),
              ),
            ),
            el(
              'div',
              { class: 'ch-legende ch-flex-c ch-g6' },
              icon('sign-in', { size: 13 }),
              el(
                'span',
                null,
                'Arrivée ',
                el(
                  'span',
                  { style: { fontFamily: 'var(--cv-font-mono)', color: 'var(--cv-fg)' } },
                  formatTime(arrival.at),
                ),
              ),
              status === 'on_break'
                ? el(
                    'span',
                    { style: { marginLeft: 'auto', color: 'var(--cv-warning-700)' } },
                    `pause · ${formatDuration(currentBreakDuration, { compact: true })}`,
                  )
                : null,
            ),
          )
        : null,

      el(
        'div',
        { class: 'ch-flex ch-g6' },
        meta.cta
          ? UI.Button({
              variant: meta.ctaVariant,
              size: 'sm',
              icon: status === 'not_arrived' ? 'sign-in' : status === 'present' ? 'pause' : 'play',
              children: meta.cta,
              mutates: true,
              onclick: () =>
                store.actions.recordAttendance(/** @type {AttendanceType} */ (meta.action)),
              style: { flex: 1 },
            })
          : null,
        status === 'present' || status === 'on_break'
          ? UI.Button({
              variant: 'ghost',
              size: 'sm',
              icon: 'sign-out',
              children: 'Partir',
              title: 'Clôturer la journée',
              mutates: true,
              onclick: () => {
                // On a break: close the break first to keep a clean history.
                // The timer suspended by the break is resumed, then stopped right after by 'departure'.
                if (status === 'on_break') store.actions.recordAttendance('break_end');
                store.actions.recordAttendance('departure'); // automatically stops the active timer if there is one
              },
            })
          : null,
        status === 'left'
          ? el(
              'div',
              {
                class: 'ch-indice',
                style: { flex: 1, textAlign: 'center' },
              },
              'À demain.',
            )
          : null,
      ),
    );

    // ----- active timers (parallel) -----
    /** @param {Session} active */
    function chronoCard(active) {
      const project = s.projects.find((p) => p.id === active.projectId);
      const isRunning = active.status === 'running';
      return el(
        'section',
        {
          class: 'ch-pile ch-g8',
          style: {
            background: 'var(--cv-fg)',
            color: 'var(--cv-fg-inverse)',
            border: '1px solid var(--cv-fg)',
            borderRadius: 10,
            padding: 12,
          },
        },
        el(
          'div',
          { class: 'ch-flex-c ch-g8' },
          el('span', {
            style: {
              width: 7,
              height: 7,
              borderRadius: '50%',
              flexShrink: 0,
              background: isRunning ? 'var(--cv-accent-400)' : 'var(--cv-neutral-400)',
              animation: isRunning ? 'cv-pulse 1.2s infinite' : 'none',
            },
          }),
          project
            ? el('span', {
                class: 'ch-pastille',
                style: { background: project.color, flexShrink: 0 },
              })
            : null,
          el(
            'div',
            { class: 'ch-souple' },
            el(
              'div',
              {
                class: 'ch-ellipse',
                style: { font: '500 12px/1.2 var(--cv-font-sans)' },
              },
              project?.name || 'Sans projet',
            ),
            active.description
              ? el(
                  'div',
                  {
                    class: 'ch-ellipse',
                    style: {
                      font: '400 10px/1.3 var(--cv-font-sans)',
                      color: 'rgba(255,255,255,0.6)',
                      marginTop: 1,
                    },
                  },
                  active.description,
                )
              : null,
          ),
        ),
        el(
          'div',
          { class: 'ch-flex-c ch-g6' },
          el(
            'div',
            {
              style: { font: '500 20px/1 var(--cv-font-mono)', letterSpacing: '-0.02em', flex: 1 },
            },
            formatDuration(liveDuration(active), { withSeconds: true }),
          ),
          isRunning
            ? el(
                'button',
                {
                  'data-mutates': '',
                  onclick: () => store.actions.pauseSession(active.id),
                  class: 'ch-btn-sombre',
                  title: 'Mettre en pause',
                },
                icon('pause', { size: 14 }),
              )
            : el(
                'button',
                {
                  'data-mutates': '',
                  onclick: () => store.actions.resumeSession(active.id),
                  class: 'ch-btn-sombre ch-btn-sombre--accent',
                  title: 'Reprendre',
                },
                icon('play', { size: 14 }),
              ),
          el(
            'button',
            {
              'data-mutates': '',
              onclick: () => store.actions.stopSession(active.id),
              class: 'ch-btn-sombre',
              title: 'Arrêter & enregistrer',
            },
            icon('stop', { size: 14 }),
          ),
        ),
      );
    }

    let activeBlock;
    if (actives.length === 0) {
      activeBlock = el(
        'section',
        {
          class: 'ch-pile ch-g10',
          style: {
            background: 'var(--cv-surface)',
            color: 'var(--cv-fg)',
            border: '1px dashed var(--cv-border-strong)',
            borderRadius: 10,
            padding: 16,
          },
        },
        el(
          'div',
          { class: 'ch-flex-c ch-g8' },
          icon('timer', { size: 16, style: { color: 'var(--cv-fg-subtle)' } }),
          el('span', { class: 'ch-libelle' }, 'Aucun chrono actif'),
        ),
        el(
          'div',
          { class: 'ch-note' },
          'Lance un ou plusieurs chronos en parallèle — depuis un projet, une todo ou en un clic.',
        ),
        UI.Button({
          variant: 'primary',
          size: 'sm',
          icon: 'play',
          children: 'Démarrer un chrono',
          mutates: true,
          onclick: opts.onOpenQuickAdd,
          disabled: status === 'left',
          style: { alignSelf: 'stretch' },
        }),
      );
    } else {
      const header = el(
        'div',
        { class: 'ch-flex-c ch-g8', style: { padding: '0 2px' } },
        el(
          'span',
          {
            class: 'ch-surtitre ch-surtitre--fort',
          },
          actives.length > 1 ? `${actives.length} chronos en parallèle` : 'Chrono actif',
        ),
        actives.length > 1 && runningCount > 0
          ? el(
              'span',
              {
                style: {
                  font: '500 10px/1 var(--cv-font-mono)',
                  color: 'var(--cv-accent-600)',
                  padding: '2px 6px',
                  background: 'var(--cv-accent-50)',
                  borderRadius: 4,
                },
              },
              `${runningCount} en cours`,
            )
          : null,
      );

      const groupBar =
        actives.length > 1
          ? el(
              'div',
              { class: 'ch-flex ch-g6' },
              runningCount > 0
                ? UI.Button({
                    variant: 'secondary',
                    size: 'sm',
                    icon: 'pause',
                    children: 'Tout mettre en pause',
                    mutates: true,
                    onclick: () => store.actions.pauseAll(),
                    style: { flex: 1 },
                  })
                : UI.Button({
                    variant: 'secondary',
                    size: 'sm',
                    icon: 'play',
                    children: 'Tout reprendre',
                    mutates: true,
                    onclick: () => store.actions.resumeAll(),
                    style: { flex: 1 },
                  }),
              UI.Button({
                variant: 'secondary',
                size: 'sm',
                icon: 'stop',
                title: 'Tout arrêter & enregistrer',
                mutates: true,
                onclick: () => store.actions.stopAll(),
              }),
            )
          : null;

      activeBlock = el(
        'section',
        { class: 'ch-pile ch-g8' },
        header,
        ...actives.map(chronoCard),
        groupBar,
        UI.Button({
          variant: 'secondary',
          size: 'sm',
          icon: 'plus',
          children: 'Démarrer un autre chrono',
          mutates: true,
          onclick: opts.onOpenQuickAdd,
          disabled: status === 'left',
          style: { alignSelf: 'stretch' },
        }),
      );
    }

    host.replaceChildren(presenceBlock, activeBlock);
  }

  render();
  const offState = store.onState(render);
  const offTick = store.onTick(render);

  return {
    el: host,
    destroy() {
      offState();
      offTick();
    },
  };
}

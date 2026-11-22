// Presence and running timers, in two forms (decision F of docs/interface-comparison.md):
//  - the full cards, in the page header of the Timeline view (`createAttendanceWidget`);
//  - a compact summary in the top bar, on every view (`createTopbarStatus`): the presence state,
//    the number of timers and the main action.
// Full re-render when the state changes. A tick only rewrites the figures that move (durations),
// so the buttons are not replaced every second: they keep the keyboard focus and their tooltip.

import * as UI from './ui.js';

const { el, icon, formatDuration, formatTime, liveDuration, t, tNodes } = UI;

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
 * What each presence state shows and does: its badge, the main action and, for the compact
 * summary, a shorter label.
 * @type {Record<
 *   import('../../types.js').AttendanceState['status'],
 *   {
 *     label: string, shortLabel: string, variant: import('./types.js').BadgeOptions['variant'],
 *     cta: string | null, ctaVariant: 'primary' | 'secondary',
 *     action: import('../../types.js').AttendanceType | null,
 *   }
 * >}
 */
const PRESENCE_META = {
  not_arrived: {
    label: t('presence.notArrived'),
    shortLabel: t('presence.shortNotArrived'),
    variant: 'neutral',
    action: 'arrival',
    cta: t('presence.clockIn'),
    ctaVariant: 'primary',
  },
  present: {
    label: t('presence.present'),
    shortLabel: t('presence.shortPresent'),
    variant: 'success',
    action: 'break_start',
    cta: t('presence.breakStart'),
    ctaVariant: 'secondary',
  },
  on_break: {
    label: t('presence.onBreak'),
    shortLabel: t('presence.shortOnBreak'),
    variant: 'warning',
    action: 'break_end',
    cta: t('presence.breakEnd'),
    ctaVariant: 'primary',
  },
  left: {
    label: t('presence.left'),
    shortLabel: t('presence.shortLeft'),
    variant: 'neutral',
    action: null,
    cta: null,
    ctaVariant: 'secondary',
  },
};

/**
 * The full cards: presence, then one card per running or paused timer.
 * @param {import('./types.js').Store} store
 * @param {{ onOpenQuickAdd: () => void }} opts
 */
export function createAttendanceWidget(store, opts) {
  const host = el('div', { class: 'ch-live' });

  /** @type {(() => void)[]} */
  let liveUpdaters = [];
  /**
   * A text that follows the clock: written now, and again on every tick.
   * @param {HTMLElement} node
   * @param {() => string} text
   */
  function live(node, text) {
    node.textContent = text();
    liveUpdaters.push(() => {
      node.textContent = text();
    });
    return node;
  }

  function render() {
    liveUpdaters = [];
    const s = store.state;
    const attState = store.attendanceState();
    const actives = s.sessions.filter((x) => x.status !== 'done').sort((a, b) => a.start - b.start);
    const runningCount = actives.filter((x) => x.status === 'running').length;

    const status = attState.status;
    const arrival = attState.events.find((e) => e.type === 'arrival');
    const lastBreakStartEvent = attState.events
      .filter((e) => e.type === 'break_start')
      .slice(-1)[0];
    const presenceDuration = () =>
      arrival ? Date.now() - arrival.at - totalPauses(attState.events) : 0;
    const currentBreakDuration = () =>
      lastBreakStartEvent && status === 'on_break' ? Date.now() - lastBreakStartEvent.at : 0;

    const meta = PRESENCE_META[status];

    // ----- presence block -----
    const presenceBlock = el(
      'section',
      { class: 'cv-card cv-card--compact', 'aria-label': t('presence.section') },
      el('div', null, UI.Badge({ variant: meta.variant, children: meta.label })),

      arrival && status !== 'not_arrived'
        ? el(
            'div',
            { class: 'ch-stack ch-gap-3' },
            el(
              'div',
              { class: 'ch-row ch-between ch-gap-3 ch-baseline' },
              el('div', { class: 'ch-meta' }, t('presence.section')),
              live(el('div', { class: 'cv-num ch-kpi ch-kpi--md' }), () =>
                formatDuration(presenceDuration()),
              ),
            ),
            el(
              'div',
              { class: 'ch-meta ch-row ch-center ch-gap-3' },
              icon('sign-in'),
              el(
                'span',
                null,
                tNodes('presence.arrival', {
                  time: el('span', { class: 'cv-num ch-fg' }, formatTime(arrival.at)),
                }),
              ),
              status === 'on_break'
                ? live(el('span', { class: 'ch-end ch-warning-text' }), () =>
                    t('presence.breakDuration', {
                      duration: formatDuration(currentBreakDuration(), { compact: true }),
                    }),
                  )
                : null,
            ),
          )
        : null,

      el(
        'div',
        { class: 'ch-row ch-gap-3' },
        meta.cta
          ? UI.Button({
              variant: meta.ctaVariant,
              size: 'sm',
              icon: status === 'not_arrived' ? 'sign-in' : status === 'present' ? 'pause' : 'play',
              children: meta.cta,
              mutates: true,
              onclick: () =>
                store.actions.recordAttendance(/** @type {AttendanceType} */ (meta.action)),
              className: 'ch-grow',
            })
          : null,
        status === 'present' || status === 'on_break'
          ? UI.Button({
              variant: 'ghost',
              size: 'sm',
              icon: 'sign-out',
              children: t('presence.leave'),
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
          ? el('div', { class: 'ch-subtle ch-fill ch-center' }, t('presence.seeYou'))
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
        { class: 'ch-ink', 'aria-label': project?.name || t('common.noProject') },
        el(
          'div',
          { class: 'ch-row ch-center ch-gap-3' },
          el(
            'div',
            { class: 'ch-grow' },
            // On the inverse card the project is a chip: the fill under a white label reads on
            // any ground, where a marker is only guaranteed on the surfaces.
            project
              ? UI.setProjectColor(
                  el('span', { class: 'cv-cat-block ch-cat-chip' }, project.name),
                  project,
                )
              : el('div', { class: 'ch-ellipsis ch-strong' }, t('common.noProject')),
            el(
              'div',
              { class: 'ch-caption ch-ellipsis' },
              active.description
                ? t('timers.runningWithDescription', {
                    status: isRunning ? t('common.running') : t('common.paused'),
                    description: active.description,
                  })
                : isRunning
                  ? t('common.running')
                  : t('common.paused'),
            ),
          ),
        ),
        el(
          'div',
          { class: 'ch-row ch-center ch-gap-3' },
          live(el('div', { class: 'cv-num ch-kpi ch-kpi--md ch-grow' }), () =>
            formatDuration(liveDuration(active), { withSeconds: true }),
          ),
          isRunning
            ? UI.IconButton({
                icon: 'pause',
                label: t('common.pause'),
                variant: 'secondary',
                size: 'sm',
                mutates: true,
                onclick: () => store.actions.pauseSession(active.id),
              })
            : UI.IconButton({
                icon: 'play',
                label: t('common.resume'),
                variant: 'primary',
                size: 'sm',
                mutates: true,
                onclick: () => store.actions.resumeSession(active.id),
              }),
          UI.IconButton({
            icon: 'stop',
            label: t('timers.stopAndSave'),
            variant: 'secondary',
            size: 'sm',
            mutates: true,
            onclick: () => store.actions.stopSession(active.id),
          }),
        ),
      );
    }

    let activeBlock;
    if (actives.length === 0) {
      activeBlock = el(
        'section',
        { class: 'cv-card cv-card--compact', 'aria-label': t('timers.section') },
        el(
          'div',
          { class: 'ch-row ch-center ch-gap-3' },
          icon('timer'),
          el('span', { class: 'ch-strong' }, t('timers.none')),
        ),
        el('div', { class: 'ch-meta' }, t('timers.noneHint')),
        el(
          'div',
          null,
          UI.Button({
            variant: 'primary',
            size: 'sm',
            icon: 'play',
            children: t('common.timerStart'),
            mutates: true,
            onclick: opts.onOpenQuickAdd,
            disabled: status === 'left',
          }),
        ),
      );
      activeBlock.classList.add('ch-stack', 'ch-gap-3');
    } else {
      const header = el(
        'div',
        { class: 'ch-row ch-center ch-wrap ch-gap-3 ch-live-head' },
        el('h2', { class: 'cv-overline' }, t('timers.heading', { count: actives.length })),
        actives.length > 1 && runningCount > 0
          ? el(
              'span',
              { class: 'cv-tag cv-tag--mono' },
              t('timers.runningTag', { count: runningCount }),
            )
          : null,
      );

      const groupBar =
        actives.length > 1
          ? [
              runningCount > 0
                ? UI.Button({
                    variant: 'secondary',
                    size: 'sm',
                    icon: 'pause',
                    children: t('common.pauseAll'),
                    mutates: true,
                    onclick: () => store.actions.pauseAll(),
                  })
                : UI.Button({
                    variant: 'secondary',
                    size: 'sm',
                    icon: 'play',
                    children: t('common.resumeAll'),
                    mutates: true,
                    onclick: () => store.actions.resumeAll(),
                  }),
              UI.IconButton({
                icon: 'stop',
                label: t('timers.stopAllAndSave'),
                variant: 'secondary',
                size: 'sm',
                mutates: true,
                onclick: () => store.actions.stopAll(),
              }),
            ]
          : [];

      activeBlock = el(
        'section',
        { class: 'ch-stack ch-gap-3', 'aria-label': t('timers.section') },
        el(
          'div',
          { class: 'ch-row ch-center ch-wrap ch-gap-3' },
          header,
          ...groupBar,
          UI.Button({
            variant: 'secondary',
            size: 'sm',
            icon: 'plus',
            children: t('timers.startAnother'),
            mutates: true,
            onclick: opts.onOpenQuickAdd,
            disabled: status === 'left',
          }),
        ),
        el('div', { class: 'ch-timers' }, ...actives.map(chronoCard)),
      );
    }

    host.replaceChildren(presenceBlock, activeBlock);
  }

  render();
  const offState = store.onState(render);
  const offTick = store.onTick(() => {
    for (const update of liveUpdaters) update();
  });

  return {
    el: host,
    destroy() {
      offState();
      offTick();
    },
  };
}

/**
 * The compact summary of the top bar: the presence state, the number of timers and the main
 * action (start, pause everything or resume everything). It has no figure that moves, so only a
 * change of state draws it again.
 * @param {import('./types.js').Store} store
 * @param {{ onOpenQuickAdd: () => void }} opts
 */
export function createTopbarStatus(store, opts) {
  const host = el('div', {
    class: 'ch-topstatus',
    role: 'group',
    'aria-label': t('presence.group'),
  });

  function render() {
    const status = store.attendanceState().status;
    const meta = PRESENCE_META[status];
    const actives = store.activeSessions();
    const running = actives.filter((x) => x.status === 'running').length;

    /** @type {HTMLElement | null} */
    let count = null;
    if (actives.length > 0) {
      const shown = running > 0 ? running : actives.length;
      count = el(
        'span',
        { class: 'cv-tag cv-tag--mono' },
        icon('timer'),
        // The figure and the words share one inline item: as separate flex items of the tag, the
        // space that opens the words would be dropped and they would touch the figure.
        el(
          'span',
          null,
          String(shown),
          el(
            'span',
            { class: 'ch-topstatus__text' },
            ` ${running > 0 ? t('timers.topRunning', { count: shown }) : t('timers.topPaused', { count: shown })}`,
          ),
        ),
      );
    }

    const action =
      running > 0
        ? UI.IconButton({
            icon: 'pause',
            label: t('common.pauseAll'),
            variant: 'secondary',
            size: 'sm',
            mutates: true,
            onclick: () => store.actions.pauseAll(),
          })
        : actives.length > 0
          ? UI.IconButton({
              icon: 'play',
              label: t('common.resumeAll'),
              variant: 'primary',
              size: 'sm',
              mutates: true,
              onclick: () => store.actions.resumeAll(),
            })
          : UI.IconButton({
              icon: 'play',
              label: t('common.newTimer'),
              variant: 'primary',
              size: 'sm',
              mutates: true,
              disabled: status === 'left',
              onclick: opts.onOpenQuickAdd,
            });

    const badge = UI.Badge({ variant: meta.variant, children: meta.shortLabel });
    host.replaceChildren(...(count ? [badge, count, action] : [badge, action]));
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

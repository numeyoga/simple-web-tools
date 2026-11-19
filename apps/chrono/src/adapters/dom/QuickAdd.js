// "add a timer" modal.
//
// Two modes:
//   • "live"   : starts a timer that runs immediately.
//   • "manual" : creates an already finished session (start + end entered)
//                — typically to catch up on a forgotten range. The session
//                is NOT made active because it already has an end.
import * as UI from './ui.js';

const { el, icon, formatDuration, localToTimestamp, timestampToLocal } = UI;

/**
 * @param {import('./types.js').Store} store
 * @param {import('./types.js').QuickAddOptions} [options]
 */
export function openQuickAddModal(
  store,
  {
    projectPrefill = null,
    descriptionPrefill = '',
    mode: modePrefill = 'live',
    startPrefill = null,
    endPrefill = null,
    onStart,
    onManualAdd,
  } = {},
) {
  let projectId =
    projectPrefill ||
    store.state.projects.find((p) => !p.archived)?.id ||
    store.state.projects[0]?.id ||
    '';
  /** @type {'live' | 'manual'} */
  let mode = modePrefill === 'manual' ? 'manual' : 'live';

  /* --- segmented control mode --- */
  const segWrap = el('div', {
    role: 'tablist',
    style: {
      display: 'inline-flex',
      padding: 3,
      borderRadius: 9,
      background: 'var(--cv-neutral-100)',
      border: '1px solid var(--cv-border)',
      alignSelf: 'flex-start',
    },
  });
  /**
   * @param {'live' | 'manual'} value
   * @param {string} iconName
   * @param {string} label
   */
  function segBtn(value, iconName, label) {
    const btn = el(
      'button',
      {
        role: 'tab',
        onclick: () => {
          mode = value;
          renderMode();
        },
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          border: 'none',
          borderRadius: 6,
          font: '500 12px/1 var(--cv-font-sans)',
          cursor: 'pointer',
          background: 'transparent',
          color: 'var(--cv-fg-muted)',
          transition: 'background 120ms, color 120ms',
        },
      },
      icon(iconName, { size: 13 }),
      label,
    );
    btn.dataset.value = value;
    return btn;
  }
  const segLive = segBtn('live', 'play', 'Démarrer maintenant');
  const segManual = segBtn('manual', 'pencil-simple', 'Saisir manuellement');
  segWrap.appendChild(segLive);
  segWrap.appendChild(segManual);

  function paintSeg() {
    for (const b of [segLive, segManual]) {
      const isOn = b.dataset.value === mode;
      b.style.background = isOn ? 'var(--cv-surface)' : 'transparent';
      b.style.color = isOn ? 'var(--cv-fg)' : 'var(--cv-fg-muted)';
      b.style.boxShadow = isOn ? 'var(--cv-shadow-sm)' : 'none';
    }
  }

  /* --- project list --- */
  const listHost = el('div', {
    class: 'ch-pile ch-g4',
    style: { maxHeight: 240, overflowY: 'auto' },
  });
  function renderListView() {
    const projects = store.state.projects.filter((p) => !p.archived);
    listHost.replaceChildren(
      ...projects.map((p) =>
        el(
          'button',
          {
            onclick: () => {
              projectId = p.id;
              renderListView();
            },
            class: projectId === p.id ? 'ch-option est-actif' : 'ch-option',
          },
          el('span', {
            style: { width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 },
          }),
          el(
            'div',
            { class: 'ch-souple' },
            el(
              'div',
              { class: 'ch-ellipse', style: { font: '500 13px/1.2 var(--cv-font-sans)' } },
              p.name,
            ),
            p.client
              ? el(
                  'div',
                  {
                    style: {
                      font: '400 11px/1.2 var(--cv-font-sans)',
                      color: 'var(--cv-fg-muted)',
                      marginTop: 2,
                    },
                  },
                  p.client,
                )
              : null,
          ),
          projectId === p.id
            ? icon('check-circle', {
                weight: 'fill',
                size: 16,
                style: { color: 'var(--cv-accent-500)' },
              })
            : null,
        ),
      ),
    );
  }
  renderListView();

  /* --- description --- */
  const inputDesc = el('input', {
    value: descriptionPrefill || '',
    placeholder: 'Ex. maquette homepage v3',
    autocomplete: 'off',
    onkeydown: (/** @type {import('./types.js').TargetKeyEvent} */ e) => {
      if (e.key === 'Enter' && mode === 'live') submit();
    },
    style: {
      height: 40,
      padding: '0 12px',
      border: '1px solid var(--cv-border-strong)',
      borderRadius: 8,
      background: 'var(--cv-surface)',
      color: 'var(--cv-fg)',
      font: '400 15px/1 var(--cv-font-sans)',
      outline: 'none',
      transition: 'border-color 120ms',
    },
    onfocus: (/** @type {import('./types.js').TargetEvent} */ e) => {
      e.target.style.borderColor = 'var(--cv-accent-500)';
      e.target.style.boxShadow = 'var(--cv-shadow-focus)';
    },
    onblur: (/** @type {import('./types.js').TargetEvent} */ e) => {
      e.target.style.borderColor = 'var(--cv-border-strong)';
      e.target.style.boxShadow = 'none';
    },
  });

  /* --- "manual entry" block --- */
  // Defaults: without a prefill, propose a one-hour range
  // ending now, rounded to the nearest quarter hour.
  const now = new Date();
  now.setSeconds(0, 0);
  const defaultEnd = endPrefill != null ? endPrefill : now.getTime();
  const defaultStart = startPrefill != null ? startPrefill : defaultEnd - 60 * 60_000;

  const startW = UI.Input({
    label: 'Début',
    type: 'datetime-local',
    value: timestampToLocal(defaultStart),
  });
  const endW = UI.Input({
    label: 'Fin',
    type: 'datetime-local',
    value: timestampToLocal(defaultEnd),
  });
  const displayedDuration = el(
    'div',
    {
      style: { font: '500 16px/1 var(--cv-font-mono)', color: 'var(--cv-fg)' },
    },
    '—',
  );
  const errorBox = el('div', {
    style: {
      display: 'none',
      padding: '6px 10px',
      borderRadius: 6,
      background: 'var(--cv-danger-50, #fef2f2)',
      border: '1px solid var(--cv-danger-200, #fecaca)',
      color: 'var(--cv-danger-700, #b91c1c)',
      font: '400 12px/1.3 var(--cv-font-sans)',
    },
  });

  function recomputeDuration() {
    const d = localToTimestamp(startW.input.value);
    const f = localToTimestamp(endW.input.value);
    if (d == null || f == null) {
      displayedDuration.textContent = '—';
      return;
    }
    if (f < d) {
      displayedDuration.textContent = '—';
      return;
    }
    displayedDuration.textContent = formatDuration(f - d);
  }
  startW.input.addEventListener('input', () => {
    hideError();
    recomputeDuration();
  });
  endW.input.addEventListener('input', () => {
    hideError();
    recomputeDuration();
  });
  startW.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  endW.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  recomputeDuration();

  /** @param {string} msg */
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
  function hideError() {
    errorBox.style.display = 'none';
  }

  const manualBlock = el(
    'div',
    { class: 'ch-pile ch-g10' },
    el(
      'div',
      { class: 'ch-flex ch-g10' },
      el('div', { style: { flex: 1 } }, startW),
      el('div', { style: { flex: 1 } }, endW),
    ),
    el(
      'div',
      {
        class: 'ch-flex-c ch-entre',
        style: {
          padding: '8px 12px',
          background: 'var(--cv-neutral-50)',
          border: '1px solid var(--cv-border)',
          borderRadius: 8,
        },
      },
      el('span', { class: 'ch-surtitre' }, 'Durée'),
      displayedDuration,
    ),
    errorBox,
  );

  /* --- dynamic footer --- */
  const footerHint = el('div', {
    class: 'ch-flex-c ch-g8',
    style: {
      marginRight: 'auto',
      font: '400 12px/1 var(--cv-font-sans)',
      color: 'var(--cv-fg-subtle)',
    },
  });
  const submitBtn = UI.Button({
    variant: 'primary',
    icon: 'play',
    children: 'Démarrer',
    onclick: () => submit(),
  });

  function paintFooter() {
    if (mode === 'live') {
      footerHint.replaceChildren(UI.Kbd('Entrée'), document.createTextNode(' pour démarrer'));
      submitBtn.replaceChildren(
        icon('play', { size: 14, weight: 'fill' }),
        document.createTextNode('Démarrer'),
      );
    } else {
      footerHint.replaceChildren(UI.Kbd('Entrée'), document.createTextNode(' pour enregistrer'));
      submitBtn.replaceChildren(
        icon('check', { size: 14 }),
        document.createTextNode('Enregistrer'),
      );
    }
  }

  /* --- swap the body according to the mode --- */
  const modeHost = el('div', { class: 'ch-pile ch-g14' });
  function renderMode() {
    paintSeg();
    paintFooter();
    modeHost.replaceChildren(
      mode === 'manual'
        ? manualBlock
        : el(
            'div',
            {
              class: 'ch-flex-c ch-g8',
              style: {
                padding: '8px 12px',
                background: 'var(--cv-accent-50)',
                border: '1px solid var(--cv-accent-100)',
                borderRadius: 8,
                font: '400 12px/1.4 var(--cv-font-sans)',
                color: 'var(--cv-accent-700)',
              },
            },
            icon('timer', { size: 14, weight: 'fill' }),
            'Le chrono se lance maintenant — en parallèle des chronos déjà actifs — et tourne jusqu’à ce que tu l’arrêtes.',
          ),
    );
  }

  function submit() {
    if (!projectId) return;
    if (mode === 'live') {
      store.actions.startSession(projectId, inputDesc.value);
      onStart && onStart(projectId);
      modal.close();
    } else {
      const d = localToTimestamp(startW.input.value);
      const f = localToTimestamp(endW.input.value);
      if (d == null || f == null) {
        showError('Renseigne un début et une fin valides.');
        return;
      }
      if (f <= d) {
        showError('La fin doit être postérieure au début.');
        return;
      }
      const id = store.actions.addManualSession({
        projectId,
        description: inputDesc.value,
        start: d,
        end: f,
      });
      if (!id) {
        showError('Impossible d’enregistrer cette session.');
        return;
      }
      onManualAdd && onManualAdd(id, projectId);
      modal.close();
    }
  }

  /* --- modal body --- */
  const body = el(
    'div',
    { class: 'ch-pile ch-g14' },
    segWrap,
    el(
      'label',
      { class: 'ch-pile ch-g4' },
      el('span', { class: 'ch-label' }, 'Sur quoi as-tu travaillé ?'),
      inputDesc,
    ),
    modeHost,
    el(
      'div',
      null,
      el('div', { class: 'ch-label', style: { marginBottom: 6 } }, 'Projet'),
      listHost,
    ),
  );

  const footer = [
    footerHint,
    UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
    submitBtn,
  ];

  const modal = UI.Modal({ title: 'Ajouter un chrono', width: 540, body, footer });
  renderMode();
  setTimeout(() => inputDesc.focus(), 50);
}

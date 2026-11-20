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

  /* --- mode: a segmented control (native radios) --- */
  const segmented = UI.Segmented({
    legend: 'Mode de saisie',
    name: fieldGroupName('mode'),
    options: [
      { value: 'live', label: 'Démarrer maintenant' },
      { value: 'manual', label: 'Saisir manuellement' },
    ],
    value: mode,
    onchange: (value) => {
      mode = value === 'manual' ? 'manual' : 'live';
      renderMode();
    },
  });
  segmented.classList.add('ch-self-start');

  /* --- project list: native radios in a fieldset --- */
  const projectGroup = fieldGroupName('project');
  const listHost = el('fieldset', { class: 'cv-fieldset' });
  function renderListView() {
    const projects = store.state.projects.filter((p) => !p.archived);
    listHost.replaceChildren(
      el('legend', { class: 'cv-label' }, 'Projet'),
      el(
        'div',
        { class: 'ch-radio-list ch-stack' },
        ...projects.map((p) =>
          el(
            'label',
            { class: 'cv-check' },
            el('input', {
              type: 'radio',
              name: projectGroup,
              value: p.id,
              checked: projectId === p.id,
              onchange: () => {
                projectId = p.id;
              },
            }),
            UI.projectName(p),
            p.client ? el('span', { class: 'ch-meta ch-ellipsis' }, p.client) : null,
          ),
        ),
      ),
    );
  }
  renderListView();

  /* --- description --- */
  const descW = UI.Input({
    label: 'Sur quoi as-tu travaillé ?',
    value: descriptionPrefill || '',
    placeholder: 'Ex. maquette homepage v3',
    onkeydown: (e) => {
      if (e.key === 'Enter' && mode === 'live') submit();
    },
  });
  const inputDesc = descW.input;

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
  const displayedDuration = el('div', { class: 'cv-num ch-kpi ch-kpi--sm' }, '—');

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
    endW.setError(null);
    recomputeDuration();
  });
  endW.input.addEventListener('input', () => {
    endW.setError(null);
    recomputeDuration();
  });
  startW.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  endW.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  recomputeDuration();

  const manualBlock = el(
    'div',
    { class: 'ch-stack ch-gap-4' },
    el('div', { class: 'ch-row ch-wrap ch-gap-4' }, startW, endW),
    el(
      'div',
      { class: 'ch-block ch-row ch-center ch-between' },
      el('span', { class: 'cv-overline' }, 'Durée'),
      displayedDuration,
    ),
  );

  /* --- dynamic footer --- */
  const footerHint = el('div', { class: 'ch-meta ch-row ch-center ch-gap-2 ch-push' });
  const submitBtn = UI.Button({
    variant: 'primary',
    icon: 'play',
    children: 'Démarrer',
    onclick: () => submit(),
  });

  function paintFooter() {
    if (mode === 'live') {
      footerHint.replaceChildren(UI.Kbd('Entrée'), document.createTextNode(' pour démarrer'));
      submitBtn.replaceChildren(icon('play'), document.createTextNode('Démarrer'));
    } else {
      footerHint.replaceChildren(UI.Kbd('Entrée'), document.createTextNode(' pour enregistrer'));
      submitBtn.replaceChildren(icon('check'), document.createTextNode('Enregistrer'));
    }
  }

  /* --- swap the body according to the mode --- */
  const modeHost = el('div', { class: 'ch-stack ch-gap-4' });
  function renderMode() {
    paintFooter();
    modeHost.replaceChildren(
      mode === 'manual'
        ? manualBlock
        : UI.Alert({
            status: 'info',
            title: 'Le chrono se lance maintenant.',
            text: 'Il tourne en parallèle des chronos déjà actifs, jusqu’à ce que tu l’arrêtes.',
          }),
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
        failEnd('Début ou fin illisible. Renseigne un début et une fin valides.');
        return;
      }
      if (f <= d) {
        failEnd('La fin est avant le début. Choisis une fin postérieure au début.');
        return;
      }
      const id = store.actions.addManualSession({
        projectId,
        description: inputDesc.value,
        start: d,
        end: f,
      });
      if (!id) {
        failEnd('Impossible d’enregistrer cette session. Vérifie le projet et les heures.');
        return;
      }
      onManualAdd && onManualAdd(id, projectId);
      modal.close();
    }
  }

  /** @param {string} message */
  function failEnd(message) {
    endW.setError(message);
    endW.input.focus();
  }

  /* --- modal body --- */
  const body = el('div', { class: 'ch-stack ch-gap-5' }, segmented, descW, modeHost, listHost);

  const footer = [
    footerHint,
    UI.Button({ children: 'Annuler', onclick: () => modal.close() }),
    submitBtn,
  ];

  const modal = UI.Modal({ title: 'Ajouter un chrono', body, footer });
  renderMode();
  inputDesc.focus();
}

let groupCounter = 0;
/**
 * A name for a group of radios, unique in the document.
 * @param {string} prefix
 */
function fieldGroupName(prefix) {
  groupCounter += 1;
  return `quick-add-${prefix}-${groupCounter}`;
}

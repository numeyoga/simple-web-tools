// widget sidebar : présence + chrono actif.
// Re-rendu complet à chaque update (état OU tick). Le composant est petit, c'est sans incidence.

import * as UI from './ui.js';

const { el, icon, fmtDuree, fmtHeure, dureeVivante } = UI;

function totalPauses(events) {
  let total = 0;
  let pauseStart = null;
  for (const e of events) {
    if (e.type === 'pause_debut') pauseStart = e.at;
    else if (e.type === 'pause_fin' && pauseStart) {
      total += e.at - pauseStart;
      pauseStart = null;
    }
  }
  if (pauseStart) total += Date.now() - pauseStart;
  return total;
}

export function createPointageWidget(store, opts) {
  const host = el('div', { class: 'ch-pile ch-g12' });

  function render() {
    const s = store.state;
    const etat = store.etatPointage();
    const actives = s.sessions
      .filter((x) => x.statut !== 'terminee')
      .sort((a, b) => a.debut - b.debut);
    const nbEnCours = actives.filter((x) => x.statut === 'en_cours').length;

    const statut = etat.statut;
    const arrivee = etat.events.find((e) => e.type === 'arrivee');
    const pauseDebut = etat.events.filter((e) => e.type === 'pause_debut').slice(-1)[0];
    const dureePresence = arrivee ? Date.now() - arrivee.at - totalPauses(etat.events) : 0;
    const dureePauseEnCours = pauseDebut && statut === 'pause' ? Date.now() - pauseDebut.at : 0;

    const meta = {
      pas_arrive: {
        label: 'Pas encore arrivé',
        color: 'var(--cv-fg-muted)',
        dot: 'var(--cv-neutral-400)',
        action: 'arrivee',
        cta: 'Pointer arrivée',
        ctaVariant: 'primary',
      },
      present: {
        label: 'Présent',
        color: 'var(--cv-success-700)',
        dot: 'var(--cv-success-500)',
        action: 'pause_debut',
        cta: 'Pause',
        ctaVariant: 'secondary',
      },
      pause: {
        label: 'En pause',
        color: 'var(--cv-warning-700)',
        dot: 'var(--cv-warning-500)',
        action: 'pause_fin',
        cta: 'Reprendre',
        ctaVariant: 'primary',
      },
      parti: {
        label: 'Journée terminée',
        color: 'var(--cv-fg-muted)',
        dot: 'var(--cv-neutral-400)',
        action: null,
        cta: null,
        ctaVariant: 'secondary',
      },
    }[statut];

    // ----- bloc présence -----
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
            animation: statut === 'present' ? 'cv-pulse 2s infinite' : 'none',
            boxShadow: statut === 'present' ? '0 0 0 3px rgba(22,163,74,0.15)' : 'none',
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

      arrivee && statut !== 'pas_arrive'
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
                fmtDuree(dureePresence),
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
                  fmtHeure(arrivee.at),
                ),
              ),
              statut === 'pause'
                ? el(
                    'span',
                    { style: { marginLeft: 'auto', color: 'var(--cv-warning-700)' } },
                    `pause · ${fmtDuree(dureePauseEnCours, { compact: true })}`,
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
              icon: statut === 'pas_arrive' ? 'sign-in' : statut === 'present' ? 'pause' : 'play',
              children: meta.cta,
              onclick: () => store.actions.pointer(meta.action),
              style: { flex: 1 },
            })
          : null,
        statut === 'present' || statut === 'pause'
          ? UI.Button({
              variant: 'ghost',
              size: 'sm',
              icon: 'sign-out',
              children: 'Partir',
              title: 'Clôturer la journée',
              onclick: () => {
                // En pause : on clôt la pause d'abord pour avoir un historique propre.
                // Le chrono suspendu par la pause sera repris puis stoppé net par 'depart' juste après.
                if (statut === 'pause') store.actions.pointer('pause_fin');
                store.actions.pointer('depart'); // stoppe automatiquement le chrono actif s'il y en a un
              },
            })
          : null,
        statut === 'parti'
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

    // ----- chronos actifs (parallèles) -----
    function chronoCard(active) {
      const proj = s.projets.find((p) => p.id === active.projetId);
      const enCours = active.statut === 'en_cours';
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
              background: enCours ? 'var(--cv-accent-400)' : 'var(--cv-neutral-400)',
              animation: enCours ? 'cv-pulse 1.2s infinite' : 'none',
            },
          }),
          proj
            ? el('span', {
                class: 'ch-pastille',
                style: { background: proj.couleur, flexShrink: 0 },
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
              proj?.nom || 'Sans projet',
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
            fmtDuree(dureeVivante(active), { withSeconds: true }),
          ),
          enCours
            ? el(
                'button',
                {
                  onclick: () => store.actions.pauserSession(active.id),
                  class: 'ch-btn-sombre',
                  title: 'Mettre en pause',
                },
                icon('pause', { size: 14 }),
              )
            : el(
                'button',
                {
                  onclick: () => store.actions.reprendreSession(active.id),
                  class: 'ch-btn-sombre ch-btn-sombre--accent',
                  title: 'Reprendre',
                },
                icon('play', { size: 14 }),
              ),
          el(
            'button',
            {
              onclick: () => store.actions.arreterSession(active.id),
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
          onclick: opts.onOuvrirQuickAdd,
          disabled: statut === 'parti',
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
        actives.length > 1 && nbEnCours > 0
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
              `${nbEnCours} en cours`,
            )
          : null,
      );

      const groupBar =
        actives.length > 1
          ? el(
              'div',
              { class: 'ch-flex ch-g6' },
              nbEnCours > 0
                ? UI.Button({
                    variant: 'secondary',
                    size: 'sm',
                    icon: 'pause',
                    children: 'Tout mettre en pause',
                    onclick: () => store.actions.pauserTout(),
                    style: { flex: 1 },
                  })
                : UI.Button({
                    variant: 'secondary',
                    size: 'sm',
                    icon: 'play',
                    children: 'Tout reprendre',
                    onclick: () => store.actions.reprendreTout(),
                    style: { flex: 1 },
                  }),
              UI.Button({
                variant: 'secondary',
                size: 'sm',
                icon: 'stop',
                title: 'Tout arrêter & enregistrer',
                onclick: () => store.actions.arreterTout(),
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
          onclick: opts.onOuvrirQuickAdd,
          disabled: statut === 'parti',
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

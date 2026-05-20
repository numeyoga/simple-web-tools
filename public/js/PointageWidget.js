// js/PointageWidget.js — widget sidebar : présence + chrono actif.
// Re-rendu complet à chaque update (état OU tick). Le composant est petit, c'est sans incidence.

(function () {
  const { el, icon, fmtDuree, fmtHeure, dureeVivante } = window.UI;

  function totalPauses(events) {
    let total = 0;
    let pauseStart = null;
    for (const e of events) {
      if (e.type === 'pause_debut') pauseStart = e.at;
      else if (e.type === 'pause_fin' && pauseStart) { total += e.at - pauseStart; pauseStart = null; }
    }
    if (pauseStart) total += Date.now() - pauseStart;
    return total;
  }

  const darkBtnStyle = {
    flex: 1, height: 30, padding: '0 10px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: '#fff',
    font: '500 12px/1 var(--cv-font-sans)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    cursor: 'pointer', transition: 'background 120ms',
  };

  function createPointageWidget(store, opts) {
    const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } });

    function render() {
      const s = store.state;
      const etat = store.etatPointage();
      const active = s.activeId ? s.sessions.find(x => x.id === s.activeId) : null;
      const projetActif = active ? s.projets.find(p => p.id === active.projetId) : null;

      const statut = etat.statut;
      const arrivee = etat.events.find(e => e.type === 'arrivee');
      const pauseDebut = etat.events.filter(e => e.type === 'pause_debut').slice(-1)[0];
      const dureePresence = arrivee ? Date.now() - arrivee.at - totalPauses(etat.events) : 0;
      const dureePauseEnCours = pauseDebut && statut === 'pause' ? Date.now() - pauseDebut.at : 0;

      const meta = {
        pas_arrive: { label: 'Pas encore arrivé', color: 'var(--cv-fg-muted)',    dot: 'var(--cv-neutral-400)', action: 'arrivee',     cta: 'Pointer arrivée', ctaVariant: 'primary' },
        present:    { label: 'Présent',           color: 'var(--cv-success-700)', dot: 'var(--cv-success-500)', action: 'pause_debut', cta: 'Pause',           ctaVariant: 'secondary' },
        pause:      { label: 'En pause',          color: 'var(--cv-warning-700)', dot: 'var(--cv-warning-500)', action: 'pause_fin',   cta: 'Reprendre',       ctaVariant: 'primary' },
        parti:      { label: 'Journée terminée',  color: 'var(--cv-fg-muted)',    dot: 'var(--cv-neutral-400)', action: null,          cta: null,              ctaVariant: 'secondary' },
      }[statut];

      // ----- bloc présence -----
      const presenceBlock = el('section', {
        style: {
          background: 'var(--cv-surface)', border: '1px solid var(--cv-border)',
          borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
        },
      },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          el('span', {
            style: {
              width: 8, height: 8, borderRadius: '50%', background: meta.dot,
              animation: statut === 'present' ? 'cv-pulse 2s infinite' : 'none',
              boxShadow: statut === 'present' ? '0 0 0 3px rgba(22,163,74,0.15)' : 'none',
            },
          }),
          el('span', {
            style: { font: '600 12px/1 var(--cv-font-sans)', color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' },
          }, meta.label),
        ),

        (arrivee && statut !== 'pas_arrive') ? el('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          el('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 } },
            el('div', { style: { font: '500 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)' } }, 'Présence'),
            el('div', { style: { font: '500 20px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', letterSpacing: '-0.02em' } },
              fmtDuree(dureePresence)),
          ),
          el('div', { style: { display: 'flex', alignItems: 'center', gap: 6, font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
            icon('sign-in', { size: 13 }),
            el('span', null,
              'Arrivée ',
              el('span', { style: { fontFamily: 'var(--cv-font-mono)', color: 'var(--cv-fg)' } }, fmtHeure(arrivee.at)),
            ),
            statut === 'pause' ? el('span', { style: { marginLeft: 'auto', color: 'var(--cv-warning-700)' } },
              `pause · ${fmtDuree(dureePauseEnCours, { compact: true })}`) : null,
          ),
        ) : null,

        el('div', { style: { display: 'flex', gap: 6 } },
          meta.cta ? UI.Button({
            variant: meta.ctaVariant, size: 'sm',
            icon: statut === 'pas_arrive' ? 'sign-in' : statut === 'present' ? 'pause' : 'play',
            children: meta.cta,
            onclick: () => store.actions.pointer(meta.action),
            style: { flex: 1 },
          }) : null,
          (statut === 'present' || statut === 'pause') ? UI.Button({
            variant: 'ghost', size: 'sm', icon: 'sign-out', children: 'Partir',
            title: 'Clôturer la journée',
            onclick: () => {
              if (s.activeId) store.actions.arreter();
              if (statut === 'pause') store.actions.pointer('pause_fin');
              store.actions.pointer('depart');
            },
          }) : null,
          statut === 'parti' ? el('div', {
            style: { flex: 1, font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)', textAlign: 'center' },
          }, 'À demain.') : null,
        ),
      );

      // ----- bloc session active -----
      const activeBlock = el('section', {
        style: {
          background: active ? 'var(--cv-fg)' : 'var(--cv-surface)',
          color: active ? 'var(--cv-fg-inverse)' : 'var(--cv-fg)',
          border: active ? '1px solid var(--cv-fg)' : '1px dashed var(--cv-border-strong)',
          borderRadius: 10, padding: active ? 14 : 16,
          display: 'flex', flexDirection: 'column', gap: 10,
          transition: 'background 180ms, color 180ms',
        },
      });

      if (active) {
        activeBlock.append(
          el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            el('span', {
              style: {
                width: 8, height: 8, borderRadius: '50%',
                background: active.statut === 'en_cours' ? 'var(--cv-accent-400)' : 'var(--cv-neutral-400)',
                animation: active.statut === 'en_cours' ? 'cv-pulse 1.2s infinite' : 'none',
              },
            }),
            el('span', {
              style: { font: '600 11px/1 var(--cv-font-sans)', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' },
            }, active.statut === 'en_cours' ? 'Chrono actif' : 'Chrono en pause'),
          ),
          el('div', {
            style: { font: '500 28px/1 var(--cv-font-mono)', letterSpacing: '-0.02em' },
          }, fmtDuree(dureeVivante(active), { withSeconds: true })),
          el('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 18 } },
            projetActif ? el('span', { style: { width: 8, height: 8, borderRadius: 2, background: projetActif.couleur, flexShrink: 0 } }) : null,
            el('div', { style: { minWidth: 0, flex: 1 } },
              el('div', {
                style: { font: '500 13px/1.2 var(--cv-font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              }, projetActif?.nom || 'Sans projet'),
              active.description ? el('div', {
                style: { font: '400 11px/1.3 var(--cv-font-sans)', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 },
              }, active.description) : null,
            ),
          ),
          el('div', { style: { display: 'flex', gap: 6 } },
            active.statut === 'en_cours'
              ? el('button', {
                  onclick: () => store.actions.pauserActive(),
                  style: darkBtnStyle, title: 'Mettre en pause',
                }, icon('pause', { size: 14 }), ' Pause')
              : el('button', {
                  onclick: () => store.actions.reprendreActive(),
                  style: { ...darkBtnStyle, background: 'var(--cv-accent-500)', borderColor: 'var(--cv-accent-500)' },
                  title: 'Reprendre',
                }, icon('play', { size: 14 }), ' Reprendre'),
            el('button', {
              onclick: () => store.actions.arreter(),
              style: { ...darkBtnStyle, flex: 0, padding: '0 10px' },
              title: 'Arrêter & enregistrer',
            }, icon('stop', { size: 14 })),
          ),
        );
      } else {
        activeBlock.append(
          el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            icon('timer', { size: 16, style: { color: 'var(--cv-fg-subtle)' } }),
            el('span', { style: { font: '500 13px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)' } }, 'Aucun chrono actif'),
          ),
          el('div', { style: { font: '400 12px/1.4 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
            'Lance un chrono depuis un projet, une todo ou en un clic.'),
          UI.Button({
            variant: 'primary', size: 'sm', icon: 'play', children: 'Démarrer un chrono',
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
    const offTick  = store.onTick(render);

    return {
      el: host,
      destroy() { offState(); offTick(); },
    };
  }

  window.createPointageWidget = createPointageWidget;
})();

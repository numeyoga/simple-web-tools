// js/Timeline.js — vue "Timeline" : bandeau date, stats, chart horaire, sessions, répartition.
(function () {
  const { el, icon, fmtDuree, fmtHeure, dureeVivante, startOfDay } = window.UI;

  const HEURE_DEBUT = 7;
  const HEURE_FIN = 20;
  const PX_PAR_HEURE = 84;

  const POINTAGE_TYPES = [
    { value: 'arrivee',     label: 'Arrivée',         icon: 'sign-in',  color: 'var(--cv-success-600)' },
    { value: 'pause_debut', label: 'Début de pause',  icon: 'pause',    color: 'var(--cv-warning-700)' },
    { value: 'pause_fin',   label: 'Fin de pause',    icon: 'play',     color: 'var(--cv-warning-700)' },
    { value: 'depart',      label: 'Départ',          icon: 'sign-out', color: 'var(--cv-fg-muted)' },
  ];
  const POINTAGE_META = Object.fromEntries(POINTAGE_TYPES.map(p => [p.value, p]));

  function createTimeline(store, opts) {
    let dateOffset = 0;

    const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } });

    function statBloc(label, valeur, sousTexte, { accent, mono = true } = {}) {
      return el('div', null,
        el('div', { style: { font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, label),
        el('div', {
          style: {
            marginTop: 4, font: `500 22px/1 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
            color: accent ? 'var(--cv-accent-600)' : 'var(--cv-fg)', letterSpacing: '-0.01em',
          },
        }, valeur),
        sousTexte ? el('div', { style: { marginTop: 3, font: '400 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)' } }, sousTexte) : null,
      );
    }

    function legendeItem(couleur, label, stripe) {
      return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
        el('span', {
          style: {
            width: 14, height: 8, borderRadius: 2,
            background: stripe ? `repeating-linear-gradient(135deg, ${couleur} 0 3px, transparent 3px 6px)` : couleur,
            border: stripe ? `1px solid ${couleur}` : 'none',
          },
        }),
        label,
      );
    }

    function ouvrirEditionSession(s) {
      const projets = store.state.projets;
      let modal;

      function tsVersLocal(ts) {
        const d = new Date(ts);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      function localVersTs(v) { const t = new Date(v).getTime(); return isNaN(t) ? null : t; }

      const projW  = UI.Select({
        label: 'Projet', value: s.projetId,
        options: projets.map(p => ({ value: p.id, label: p.nom + (p.archive ? ' (archivé)' : '') })),
      });
      const descW  = UI.Input({ label: 'Description', value: s.description || '', placeholder: 'Ex. maquette homepage v3' });
      const debutW = UI.Input({ label: 'Début', value: tsVersLocal(s.debut), type: 'datetime-local' });
      const finW   = s.statut === 'terminee'
        ? UI.Input({ label: 'Fin', value: tsVersLocal(s.fin), type: 'datetime-local' })
        : null;

      const dureeAffichee = el('div', {
        style: { font: '500 18px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', marginTop: 4 },
      }, fmtDuree(dureeVivante(s)));
      function recalcDuree() {
        if (s.statut !== 'terminee') return;
        const d = localVersTs(debutW.input.value);
        const f = localVersTs(finW.input.value);
        if (d != null && f != null && f >= d) dureeAffichee.textContent = fmtDuree(f - d);
      }
      debutW.input.addEventListener('input', recalcDuree);
      if (finW) finW.input.addEventListener('input', recalcDuree);

      function enregistrer() {
        const patch = {
          projetId: projW.input.value,
          description: descW.input.value.trim(),
        };
        const debut = localVersTs(debutW.input.value);
        if (debut != null) patch.debut = debut;
        if (finW) {
          const fin = localVersTs(finW.input.value);
          if (fin != null) patch.fin = fin;
          if (patch.debut != null && patch.fin != null && patch.fin < patch.debut) {
            alert('La fin doit être après le début.');
            return;
          }
        }
        store.actions.majSession(s.id, patch);
        modal.close();
      }

      function supprimer() {
        store.actions.supprimerSession(s.id);
        modal.close();
      }

      modal = UI.Modal({
        title: 'Modifier la session', width: 480,
        body: el('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
          projW,
          descW,
          el('div', { style: { display: 'flex', gap: 10 } },
            el('div', { style: { flex: 1 } }, debutW),
            finW ? el('div', { style: { flex: 1 } }, finW) : null,
          ),
          s.statut === 'terminee' ? el('div', null,
            el('div', { style: { font: '500 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, 'Durée calculée'),
            dureeAffichee,
          ) : el('div', {
            style: { padding: '8px 10px', background: 'var(--cv-accent-50)', border: '1px solid var(--cv-accent-100)', borderRadius: 6, font: '400 12px/1.4 var(--cv-font-sans)', color: 'var(--cv-accent-700)' },
          }, 'Session encore active — la durée continue de courir.'),
        ),
        footer: [
          UI.Button({ variant: 'destructive', icon: 'trash', children: 'Supprimer', onclick: supprimer, style: { marginRight: 'auto' } }),
          UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
          UI.Button({ variant: 'primary', icon: 'check', children: 'Enregistrer', onclick: enregistrer }),
        ],
      });
    }

    /* ----------------- TimelineChart ----------------- */
    function timelineChart(jourDebut, sessionsJ, pointageJ, projets, isToday) {
      const totalHours = HEURE_FIN - HEURE_DEBUT;
      const widthPx = totalHours * PX_PAR_HEURE;
      const hourToPx = h => (h - HEURE_DEBUT) * PX_PAR_HEURE;
      const msToPx = ms => (ms / 3600_000) * PX_PAR_HEURE;
      const tsToPx = ts => {
        const d = new Date(ts);
        const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
        return hourToPx(h);
      };

      // segments présence
      const presenceSegs = [];
      let enPresence = null;
      for (const e of pointageJ) {
        if ((e.type === 'arrivee' || e.type === 'pause_fin') && enPresence == null) enPresence = e.at;
        else if ((e.type === 'pause_debut' || e.type === 'depart') && enPresence != null) {
          presenceSegs.push({ debut: enPresence, fin: e.at });
          enPresence = null;
        }
      }
      if (enPresence != null) presenceSegs.push({ debut: enPresence, fin: isToday ? Date.now() : jourDebut + 86400000, ongoing: true });

      // pauses
      const pauseSegs = [];
      let enPause = null;
      for (const e of pointageJ) {
        if (e.type === 'pause_debut') enPause = e.at;
        else if (e.type === 'pause_fin' && enPause != null) {
          pauseSegs.push({ debut: enPause, fin: e.at });
          enPause = null;
        }
      }
      if (enPause != null) pauseSegs.push({ debut: enPause, fin: isToday ? Date.now() : jourDebut + 86400000, ongoing: true });

      const now = Date.now();

      const rule = el('div', { style: { position: 'relative', height: 22, width: widthPx } });
      for (let i = 0; i <= totalHours; i++) {
        const h = HEURE_DEBUT + i;
        rule.appendChild(el('div', {
          style: {
            position: 'absolute', left: hourToPx(h), top: 0, transform: 'translateX(-50%)',
            font: '500 10px/1 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)',
          },
        }, `${String(h).padStart(2,'0')}:00`));
      }

      const line = el('div', { style: { position: 'relative', height: 140, width: widthPx, marginTop: 6 } });

      // grilles
      for (let i = 0; i <= totalHours; i++) {
        line.appendChild(el('div', {
          style: {
            position: 'absolute', left: hourToPx(HEURE_DEBUT + i), top: 0, bottom: 0,
            borderLeft: `1px ${(HEURE_DEBUT + i) % 2 === 0 ? 'solid' : 'dashed'} var(--cv-border)`,
          },
        }));
      }

      // bandes présence
      for (const seg of presenceSegs) {
        line.appendChild(el('div', {
          title: `Présence : ${fmtHeure(seg.debut)} → ${seg.ongoing ? 'en cours' : fmtHeure(seg.fin)}`,
          style: {
            position: 'absolute',
            left: tsToPx(seg.debut),
            width: Math.max(2, tsToPx(seg.fin) - tsToPx(seg.debut)),
            top: 0, bottom: 0,
            background: 'var(--cv-success-50)',
            borderTop: '2px solid var(--cv-success-500)',
            borderBottom: '2px solid var(--cv-success-500)',
            opacity: 0.9,
          },
        }));
      }
      // bandes pauses
      for (const seg of pauseSegs) {
        line.appendChild(el('div', {
          title: `Pause : ${fmtHeure(seg.debut)} → ${seg.ongoing ? 'en cours' : fmtHeure(seg.fin)}`,
          style: {
            position: 'absolute',
            left: tsToPx(seg.debut),
            width: Math.max(2, tsToPx(seg.fin) - tsToPx(seg.debut)),
            top: 0, bottom: 0,
            background: 'repeating-linear-gradient(135deg, var(--cv-warning-100) 0 6px, var(--cv-warning-50) 6px 12px)',
            borderTop: '2px solid var(--cv-warning-500)',
            borderBottom: '2px solid var(--cv-warning-500)',
          },
        }));
      }

      // sessions — placement en « voies » (swim lanes) pour gérer les chronos
      // en PARALLÈLE. La hauteur de la bande reste CONSTANTE : on divise la zone
      // verticale réservée aux sessions par le nombre de voies nécessaires ce
      // jour-là (chevauchement maximal). Une seule session => 1 voie pleine ;
      // plusieurs en parallèle => voies empilées, sans changer la hauteur totale.
      const SESSION_ZONE_TOP = 30;
      const SESSION_ZONE_H = 104;
      const LANE_GAP = 4;

      // Étendue visuelle de chaque session : [debut, debut + durée affichée].
      const placed = sessionsJ.map(s => {
        const dureeMs = dureeVivante(s);
        return { s, dureeMs, start: s.debut, end: s.debut + Math.max(dureeMs, 60_000) };
      }).sort((a, b) => a.start - b.start);

      // Affectation gloutonne : on réutilise la première voie devenue libre.
      const laneEnds = [];
      for (const item of placed) {
        let lane = laneEnds.findIndex(end => item.start >= end - 1000);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = item.end;
        item.lane = lane;
      }
      const laneCount = Math.max(1, laneEnds.length);
      const laneH = (SESSION_ZONE_H - LANE_GAP * (laneCount - 1)) / laneCount;
      const compact = laneH < 46;

      for (const item of placed) {
        const s = item.s;
        const proj = projets.find(p => p.id === s.projetId);
        const dureeMs = item.dureeMs;
        const left = tsToPx(s.debut);
        const width = Math.max(10, msToPx(dureeMs));
        const isActive = s.statut !== 'terminee';
        const enCours = s.statut === 'en_cours';
        const top = SESSION_ZONE_TOP + item.lane * (laneH + LANE_GAP);
        const block = el('div', {
          title: `${proj?.nom || 'Sans projet'} · ${fmtHeure(s.debut)} → ${s.statut === 'terminee' ? fmtHeure(s.fin) : 'en cours'} · ${fmtDuree(dureeMs)}`,
          onclick: () => ouvrirEditionSession(s),
          style: {
            position: 'absolute', left, width,
            top, height: laneH,
            background: proj?.couleur || 'var(--cv-neutral-500)',
            borderRadius: 6,
            boxShadow: isActive ? '0 0 0 2px rgba(234,88,12,0.30), var(--cv-shadow-md)' : 'var(--cv-shadow-sm)',
            color: '#fff', padding: compact ? '0 9px' : '7px 10px',
            overflow: 'hidden', cursor: 'pointer',
            display: 'flex',
            flexDirection: compact ? 'row' : 'column',
            alignItems: compact ? 'center' : 'stretch',
            justifyContent: 'space-between', gap: compact ? 8 : 0,
            outline: enCours ? '2px solid var(--cv-accent-500)' : 'none',
          },
        });
        const titre = el('div', { style: { minWidth: 0, flex: 1, overflow: 'hidden' } },
          el('div', { style: { font: '500 11px/1.2 var(--cv-font-sans)', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, proj?.nom || 'Sans projet'),
          (!compact && s.description && width > 80) ? el('div', { style: { marginTop: 2, font: '500 12px/1.3 var(--cv-font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.description) : null,
        );
        const dureeLine = el('div', { style: { font: '500 11px/1 var(--cv-font-mono)', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 } },
          el('span', null, fmtDuree(dureeMs)),
          enCours ? el('span', { style: { width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'cv-pulse 1.2s infinite' } }) : null,
        );
        block.append(titre, dureeLine);
        line.appendChild(block);
      }

      // Curseur "maintenant"
      if (isToday) {
        line.appendChild(el('div', {
          style: {
            position: 'absolute', left: tsToPx(now),
            top: -6, bottom: -6, width: 2,
            background: 'var(--cv-accent-500)', pointerEvents: 'none',
          },
        },
          el('div', { style: { position: 'absolute', top: -4, left: -4, width: 10, height: 10, borderRadius: '50%', background: 'var(--cv-accent-500)', boxShadow: '0 0 0 3px rgba(234,88,12,0.2)' } }),
          el('div', {
            style: {
              position: 'absolute', top: -22, left: 4,
              background: 'var(--cv-accent-500)', color: '#fff',
              padding: '2px 6px', borderRadius: 4,
              font: '500 10px/1 var(--cv-font-mono)', whiteSpace: 'nowrap',
            },
          }, fmtHeure(now)),
        ));
      }

      return el('div', { style: { overflowX: 'auto', overflowY: 'hidden', padding: '16px 0 12px' } },
        el('div', { style: { width: widthPx, position: 'relative', paddingLeft: 16, paddingRight: 16 } },
          rule, line,
        ),
      );
    }

    /* ----------------- Liste sessions ----------------- */
    function sessionsListe(sessionsJ, projets) {
      const list = sessionsJ.length === 0
        ? el('div', { style: { padding: '32px 16px', textAlign: 'center', color: 'var(--cv-fg-muted)', font: '400 13px/1.5 var(--cv-font-sans)' } },
            icon('hourglass-low', { size: 22, style: { color: 'var(--cv-fg-subtle)' } }),
            el('div', { style: { marginTop: 6 } }, 'Aucune session pour ce jour.'),
            UI.Button({ variant: 'primary', size: 'sm', icon: 'play', children: 'Démarrer un chrono', style: { marginTop: 12 }, onclick: opts.onOuvrirQuickAdd }),
          )
        : el('div', null,
            sessionsJ.map(s => {
              const proj = projets.find(p => p.id === s.projetId);
              const isActive = s.statut !== 'terminee';
              const row = el('div', {
                style: {
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', borderBottom: '1px solid var(--cv-border)',
                  background: isActive ? 'var(--cv-accent-50)' : 'var(--cv-surface)',
                  transition: 'background 120ms', cursor: 'pointer',
                },
                onmouseenter: e => { if (!isActive) e.currentTarget.style.background = 'var(--cv-surface-2)'; },
                onmouseleave: e => { if (!isActive) e.currentTarget.style.background = 'var(--cv-surface)'; },
                onclick: e => {
                  // Évite d'ouvrir l'édition quand on clique sur un bouton dans la ligne.
                  if (e.target.closest('button')) return;
                  ouvrirEditionSession(s);
                },
              },
                el('div', { style: { width: 4, alignSelf: 'stretch', borderRadius: 2, background: proj?.couleur || 'var(--cv-neutral-400)', flexShrink: 0 } }),
                el('div', { style: { minWidth: 0, flex: 1 } },
                  el('div', {
                    style: { font: '500 13px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                  }, s.description || el('span', { style: { color: 'var(--cv-fg-subtle)', fontStyle: 'italic' } }, 'Sans description')),
                  el('div', { style: { display: 'flex', gap: 10, marginTop: 2, font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
                    el('span', null, proj?.nom || 'Sans projet'),
                    el('span', null, '·'),
                    el('span', { style: { fontFamily: 'var(--cv-font-mono)' } }, `${fmtHeure(s.debut)} → ${s.statut === 'terminee' ? fmtHeure(s.fin) : 'en cours'}`),
                  ),
                ),
                el('div', {
                  style: { font: '500 15px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', minWidth: 56, textAlign: 'right' },
                }, fmtDuree(dureeVivante(s))),
                (isActive && s.statut === 'en_cours') ? el('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
                    UI.Badge({ variant: 'accent', dot: true, children: 'en cours' }),
                    UI.IconButton({ icon: 'pause', label: 'Mettre en pause', size: 'sm', onclick: () => store.actions.pauserSession(s.id) }),
                    UI.IconButton({ icon: 'stop', label: 'Arrêter', size: 'sm', onclick: () => store.actions.arreterSession(s.id) }),
                  )
                : (isActive && s.statut === 'en_pause') ? el('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
                    UI.Badge({ variant: 'warning', dot: true, children: 'pause' }),
                    UI.IconButton({ icon: 'play', label: 'Reprendre', size: 'sm', onclick: () => store.actions.reprendreSession(s.id) }),
                    UI.IconButton({ icon: 'stop', label: 'Arrêter', size: 'sm', onclick: () => store.actions.arreterSession(s.id) }),
                  )
                : el('div', { style: { display: 'flex', gap: 2, flexShrink: 0 } },
                    UI.IconButton({
                      icon: 'play', label: 'Reprendre ce projet',
                      title: 'Redémarrer un chrono sur ce projet',
                      onclick: () => opts.onDemarrerSurProjet(s.projetId, s.description),
                    }),
                    UI.IconButton({
                      icon: 'pencil-simple', label: 'Modifier', size: 'sm',
                      onclick: () => ouvrirEditionSession(s),
                    }),
                    UI.IconButton({
                      icon: 'trash', label: 'Supprimer', size: 'sm',
                      onclick: () => store.actions.supprimerSession(s.id),
                    }),
                  ),
              );
              return row;
            }),
          );

      return el('section', {
        style: {
          background: 'var(--cv-surface)', border: '1px solid var(--cv-border)',
          borderRadius: 12, boxShadow: 'var(--cv-shadow-sm)', overflow: 'hidden',
        },
      },
        el('header', { style: { padding: '12px 16px', borderBottom: '1px solid var(--cv-border)', display: 'flex', alignItems: 'center' } },
          el('div', { style: { font: '600 13px/1.3 var(--cv-font-sans)' } }, 'Sessions du jour'),
          el('div', { style: { marginLeft: 'auto' } },
            UI.Button({ size: 'sm', icon: 'plus', children: 'Nouvelle', onclick: opts.onOuvrirQuickAdd })),
        ),
        list,
      );
    }

    /* ----------------- Répartition ----------------- */
    function repartition(sessionsJ, projets) {
      const total = sessionsJ.reduce((s, x) => s + dureeVivante(x), 0);
      const parProjet = {};
      for (const s of sessionsJ) {
        parProjet[s.projetId] = (parProjet[s.projetId] || 0) + dureeVivante(s);
      }
      const liste = Object.entries(parProjet)
        .map(([id, d]) => ({ id, duree: d, projet: projets.find(p => p.id === id) }))
        .filter(x => x.projet)
        .sort((a, b) => b.duree - a.duree);

      return el('section', {
        style: { background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', borderRadius: 12, boxShadow: 'var(--cv-shadow-sm)', overflow: 'hidden' },
      },
        el('header', { style: { padding: '12px 16px', borderBottom: '1px solid var(--cv-border)' } },
          el('div', { style: { font: '600 13px/1.3 var(--cv-font-sans)' } }, 'Répartition par projet'),
          el('div', { style: { font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2 } }, 'Clique pour relancer'),
        ),
        liste.length === 0
          ? el('div', { style: { padding: '32px 16px', textAlign: 'center', color: 'var(--cv-fg-muted)', font: '400 13px/1.5 var(--cv-font-sans)' } },
              'Rien à afficher — lance un chrono.')
          : el('div', { style: { padding: '8px 0' } },
              liste.map(({ id, duree, projet }) => {
                const pct = total > 0 ? (duree / total) * 100 : 0;
                return el('button', {
                  onclick: () => opts.onDemarrerSurProjet(id),
                  style: {
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '10px 16px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left', transition: 'background 120ms',
                  },
                  onmouseenter: e => e.currentTarget.style.background = 'var(--cv-surface-2)',
                  onmouseleave: e => e.currentTarget.style.background = 'transparent',
                },
                  el('div', { style: { minWidth: 0, flex: 1 } },
                    el('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 } },
                      el('span', { style: { width: 8, height: 8, borderRadius: 2, background: projet.couleur, flexShrink: 0 } }),
                      el('span', { style: { font: '500 13px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, projet.nom),
                      el('span', { style: { marginLeft: 'auto', font: '500 13px/1 var(--cv-font-mono)', color: 'var(--cv-fg)' } }, fmtDuree(duree)),
                    ),
                    el('div', { style: { height: 6, background: 'var(--cv-neutral-100)', borderRadius: 3, overflow: 'hidden' } },
                      el('div', { style: { width: `${pct}%`, height: '100%', background: projet.couleur, borderRadius: 3, transition: 'width 300ms' } }),
                    ),
                  ),
                  icon('play', { size: 14, style: { color: 'var(--cv-fg-subtle)' } }),
                );
              }),
            ),
      );
    }

    /* ----------------- Pointages (édition) ----------------- */

    function tsVersLocal(ts) {
      const d = new Date(ts);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function localVersTs(v) { const t = new Date(v).getTime(); return isNaN(t) ? null : t; }

    function ouvrirEditionPointage(p, jourDebut) {
      const isNew = !p;
      let modal;
      const tsInitial = p?.at ?? (jourDebut + 9 * 3600_000);

      const typeW = UI.Select({
        label: 'Type', value: p?.type || 'arrivee',
        options: POINTAGE_TYPES.map(t => ({ value: t.value, label: t.label })),
      });
      const timeW = UI.Input({ label: 'Heure', type: 'datetime-local', value: tsVersLocal(tsInitial), autoFocus: true });

      function enregistrer() {
        const t = localVersTs(timeW.input.value);
        if (t == null) return;
        const type = typeW.input.value;
        if (isNew) store.actions.ajouterPointage(type, t);
        else       store.actions.majPointage(p.id, { type, at: t });
        modal.close();
      }
      function supprimer() {
        if (!p) return;
        store.actions.supprimerPointage(p.id);
        modal.close();
      }
      timeW.input.addEventListener('keydown', e => { if (e.key === 'Enter') enregistrer(); });

      const footer = [];
      if (!isNew) footer.push(UI.Button({
        variant: 'destructive', icon: 'trash', children: 'Supprimer',
        onclick: supprimer, style: { marginRight: 'auto' },
      }));
      footer.push(UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }));
      footer.push(UI.Button({ variant: 'primary', icon: 'check', children: 'Enregistrer', onclick: enregistrer }));

      modal = UI.Modal({
        title: isNew ? 'Ajouter un pointage' : 'Modifier le pointage', width: 420,
        body: el('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } }, typeW, timeW),
        footer,
      });
    }

    function pointageSection(pointageJ, jourDebut) {
      const ordres = pointageJ.slice().sort((a, b) => a.at - b.at);
      return el('section', {
        style: {
          background: 'var(--cv-surface)', border: '1px solid var(--cv-border)',
          borderRadius: 12, boxShadow: 'var(--cv-shadow-sm)', overflow: 'hidden',
        },
      },
        el('header', { style: { padding: '12px 16px', borderBottom: '1px solid var(--cv-border)', display: 'flex', alignItems: 'center' } },
          el('div', null,
            el('div', { style: { font: '600 13px/1.3 var(--cv-font-sans)' } }, 'Pointages du jour'),
            el('div', { style: { font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2 } },
              'Arrivée, pauses, départ — clique pour corriger une heure.'),
          ),
          el('div', { style: { marginLeft: 'auto' } },
            UI.Button({
              size: 'sm', icon: 'plus', children: 'Ajouter',
              onclick: () => ouvrirEditionPointage(null, jourDebut),
            }),
          ),
        ),
        ordres.length === 0
          ? el('div', {
              style: { padding: '24px 16px', textAlign: 'center', color: 'var(--cv-fg-muted)', font: '400 13px/1.5 var(--cv-font-sans)' },
            },
              icon('clock', { size: 22, style: { color: 'var(--cv-fg-subtle)' } }),
              el('div', { style: { marginTop: 6 } }, 'Aucun pointage pour ce jour.'),
              el('div', { style: { marginTop: 4, font: '400 12px/1.4 var(--cv-font-sans)' } },
                'Utilise « Ajouter » pour reconstituer la journée.'),
            )
          : el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 } },
              ordres.map(p => {
                const meta = POINTAGE_META[p.type] || POINTAGE_META.arrivee;
                return el('button', {
                  onclick: () => ouvrirEditionPointage(p, jourDebut),
                  title: 'Modifier ou supprimer ce pointage',
                  style: {
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--cv-neutral-50)', border: '1px solid var(--cv-border)',
                    cursor: 'pointer', font: 'inherit', color: 'var(--cv-fg)', textAlign: 'left',
                    transition: 'background 120ms, border-color 120ms',
                  },
                  onmouseenter: e => { e.currentTarget.style.background = 'var(--cv-surface-2)'; e.currentTarget.style.borderColor = 'var(--cv-border-strong)'; },
                  onmouseleave: e => { e.currentTarget.style.background = 'var(--cv-neutral-50)'; e.currentTarget.style.borderColor = 'var(--cv-border)'; },
                },
                  icon(meta.icon, { size: 16, style: { color: meta.color } }),
                  el('div', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                    el('div', {
                      style: { font: '500 10px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
                    }, meta.label),
                    el('div', { style: { font: '500 13px/1 var(--cv-font-mono)', color: 'var(--cv-fg)' } }, fmtHeure(p.at)),
                  ),
                );
              }),
            ),
      );
    }

    /* ----------------- Render principal ----------------- */
    function render() {
      const s = store.state;
      const dbase = new Date(); dbase.setHours(0, 0, 0, 0); dbase.setDate(dbase.getDate() + dateOffset);
      const jourDebut = dbase.getTime();
      const jourFin = jourDebut + 86400000;
      const isToday = dateOffset === 0;

      const sessionsJ = s.sessions.filter(x => x.debut >= jourDebut && x.debut < jourFin)
        .sort((a, b) => a.debut - b.debut);
      const pointageJ = s.pointage.filter(p => p.at >= jourDebut && p.at < jourFin)
        .sort((a, b) => a.at - b.at);

      const totalTravaille = sessionsJ.reduce((acc, x) => acc + dureeVivante(x), 0);
      const arrivee = pointageJ.find(p => p.type === 'arrivee');
      const dernierDepart = [...pointageJ].reverse().find(p => p.type === 'depart');

      const jourLabel = dateOffset === 0 ? "Aujourd'hui"
        : dateOffset === -1 ? 'Hier'
        : new Date(jourDebut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const jourLabelDate = new Date(jourDebut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

      host.replaceChildren(
        // Bandeau date + stats
        el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' } },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            UI.IconButton({ icon: 'caret-left', label: 'Jour précédent', onclick: () => { dateOffset--; render(); } }),
            el('div', null,
              el('div', { style: { font: '600 20px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)', letterSpacing: '-0.01em', textTransform: 'capitalize' } }, jourLabel),
              el('div', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'capitalize', marginTop: 2 } }, jourLabelDate),
            ),
            UI.IconButton({ icon: 'caret-right', label: 'Jour suivant', disabled: dateOffset >= 0, onclick: () => { dateOffset++; render(); } }),
            dateOffset !== 0 ? UI.Button({ size: 'sm', variant: 'ghost', children: "Aujourd'hui", onclick: () => { dateOffset = 0; render(); } }) : null,
          ),
          el('div', { style: { flex: 1 } }),
          el('div', { style: { display: 'flex', gap: 28 } },
            statBloc('Temps travaillé', fmtDuree(totalTravaille), `${sessionsJ.length} session${sessionsJ.length > 1 ? 's' : ''}`),
            statBloc('Amplitude',
              arrivee ? `${fmtHeure(arrivee.at)} → ${dernierDepart ? fmtHeure(dernierDepart.at) : '···'}` : '—',
              arrivee ? (dernierDepart ? 'journée clôturée' : 'en cours') : 'pas encore arrivé',
              { mono: false }),
          ),
        ),

        // Timeline chart
        el('section', { style: { background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', borderRadius: 12, boxShadow: 'var(--cv-shadow-sm)', overflow: 'hidden' } },
          el('header', { style: { padding: '12px 16px', borderBottom: '1px solid var(--cv-border)', display: 'flex', alignItems: 'center', gap: 12 } },
            el('div', null,
              el('div', { style: { font: '600 13px/1.3 var(--cv-font-sans)' } }, 'Journée en continu'),
              el('div', { style: { font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2 } },
                'Les chronos en parallèle s’empilent en voies · glisse pour faire défiler'),
            ),
            el('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, font: '400 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
              legendeItem('var(--cv-success-500)', 'Présence'),
              legendeItem('var(--cv-warning-400)', 'Pause', true),
              legendeItem('var(--cv-fg)', 'Session'),
            ),
          ),
          timelineChart(jourDebut, sessionsJ, pointageJ, s.projets, isToday),
        ),

        // Bas : sessions + répartition
        el('div', { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 } },
          sessionsListe(sessionsJ, s.projets),
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
            pointageSection(pointageJ, jourDebut),
            repartition(sessionsJ, s.projets),
          ),
        ),
      );
    }

    render();
    const offState = store.onState(render);
    const offTick  = store.onTick(() => { if (dateOffset === 0) render(); });

    return {
      el: host,
      destroy() { offState(); offTick(); },
    };
  }

  window.createTimeline = createTimeline;
})();

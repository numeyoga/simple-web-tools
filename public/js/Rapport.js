// js/Rapport.js — vue rapport hebdomadaire : stats, barres jour par jour, tableau projets, export CSV.
(function () {
  const { el, icon, fmtDuree, dureeVivante } = window.UI;

  function createRapport(store) {
    let semaineOffset = 0;

    const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } });

    function bornesSemaine() {
      const now = new Date();
      now.setDate(now.getDate() + semaineOffset * 7);
      const dow = (now.getDay() + 6) % 7; // 0 = lundi
      const lundi = new Date(now); lundi.setDate(now.getDate() - dow); lundi.setHours(0, 0, 0, 0);
      const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6); dimanche.setHours(23, 59, 59, 999);
      const jours = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lundi); d.setDate(lundi.getDate() + i); return d;
      });
      return { lundi, dimanche, jours };
    }

    function statCard(label, valeur, sousTexte, { accent, mono = true, extra } = {}) {
      return el('div', {
        style: { background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', borderRadius: 12, padding: 16, boxShadow: 'var(--cv-shadow-sm)' },
      },
        el('div', { style: { font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, label),
        el('div', {
          style: {
            marginTop: 8, font: `500 26px/1 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
            color: accent ? 'var(--cv-accent-600)' : 'var(--cv-fg)', letterSpacing: '-0.01em',
          },
        }, valeur),
        sousTexte ? el('div', { style: { marginTop: 4, font: '400 12px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)' } }, sousTexte) : null,
        extra || null,
      );
    }

    function Th(content, align = 'left') {
      return el('th', {
        style: {
          padding: '10px 16px', textAlign: align,
          font: '500 11px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        },
      }, content);
    }
    function Td(content, opts = {}) {
      const { align = 'left', muted, mono, strong, colSpan, style } = opts;
      const attrs = {
        style: {
          padding: '12px 16px', textAlign: align,
          font: `${strong ? 600 : 400} 13px/1.3 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
          color: muted ? 'var(--cv-fg-muted)' : 'var(--cv-fg)',
          ...(style || {}),
        },
      };
      if (colSpan) attrs.colSpan = colSpan;
      return el('td', attrs, content);
    }

    function barresSemaine(parJour, projets, maxJour) {
      const H = 180;
      const jourNoms = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const maxH = Math.ceil(maxJour / 3600_000 / 2) * 2;
      const paliers = Array.from({ length: Math.max(1, maxH / 2) + 1 }, (_, i) => i * 2);

      const axisY = el('div', { style: { height: H, position: 'relative', width: 34, flexShrink: 0 } });
      for (const h of paliers) {
        axisY.appendChild(el('div', {
          style: {
            position: 'absolute', bottom: (h / maxH) * H, right: 0,
            font: '500 10px/1 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)',
            transform: 'translateY(50%)',
          },
        }, `${h}h`));
      }

      const bars = el('div', { style: { flex: 1, display: 'flex', gap: 8, alignItems: 'flex-end', height: H, position: 'relative' } });
      for (const h of paliers) {
        bars.appendChild(el('div', {
          style: {
            position: 'absolute', left: 0, right: 0,
            bottom: (h / maxH) * H,
            borderTop: h === 0 ? '1px solid var(--cv-border-strong)' : '1px dashed var(--cv-border)',
            pointerEvents: 'none',
          },
        }));
      }

      parJour.forEach((j, i) => {
        const isToday = j.date.getTime() === today.getTime();
        const isWeekend = i >= 5;
        const hauteurTotale = (j.total / (maxH * 3600_000)) * H;
        const segs = Object.entries(j.parProjet)
          .map(([pid, d]) => ({ projet: projets.find(p => p.id === pid), duree: d }))
          .filter(x => x.projet)
          .sort((a, b) => b.duree - a.duree);

        const segNodes = segs.map((seg, si) => el('div', {
          title: `${seg.projet.nom} · ${fmtDuree(seg.duree)}`,
          style: {
            height: (seg.duree / j.total) * hauteurTotale,
            background: seg.projet.couleur,
            borderBottom: si > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none',
          },
        }));

        bars.appendChild(el('div', {
          style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 },
        },
          el('div', {
            style: {
              position: 'absolute', bottom: hauteurTotale + 8,
              font: '500 11px/1 var(--cv-font-mono)', color: 'var(--cv-fg-muted)',
              opacity: j.total > 0 ? 1 : 0.3, whiteSpace: 'nowrap',
            },
          }, j.total > 0 ? fmtDuree(j.total, { compact: true }) : ''),

          el('div', {
            style: {
              width: '100%', maxWidth: 68, height: hauteurTotale,
              display: 'flex', flexDirection: 'column-reverse',
              borderRadius: 4, overflow: 'hidden',
              background: isWeekend ? 'transparent' : 'var(--cv-neutral-100)',
              boxShadow: isToday ? '0 0 0 2px var(--cv-accent-500)' : 'none',
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            },
          }, segNodes),

          el('div', {
            style: {
              position: 'absolute', bottom: 0,
              font: `${isToday ? 600 : 400} 12px/1 var(--cv-font-sans)`,
              color: isToday ? 'var(--cv-accent-600)' : (isWeekend ? 'var(--cv-fg-subtle)' : 'var(--cv-fg)'),
            },
          }, `${jourNoms[i]} ${j.date.getDate()}`),
        ));
      });

      return el('div', { style: { display: 'flex', gap: 16 } }, axisY, bars);
    }

    function exportCSV(sessionsSem, projets, lundi) {
      const rows = [['Date', 'Projet', 'Client', 'Description', 'Début', 'Fin', 'Durée (h)', 'Facturable (€)']];
      for (const s of sessionsSem.slice().sort((a, b) => a.debut - b.debut)) {
        const p = projets.find(pr => pr.id === s.projetId);
        const heures = dureeVivante(s) / 3600_000;
        const montant = p && p.tarif > 0 ? (heures * p.tarif).toFixed(2) : '';
        rows.push([
          new Date(s.debut).toLocaleDateString('fr-FR'),
          p?.nom || '',
          p?.client || '',
          s.description || '',
          new Date(s.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          s.fin ? new Date(s.fin).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
          heures.toFixed(2),
          montant,
        ]);
      }
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `rapport-${lundi.toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function render() {
      const { projets, sessions } = store.state;
      const { lundi, dimanche, jours } = bornesSemaine();

      const sessionsSem = sessions.filter(s => s.debut >= lundi.getTime() && s.debut <= dimanche.getTime());

      const parJour = jours.map(j => {
        const dStart = new Date(j); dStart.setHours(0, 0, 0, 0);
        const dEnd   = new Date(j); dEnd.setHours(23, 59, 59, 999);
        const ss = sessionsSem.filter(s => s.debut >= dStart.getTime() && s.debut <= dEnd.getTime());
        const parProjet = {};
        for (const s of ss) parProjet[s.projetId] = (parProjet[s.projetId] || 0) + dureeVivante(s);
        const total = Object.values(parProjet).reduce((a, b) => a + b, 0);
        return { date: j, ss, parProjet, total };
      });

      const totalSemaine = parJour.reduce((s, j) => s + j.total, 0);
      const maxJour = Math.max(...parJour.map(j => j.total), 8 * 3600_000);
      const objectifSem = 35 * 3600_000;
      const progObjectif = Math.min(1, totalSemaine / objectifSem);

      const parProjet = {};
      for (const s of sessionsSem) parProjet[s.projetId] = (parProjet[s.projetId] || 0) + dureeVivante(s);
      const projetsTri = Object.entries(parProjet)
        .map(([id, duree]) => ({ id, duree, projet: projets.find(p => p.id === id) }))
        .filter(x => x.projet)
        .sort((a, b) => b.duree - a.duree);

      const facturable = projetsTri.reduce((s, x) => s + (x.projet.tarif > 0 ? x.duree : 0), 0);
      const chiffreAffaires = projetsTri.reduce((s, x) => s + (x.projet.tarif > 0 ? (x.duree / 3600_000) * x.projet.tarif : 0), 0);

      const semLabel = semaineOffset === 0 ? 'Cette semaine'
        : semaineOffset === -1 ? 'Semaine dernière'
        : semaineOffset < 0 ? `Il y a ${-semaineOffset} semaines`
        : `Dans ${semaineOffset} semaines`;
      const semDates = `${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

      host.replaceChildren(
        // Header
        el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' } },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            UI.IconButton({ icon: 'caret-left', label: 'Semaine précédente', onclick: () => { semaineOffset--; render(); } }),
            el('div', null,
              el('div', { style: { font: '600 20px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)', letterSpacing: '-0.01em' } }, semLabel),
              el('div', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2, textTransform: 'capitalize' } }, semDates),
            ),
            UI.IconButton({ icon: 'caret-right', label: 'Semaine suivante', disabled: semaineOffset >= 0, onclick: () => { semaineOffset++; render(); } }),
            semaineOffset !== 0 ? UI.Button({ size: 'sm', variant: 'ghost', children: 'Cette semaine', onclick: () => { semaineOffset = 0; render(); } }) : null,
          ),
          el('div', { style: { flex: 1 } }),
          UI.Button({ icon: 'file-arrow-down', children: 'Exporter CSV', onclick: () => exportCSV(sessionsSem, projets, lundi) }),
        ),

        // Stats top
        el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 } },
          statCard('Total semaine', fmtDuree(totalSemaine), 'objectif 35h00', {
            extra: el('div', {
              style: { height: 4, background: 'var(--cv-neutral-100)', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
            }, el('div', {
              style: {
                width: `${progObjectif * 100}%`, height: '100%',
                background: progObjectif >= 1 ? 'var(--cv-success-500)' : 'var(--cv-accent-500)',
                transition: 'width 300ms',
              },
            })),
          }),
          statCard('Facturable', fmtDuree(facturable),
            `${Math.round((facturable / Math.max(totalSemaine, 1)) * 100)}% du total`, { accent: true }),
          statCard("Chiffre d'affaires",
            `${Math.round(chiffreAffaires).toLocaleString('fr-FR')} €`,
            `${sessionsSem.length} sessions`, { mono: false }),
          statCard('Moyenne/jour', fmtDuree(totalSemaine / 5), 'lun. → ven.'),
        ),

        // Graphique
        el('section', {
          style: { background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', borderRadius: 12, boxShadow: 'var(--cv-shadow-sm)', padding: 20 },
        },
          el('div', { style: { display: 'flex', alignItems: 'baseline', marginBottom: 16 } },
            el('div', { style: { font: '600 13px/1.3 var(--cv-font-sans)' } }, 'Distribution par jour'),
            el('div', { style: { marginLeft: 'auto', font: '400 11px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } },
              'Segments colorés = projets'),
          ),
          barresSemaine(parJour, projets, maxJour),
        ),

        // Table projets
        el('section', {
          style: { background: 'var(--cv-surface)', border: '1px solid var(--cv-border)', borderRadius: 12, boxShadow: 'var(--cv-shadow-sm)', overflow: 'hidden' },
        },
          el('header', { style: { padding: '14px 20px', borderBottom: '1px solid var(--cv-border)' } },
            el('div', { style: { font: '600 13px/1.3 var(--cv-font-sans)' } }, 'Par projet'),
          ),
          projetsTri.length === 0
            ? el('div', { style: { padding: '32px 16px', textAlign: 'center', color: 'var(--cv-fg-muted)', font: '400 13px/1.5 var(--cv-font-sans)' } },
                'Aucune session sur cette semaine.')
            : el('table', { style: { width: '100%', borderCollapse: 'collapse' } },
                el('thead', null,
                  el('tr', { style: { borderBottom: '1px solid var(--cv-border)', background: 'var(--cv-neutral-50)' } },
                    Th('Projet'), Th('Client'), Th('Temps', 'right'), Th('Tarif', 'right'), Th('Montant', 'right'),
                  ),
                ),
                el('tbody', null,
                  projetsTri.map(({ id, duree, projet }) => el('tr', { style: { borderBottom: '1px solid var(--cv-border)' } },
                    Td(el('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      el('span', { style: { width: 8, height: 8, borderRadius: 2, background: projet.couleur } }),
                      el('span', { style: { font: '500 13px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)' } }, projet.nom),
                    )),
                    Td(projet.client || '—', { muted: true }),
                    Td(fmtDuree(duree), { align: 'right', mono: true }),
                    Td(projet.tarif > 0 ? `${projet.tarif} €/h` : '—', { align: 'right', muted: true }),
                    Td(projet.tarif > 0 ? `${Math.round((duree / 3600_000) * projet.tarif).toLocaleString('fr-FR')} €` : '—',
                      { align: 'right', mono: true, style: { color: projet.tarif > 0 ? 'var(--cv-fg)' : 'var(--cv-fg-subtle)' } }),
                  )),
                  el('tr', { style: { background: 'var(--cv-neutral-50)' } },
                    Td('Total', { colSpan: 2, strong: true }),
                    Td(fmtDuree(totalSemaine), { align: 'right', mono: true, strong: true }),
                    Td(''),
                    Td(`${Math.round(chiffreAffaires).toLocaleString('fr-FR')} €`, {
                      align: 'right', mono: true, strong: true, style: { color: 'var(--cv-accent-600)' },
                    }),
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
      destroy() { offState(); },
    };
  }

  window.createRapport = createRapport;
})();

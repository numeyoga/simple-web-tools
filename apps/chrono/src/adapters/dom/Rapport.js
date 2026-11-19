// vue rapport hebdomadaire : stats, barres jour par jour, tableau projets, export CSV.
import { agregerSemaine, construireCSVRapport as construireCSV } from '../../core/report.js';
import * as UI from './ui.js';

const { el, fmtDuree } = UI;

export function createRapport(store) {
  let semaineOffset = 0;

  const host = el('div', { class: 'ch-pile ch-g20' });

  function statCard(label, valeur, sousTexte, { accent, mono = true, extra } = {}) {
    return el(
      'div',
      {
        class: 'ch-carte',
        style: { padding: 16 },
      },
      el('div', { class: 'ch-surtitre' }, label),
      el(
        'div',
        {
          style: {
            marginTop: 8,
            font: `500 26px/1 ${mono ? 'var(--cv-font-mono)' : 'var(--cv-font-sans)'}`,
            color: accent ? 'var(--cv-accent-600)' : 'var(--cv-fg)',
            letterSpacing: '-0.01em',
          },
        },
        valeur,
      ),
      sousTexte
        ? el(
            'div',
            {
              style: {
                marginTop: 4,
                font: '400 12px/1.2 var(--cv-font-sans)',
                color: 'var(--cv-fg-subtle)',
              },
            },
            sousTexte,
          )
        : null,
      extra || null,
    );
  }

  function Th(content, align = 'left') {
    return el(
      'th',
      {
        class: 'ch-surtitre',
        style: { padding: '10px 16px', textAlign: align },
      },
      content,
    );
  }
  function Td(content, opts = {}) {
    const { align = 'left', muted, mono, strong, colSpan, style } = opts;
    const attrs = {
      style: {
        padding: '12px 16px',
        textAlign: align,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxH = Math.ceil(maxJour / 3600_000 / 2) * 2;
    const paliers = Array.from({ length: Math.max(1, maxH / 2) + 1 }, (_, i) => i * 2);

    const axisY = el('div', {
      style: { height: H, position: 'relative', width: 34, flexShrink: 0 },
    });
    for (const h of paliers) {
      axisY.appendChild(
        el(
          'div',
          {
            class: 'ch-mono-xs',
            style: {
              position: 'absolute',
              bottom: (h / maxH) * H,
              right: 0,
              transform: 'translateY(50%)',
            },
          },
          `${h}h`,
        ),
      );
    }

    const bars = el('div', {
      class: 'ch-flex ch-g8',
      style: { flex: 1, alignItems: 'flex-end', height: H, position: 'relative' },
    });
    for (const h of paliers) {
      bars.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: (h / maxH) * H,
            borderTop:
              h === 0 ? '1px solid var(--cv-border-strong)' : '1px dashed var(--cv-border)',
            pointerEvents: 'none',
          },
        }),
      );
    }

    parJour.forEach((j, i) => {
      const isToday = j.date.getTime() === today.getTime();
      const isWeekend = i >= 5;
      const hauteurTotale = (j.total / (maxH * 3600_000)) * H;
      const segs = Object.entries(j.parProjet)
        .map(([pid, d]) => ({ projet: projets.find((p) => p.id === pid), duree: d }))
        .filter((x) => x.projet)
        .sort((a, b) => b.duree - a.duree);

      const segNodes = segs.map((seg, si) =>
        el('div', {
          title: `${seg.projet.nom} · ${fmtDuree(seg.duree)}`,
          style: {
            height: (seg.duree / j.total) * hauteurTotale,
            background: seg.projet.couleur,
            borderBottom: si > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none',
          },
        }),
      );

      bars.appendChild(
        el(
          'div',
          {
            class: 'ch-pile ch-g6',
            style: { flex: 1, alignItems: 'center', position: 'relative', zIndex: 1 },
          },
          el(
            'div',
            {
              style: {
                position: 'absolute',
                bottom: hauteurTotale + 8,
                font: '500 11px/1 var(--cv-font-mono)',
                color: 'var(--cv-fg-muted)',
                opacity: j.total > 0 ? 1 : 0.3,
                whiteSpace: 'nowrap',
              },
            },
            j.total > 0 ? fmtDuree(j.total, { compact: true }) : '',
          ),

          el(
            'div',
            {
              class: 'ch-flex',
              style: {
                width: '100%',
                maxWidth: 68,
                height: hauteurTotale,
                flexDirection: 'column-reverse',
                borderRadius: 4,
                overflow: 'hidden',
                background: isWeekend ? 'transparent' : 'var(--cv-neutral-100)',
                boxShadow: isToday ? '0 0 0 2px var(--cv-accent-500)' : 'none',
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
              },
            },
            segNodes,
          ),

          el(
            'div',
            {
              style: {
                position: 'absolute',
                bottom: 0,
                font: `${isToday ? 600 : 400} 12px/1 var(--cv-font-sans)`,
                color: isToday
                  ? 'var(--cv-accent-600)'
                  : isWeekend
                    ? 'var(--cv-fg-subtle)'
                    : 'var(--cv-fg)',
              },
            },
            `${jourNoms[i]} ${j.date.getDate()}`,
          ),
        ),
      );
    });

    return el('div', { class: 'ch-flex ch-g16' }, axisY, bars);
  }

  // Tableau récapitulatif de la distribution par jour : une ligne par jour,
  // une colonne par projet ayant du temps cette semaine, + une colonne Total.
  // Permet de lire les chiffres sans survoler chaque segment du diagramme.
  function tableauParJour(parJour, projetsTri, totalSemaine) {
    const jourNoms = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cols = projetsTri; // [{ id, duree, projet }]

    if (cols.length === 0) return el('div', { style: { display: 'none' } });

    const cellTxt = (ms) => (ms > 0 ? fmtDuree(ms) : '·');

    const totauxProjet = cols.map((c) =>
      parJour.reduce((acc, j) => acc + (j.parProjet[c.id] || 0), 0),
    );

    return el(
      'div',
      { style: { marginTop: 20, borderTop: '1px solid var(--cv-border)', overflowX: 'auto' } },
      el(
        'div',
        { class: 'ch-surtitre ch-surtitre--fort', style: { padding: '16px 0 10px' } },
        'Détail chiffré',
      ),
      el(
        'table',
        { style: { width: '100%', borderCollapse: 'collapse', minWidth: 480 } },
        el(
          'thead',
          null,
          el(
            'tr',
            { style: { borderBottom: '1px solid var(--cv-border)' } },
            Th('Jour'),
            ...cols.map((c) =>
              el(
                'th',
                {
                  style: {
                    padding: '8px 12px',
                    textAlign: 'right',
                    font: '500 11px/1.3 var(--cv-font-sans)',
                    color: 'var(--cv-fg-muted)',
                  },
                },
                el(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      justifyContent: 'flex-end',
                    },
                  },
                  el('span', {
                    class: 'ch-pastille',
                    style: { background: c.projet.couleur, flexShrink: 0 },
                  }),
                  el('span', { class: 'ch-ellipse', style: { maxWidth: 120 } }, c.projet.nom),
                ),
              ),
            ),
            Th('Total', 'right'),
          ),
        ),
        el(
          'tbody',
          null,
          parJour.map((j, i) => {
            const isToday = j.date.getTime() === today.getTime();
            return el(
              'tr',
              {
                style: {
                  borderBottom: '1px solid var(--cv-border)',
                  background: isToday ? 'var(--cv-accent-50)' : 'transparent',
                },
              },
              Td(`${jourNoms[i]} ${j.date.getDate()}`, { strong: isToday, muted: j.total === 0 }),
              ...cols.map((c) => {
                const v = j.parProjet[c.id] || 0;
                return Td(cellTxt(v), { align: 'right', mono: true, muted: v === 0 });
              }),
              Td(j.total > 0 ? fmtDuree(j.total) : '·', {
                align: 'right',
                mono: true,
                strong: j.total > 0,
                muted: j.total === 0,
              }),
            );
          }),
          el(
            'tr',
            { style: { background: 'var(--cv-neutral-50)' } },
            Td('Total', { strong: true }),
            ...totauxProjet.map((v) =>
              Td(cellTxt(v), { align: 'right', mono: true, strong: true, muted: v === 0 }),
            ),
            Td(fmtDuree(totalSemaine), { align: 'right', mono: true, strong: true }),
          ),
        ),
      ),
    );
  }

  function exportCSV(sessionsSem, projets, lundi) {
    const csv = construireCSV(sessionsSem, projets, Date.now());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // Date locale (et non toISOString, qui passe en UTC : lundi 00:00 → dimanche).
    a.href = url;
    a.download = `rapport-${UI.fmtDateISO(lundi)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function render() {
    const { projets, sessions } = store.state;
    const {
      lundi,
      dimanche,
      sessionsSem,
      parJour,
      totalSemaine,
      maxJour,
      progObjectif,
      projetsTri,
      totalSessions,
      joursActifs,
    } = agregerSemaine(sessions, projets, semaineOffset, Date.now());

    const semLabel =
      semaineOffset === 0
        ? 'Cette semaine'
        : semaineOffset === -1
          ? 'Semaine dernière'
          : semaineOffset < 0
            ? `Il y a ${-semaineOffset} semaines`
            : `Dans ${semaineOffset} semaines`;
    const semDates = `${lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → ${dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

    host.replaceChildren(
      // Header
      el(
        'div',
        { class: 'ch-flex ch-g16', style: { alignItems: 'flex-end', flexWrap: 'wrap' } },
        el(
          'div',
          { class: 'ch-flex-c ch-g8' },
          UI.IconButton({
            icon: 'caret-left',
            label: 'Semaine précédente',
            onclick: () => {
              semaineOffset--;
              render();
            },
          }),
          el(
            'div',
            null,
            el('div', { class: 'ch-titre-page' }, semLabel),
            el(
              'div',
              { class: 'ch-meta', style: { marginTop: 2, textTransform: 'capitalize' } },
              semDates,
            ),
          ),
          UI.IconButton({
            icon: 'caret-right',
            label: 'Semaine suivante',
            disabled: semaineOffset >= 0,
            onclick: () => {
              semaineOffset++;
              render();
            },
          }),
          semaineOffset !== 0
            ? UI.Button({
                size: 'sm',
                variant: 'ghost',
                children: 'Cette semaine',
                onclick: () => {
                  semaineOffset = 0;
                  render();
                },
              })
            : null,
        ),
        el('div', { style: { flex: 1 } }),
        UI.Button({
          icon: 'file-arrow-down',
          children: 'Exporter CSV',
          onclick: () => exportCSV(sessionsSem, projets, lundi),
        }),
      ),

      // Stats top
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 } },
        statCard('Total semaine', fmtDuree(totalSemaine), 'objectif 35h00', {
          extra: el(
            'div',
            {
              style: {
                height: 4,
                background: 'var(--cv-neutral-100)',
                borderRadius: 2,
                marginTop: 10,
                overflow: 'hidden',
              },
            },
            el('div', {
              style: {
                width: `${progObjectif * 100}%`,
                height: '100%',
                background: progObjectif >= 1 ? 'var(--cv-success-500)' : 'var(--cv-accent-500)',
                transition: 'width 300ms',
              },
            }),
          ),
        }),
        statCard(
          'Sessions',
          String(totalSessions),
          `réparties sur ${joursActifs} jour${joursActifs > 1 ? 's' : ''}`,
          { mono: false },
        ),
        statCard(
          'Moyenne / jour actif',
          fmtDuree(joursActifs > 0 ? totalSemaine / joursActifs : 0),
          joursActifs > 0 ? 'sur jours travaillés' : 'aucun jour travaillé',
        ),
      ),

      // Graphique
      el(
        'section',
        {
          class: 'ch-carte',
          style: { padding: 20 },
        },
        el(
          'div',
          { class: 'ch-flex', style: { alignItems: 'baseline', marginBottom: 16 } },
          el('div', { class: 'ch-titre-carte' }, 'Distribution par jour'),
          el(
            'div',
            { class: 'ch-legende', style: { marginLeft: 'auto' } },
            'Segments colorés = projets',
          ),
        ),
        barresSemaine(parJour, projets, maxJour),
        tableauParJour(parJour, projetsTri, totalSemaine),
      ),

      // Table projets
      el(
        'section',
        {
          class: 'ch-carte ch-carte--rogne',
        },
        el(
          'header',
          { style: { padding: '14px 20px', borderBottom: '1px solid var(--cv-border)' } },
          el('div', { class: 'ch-titre-carte' }, 'Par projet'),
        ),
        projetsTri.length === 0
          ? el('div', { class: 'ch-vide' }, 'Aucune session sur cette semaine.')
          : el(
              'table',
              { style: { width: '100%', borderCollapse: 'collapse' } },
              el(
                'thead',
                null,
                el(
                  'tr',
                  {
                    style: {
                      borderBottom: '1px solid var(--cv-border)',
                      background: 'var(--cv-neutral-50)',
                    },
                  },
                  Th('Projet'),
                  Th('Client'),
                  Th('Sessions', 'right'),
                  Th('Temps', 'right'),
                  Th('Part', 'right'),
                ),
              ),
              el(
                'tbody',
                null,
                projetsTri.map(({ id, duree, projet }) => {
                  const sessionsCount = sessionsSem.filter((s) => s.projetId === id).length;
                  const part = totalSemaine > 0 ? (duree / totalSemaine) * 100 : 0;
                  return el(
                    'tr',
                    { style: { borderBottom: '1px solid var(--cv-border)' } },
                    Td(
                      el(
                        'div',
                        { class: 'ch-flex-c ch-g8' },
                        el('span', { class: 'ch-pastille', style: { background: projet.couleur } }),
                        el('span', { class: 'ch-libelle' }, projet.nom),
                      ),
                    ),
                    Td(projet.client || '—', { muted: true }),
                    Td(String(sessionsCount), { align: 'right', mono: true }),
                    Td(fmtDuree(duree), { align: 'right', mono: true }),
                    Td(`${part.toFixed(0)}\u00a0%`, { align: 'right', mono: true, muted: true }),
                  );
                }),
                el(
                  'tr',
                  { style: { background: 'var(--cv-neutral-50)' } },
                  Td('Total', { colSpan: 2, strong: true }),
                  Td(String(totalSessions), { align: 'right', mono: true, strong: true }),
                  Td(fmtDuree(totalSemaine), { align: 'right', mono: true, strong: true }),
                  Td('100\u00a0%', { align: 'right', mono: true, muted: true }),
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
    destroy() {
      offState();
    },
  };
}

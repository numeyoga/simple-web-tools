// vue "Timeline" : bandeau date, stats, chart horaire, sessions, répartition.
import * as UI from './ui.js';

const { el, icon, fmtDuree, fmtHeure, dureeVivante } = UI;

const HEURE_DEBUT = 7;
const HEURE_FIN = 20;
const PX_PAR_HEURE = 84;

const POINTAGE_TYPES = [
  { value: 'arrivee', label: 'Arrivée', icon: 'sign-in', color: 'var(--cv-success-600)' },
  { value: 'pause_debut', label: 'Début de pause', icon: 'pause', color: 'var(--cv-warning-700)' },
  { value: 'pause_fin', label: 'Fin de pause', icon: 'play', color: 'var(--cv-warning-700)' },
  { value: 'depart', label: 'Départ', icon: 'sign-out', color: 'var(--cv-fg-muted)' },
];
const POINTAGE_META = Object.fromEntries(POINTAGE_TYPES.map((p) => [p.value, p]));

// Échelle horizontale du graphique (px depuis le bord gauche du contenu).
const CHART_PAD_X = 16;
const hourToPx = (h) => (h - HEURE_DEBUT) * PX_PAR_HEURE;
const tsToPx = (ts) => {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  return hourToPx(h);
};

// Pose une clé de focus stable (dataset.focusKey) sur un élément déjà construit.
const cle = (node, key) => {
  node.dataset.focusKey = key;
  return node;
};

export function createTimeline(store, opts) {
  let dateOffset = 0;

  const host = el('div', { class: 'ch-pile ch-g20' });

  function statBloc(label, valeur, sousTexte, { accent, mono = true } = {}) {
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
        valeur,
      ),
      sousTexte
        ? el(
            'div',
            {
              style: {
                marginTop: 3,
                font: '400 11px/1.2 var(--cv-font-sans)',
                color: 'var(--cv-fg-subtle)',
              },
            },
            sousTexte,
          )
        : null,
    );
  }

  function legendeItem(couleur, label, stripe) {
    return el(
      'span',
      { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
      el('span', {
        style: {
          width: 14,
          height: 8,
          borderRadius: 2,
          background: stripe
            ? `repeating-linear-gradient(135deg, ${couleur} 0 3px, transparent 3px 6px)`
            : couleur,
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
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    function localVersTs(v) {
      const t = new Date(v).getTime();
      return isNaN(t) ? null : t;
    }

    const projW = UI.Select({
      label: 'Projet',
      value: s.projetId,
      options: projets.map((p) => ({
        value: p.id,
        label: p.nom + (p.archive ? ' (archivé)' : ''),
      })),
    });
    const descW = UI.Input({
      label: 'Description',
      value: s.description || '',
      placeholder: 'Ex. maquette homepage v3',
    });
    const debutW = UI.Input({
      label: 'Début',
      value: tsVersLocal(s.debut),
      type: 'datetime-local',
    });
    const finW =
      s.statut === 'terminee'
        ? UI.Input({ label: 'Fin', value: tsVersLocal(s.fin), type: 'datetime-local' })
        : null;

    const dureeAffichee = el(
      'div',
      {
        style: { font: '500 18px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', marginTop: 4 },
      },
      fmtDuree(dureeVivante(s)),
    );
    // Même règle que majSession (db.js) : le temps de pause déjà décompté sur
    // la session d'origine est conservé, la durée enregistrée = bloc - pauses.
    const pausesOrigine =
      s.statut === 'terminee' && s.debut != null && s.fin != null
        ? Math.max(0, s.fin - s.debut - (s.duree || 0))
        : 0;
    function libellePause(ms) {
      const min = Math.max(1, Math.round(ms / 60000));
      const h = Math.floor(min / 60);
      return h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
    }
    const pausesNote =
      pausesOrigine > 0
        ? el(
            'div',
            {
              class: 'ch-legende',
              style: { marginTop: 4 },
            },
            `dont ${libellePause(pausesOrigine)} de pause déduites`,
          )
        : null;
    function recalcDuree() {
      if (s.statut !== 'terminee') return;
      const d = localVersTs(debutW.input.value);
      const f = localVersTs(finW.input.value);
      if (d != null && f != null && f >= d)
        dureeAffichee.textContent = fmtDuree(Math.max(0, f - d - pausesOrigine));
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
      title: 'Modifier la session',
      width: 480,
      body: el(
        'div',
        { class: 'ch-pile ch-g12' },
        projW,
        descW,
        el(
          'div',
          { class: 'ch-flex ch-g10' },
          el('div', { style: { flex: 1 } }, debutW),
          finW ? el('div', { style: { flex: 1 } }, finW) : null,
        ),
        s.statut === 'terminee'
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
              dureeAffichee,
              pausesNote,
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
          onclick: supprimer,
          style: { marginRight: 'auto' },
        }),
        UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
        UI.Button({
          variant: 'primary',
          icon: 'check',
          children: 'Enregistrer',
          onclick: enregistrer,
        }),
      ],
    });
  }

  /* ----------------- TimelineChart ----------------- */
  function timelineChart(jourDebut, sessionsJ, pointageJ, projets, isToday) {
    const totalHours = HEURE_FIN - HEURE_DEBUT;
    const widthPx = totalHours * PX_PAR_HEURE;
    const msToPx = (ms) => (ms / 3600_000) * PX_PAR_HEURE;

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
    if (enPresence != null)
      presenceSegs.push({
        debut: enPresence,
        fin: isToday ? Date.now() : jourDebut + 86400000,
        ongoing: true,
      });

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
    if (enPause != null)
      pauseSegs.push({
        debut: enPause,
        fin: isToday ? Date.now() : jourDebut + 86400000,
        ongoing: true,
      });

    const now = Date.now();

    const rule = el('div', { style: { position: 'relative', height: 22, width: widthPx } });
    for (let i = 0; i <= totalHours; i++) {
      const h = HEURE_DEBUT + i;
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

    // grilles
    for (let i = 0; i <= totalHours; i++) {
      line.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: hourToPx(HEURE_DEBUT + i),
            top: 0,
            bottom: 0,
            borderLeft: `1px ${(HEURE_DEBUT + i) % 2 === 0 ? 'solid' : 'dashed'} var(--cv-border)`,
          },
        }),
      );
    }

    // bandes présence
    for (const seg of presenceSegs) {
      line.appendChild(
        el('div', {
          title: `Présence : ${fmtHeure(seg.debut)} → ${seg.ongoing ? 'en cours' : fmtHeure(seg.fin)}`,
          style: {
            position: 'absolute',
            left: tsToPx(seg.debut),
            width: Math.max(2, tsToPx(seg.fin) - tsToPx(seg.debut)),
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
    // bandes pauses
    for (const seg of pauseSegs) {
      line.appendChild(
        el('div', {
          title: `Pause : ${fmtHeure(seg.debut)} → ${seg.ongoing ? 'en cours' : fmtHeure(seg.fin)}`,
          style: {
            position: 'absolute',
            left: tsToPx(seg.debut),
            width: Math.max(2, tsToPx(seg.fin) - tsToPx(seg.debut)),
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

    // sessions — placement en « voies » (swim lanes) pour gérer les chronos
    // en PARALLÈLE. La hauteur de la bande reste CONSTANTE : on divise la zone
    // verticale réservée aux sessions par le nombre de voies nécessaires ce
    // jour-là (chevauchement maximal). Une seule session => 1 voie pleine ;
    // plusieurs en parallèle => voies empilées, sans changer la hauteur totale.
    // Insets symétriques (16 px en haut / en bas du tracé de 140 px) pour que
    // les sessions restent centrées dans le « canal » de présence, qu'il y ait
    // une seule voie (bloc plein, centré) ou plusieurs voies empilées.
    const SESSION_ZONE_TOP = 16;
    const SESSION_ZONE_H = 108;
    const LANE_GAP = 4;

    // Étendue visuelle de chaque session : [debut, debut + durée affichée].
    const placed = sessionsJ
      .map((s) => {
        const dureeMs = dureeVivante(s);
        return { s, dureeMs, start: s.debut, end: s.debut + Math.max(dureeMs, 60_000) };
      })
      .sort((a, b) => a.start - b.start);

    // Regroupement en « grappes » de sessions qui se chevauchent (composantes
    // connexes), puis répartition en colonnes À L'INTÉRIEUR de chaque grappe.
    // Conséquence : une session SANS chevauchement occupe toute la hauteur de la
    // zone (donc centrée, marges égales en haut et en bas), tandis que des
    // chronos réellement en parallèle se partagent la hauteur — sans jamais
    // changer la hauteur totale de la bande, qui reste constante.
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
      // Expansion type « agenda » : chaque bloc s'étale sur les voies libres
      // situées à côté (vers le bas) tant qu'AUCUN autre bloc ne le chevauche
      // réellement dans le temps. L'espace vertical est donc toujours rempli :
      // un bloc sans voisin instantané prend toute la hauteur restante, et les
      // marges haut/bas demeurent cohérentes entre solo et multi.
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
      const proj = projets.find((p) => p.id === s.projetId);
      const dureeMs = item.dureeMs;
      const left = tsToPx(s.debut);
      const width = Math.max(10, msToPx(dureeMs));
      const isActive = s.statut !== 'terminee';
      const enCours = s.statut === 'en_cours';
      const laneH = (SESSION_ZONE_H - LANE_GAP * (item.cols - 1)) / item.cols;
      const blockH = laneH * item.colSpan + LANE_GAP * (item.colSpan - 1);
      const compact = blockH < 46;
      const top = SESSION_ZONE_TOP + item.col * (laneH + LANE_GAP);
      const block = el('div', {
        dataset: { focusKey: `session-bloc:${s.id}` },
        title: `${proj?.nom || 'Sans projet'} · ${fmtHeure(s.debut)} → ${s.statut === 'terminee' ? fmtHeure(s.fin) : 'en cours'} · ${fmtDuree(dureeMs)}`,
        onclick: () => ouvrirEditionSession(s),
        style: {
          position: 'absolute',
          left,
          width,
          top,
          height: blockH,
          background: proj?.couleur || 'var(--cv-neutral-500)',
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
          outline: enCours ? '2px solid var(--cv-accent-500)' : 'none',
        },
      });
      const titre = el(
        'div',
        { class: 'ch-souple', style: { overflow: 'hidden' } },
        el(
          'div',
          {
            class: 'ch-ellipse',
            style: { font: '500 11px/1.2 var(--cv-font-sans)', opacity: 0.85 },
          },
          proj?.nom || 'Sans projet',
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
      const dureeLine = el(
        'div',
        {
          class: 'ch-flex-c',
          style: { font: '500 11px/1 var(--cv-font-mono)', opacity: 0.95, gap: 5, flexShrink: 0 },
        },
        el('span', null, fmtDuree(dureeMs)),
        enCours
          ? el('span', {
              class: 'ch-point',
              style: { background: '#fff', animation: 'cv-pulse 1.2s infinite' },
            })
          : null,
      );
      block.append(titre, dureeLine);
      line.appendChild(block);
    }

    // Curseur "maintenant"
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
            fmtHeure(now),
          ),
        ),
      );
    }

    return el(
      'div',
      {
        dataset: { role: 'timeline-scroll', jour: String(jourDebut) },
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

  /* ----------------- Liste sessions ----------------- */
  function sessionsListe(sessionsJ, projets) {
    const list =
      sessionsJ.length === 0
        ? el(
            'div',
            { class: 'ch-vide' },
            icon('hourglass-low', { size: 22, style: { color: 'var(--cv-fg-subtle)' } }),
            el('div', { style: { marginTop: 6 } }, 'Aucune session pour ce jour.'),
            cle(
              UI.Button({
                variant: 'primary',
                size: 'sm',
                icon: 'play',
                children: 'Démarrer un chrono',
                style: { marginTop: 12 },
                onclick: opts.onOuvrirQuickAdd,
              }),
              'sessions-vide:demarrer',
            ),
          )
        : el(
            'div',
            null,
            sessionsJ.map((s) => {
              const proj = projets.find((p) => p.id === s.projetId);
              const isActive = s.statut !== 'terminee';
              const row = el(
                'div',
                {
                  class: isActive
                    ? 'ch-ligne est-actif ch-flex-c ch-g12'
                    : 'ch-ligne ch-flex-c ch-g12',
                  style: { padding: '10px 16px', cursor: 'pointer' },
                  onclick: (e) => {
                    // Évite d'ouvrir l'édition quand on clique sur un bouton dans la ligne.
                    if (e.target.closest('button')) return;
                    ouvrirEditionSession(s);
                  },
                },
                el('div', {
                  style: {
                    width: 4,
                    alignSelf: 'stretch',
                    borderRadius: 2,
                    background: proj?.couleur || 'var(--cv-neutral-400)',
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
                    el('span', null, proj?.nom || 'Sans projet'),
                    el('span', null, '·'),
                    el(
                      'span',
                      { style: { fontFamily: 'var(--cv-font-mono)' } },
                      `${fmtHeure(s.debut)} → ${s.statut === 'terminee' ? fmtHeure(s.fin) : 'en cours'}`,
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
                  fmtDuree(dureeVivante(s)),
                ),
                isActive && s.statut === 'en_cours'
                  ? el(
                      'div',
                      { class: 'ch-flex-c ch-g6', style: { flexShrink: 0 } },
                      UI.Badge({ variant: 'accent', dot: true, children: 'en cours' }),
                      cle(
                        UI.IconButton({
                          icon: 'pause',
                          label: 'Mettre en pause',
                          size: 'sm',
                          onclick: () => store.actions.pauserSession(s.id),
                        }),
                        `session:${s.id}:pause`,
                      ),
                      cle(
                        UI.IconButton({
                          icon: 'stop',
                          label: 'Arrêter',
                          size: 'sm',
                          onclick: () => store.actions.arreterSession(s.id),
                        }),
                        `session:${s.id}:stop`,
                      ),
                    )
                  : isActive && s.statut === 'en_pause'
                    ? el(
                        'div',
                        { class: 'ch-flex-c ch-g6', style: { flexShrink: 0 } },
                        UI.Badge({ variant: 'warning', dot: true, children: 'pause' }),
                        cle(
                          UI.IconButton({
                            icon: 'play',
                            label: 'Reprendre',
                            size: 'sm',
                            onclick: () => store.actions.reprendreSession(s.id),
                          }),
                          `session:${s.id}:reprendre`,
                        ),
                        cle(
                          UI.IconButton({
                            icon: 'stop',
                            label: 'Arrêter',
                            size: 'sm',
                            onclick: () => store.actions.arreterSession(s.id),
                          }),
                          `session:${s.id}:stop`,
                        ),
                      )
                    : el(
                        'div',
                        { class: 'ch-flex ch-g2', style: { flexShrink: 0 } },
                        cle(
                          UI.IconButton({
                            icon: 'play',
                            label: 'Reprendre ce projet',
                            title: 'Redémarrer un chrono sur ce projet',
                            onclick: () => opts.onDemarrerSurProjet(s.projetId, s.description),
                          }),
                          `session:${s.id}:redemarrer`,
                        ),
                        cle(
                          UI.IconButton({
                            icon: 'pencil-simple',
                            label: 'Modifier',
                            size: 'sm',
                            onclick: () => ouvrirEditionSession(s),
                          }),
                          `session:${s.id}:modifier`,
                        ),
                        cle(
                          UI.IconButton({
                            icon: 'trash',
                            label: 'Supprimer',
                            size: 'sm',
                            onclick: () => store.actions.supprimerSession(s.id),
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
          cle(
            UI.Button({
              size: 'sm',
              icon: 'plus',
              children: 'Nouvelle',
              onclick: opts.onOuvrirQuickAdd,
            }),
            'sessions:nouvelle',
          ),
        ),
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
      .map(([id, d]) => ({ id, duree: d, projet: projets.find((p) => p.id === id) }))
      .filter((x) => x.projet)
      .sort((a, b) => b.duree - a.duree);

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
      liste.length === 0
        ? el('div', { class: 'ch-vide' }, 'Rien à afficher — lance un chrono.')
        : el(
            'div',
            { style: { padding: '8px 0' } },
            liste.map(({ id, duree, projet }) => {
              const pct = total > 0 ? (duree / total) * 100 : 0;
              return el(
                'button',
                {
                  dataset: { focusKey: `repartition:${id}` },
                  onclick: () => opts.onDemarrerSurProjet(id),
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
                      style: { background: projet.couleur, flexShrink: 0 },
                    }),
                    el(
                      'span',
                      {
                        class: 'ch-ellipse',
                        style: { font: '500 13px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)' },
                      },
                      projet.nom,
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
                      fmtDuree(duree),
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
                        background: projet.couleur,
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

  /* ----------------- Pointages (édition) ----------------- */

  function tsVersLocal(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function localVersTs(v) {
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  }

  function ouvrirEditionPointage(p, jourDebut) {
    const isNew = !p;
    let modal;
    const tsInitial = p?.at ?? jourDebut + 9 * 3600_000;

    const typeW = UI.Select({
      label: 'Type',
      value: p?.type || 'arrivee',
      options: POINTAGE_TYPES.map((t) => ({ value: t.value, label: t.label })),
    });
    const timeW = UI.Input({
      label: 'Heure',
      type: 'datetime-local',
      value: tsVersLocal(tsInitial),
      autoFocus: true,
    });

    function enregistrer() {
      const t = localVersTs(timeW.input.value);
      if (t == null) return;
      const type = typeW.input.value;
      if (isNew) store.actions.ajouterPointage(type, t);
      else store.actions.majPointage(p.id, { type, at: t });
      modal.close();
    }
    function supprimer() {
      if (!p) return;
      store.actions.supprimerPointage(p.id);
      modal.close();
    }
    timeW.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') enregistrer();
    });

    const footer = [];
    if (!isNew)
      footer.push(
        UI.Button({
          variant: 'destructive',
          icon: 'trash',
          children: 'Supprimer',
          onclick: supprimer,
          style: { marginRight: 'auto' },
        }),
      );
    footer.push(UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }));
    footer.push(
      UI.Button({
        variant: 'primary',
        icon: 'check',
        children: 'Enregistrer',
        onclick: enregistrer,
      }),
    );

    modal = UI.Modal({
      title: isNew ? 'Ajouter un pointage' : 'Modifier le pointage',
      width: 420,
      body: el('div', { class: 'ch-pile ch-g12' }, typeW, timeW),
      footer,
    });
  }

  function pointageSection(pointageJ, jourDebut, isToday) {
    const ordres = pointageJ.slice().sort((a, b) => a.at - b.at);
    const aArrivee = pointageJ.some((e) => e.type === 'arrivee');
    const nowBoundary = isToday ? Date.now() : jourDebut + 86400000;
    const presence = aArrivee ? UI.dureePresence(pointageJ, nowBoundary) : 0;
    const estParti = pointageJ.some((e) => e.type === 'depart');
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
        aArrivee
          ? el(
              'div',
              { style: { marginLeft: 'auto', textAlign: 'right' } },
              el('div', { class: 'ch-surtitre ch-surtitre--xs' }, 'Présence totale'),
              el(
                'div',
                { class: 'ch-flex-c', style: { gap: 5, justifyContent: 'flex-end', marginTop: 4 } },
                isToday && !estParti
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
                  fmtDuree(presence),
                ),
              ),
            )
          : null,
        el(
          'div',
          { style: { marginLeft: aArrivee ? 0 : 'auto' } },
          cle(
            UI.Button({
              size: 'sm',
              icon: 'plus',
              children: 'Ajouter',
              onclick: () => ouvrirEditionPointage(null, jourDebut),
            }),
            'pointage:ajouter',
          ),
        ),
      ),
      ordres.length === 0
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
            ordres.map((p) => {
              const meta = POINTAGE_META[p.type] || POINTAGE_META.arrivee;
              return el(
                'button',
                {
                  dataset: { focusKey: `pointage:${p.id ?? `${p.type}-${p.at}`}` },
                  onclick: () => ouvrirEditionPointage(p, jourDebut),
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
                    fmtHeure(p.at),
                  ),
                ),
              );
            }),
          ),
    );
  }

  /* ----------------- Render principal ----------------- */
  // Défilement horizontal du graphique, mémorisé par jour affiché (clé = début du jour).
  const scrollParJour = new Map();

  function render() {
    // Avant de reconstruire : mémorise le défilement du graphique (pour le jour qu'il affiche)
    // et l'élément focalisé. Un conteneur non affiché (scrollLeft forcé à 0) n'est pas mémorisé.
    const ancienScroll = host.querySelector('[data-role="timeline-scroll"]');
    // On ne mémorise qu'un conteneur déjà positionné : le tout premier rendu a lieu avant
    // l'insertion dans le document (clientWidth = 0), et son scrollLeft de 0 écraserait
    // sinon le centrage initial sur l'heure actuelle.
    if (ancienScroll && ancienScroll.clientWidth > 0 && ancienScroll.dataset.positionne) {
      scrollParJour.set(ancienScroll.dataset.jour, ancienScroll.scrollLeft);
    }
    const focusKey = host.contains(document.activeElement)
      ? document.activeElement.closest('[data-focus-key]')?.dataset.focusKey
      : null;

    const s = store.state;
    const dbase = new Date();
    dbase.setHours(0, 0, 0, 0);
    dbase.setDate(dbase.getDate() + dateOffset);
    const jourDebut = dbase.getTime();
    const jourFin = jourDebut + 86400000;
    const isToday = dateOffset === 0;

    const sessionsJ = s.sessions
      .filter((x) => x.debut >= jourDebut && x.debut < jourFin)
      .sort((a, b) => a.debut - b.debut);
    const pointageJ = s.pointage
      .filter((p) => p.at >= jourDebut && p.at < jourFin)
      .sort((a, b) => a.at - b.at);

    const totalTravaille = sessionsJ.reduce((acc, x) => acc + dureeVivante(x), 0);
    const arrivee = pointageJ.find((p) => p.type === 'arrivee');
    const dernierDepart = [...pointageJ].reverse().find((p) => p.type === 'depart');

    const jourLabel =
      dateOffset === 0
        ? "Aujourd'hui"
        : dateOffset === -1
          ? 'Hier'
          : new Date(jourDebut).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
    const jourLabelDate = new Date(jourDebut).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    host.replaceChildren(
      // Bandeau date + stats
      el(
        'div',
        { class: 'ch-flex', style: { alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' } },
        el(
          'div',
          { class: 'ch-flex-c ch-g8' },
          cle(
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
            el(
              'div',
              { class: 'ch-titre-page', style: { textTransform: 'capitalize' } },
              jourLabel,
            ),
            el(
              'div',
              { class: 'ch-meta', style: { textTransform: 'capitalize', marginTop: 2 } },
              jourLabelDate,
            ),
          ),
          cle(
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
            ? cle(
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
          statBloc(
            'Temps travaillé',
            fmtDuree(totalTravaille),
            `${sessionsJ.length} session${sessionsJ.length > 1 ? 's' : ''}`,
          ),
          statBloc(
            'Amplitude',
            arrivee
              ? `${fmtHeure(arrivee.at)} → ${dernierDepart ? fmtHeure(dernierDepart.at) : '···'}`
              : '—',
            arrivee ? (dernierDepart ? 'journée clôturée' : 'en cours') : 'pas encore arrivé',
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
            legendeItem('var(--cv-success-500)', 'Présence'),
            legendeItem('var(--cv-warning-400)', 'Pause', true),
            legendeItem('var(--cv-fg)', 'Session'),
          ),
        ),
        timelineChart(jourDebut, sessionsJ, pointageJ, s.projets, isToday),
      ),

      // Bas : sessions + répartition
      el(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 } },
        sessionsListe(sessionsJ, s.projets),
        el(
          'div',
          { class: 'ch-pile ch-g20' },
          pointageSection(pointageJ, jourDebut, isToday),
          repartition(sessionsJ, s.projets),
        ),
      ),
    );

    // Restaure le défilement du graphique.
    const scroller = host.querySelector('[data-role="timeline-scroll"]');
    if (scroller && scroller.clientWidth > 0) {
      const memo = scrollParJour.get(String(jourDebut));
      if (memo != null) {
        scroller.scrollLeft = memo;
      } else if (isToday && scroller.scrollWidth > scroller.clientWidth) {
        // Premier affichage du jour courant : l'heure actuelle visible, vers les 2/3 de la largeur.
        scroller.scrollLeft = Math.max(
          0,
          CHART_PAD_X + tsToPx(Date.now()) - (scroller.clientWidth * 2) / 3,
        );
      }
      scroller.dataset.positionne = '1';
    } else if (scroller && !scroller.isConnected) {
      // Pas encore dans le document (premier rendu) : on positionne dès qu'il est affiché.
      requestAnimationFrame(() => {
        if (scroller.isConnected && !scroller.dataset.positionne) render();
      });
    }

    // Restaure le focus clavier.
    if (focusKey) {
      const cible = [...host.querySelectorAll('[data-focus-key]')].find(
        (n) => n.dataset.focusKey === focusKey,
      );
      if (cible) cible.focus({ preventScroll: true });
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

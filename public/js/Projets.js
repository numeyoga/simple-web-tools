// js/Projets.js — vue projets : cartes avec totaux, modal de création.
(function () {
  const { el, icon, fmtDuree, dureeVivante } = window.UI;

  const COULEURS = ['#ea580c','#2563eb','#16a34a','#9333ea','#0891b2','#db2777','#ca8a04','#71717a'];

  function createProjets(store, opts) {
    let afficherArchive = false;

    const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } });

    function ouvrirModalCreation() {
      const brouillon = { nom: '', client: '', couleur: '#ea580c', tarif: 0 };
      let modal;
      let inputNom, inputClient, inputTarif;
      const couleursRow = el('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } });

      function paintCouleurs() {
        couleursRow.replaceChildren(
          ...COULEURS.map(c => el('button', {
            onclick: () => { brouillon.couleur = c; paintCouleurs(); },
            'aria-label': `Couleur ${c}`,
            style: {
              width: 28, height: 28, borderRadius: 8,
              border: brouillon.couleur === c ? '2px solid var(--cv-fg)' : '2px solid transparent',
              background: c, cursor: 'pointer', padding: 0,
            },
          })),
        );
      }
      paintCouleurs();

      const nomW    = UI.Input({ label: 'Nom du projet', value: '', placeholder: 'Ex. Refonte site — Acme', autoFocus: true });
      const clientW = UI.Input({ label: 'Client',        value: '', placeholder: 'Ex. Acme SAS (facultatif)' });
      const tarifW  = UI.Input({ label: 'Tarif horaire (€)', value: '', type: 'number', placeholder: '0', hint: 'Laisse à 0 si non facturable.' });
      inputNom = nomW.input; inputClient = clientW.input; inputTarif = tarifW.input;

      const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        nomW,
        clientW,
        el('div', null,
          el('div', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginBottom: 6 } }, 'Couleur'),
          couleursRow,
        ),
        tarifW,
      );

      function creer() {
        const nom = inputNom.value.trim();
        if (!nom) return;
        const client = inputClient.value.trim();
        const tarif = Number(inputTarif.value) || 0;
        store.actions.ajouterProjet(nom, client, brouillon.couleur, tarif);
        modal.close();
      }

      const btnCreer = UI.Button({ variant: 'primary', icon: 'check', children: 'Créer', onclick: creer });
      const updateDisabled = () => {
        btnCreer.disabled = !inputNom.value.trim();
        btnCreer.style.opacity = btnCreer.disabled ? 0.5 : 1;
        btnCreer.style.cursor = btnCreer.disabled ? 'not-allowed' : 'pointer';
      };
      inputNom.addEventListener('input', updateDisabled);
      updateDisabled();
      inputNom.addEventListener('keydown', e => { if (e.key === 'Enter') creer(); });

      modal = UI.Modal({
        title: 'Nouveau projet', width: 480,
        body,
        footer: [
          UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
          btnCreer,
        ],
      });
    }

    function render() {
      const { projets, sessions, todos } = store.state;
      const liste = projets.filter(p => afficherArchive ? p.archive : !p.archive);

      const totaux = {};
      for (const s of sessions) {
        if (!totaux[s.projetId]) totaux[s.projetId] = { duree: 0, count: 0 };
        totaux[s.projetId].duree += dureeVivante(s);
        totaux[s.projetId].count += 1;
      }
      const todosParProjet = {};
      for (const t of todos) {
        if (!todosParProjet[t.projetId]) todosParProjet[t.projetId] = { open: 0, done: 0 };
        if (t.fait) todosParProjet[t.projetId].done += 1; else todosParProjet[t.projetId].open += 1;
      }

      host.replaceChildren(
        // Header
        el('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
          el('div', null,
            el('div', { style: { font: '600 20px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg)', letterSpacing: '-0.01em' } }, 'Projets'),
            el('div', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 4 } },
              `${projets.filter(p => !p.archive).length} actifs · ${projets.filter(p => p.archive).length} archivés`),
          ),
          el('div', { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
            UI.Button({
              variant: afficherArchive ? 'primary' : 'secondary',
              icon: 'archive', children: afficherArchive ? 'Archivés' : 'Actifs',
              onclick: () => { afficherArchive = !afficherArchive; render(); },
            }),
            UI.Button({ variant: 'primary', icon: 'plus', children: 'Nouveau projet', onclick: ouvrirModalCreation }),
          ),
        ),

        // Grille
        liste.length === 0
          ? el('div', {
              style: {
                padding: '48px 16px', textAlign: 'center', color: 'var(--cv-fg-muted)',
                font: '400 14px/1.5 var(--cv-font-sans)',
                border: '1px dashed var(--cv-border-strong)', borderRadius: 10,
              },
            },
              icon('folder-open', { size: 32, style: { color: 'var(--cv-fg-subtle)' } }),
              el('div', { style: { marginTop: 8 } }, `Aucun projet ${afficherArchive ? 'archivé' : 'actif'}.`),
            )
          : el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 } },
              liste.map(p => carteProjet(p, totaux[p.id] || { duree: 0, count: 0 }, todosParProjet[p.id] || { open: 0, done: 0 })),
            ),
      );
    }

    function carteProjet(p, t, td) {
      const facturable = p.tarif > 0 ? t.duree : 0;
      return el('article', {
        style: {
          background: 'var(--cv-surface)', border: '1px solid var(--cv-border)',
          borderRadius: 12, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: 'var(--cv-shadow-sm)',
          position: 'relative', overflow: 'hidden',
        },
      },
        el('div', { style: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: p.couleur } }),
        el('div', { style: { paddingLeft: 6 } },
          el('div', { style: { font: '600 14px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg)' } }, p.nom),
          el('div', { style: { font: '400 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2 } }, p.client || '—'),
        ),

        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingLeft: 6 } },
          el('div', null,
            el('div', { style: { font: '500 10px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, 'Temps total'),
            el('div', { style: { font: '500 18px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', marginTop: 4, letterSpacing: '-0.01em' } }, fmtDuree(t.duree)),
            el('div', { style: { font: '400 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)', marginTop: 2 } }, `${t.count} session${t.count > 1 ? 's' : ''}`),
          ),
          el('div', null,
            el('div', { style: { font: '500 10px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, 'Facturable'),
            el('div', {
              style: { font: '500 18px/1 var(--cv-font-mono)', marginTop: 4, letterSpacing: '-0.01em', color: p.tarif > 0 ? 'var(--cv-accent-600)' : 'var(--cv-fg-subtle)' },
            }, p.tarif > 0 ? `${Math.round(facturable / 3600_000 * p.tarif)} €` : '—'),
            el('div', { style: { font: '400 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)', marginTop: 2 } },
              p.tarif > 0 ? `${p.tarif} €/h` : 'non facturé'),
          ),
        ),

        el('div', { style: { display: 'flex', gap: 6, paddingLeft: 6 } },
          UI.Badge({ variant: 'neutral', children: `${td.open} todo${td.open > 1 ? 's' : ''}` }),
          td.done > 0 ? UI.Badge({ variant: 'success', children: `${td.done} faites` }) : null,
        ),

        el('div', { style: { display: 'flex', gap: 6, marginTop: 'auto', paddingLeft: 6 } },
          !p.archive
            ? [
                UI.Button({
                  size: 'sm', variant: 'primary', icon: 'play', children: 'Démarrer',
                  onclick: () => opts.onDemarrerSurProjet(p.id), style: { flex: 1 },
                }),
                UI.IconButton({
                  icon: 'archive', label: 'Archiver', variant: 'secondary', size: 'sm',
                  onclick: () => store.actions.archiverProjet(p.id),
                }),
              ]
            : UI.Button({
                size: 'sm', variant: 'secondary', icon: 'arrow-counter-clockwise',
                children: 'Désarchiver',
                onclick: () => store.actions.archiverProjet(p.id),
                style: { flex: 1 },
              }),
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

  window.createProjets = createProjets;
})();

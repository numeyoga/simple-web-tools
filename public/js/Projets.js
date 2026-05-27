// js/Projets.js — vue projets : cartes avec totaux, modal de création.
(function () {
  const { el, icon, fmtDuree, dureeVivante } = window.UI;

  /* Palette curatée (16 teintes bien différenciées). Une couleur perso peut être saisie via le picker natif. */
  const COULEURS = [
    '#ea580c', '#d97706', '#ca8a04', '#65a30d',
    '#16a34a', '#0d9488', '#0891b2', '#0284c7',
    '#2563eb', '#4f46e5', '#7c3aed', '#9333ea',
    '#c026d3', '#db2777', '#e11d48', '#475569',
  ];
  const norm = c => (c || '').trim().toLowerCase();

  function createProjets(store, opts) {
    let afficherArchive = false;

    const host = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } });

    function ouvrirModalProjet(existant = null) {
      const isEdit = !!existant;
      const brouillon = existant
        ? { nom: existant.nom, client: existant.client || '', couleur: existant.couleur }
        : { nom: '', client: '', couleur: COULEURS[0] };
      let modal;
      let inputNom, inputClient;
      const couleursRow = el('div', {
        style: { display: 'grid', gridTemplateColumns: 'repeat(9, 28px)', gap: 8, alignItems: 'center' },
      });

      /* Picker natif caché, déclenché par le bouton "+". */
      const pickerNatif = el('input', {
        type: 'color',
        value: COULEURS.includes(norm(brouillon.couleur)) ? COULEURS[0] : brouillon.couleur,
        oninput: e => { brouillon.couleur = e.target.value; paintCouleurs(); },
        style: {
          position: 'absolute', width: 0, height: 0, padding: 0, border: 0,
          opacity: 0, pointerEvents: 'none',
        },
      });

      function paintCouleurs() {
        const current = norm(brouillon.couleur);
        const estDansPalette = COULEURS.some(c => norm(c) === current);
        couleursRow.replaceChildren(
          ...COULEURS.map(c => {
            const selectionne = norm(c) === current;
            return el('button', {
              type: 'button',
              onclick: () => { brouillon.couleur = c; paintCouleurs(); },
              'aria-label': `Couleur ${c}`,
              title: c,
              style: {
                width: 28, height: 28, borderRadius: 8,
                border: selectionne ? '2px solid var(--cv-fg)' : '2px solid transparent',
                background: c, cursor: 'pointer', padding: 0,
                boxShadow: selectionne ? '0 0 0 2px var(--cv-surface) inset' : 'none',
              },
            });
          }),
          /* Bouton "couleur personnalisée" : ouvre le color picker natif.
             Si une couleur perso est déjà choisie, on l'affiche dans le bouton. */
          el('button', {
            type: 'button',
            onclick: () => pickerNatif.click(),
            'aria-label': 'Couleur personnalisée',
            title: estDansPalette ? 'Couleur personnalisée…' : `Couleur personnalisée : ${brouillon.couleur}`,
            style: {
              width: 28, height: 28, borderRadius: 8, padding: 0, cursor: 'pointer',
              border: !estDansPalette ? '2px solid var(--cv-fg)' : '1px dashed var(--cv-border-strong)',
              background: !estDansPalette
                ? brouillon.couleur
                : 'conic-gradient(from 180deg, #ef4444, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #ef4444)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', textShadow: '0 0 2px rgba(0,0,0,0.4)',
              boxShadow: !estDansPalette ? '0 0 0 2px var(--cv-surface) inset' : 'none',
            },
          }, !estDansPalette ? '' : icon('plus', { size: 14, style: { color: 'var(--cv-fg)' } })),
          pickerNatif,
        );
      }
      paintCouleurs();

      const nomW    = UI.Input({ label: 'Nom du projet', value: brouillon.nom, placeholder: 'Ex. Refonte site — Acme', autoFocus: !isEdit });
      /* Autocomplétion sur les clients déjà connus. L'utilisateur peut aussi taper
         une nouvelle valeur libre — elle est créée à la volée. */
      const clientsConnus = Array.from(new Set(
        store.state.projets
          .filter(p => p.client && p.id !== existant?.id)
          .map(p => p.client.trim())
          .filter(Boolean)
      ));
      const clientW = UI.Autocomplete({
        label: 'Client',
        value: brouillon.client,
        options: clientsConnus,
        placeholder: 'Ex. Acme SAS (facultatif)',
        hint: clientsConnus.length > 0 ? `${clientsConnus.length} client${clientsConnus.length > 1 ? 's' : ''} déjà saisi${clientsConnus.length > 1 ? 's' : ''} — ou tape un nouveau nom` : null,
      });
      inputNom = nomW.input; inputClient = clientW.input;

      const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        nomW,
        clientW,
        el('div', null,
          el('div', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginBottom: 6 } }, 'Couleur'),
          couleursRow,
        ),
      );

      function enregistrer() {
        const nom = inputNom.value.trim();
        if (!nom) return;
        const patch = {
          nom,
          client: inputClient.value.trim(),
          couleur: brouillon.couleur,
        };
        if (isEdit) store.actions.majProjet(existant.id, patch);
        else        store.actions.ajouterProjet(patch.nom, patch.client, patch.couleur);
        modal.close();
      }

      function supprimer() {
        const { sessions, todos } = store.state;
        const n = sessions.filter(s => s.projetId === existant.id).length;
        const m = todos.filter(t => t.projetId === existant.id).length;
        const msg = (n + m) > 0
          ? `Supprimer le projet « ${existant.nom} » ? ${n} session${n>1?'s':''} et ${m} tâche${m>1?'s':''} seront aussi supprimées.`
          : `Supprimer le projet « ${existant.nom} » ?`;
        if (!confirm(msg)) return;
        store.actions.supprimerProjet(existant.id);
        modal.close();
      }

      const btnEnregistrer = UI.Button({ variant: 'primary', icon: 'check', children: isEdit ? 'Enregistrer' : 'Créer', onclick: enregistrer });
      const updateDisabled = () => {
        btnEnregistrer.disabled = !inputNom.value.trim();
        btnEnregistrer.style.opacity = btnEnregistrer.disabled ? 0.5 : 1;
        btnEnregistrer.style.cursor = btnEnregistrer.disabled ? 'not-allowed' : 'pointer';
      };
      inputNom.addEventListener('input', updateDisabled);
      updateDisabled();
      inputNom.addEventListener('keydown', e => { if (e.key === 'Enter') enregistrer(); });

      const footer = [];
      if (isEdit) footer.push(UI.Button({ variant: 'destructive', icon: 'trash', children: 'Supprimer', onclick: supprimer, style: { marginRight: 'auto' } }));
      footer.push(UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }));
      footer.push(btnEnregistrer);

      modal = UI.Modal({
        title: isEdit ? 'Modifier le projet' : 'Nouveau projet', width: 480,
        body, footer,
      });
    }

    function ouvrirModalCreation() { ouvrirModalProjet(null); }

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

        el('div', { style: { paddingLeft: 6 } },
          el('div', { style: { font: '500 10px/1 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' } }, 'Temps total'),
          el('div', { style: { font: '500 22px/1 var(--cv-font-mono)', color: 'var(--cv-fg)', marginTop: 6, letterSpacing: '-0.01em' } }, fmtDuree(t.duree)),
          el('div', { style: { font: '400 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)', marginTop: 2 } }, `${t.count} session${t.count > 1 ? 's' : ''} enregistrée${t.count > 1 ? 's' : ''}`),
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
                  icon: 'pencil-simple', label: 'Modifier', variant: 'secondary', size: 'sm',
                  onclick: () => ouvrirModalProjet(p),
                }),
                UI.IconButton({
                  icon: 'archive', label: 'Archiver', variant: 'secondary', size: 'sm',
                  onclick: () => store.actions.archiverProjet(p.id),
                }),
              ]
            : [
                UI.Button({
                  size: 'sm', variant: 'secondary', icon: 'arrow-counter-clockwise',
                  children: 'Désarchiver',
                  onclick: () => store.actions.archiverProjet(p.id),
                  style: { flex: 1 },
                }),
                UI.IconButton({
                  icon: 'pencil-simple', label: 'Modifier', variant: 'secondary', size: 'sm',
                  onclick: () => ouvrirModalProjet(p),
                }),
              ],
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

// js/QuickAdd.js — modal "démarrer un chrono" : description + sélection de projet.
(function () {
  const { el, icon } = window.UI;

  function ouvrirQuickAdd(store, { projetPrefill = null, descriptionPrefill = '', onDemarre } = {}) {
    let projetId = projetPrefill
      || (store.state.projets.find(p => !p.archive)?.id)
      || store.state.projets[0]?.id
      || '';
    let modal;
    let inputDesc;

    const listHost = el('div', {
      style: { display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' },
    });

    function renderListe() {
      const projets = store.state.projets.filter(p => !p.archive);
      listHost.replaceChildren(...projets.map(p => el('button', {
        onclick: () => { projetId = p.id; renderListe(); },
        style: {
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          border: `1px solid ${projetId === p.id ? 'var(--cv-accent-500)' : 'transparent'}`,
          background: projetId === p.id ? 'var(--cv-accent-50)' : 'transparent',
          color: 'var(--cv-fg)', cursor: 'pointer',
          textAlign: 'left', transition: 'all 120ms',
        },
        onmouseenter: e => { if (projetId !== p.id) e.currentTarget.style.background = 'var(--cv-surface-2)'; },
        onmouseleave: e => { if (projetId !== p.id) e.currentTarget.style.background = 'transparent'; },
      },
        el('span', { style: { width: 10, height: 10, borderRadius: 3, background: p.couleur, flexShrink: 0 } }),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { style: { font: '500 13px/1.2 var(--cv-font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.nom),
          p.client ? el('div', { style: { font: '400 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2 } }, p.client) : null,
        ),
        projetId === p.id ? icon('check-circle', { weight: 'fill', size: 16, style: { color: 'var(--cv-accent-500)' } }) : null,
      )));
    }
    renderListe();

    inputDesc = el('input', {
      value: descriptionPrefill || '',
      placeholder: 'Ex. maquette homepage v3',
      autocomplete: 'off',
      onkeydown: e => { if (e.key === 'Enter') submit(); },
      style: {
        height: 40, padding: '0 12px',
        border: '1px solid var(--cv-border-strong)', borderRadius: 8,
        background: 'var(--cv-surface)', color: 'var(--cv-fg)',
        font: '400 15px/1 var(--cv-font-sans)', outline: 'none',
        transition: 'border-color 120ms',
      },
      onfocus: e => { e.target.style.borderColor = 'var(--cv-accent-500)'; e.target.style.boxShadow = 'var(--cv-shadow-focus)'; },
      onblur:  e => { e.target.style.borderColor = 'var(--cv-border-strong)'; e.target.style.boxShadow = 'none'; },
    });

    function submit() {
      if (!projetId) return;
      store.actions.demarrer(projetId, inputDesc.value);
      onDemarre && onDemarre(projetId);
      modal.close();
    }

    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
      el('label', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
        el('span', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)' } }, 'Sur quoi travailles-tu ?'),
        inputDesc,
      ),
      el('div', null,
        el('div', { style: { font: '500 12px/1.3 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginBottom: 6 } }, 'Projet'),
        listHost,
      ),
    );

    const footer = [
      el('div', {
        style: {
          marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center',
          font: '400 12px/1 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)',
        },
      }, UI.Kbd('Entrée'), ' pour démarrer'),
      UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
      UI.Button({ variant: 'primary', icon: 'play', children: 'Démarrer', onclick: submit }),
    ];

    modal = UI.Modal({ title: 'Démarrer un chrono', width: 520, body, footer });
    setTimeout(() => inputDesc.focus(), 50);
  }

  window.ouvrirQuickAdd = ouvrirQuickAdd;
})();

// js/QuickAdd.js — modal "ajouter un chrono".
//
// Deux modes :
//   • "live"   : démarre un chrono qui tourne immédiatement.
//   • "manuel" : crée une session déjà terminée (début + fin saisis)
//                — typiquement pour rattraper une plage oubliée. La session
//                n'est PAS activée car elle a déjà une fin.
(function () {
  const { el, icon, fmtDuree } = window.UI;

  function tsVersLocal(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function localVersTs(v) { const t = new Date(v).getTime(); return isNaN(t) ? null : t; }

  function ouvrirQuickAdd(store, {
    projetPrefill = null,
    descriptionPrefill = '',
    mode: modePrefill = 'live',
    debutPrefill = null,
    finPrefill = null,
    onDemarre,
    onAjoutManuel,
  } = {}) {
    let projetId = projetPrefill
      || (store.state.projets.find(p => !p.archive)?.id)
      || store.state.projets[0]?.id
      || '';
    let mode = modePrefill === 'manuel' ? 'manuel' : 'live';
    let modal;
    let inputDesc;
    let debutW, finW, dureeAffichee, errorBox;

    /* --- segmented control mode --- */
    const segWrap = el('div', {
      role: 'tablist',
      style: {
        display: 'inline-flex', padding: 3, borderRadius: 9,
        background: 'var(--cv-neutral-100)', border: '1px solid var(--cv-border)',
        alignSelf: 'flex-start',
      },
    });
    function segBtn(value, iconName, label) {
      const btn = el('button', {
        role: 'tab',
        onclick: () => { mode = value; renderMode(); },
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', border: 'none', borderRadius: 6,
          font: '500 12px/1 var(--cv-font-sans)', cursor: 'pointer',
          background: 'transparent', color: 'var(--cv-fg-muted)',
          transition: 'background 120ms, color 120ms',
        },
      },
        icon(iconName, { size: 13 }),
        label,
      );
      btn.dataset.value = value;
      return btn;
    }
    const segLive   = segBtn('live',   'play',          'Démarrer maintenant');
    const segManuel = segBtn('manuel', 'pencil-simple', 'Saisir manuellement');
    segWrap.appendChild(segLive);
    segWrap.appendChild(segManuel);

    function paintSeg() {
      for (const b of [segLive, segManuel]) {
        const actif = b.dataset.value === mode;
        b.style.background = actif ? 'var(--cv-surface)' : 'transparent';
        b.style.color = actif ? 'var(--cv-fg)' : 'var(--cv-fg-muted)';
        b.style.boxShadow = actif ? 'var(--cv-shadow-sm)' : 'none';
      }
    }

    /* --- liste des projets --- */
    const listHost = el('div', {
      class: 'ch-pile ch-g4', style: { maxHeight: 240, overflowY: 'auto' },
    });
    function renderListe() {
      const projets = store.state.projets.filter(p => !p.archive);
      listHost.replaceChildren(...projets.map(p => el('button', {
        onclick: () => { projetId = p.id; renderListe(); },
        class: projetId === p.id ? 'ch-option est-actif' : 'ch-option',
      },
        el('span', { style: { width: 10, height: 10, borderRadius: 3, background: p.couleur, flexShrink: 0 } }),
        el('div', { class: 'ch-souple' },
          el('div', { class: 'ch-ellipse', style: { font: '500 13px/1.2 var(--cv-font-sans)' } }, p.nom),
          p.client ? el('div', { style: { font: '400 11px/1.2 var(--cv-font-sans)', color: 'var(--cv-fg-muted)', marginTop: 2 } }, p.client) : null,
        ),
        projetId === p.id ? icon('check-circle', { weight: 'fill', size: 16, style: { color: 'var(--cv-accent-500)' } }) : null,
      )));
    }
    renderListe();

    /* --- description --- */
    inputDesc = el('input', {
      value: descriptionPrefill || '',
      placeholder: 'Ex. maquette homepage v3',
      autocomplete: 'off',
      onkeydown: e => { if (e.key === 'Enter' && mode === 'live') submit(); },
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

    /* --- bloc "saisie manuelle" --- */
    // Valeurs par défaut : si pas de prefill, on propose une plage d'une heure
    // se terminant maintenant arrondie au quart d'heure le plus proche.
    const now = new Date();
    now.setSeconds(0, 0);
    const finDefault = finPrefill != null ? finPrefill : now.getTime();
    const debutDefault = debutPrefill != null ? debutPrefill : finDefault - 60 * 60_000;

    debutW = window.UI.Input({ label: 'Début', type: 'datetime-local', value: tsVersLocal(debutDefault) });
    finW   = window.UI.Input({ label: 'Fin',   type: 'datetime-local', value: tsVersLocal(finDefault) });
    dureeAffichee = el('div', {
      style: { font: '500 16px/1 var(--cv-font-mono)', color: 'var(--cv-fg)' },
    }, '—');
    errorBox = el('div', {
      style: {
        display: 'none', padding: '6px 10px', borderRadius: 6,
        background: 'var(--cv-danger-50, #fef2f2)', border: '1px solid var(--cv-danger-200, #fecaca)',
        color: 'var(--cv-danger-700, #b91c1c)', font: '400 12px/1.3 var(--cv-font-sans)',
      },
    });

    function recalcDuree() {
      const d = localVersTs(debutW.input.value);
      const f = localVersTs(finW.input.value);
      if (d == null || f == null) { dureeAffichee.textContent = '—'; return; }
      if (f < d) {
        dureeAffichee.textContent = '—';
        return;
      }
      dureeAffichee.textContent = fmtDuree(f - d);
    }
    debutW.input.addEventListener('input', () => { hideError(); recalcDuree(); });
    finW.input.addEventListener('input',   () => { hideError(); recalcDuree(); });
    debutW.input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    finW.input.addEventListener('keydown',   e => { if (e.key === 'Enter') submit(); });
    recalcDuree();

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
    function hideError() {
      errorBox.style.display = 'none';
    }

    const manuelBlock = el('div', { class: 'ch-pile ch-g10' },
      el('div', { class: 'ch-flex ch-g10' },
        el('div', { style: { flex: 1 } }, debutW),
        el('div', { style: { flex: 1 } }, finW),
      ),
      el('div', {
        class: 'ch-flex-c ch-entre',
        style: { padding: '8px 12px', background: 'var(--cv-neutral-50)', border: '1px solid var(--cv-border)', borderRadius: 8 },
      },
        el('span', { class: 'ch-surtitre' }, 'Durée'),
        dureeAffichee,
      ),
      errorBox,
    );

    /* --- footer dynamique --- */
    const footerHint = el('div', {
      class: 'ch-flex-c ch-g8',
      style: {
        marginRight: 'auto', font: '400 12px/1 var(--cv-font-sans)', color: 'var(--cv-fg-subtle)',
      },
    });
    const submitBtn = window.UI.Button({ variant: 'primary', icon: 'play', children: 'Démarrer', onclick: () => submit() });

    function paintFooter() {
      if (mode === 'live') {
        footerHint.replaceChildren(window.UI.Kbd('Entrée'), document.createTextNode(' pour démarrer'));
        submitBtn.innerHTML = '';
        submitBtn.append(icon('play', { size: 14, weight: 'fill' }), document.createTextNode('Démarrer'));
      } else {
        footerHint.replaceChildren(window.UI.Kbd('Entrée'), document.createTextNode(' pour enregistrer'));
        submitBtn.innerHTML = '';
        submitBtn.append(icon('check', { size: 14 }), document.createTextNode('Enregistrer'));
      }
    }

    /* --- swap body selon le mode --- */
    const modeHost = el('div', { class: 'ch-pile ch-g14' });
    function renderMode() {
      paintSeg();
      paintFooter();
      modeHost.replaceChildren(
        mode === 'manuel'
          ? manuelBlock
          : el('div', {
              class: 'ch-flex-c ch-g8',
              style: {
                padding: '8px 12px', background: 'var(--cv-accent-50)',
                border: '1px solid var(--cv-accent-100)', borderRadius: 8,
                font: '400 12px/1.4 var(--cv-font-sans)', color: 'var(--cv-accent-700)',
              },
            },
              icon('timer', { size: 14, weight: 'fill' }),
              'Le chrono se lance maintenant — en parallèle des chronos déjà actifs — et tourne jusqu’à ce que tu l’arrêtes.',
            ),
      );
    }

    function submit() {
      if (!projetId) return;
      if (mode === 'live') {
        store.actions.demarrer(projetId, inputDesc.value);
        onDemarre && onDemarre(projetId);
        modal.close();
      } else {
        const d = localVersTs(debutW.input.value);
        const f = localVersTs(finW.input.value);
        if (d == null || f == null) { showError('Renseigne un début et une fin valides.'); return; }
        if (f <= d) { showError('La fin doit être postérieure au début.'); return; }
        const id = store.actions.ajouterSessionManuelle({
          projetId, description: inputDesc.value, debut: d, fin: f,
        });
        if (!id) { showError('Impossible d’enregistrer cette session.'); return; }
        onAjoutManuel && onAjoutManuel(id, projetId);
        modal.close();
      }
    }

    /* --- corps du modal --- */
    const body = el('div', { class: 'ch-pile ch-g14' },
      segWrap,
      el('label', { class: 'ch-pile ch-g4' },
        el('span', { class: 'ch-label' }, 'Sur quoi as-tu travaillé ?'),
        inputDesc,
      ),
      modeHost,
      el('div', null,
        el('div', { class: 'ch-label', style: { marginBottom: 6 } }, 'Projet'),
        listHost,
      ),
    );

    const footer = [
      footerHint,
      window.UI.Button({ variant: 'ghost', children: 'Annuler', onclick: () => modal.close() }),
      submitBtn,
    ];

    modal = window.UI.Modal({ title: 'Ajouter un chrono', width: 540, body, footer });
    renderMode();
    setTimeout(() => inputDesc.focus(), 50);
  }

  window.ouvrirQuickAdd = ouvrirQuickAdd;
})();

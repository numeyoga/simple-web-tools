// modal de gestion des espaces de sauvegarde (workspaces IndexedDB).
// Permet de basculer, créer, renommer, supprimer, exporter ou importer un espace.
import { WORKSPACES } from '../workspaces.js';
import * as UI from './ui.js';

const { el, icon } = UI;

/* Petite confirmation modale promisifiée (oui/non).
     Important : `modal.close()` déclenche `onclose`. On mémorise la réponse
     avant de fermer pour qu'`onclose` ne resolve pas `false` à notre place. */
function confirmer({ titre, message, danger }) {
  return new Promise((resolve) => {
    let settled = false;
    const finir = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let modal;
    modal = UI.Modal({
      title: titre,
      width: 420,
      body: el(
        'div',
        { style: { font: '400 13px/1.5 var(--cv-font-sans)', color: 'var(--cv-fg)' } },
        message,
      ),
      footer: [
        UI.Button({
          variant: 'ghost',
          children: 'Annuler',
          onclick: () => {
            finir(false);
            modal.close();
          },
        }),
        UI.Button({
          variant: danger ? 'destructive' : 'primary',
          icon: danger ? 'trash' : 'check',
          children: danger ? 'Supprimer' : 'Confirmer',
          onclick: () => {
            finir(true);
            modal.close();
          },
        }),
      ],
      onclose: () => finir(false),
    });
  });
}

function lireFichier(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ''));
    r.onerror = () => rej(r.error);
    r.readAsText(file);
  });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ouvrirGestionEspaces({ store, toasts } = {}) {
  let modal;

  /* État local de l'édition inline d'un libellé. */
  let editingId = null;
  let pendingLabel = '';

  /* Conteneur unique re-rendu en place pour éviter de fermer/rouvrir la modale. */
  const body = el('div', { class: 'ch-pile ch-g14' });

  function ligneEspace(ws, activeId) {
    const isActive = ws.id === activeId;
    const isEditing = ws.id === editingId;

    // Vue normale
    const titre = isEditing
      ? el('input', {
          value: pendingLabel,
          autocomplete: 'off',
          oninput: (e) => {
            pendingLabel = e.target.value;
          },
          onkeydown: (e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              editingId = null;
              pendingLabel = '';
              render();
            }
          },
          style: {
            flex: 1,
            height: 30,
            padding: '0 10px',
            border: '1px solid var(--cv-accent-500)',
            borderRadius: 6,
            background: 'var(--cv-surface)',
            color: 'var(--cv-fg)',
            font: '500 13px/1 var(--cv-font-sans)',
            outline: 'none',
          },
          ref: (node) => {
            setTimeout(() => {
              node.focus();
              node.select();
            }, 10);
          },
        })
      : el(
          'div',
          { class: 'ch-souple ch-pile ch-g2' },
          el(
            'div',
            { class: 'ch-flex-c ch-g8' },
            el(
              'span',
              {
                class: 'ch-ellipse',
                style: {
                  font: '500 14px/1.2 var(--cv-font-sans)',
                  color: 'var(--cv-fg)',
                },
              },
              ws.label,
            ),
            isActive ? UI.Badge({ variant: 'accent', dot: true, children: 'actif' }) : null,
          ),
          el(
            'div',
            {
              class: 'ch-flex-c ch-g10',
              style: { font: '400 11px/1.3 var(--cv-font-mono)', color: 'var(--cv-fg-subtle)' },
            },
            el('span', null, ws.id),
            ws.creeLe ? el('span', null, '·') : null,
            ws.creeLe ? el('span', null, `créé ${fmtDate(ws.creeLe)}`) : null,
          ),
        );

    function commitRename() {
      const label = pendingLabel.trim();
      if (label && label !== ws.label) WORKSPACES.rename(ws.id, label);
      editingId = null;
      pendingLabel = '';
      render();
    }

    const list = WORKSPACES.getList();
    const peutSupprimer = list.length > 1 && !isActive;

    return el(
      'div',
      {
        class: 'ch-flex-c ch-g10',
        style: {
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${isActive ? 'var(--cv-accent-500)' : 'var(--cv-border)'}`,
          background: isActive ? 'var(--cv-accent-50)' : 'var(--cv-surface)',
        },
      },
      // Icône
      el(
        'div',
        {
          style: {
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isActive ? 'var(--cv-accent-500)' : 'var(--cv-neutral-100)',
            color: isActive ? '#fff' : 'var(--cv-fg-muted)',
          },
        },
        icon(isActive ? 'database' : 'database', {
          weight: isActive ? 'fill' : 'regular',
          size: 16,
        }),
      ),

      titre,

      isEditing
        ? el(
            'div',
            { class: 'ch-flex ch-g4' },
            UI.IconButton({
              icon: 'check',
              label: 'Valider',
              variant: 'ghost',
              onclick: commitRename,
            }),
            UI.IconButton({
              icon: 'x',
              label: 'Annuler',
              variant: 'ghost',
              onclick: () => {
                editingId = null;
                pendingLabel = '';
                render();
              },
            }),
          )
        : el(
            'div',
            { class: 'ch-flex ch-g4', style: { flexShrink: 0 } },
            !isActive
              ? UI.Button({
                  size: 'sm',
                  variant: 'primary',
                  icon: 'arrow-right',
                  children: 'Basculer',
                  onclick: async () => {
                    const ok = await confirmer({
                      titre: 'Changer d’espace ?',
                      message: `La page va se recharger pour afficher l’espace « ${ws.label} ». Tout chrono en cours dans l’espace actuel reste enregistré.`,
                    });
                    if (ok) WORKSPACES.switchTo(ws.id);
                  },
                })
              : null,
            UI.IconButton({
              icon: 'pencil-simple',
              label: 'Renommer',
              variant: 'ghost',
              onclick: () => {
                editingId = ws.id;
                pendingLabel = ws.label;
                render();
              },
            }),
            UI.IconButton({
              icon: 'trash',
              label: peutSupprimer ? 'Supprimer' : 'Impossible : actif ou dernier',
              variant: 'ghost',
              disabled: !peutSupprimer,
              onclick: async () => {
                const ok = await confirmer({
                  titre: 'Supprimer cet espace ?',
                  message: `Toutes les données de l’espace « ${ws.label} » seront effacées (projets, sessions, todos, pointage). Cette action est irréversible.`,
                  danger: true,
                });
                if (!ok) return;
                await WORKSPACES.remove(ws.id);
                if (toasts)
                  toasts.push({ variant: 'info', title: 'Espace supprimé', body: ws.label });
                render();
              },
            }),
          ),
    );
  }

  function blocCreation() {
    let avecDemo = false;
    const input = el('input', {
      placeholder: 'Ex. Perso, Freelance, Test, Q4…',
      autocomplete: 'off',
      onkeydown: (e) => {
        if (e.key === 'Enter') creer();
      },
      style: {
        flex: 1,
        height: 32,
        padding: '0 10px',
        border: '1px solid var(--cv-border-strong)',
        borderRadius: 8,
        background: 'var(--cv-surface)',
        color: 'var(--cv-fg)',
        font: '400 13px/1 var(--cv-font-sans)',
        outline: 'none',
      },
    });
    const checkbox = el('input', {
      type: 'checkbox',
      onchange: (e) => {
        avecDemo = e.target.checked;
      },
      style: { accentColor: 'var(--cv-accent-500)' },
    });

    async function creer() {
      const label = (input.value || '').trim();
      if (!label) {
        input.focus();
        return;
      }
      const ws = WORKSPACES.create({ label, seedDemo: avecDemo });
      const ok = await confirmer({
        titre: 'Basculer sur cet espace ?',
        message: `L’espace « ${ws.label} » a été créé. Veux-tu basculer dessus maintenant ?`,
      });
      if (ok) WORKSPACES.switchTo(ws.id);
      else {
        render();
        if (toasts) toasts.push({ variant: 'success', title: 'Espace créé', body: ws.label });
      }
    }

    return el(
      'div',
      {
        class: 'ch-pile ch-g10',
        style: {
          padding: 12,
          border: '1px dashed var(--cv-border-strong)',
          borderRadius: 10,
          background: 'var(--cv-neutral-50)',
        },
      },
      el(
        'div',
        {
          style: {
            font: '600 12px/1 var(--cv-font-sans)',
            color: 'var(--cv-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        },
        'Nouvel espace',
      ),
      el(
        'div',
        { class: 'ch-flex ch-g8' },
        input,
        UI.Button({ variant: 'primary', icon: 'plus', children: 'Créer', onclick: creer }),
      ),
      el(
        'label',
        {
          class: 'ch-meta ch-flex-c ch-g8',
          style: { cursor: 'pointer' },
        },
        checkbox,
        el('span', null, 'Inclure des données de démonstration au démarrage'),
      ),
    );
  }

  function blocExportImport() {
    const fileInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      style: { display: 'none' },
      onchange: async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
          const txt = await lireFichier(file);
          const payload = JSON.parse(txt);
          const dataKeys = payload?.data || payload;
          if (
            !dataKeys ||
            (!Array.isArray(dataKeys.projets) && !Array.isArray(dataKeys.sessions))
          ) {
            throw new Error('JSON invalide');
          }
          const ws = WORKSPACES.getActive();
          const ok = await confirmer({
            titre: 'Remplacer les données ?',
            message: `Toutes les données actuelles de l’espace « ${ws.label} » seront remplacées par le contenu du fichier. Continuer ?`,
            danger: true,
          });
          if (!ok) return;
          await WORKSPACES.importJSON(ws.id, payload);
          if (toasts)
            toasts.push({ variant: 'success', title: 'Import terminé', body: 'Rechargement…' });
          setTimeout(() => location.reload(), 400);
        } catch (err) {
          if (toasts)
            toasts.push({ variant: 'danger', title: 'Import impossible', body: err.message });
        }
      },
    });

    return el(
      'div',
      {
        class: 'ch-panneau ch-pile ch-g8',
        style: { padding: 12 },
      },
      el(
        'div',
        {
          style: {
            font: '600 12px/1 var(--cv-font-sans)',
            color: 'var(--cv-fg-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        },
        'Sauvegarde',
      ),
      el(
        'div',
        { class: 'ch-note' },
        'Exporte ou importe l’espace actif au format JSON. Pratique pour archiver ou migrer.',
      ),
      el(
        'div',
        { class: 'ch-flex ch-g8' },
        UI.Button({
          variant: 'secondary',
          size: 'sm',
          icon: 'download-simple',
          children: 'Exporter JSON',
          onclick: async () => {
            try {
              await WORKSPACES.downloadCurrentJSON(store);
              if (toasts) toasts.push({ variant: 'success', title: 'Export téléchargé' });
            } catch (err) {
              if (toasts)
                toasts.push({ variant: 'danger', title: 'Export impossible', body: err.message });
            }
          },
        }),
        UI.Button({
          variant: 'secondary',
          size: 'sm',
          icon: 'upload-simple',
          children: 'Importer JSON',
          onclick: () => fileInput.click(),
        }),
        fileInput,
      ),
    );
  }

  function render() {
    const list = WORKSPACES.getList();
    const activeId = WORKSPACES.getActiveId();
    body.replaceChildren(
      el(
        'div',
        { class: 'ch-note' },
        'Chaque espace est une base IndexedDB isolée. Idéal pour séparer perso / pro, ou faire des essais sans toucher à tes vraies données.',
      ),
      el('div', { class: 'ch-pile ch-g8' }, ...list.map((ws) => ligneEspace(ws, activeId))),
      blocCreation(),
      blocExportImport(),
    );
  }

  render();

  modal = UI.Modal({
    title: 'Espaces de sauvegarde',
    width: 560,
    body,
    footer: [UI.Button({ variant: 'ghost', children: 'Fermer', onclick: () => modal.close() })],
  });
}

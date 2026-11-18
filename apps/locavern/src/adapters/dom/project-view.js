/** @import { AppCommand, AppState, Project, StoreEffect } from '../../types.d.ts' */

import { formatShortDateFr } from '../../core/dates.js';
import { selectProjects } from '../../core/store.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';

/**
 * Open the Covenant dialog (modal or drawer per user preference) to consult, create, or edit a project.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   project?: Project;
 *   mode?: 'view' | 'edit';
 *   onOpenProjectNotes?: (projectId: string) => void;
 *   onOpenProjectWhiteboards?: (projectId: string) => void;
 * }} opts
 */
export function openProjectModal({
  store,
  project,
  mode,
  onOpenProjectNotes,
  onOpenProjectWhiteboards,
}) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-project'));
  const titleEl = document.getElementById('modal-project-title');
  const bodyEl = document.getElementById('modal-project-body');
  const footerEl = document.getElementById('modal-project-footer');
  if (!modal || !titleEl || !bodyEl || !footerEl) return;

  const state = store.getState();
  const readOnly = state.readOnly;
  applyDialogPresentation(modal, state.preferences.inputPresentations.projects);

  const isExisting = Boolean(project);
  const effectiveMode = !isExisting ? 'edit' : readOnly ? 'view' : (mode ?? 'view');

  if (effectiveMode === 'view' && project) {
    titleEl.textContent = 'Consulter le projet';

    const panel = document.createElement('div');
    panel.id = 'project-consult-view';
    panel.className = 'lc-consult-panel';

    const headRow = document.createElement('div');
    headRow.className = 'lc-consult-head';

    const projHeading = document.createElement('h3');
    projHeading.className = 'lc-consult-title';
    projHeading.textContent = project.name;

    const badge = document.createElement('span');
    badge.className = project.archived ? 'cv-badge cv-badge--warning' : 'cv-badge cv-badge--accent';
    const dot = document.createElement('span');
    dot.className = 'cv-badge__dot';
    badge.append(dot, document.createTextNode(project.archived ? 'Archivé' : 'Actif'));
    headRow.append(projHeading, badge);

    const taskCount = state.tasks.filter((t) => t.projectId === project.id && !t.archived).length;
    const noteCount = state.notes.filter((n) => n.projectId === project.id && !n.archived).length;
    const wbCount = state.whiteboards.filter(
      (w) => w.projectId === project.id && !w.archived,
    ).length;

    const meta = document.createElement('dl');
    meta.className = 'lc-archive-meta';

    /** @param {string} label @param {string} val */
    const addRow = (label, val) => {
      const row = document.createElement('div');
      row.className = 'lc-archive-meta__row';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = val;
      row.append(dt, dd);
      meta.append(row);
    };

    addRow('Description', project.description || 'Aucune description.');
    addRow(
      'Éléments actifs',
      `${taskCount} tâche${taskCount > 1 ? 's' : ''} · ${noteCount} note${noteCount > 1 ? 's' : ''} · ${wbCount} tableau${wbCount > 1 ? 'x' : ''} blanc${wbCount > 1 ? 's' : ''}`,
    );
    addRow('Mise à jour', formatShortDateFr(project.updatedAt.slice(0, 10), true));

    const quickNav = document.createElement('div');
    quickNav.className = 'lc-consult-actions';

    const tasksBtn = document.createElement('button');
    tasksBtn.type = 'button';
    tasksBtn.className = 'cv-btn cv-btn--sm';
    tasksBtn.textContent = 'Ouvrir les tâches';
    tasksBtn.addEventListener('click', () => {
      closeDialogById('modal-project');
      store.dispatch({ type: 'select_project', projectId: project.id });
      store.dispatch({ type: 'set_view', view: 'tasks' });
    });

    const notesBtn = document.createElement('button');
    notesBtn.type = 'button';
    notesBtn.className = 'cv-btn cv-btn--sm';
    notesBtn.textContent = 'Ouvrir les notes';
    notesBtn.addEventListener('click', () => {
      closeDialogById('modal-project');
      if (onOpenProjectNotes) {
        onOpenProjectNotes(project.id);
        return;
      }
      store.dispatch({ type: 'select_project', projectId: project.id });
      store.dispatch({ type: 'set_view', view: 'notes' });
    });

    const wbBtn = document.createElement('button');
    wbBtn.type = 'button';
    wbBtn.className = 'cv-btn cv-btn--sm';
    wbBtn.textContent = 'Ouvrir les tableaux blancs';
    wbBtn.addEventListener('click', () => {
      closeDialogById('modal-project');
      if (onOpenProjectWhiteboards) {
        onOpenProjectWhiteboards(project.id);
        return;
      }
      store.dispatch({ type: 'select_project', projectId: project.id });
      store.dispatch({ type: 'set_view', view: 'whiteboards' });
    });

    quickNav.append(tasksBtn, notesBtn, wbBtn);
    panel.append(headRow, meta, quickNav);
    bodyEl.replaceChildren(panel);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cv-btn';
    closeBtn.setAttribute('data-cv-close', '');
    closeBtn.textContent = 'Fermer';

    /** @type {HTMLElement[]} */
    const footerBtns = [closeBtn];
    if (!readOnly) {
      const switchEditBtn = document.createElement('button');
      switchEditBtn.type = 'button';
      switchEditBtn.id = 'btn-switch-project-edit';
      switchEditBtn.className = 'cv-btn cv-btn--primary';
      const editIc = document.createElement('i');
      editIc.className = 'ph ph-pencil-simple cv-icon';
      editIc.setAttribute('aria-hidden', 'true');
      switchEditBtn.append(editIc, document.createTextNode(' Modifier'));
      switchEditBtn.addEventListener('click', () => {
        const fresh = store.getState().projects.find((p) => p.id === project.id) ?? project;
        openProjectModal({
          store,
          project: fresh,
          mode: 'edit',
          onOpenProjectNotes,
          onOpenProjectWhiteboards,
        });
      });
      footerBtns.push(switchEditBtn);
    }
    footerEl.replaceChildren(...footerBtns);

    const onClose = () => {
      modal.returnValue = '';
      bodyEl.replaceChildren();
      footerEl.replaceChildren();
      modal.removeEventListener('close', onClose);
    };
    modal.addEventListener('close', onClose);

    if (!modal.open) {
      openDialogById('modal-project');
    }
    closeBtn.focus();
    return;
  }

  const isEdit = Boolean(project);
  titleEl.textContent = isEdit ? 'Modifier le projet' : 'Nouveau projet';

  const form = document.createElement('form');
  form.id = 'form-project';
  form.noValidate = true;

  const nameField = document.createElement('div');
  nameField.className = 'cv-field';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'cv-label';
  nameLabel.htmlFor = 'project-name-input';
  nameLabel.textContent = 'Nom du projet';
  const reqStar = document.createElement('span');
  reqStar.className = 'cv-required';
  reqStar.setAttribute('aria-hidden', 'true');
  reqStar.textContent = '*';
  nameLabel.append(reqStar);

  const nameInput = document.createElement('input');
  nameInput.id = 'project-name-input';
  nameInput.type = 'text';
  nameInput.className = 'cv-input';
  nameInput.required = true;
  nameInput.maxLength = 120;
  nameInput.autofocus = true;
  nameInput.disabled = readOnly;
  nameInput.value = project?.name ?? '';

  const nameError = document.createElement('span');
  nameError.id = 'project-name-error';
  nameError.className = 'cv-error';
  nameError.hidden = true;
  const errIcon = document.createElement('i');
  errIcon.className = 'ph ph-warning-circle cv-icon';
  errIcon.setAttribute('aria-hidden', 'true');
  const errText = document.createElement('span');
  errText.textContent = 'Saisissez un nom de projet non vide.';
  nameError.append(errIcon, errText);

  nameField.append(nameLabel, nameInput, nameError);

  const descField = document.createElement('div');
  descField.className = 'cv-field';
  const descLabel = document.createElement('label');
  descLabel.className = 'cv-label';
  descLabel.htmlFor = 'project-desc-input';
  descLabel.textContent = 'Description';
  const descInput = document.createElement('textarea');
  descInput.id = 'project-desc-input';
  descInput.className = 'cv-input';
  descInput.rows = 3;
  descInput.maxLength = 1000;
  descInput.disabled = readOnly;
  descInput.value = project?.description ?? '';
  descField.append(descLabel, descInput);

  form.append(nameField, descField);
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  bodyEl.replaceChildren(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = 'Annuler';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-project');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer le projet';

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && project) {
    const consultBtn = document.createElement('button');
    consultBtn.type = 'button';
    consultBtn.id = 'btn-switch-project-view';
    consultBtn.className = 'cv-btn';
    consultBtn.style.marginRight = 'auto';
    consultBtn.textContent = 'Consulter';
    consultBtn.addEventListener('click', () => {
      const fresh = store.getState().projects.find((p) => p.id === project.id) ?? project;
      openProjectModal({
        store,
        project: fresh,
        mode: 'view',
        onOpenProjectNotes,
        onOpenProjectWhiteboards,
      });
    });
    footerButtons.push(consultBtn);
  }
  footerButtons.push(cancelBtn, saveBtn);
  footerEl.replaceChildren(...footerButtons);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (readOnly) return;

    const cleanName = nameInput.value.trim();
    if (!cleanName) {
      nameInput.setAttribute('aria-invalid', 'true');
      nameInput.setAttribute('aria-describedby', 'project-name-error');
      nameError.hidden = false;
      nameInput.focus();
      return;
    }
    nameInput.removeAttribute('aria-invalid');
    nameInput.removeAttribute('aria-describedby');
    nameError.hidden = true;

    const now = new Date().toISOString();
    if (isEdit && project) {
      store.dispatch({
        type: 'update_project',
        id: project.id,
        name: cleanName,
        description: descInput.value,
        now,
      });
      notify({ status: 'success', title: 'Projet mis à jour', text: cleanName });
    } else {
      store.dispatch({
        type: 'create_project',
        id: crypto.randomUUID(),
        name: cleanName,
        description: descInput.value,
        now,
      });
      notify({ status: 'success', title: 'Projet créé', text: cleanName });
    }
    closeDialogById('modal-project');
  });

  const onClose = () => {
    modal.returnValue = '';
    bodyEl.replaceChildren();
    footerEl.replaceChildren();
    modal.removeEventListener('close', onClose);
  };
  modal.addEventListener('close', onClose);

  if (!modal.open) {
    openDialogById('modal-project');
  }
  nameInput.focus();
}

/**
 * Render the active Projects view inside #app-view.
 * Archived projects are hidden here and managed on the Archives screen.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   onOpenProjectNotes?: (projectId: string) => void;
 *   onOpenProjectWhiteboards?: (projectId: string) => void;
 * }} opts
 */
export function renderProjectsView({
  container,
  store,
  onOpenProjectNotes,
  onOpenProjectWhiteboards,
}) {
  const state = store.getState();

  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const heading = document.createElement('h2');
  heading.className = 'cv-h2';
  heading.style.margin = '0';
  heading.textContent = 'Vos projets';
  leftGroup.append(heading);

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'cv-btn cv-btn--primary';
  newBtn.id = 'btn-new-project';
  newBtn.disabled = state.readOnly;
  const plusIcon = document.createElement('i');
  plusIcon.className = 'ph ph-plus cv-icon';
  plusIcon.setAttribute('aria-hidden', 'true');
  newBtn.append(plusIcon, document.createTextNode(' Nouveau projet'));
  newBtn.addEventListener('click', () =>
    openProjectModal({ store, onOpenProjectNotes, onOpenProjectWhiteboards }),
  );

  header.append(leftGroup, newBtn);

  const visibleProjects = selectProjects(state);

  if (state.projects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cv-empty';
    const iconBox = document.createElement('span');
    iconBox.className = 'cv-empty__icon';
    const ic = document.createElement('i');
    ic.className = 'ph ph-folder-open cv-icon';
    ic.setAttribute('aria-hidden', 'true');
    iconBox.append(ic);

    const title = document.createElement('p');
    title.className = 'cv-empty__title';
    title.textContent = 'Aucun projet pour le moment';

    const desc = document.createElement('p');
    desc.textContent = 'Créez un projet pour organiser vos tâches et vos notes.';

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cv-btn cv-btn--primary';
    cta.disabled = state.readOnly;
    cta.textContent = 'Créer un projet';
    cta.addEventListener('click', () =>
      openProjectModal({ store, onOpenProjectNotes, onOpenProjectWhiteboards }),
    );

    empty.append(iconBox, title, desc, cta);
    container.replaceChildren(header, empty);
    return;
  }

  if (visibleProjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cv-empty';
    const iconBox = document.createElement('span');
    iconBox.className = 'cv-empty__icon';
    const ic = document.createElement('i');
    ic.className = 'ph ph-archive cv-icon';
    ic.setAttribute('aria-hidden', 'true');
    iconBox.append(ic);

    const title = document.createElement('p');
    title.className = 'cv-empty__title';
    title.textContent = 'Tous vos projets sont archivés';

    const desc = document.createElement('p');
    desc.textContent =
      'Consultez l’écran Archives pour retrouver et désarchiver vos anciens projets, ou créez un nouveau projet actif.';

    const emptyActions = document.createElement('div');
    emptyActions.className = 'lc-view-header__group';

    const archivesBtn = document.createElement('button');
    archivesBtn.type = 'button';
    archivesBtn.className = 'cv-btn';
    archivesBtn.textContent = 'Ouvrir les archives';
    archivesBtn.addEventListener('click', () => {
      store.dispatch({ type: 'set_view', view: 'archives' });
    });

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cv-btn cv-btn--primary';
    cta.disabled = state.readOnly;
    cta.textContent = 'Créer un projet';
    cta.addEventListener('click', () =>
      openProjectModal({ store, onOpenProjectNotes, onOpenProjectWhiteboards }),
    );

    emptyActions.append(archivesBtn, cta);
    empty.append(iconBox, title, desc, emptyActions);
    container.replaceChildren(header, empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'lc-projects-grid';

  for (const project of visibleProjects) {
    const card = document.createElement('article');
    card.className = 'cv-card';

    const cardHead = document.createElement('div');
    cardHead.className = 'lc-project-card__head';

    const title = document.createElement('h3');
    title.className = 'cv-card__title';
    title.textContent = project.name;

    const badge = document.createElement('span');
    badge.className = 'cv-badge cv-badge--accent';
    const dot = document.createElement('span');
    dot.className = 'cv-badge__dot';
    badge.append(dot, document.createTextNode('Actif'));

    cardHead.append(title, badge);

    const desc = document.createElement('p');
    desc.className = 'lc-project-card__desc';
    desc.textContent = project.description || 'Aucune description.';

    const taskCount = state.tasks.filter((t) => t.projectId === project.id && !t.archived).length;
    const totalTaskCount = state.tasks.filter((t) => t.projectId === project.id).length;
    const noteCount = state.notes.filter((n) => n.projectId === project.id && !n.archived).length;
    const wbCount = state.whiteboards.filter(
      (w) => w.projectId === project.id && !w.archived,
    ).length;
    const meta = document.createElement('div');
    meta.className = 'cv-card__meta cv-num';
    meta.textContent = `${taskCount} tâche${taskCount > 1 ? 's' : ''} · ${noteCount} note${noteCount > 1 ? 's' : ''} · ${wbCount} tableau${wbCount > 1 ? 'x' : ''} blanc${wbCount > 1 ? 's' : ''}`;

    const footer = document.createElement('div');
    footer.className = 'cv-card__footer lc-project-card__footer';

    const openGroup = document.createElement('div');
    openGroup.className = 'lc-project-card__actions';

    const openTasksBtn = document.createElement('button');
    openTasksBtn.type = 'button';
    openTasksBtn.className = 'cv-btn cv-btn--sm';
    openTasksBtn.textContent = 'Ouvrir les tâches';
    openTasksBtn.setAttribute('aria-label', `Ouvrir les tâches de ${project.name}`);
    openTasksBtn.addEventListener('click', () => {
      store.dispatch({ type: 'select_project', projectId: project.id });
      store.dispatch({ type: 'set_view', view: 'tasks' });
    });

    const openNotesBtn = document.createElement('button');
    openNotesBtn.type = 'button';
    openNotesBtn.className = 'cv-btn cv-btn--sm';
    openNotesBtn.textContent = 'Ouvrir les notes';
    openNotesBtn.setAttribute('aria-label', `Ouvrir les notes de ${project.name}`);
    openNotesBtn.addEventListener('click', () => {
      if (onOpenProjectNotes) {
        onOpenProjectNotes(project.id);
        return;
      }
      store.dispatch({ type: 'select_project', projectId: project.id });
      store.dispatch({ type: 'set_view', view: 'notes' });
    });

    const openWhiteboardsBtn = document.createElement('button');
    openWhiteboardsBtn.type = 'button';
    openWhiteboardsBtn.className = 'cv-btn cv-btn--sm';
    openWhiteboardsBtn.textContent = 'Ouvrir les tableaux blancs';
    openWhiteboardsBtn.setAttribute('aria-label', `Ouvrir les tableaux blancs de ${project.name}`);
    openWhiteboardsBtn.addEventListener('click', () => {
      if (onOpenProjectWhiteboards) {
        onOpenProjectWhiteboards(project.id);
        return;
      }
      store.dispatch({ type: 'select_project', projectId: project.id });
      store.dispatch({ type: 'set_view', view: 'whiteboards' });
    });

    openGroup.append(openTasksBtn, openNotesBtn, openWhiteboardsBtn);

    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'lc-project-card__actions';

    const consultBtn = document.createElement('button');
    consultBtn.type = 'button';
    consultBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
    consultBtn.textContent = 'Consulter';
    consultBtn.setAttribute('aria-label', `Consulter ${project.name}`);
    consultBtn.addEventListener('click', () =>
      openProjectModal({
        store,
        project,
        mode: 'view',
        onOpenProjectNotes,
        onOpenProjectWhiteboards,
      }),
    );

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
    editBtn.disabled = state.readOnly;
    editBtn.textContent = 'Modifier';
    editBtn.setAttribute('aria-label', `Modifier ${project.name}`);
    editBtn.addEventListener('click', () =>
      openProjectModal({
        store,
        project,
        mode: 'edit',
        onOpenProjectNotes,
        onOpenProjectWhiteboards,
      }),
    );

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
    archiveBtn.disabled = state.readOnly;
    archiveBtn.textContent = 'Archiver';
    archiveBtn.setAttribute('aria-label', `Archiver ${project.name}`);
    archiveBtn.addEventListener('click', () => {
      store.dispatch({
        type: 'toggle_archive_project',
        id: project.id,
        archived: true,
        now: new Date().toISOString(),
      });
      notify({
        status: 'info',
        title: 'Projet archivé',
        text: `${project.name} déplacé vers les archives.`,
      });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
    deleteBtn.disabled = state.readOnly;
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.setAttribute('aria-label', `Supprimer ${project.name}`);
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await confirmAction({
        title: `Supprimer « ${project.name} » ?`,
        message: `Ce projet et ses ${totalTaskCount} tâche(s) seront déplacés dans la corbeille locale. Les notes et tableaux blancs associés resteront accessibles sans projet.`,
        confirmLabel: 'Supprimer le projet',
        danger: true,
      });
      if (!confirmed) return;
      store.dispatch({
        type: 'trash_project',
        id: project.id,
        trashId: crypto.randomUUID(),
        now: new Date().toISOString(),
      });
      notify({ status: 'info', title: 'Projet placé dans la corbeille', text: project.name });
    });

    actionsGroup.append(consultBtn, editBtn, archiveBtn, deleteBtn);
    footer.append(openGroup, actionsGroup);

    card.append(cardHead, desc, meta, footer);
    grid.append(card);
  }

  container.replaceChildren(header, grid);
}

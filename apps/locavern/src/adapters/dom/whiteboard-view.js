/** @import { AppCommand, AppState, LocalRef, StoreEffect, Whiteboard, WhiteboardElement, WhiteboardViewport } from '../../types.d.ts' */

import { collectWhiteboardAssetIds } from '../../core/model.js';
import {
  selectProjectById,
  selectProjects,
  selectTemplates,
  selectWhiteboards,
} from '../../core/store.js';
import { instantiateWhiteboardTemplate } from '../../core/templates.js';
import { createTemplatePicker } from './template-picker.js';
import { saveArchiveBlob } from '../archive-file.js';
import { ensureExportDirectoryPermission } from '../export-directory.js';
import { mountWhiteboardCanvas } from '../whiteboard-canvas.js';
import { closeDialogById, confirmAction, notify, openDialogById } from './app-shell.js';
import { createLinkEditor } from './link-editor.js';
import { builtinTemplates, format, t } from '../i18n.js';
import { errorText } from '../../core/messages.js';

/**
 * Sanitize a whiteboard title into a safe local filename stem.
 * @param {string} title
 * @returns {string}
 */
function toSafeFileStem(title) {
  const clean = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || t('export.slug.whiteboard');
}

/**
 * Reparent a DOM node cleanly using Element.prototype.moveBefore when supported.
 * @param {HTMLElement} targetParent
 * @param {HTMLElement} node
 */
function reparentElement(targetParent, node) {
  if (node.parentElement === targetParent) return;
  const moveBeforeFn =
    'moveBefore' in Element.prototype
      ? /** @type {((child: Node, before: Node | null) => void) | undefined} */ (
          Reflect.get(targetParent, 'moveBefore')
        )
      : undefined;
  if (typeof moveBeforeFn === 'function') {
    try {
      moveBeforeFn.call(targetParent, node, null);
      return;
    } catch {
      // Fall back to append when moveBefore throws (e.g. disconnected subtree).
    }
  }
  targetParent.append(node);
}

/**
 * Render the standalone Whiteboards view with native SVG canvas and local images.
 * Supports separate Consultation (read-only) and Modification (edit) modes.
 * Keeps header controls mounted when filtering so search input never loses focus.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     projectId: string | null | 'all';
 *     query: string;
 *   };
 *   modeState: { whiteboardId: string | null; mode: 'view' | 'edit' };
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onOpenWhiteboardDialog?: (opts?: { whiteboard?: Whiteboard; mode?: 'view' | 'edit'; defaultProjectId?: string | null }) => void;
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 * @returns {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean }}
 */
export function renderWhiteboardView({
  container,
  store,
  filters,
  modeState,
  resolveAssetUrl,
  uploadLocalImage,
  onOpenWhiteboardDialog,
  onNavigateLocalRef,
}) {
  const initialState = store.getState();
  const initialActiveProjects = selectProjects(initialState);

  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const projectWrap = document.createElement('div');
  projectWrap.className = 'cv-select';
  const projectFilter = document.createElement('select');
  projectFilter.id = 'whiteboards-project-filter';
  projectFilter.className = 'cv-input';
  projectFilter.setAttribute('aria-label', t('whiteboards.filterByProject'));

  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = t('whiteboards.all');
  const optNone = document.createElement('option');
  optNone.value = 'none';
  optNone.textContent = t('common.noProject');
  projectFilter.append(optAll, optNone);
  for (const p of initialActiveProjects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    projectFilter.append(opt);
  }
  if (
    filters.projectId !== 'all' &&
    filters.projectId !== null &&
    !initialActiveProjects.some((p) => p.id === filters.projectId)
  ) {
    filters.projectId = 'all';
  }
  projectFilter.value = filters.projectId === 'all' ? 'all' : (filters.projectId ?? 'none');
  projectWrap.append(projectFilter);

  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'whiteboards-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = t('whiteboards.searchPlaceholder');
  searchInput.setAttribute('aria-label', t('whiteboards.searchLabel'));
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);

  leftGroup.append(projectWrap, searchGroup);

  const newWbBtn = document.createElement('button');
  newWbBtn.type = 'button';
  newWbBtn.className = 'cv-btn cv-btn--primary';
  newWbBtn.id = 'btn-new-whiteboard';
  newWbBtn.disabled = initialState.readOnly;
  const plusIc = document.createElement('i');
  plusIc.className = 'ph ph-plus cv-icon';
  plusIc.setAttribute('aria-hidden', 'true');
  newWbBtn.append(plusIc, document.createTextNode(` ${t('whiteboards.new')}`));

  header.append(leftGroup, newWbBtn);

  const bodySlot = document.createElement('div');

  /** @type {ReturnType<typeof mountWhiteboardCanvas> | null} */
  let canvasHandle = null;
  /** @type {(() => void) | null} */
  let cleanupMaxDialog = null;
  /** @type {number | null} */
  let saveTimer = null;
  /** @type {(() => void) | null} */
  let flushPending = null;
  let dispatchingInlineUpdate = false;

  function cleanupCanvas() {
    cleanupMaxDialog?.();
    cleanupMaxDialog = null;
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    canvasHandle?.destroy();
    canvasHandle = null;
  }

  function openNewWhiteboardDialog() {
    flushPending?.();
    const state = store.getState();
    const defaultProjId =
      filters.projectId === 'all' ? state.preferences.selectedProjectId : filters.projectId;
    onOpenWhiteboardDialog?.({ defaultProjectId: defaultProjId ?? null, mode: 'edit' });
  }

  newWbBtn.addEventListener('click', openNewWhiteboardDialog);

  /**
   * Wire the shared maximize dialog (#dialog-whiteboard-max) to a canvasHost & canvasHandle.
   * @param {HTMLElement} canvasHost
   * @param {() => string} getTitle
   * @returns {(() => void) | undefined}
   */
  function wireMaximizeDialog(canvasHost, getTitle) {
    const maxDialog = /** @type {HTMLDialogElement | null} */ (
      document.getElementById('dialog-whiteboard-max')
    );
    if (!maxDialog) return undefined;
    const maxDialogTitle = document.getElementById('dialog-whiteboard-max-title');
    const maxDialogBody = document.getElementById('dialog-whiteboard-max-body');
    let maxTearingDown = false;
    let pointerDownOutsideMaxDialog = false;
    /** @type {ResizeObserver | null} */
    let maxResizeObserver = null;

    function syncMaxDialogBounds() {
      if (!maxDialog) return;
      const mainEl = document.getElementById('shell-main');
      if (!mainEl) return;
      const rect = mainEl.getBoundingClientRect();
      const top = Math.max(0, Math.round(rect.top));
      const left = Math.max(0, Math.round(rect.left));
      const right = Math.min(window.innerWidth, Math.round(rect.right));
      const width = Math.max(240, right - left);
      const height = Math.max(240, Math.round(window.innerHeight - top));
      maxDialog.style.setProperty('--lc-wb-max-top', `${top}px`);
      maxDialog.style.setProperty('--lc-wb-max-left', `${left}px`);
      maxDialog.style.setProperty('--lc-wb-max-width', `${width}px`);
      maxDialog.style.setProperty('--lc-wb-max-height', `${height}px`);
    }

    /** @param {PointerEvent} e */
    function handleMaxPointerDown(e) {
      if (!maxDialog) return;
      const r = maxDialog.getBoundingClientRect();
      pointerDownOutsideMaxDialog =
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    }

    /** @param {MouseEvent} e */
    function handleMaxClickCapture(e) {
      if (!maxDialog) return;
      if (e.target === maxDialog && !pointerDownOutsideMaxDialog) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      pointerDownOutsideMaxDialog = false;
    }

    /** @param {Event} e */
    function handleMaxCancel(e) {
      if (canvasHandle?.cancelActiveInteraction()) {
        e.preventDefault();
      }
    }

    function restoreWhiteboardFromMaxDialog() {
      if (!canvasHandle || !maxDialogBody) return;
      const wbRoot = canvasHandle.getRootElement();
      reparentElement(canvasHost, wbRoot);
      canvasHost.style.minHeight = '';
      maxDialogBody.replaceChildren();
      canvasHandle.setMaximized(false);
    }

    function handleMaxClose() {
      if (!maxDialog) return;
      maxDialog.returnValue = '';
      window.removeEventListener('resize', syncMaxDialogBounds);
      window.removeEventListener('scroll', syncMaxDialogBounds, true);
      maxResizeObserver?.disconnect();
      maxResizeObserver = null;
      if (maxTearingDown) return;
      restoreWhiteboardFromMaxDialog();
      canvasHandle?.focusMaximizeButton();
    }

    function openMaxDialog() {
      if (!canvasHandle || !maxDialog || !maxDialogBody || maxDialog.open) return;
      if (maxDialogTitle) {
        maxDialogTitle.textContent = getTitle();
      }
      const hostHeight = Math.round(canvasHost.getBoundingClientRect().height);
      if (hostHeight > 0) {
        canvasHost.style.minHeight = `${hostHeight}px`;
      }
      syncMaxDialogBounds();
      const wbRoot = canvasHandle.getRootElement();
      reparentElement(maxDialogBody, wbRoot);
      canvasHandle.setMaximized(true);
      openDialogById('dialog-whiteboard-max');
      window.addEventListener('resize', syncMaxDialogBounds);
      window.addEventListener('scroll', syncMaxDialogBounds, true);
      const mainEl = document.getElementById('shell-main');
      if (mainEl && typeof ResizeObserver === 'function') {
        maxResizeObserver?.disconnect();
        maxResizeObserver = new ResizeObserver(() => syncMaxDialogBounds());
        maxResizeObserver.observe(mainEl);
      }
    }

    function closeMaxDialog() {
      if (!maxDialog || !maxDialog.open) return;
      closeDialogById('dialog-whiteboard-max');
    }

    maxDialog.addEventListener('pointerdown', handleMaxPointerDown);
    maxDialog.addEventListener('click', handleMaxClickCapture, true);
    maxDialog.addEventListener('cancel', handleMaxCancel);
    maxDialog.addEventListener('close', handleMaxClose);

    cleanupMaxDialog = () => {
      maxTearingDown = true;
      window.removeEventListener('resize', syncMaxDialogBounds);
      window.removeEventListener('scroll', syncMaxDialogBounds, true);
      maxResizeObserver?.disconnect();
      maxResizeObserver = null;
      maxDialog.removeEventListener('pointerdown', handleMaxPointerDown);
      maxDialog.removeEventListener('click', handleMaxClickCapture, true);
      maxDialog.removeEventListener('cancel', handleMaxCancel);
      maxDialog.removeEventListener('close', handleMaxClose);
      if (maxDialog.open) {
        maxDialog.close();
      }
      maxDialog.returnValue = '';
      if (canvasHandle) {
        const wbRoot = canvasHandle.getRootElement();
        if (wbRoot.parentElement !== canvasHost) {
          reparentElement(canvasHost, wbRoot);
        }
      }
      canvasHost.style.minHeight = '';
      maxDialogBody?.replaceChildren();
      maxTearingDown = false;
    };

    return () => {
      if (maxDialog.open) {
        closeMaxDialog();
      } else {
        openMaxDialog();
      }
    };
  }

  /**
   * @param {() => string} getTitle
   * @param {'svg' | 'png'} fmt
   */
  async function exportCanvas(getTitle, fmt) {
    if (!canvasHandle) return;
    try {
      await ensureExportDirectoryPermission();
      const blob =
        fmt === 'svg' ? await canvasHandle.exportSvgBlob() : await canvasHandle.exportPngBlob();
      const stem = toSafeFileStem(getTitle());
      const ext = fmt;
      const mime = fmt === 'svg' ? 'image/svg+xml' : 'image/png';
      const desc = fmt === 'svg' ? t('export.svgDescription') : t('export.pngDescription');
      const result = await saveArchiveBlob(blob, `${stem}.${ext}`, {
        pickerTypes: [{ description: desc, accept: { [mime]: [`.${ext}`] } }],
      });
      if (!result.saved) return;
      notify({
        status: 'success',
        title: t('whiteboards.exportReady', { format: fmt.toUpperCase() }),
        text: `${stem}.${ext}`,
      });
    } catch {
      notify({
        status: 'danger',
        title: t('whiteboards.exportFailed', { format: fmt.toUpperCase() }),
        text: t('whiteboards.exportFailedText', { format: fmt.toUpperCase() }),
      });
    }
  }

  function renderBody() {
    cleanupCanvas();
    flushPending = null;

    const state = store.getState();
    const readOnly = state.readOnly;
    const filteredWhiteboards = selectWhiteboards(state, filters);
    const activeWb =
      filteredWhiteboards.find((w) => w.id === state.preferences.selectedWhiteboardId) ??
      filteredWhiteboards[0] ??
      null;

    if (!activeWb) {
      modeState.whiteboardId = null;
      modeState.mode = 'view';
    } else if (modeState.whiteboardId !== activeWb.id) {
      modeState.whiteboardId = activeWb.id;
      modeState.mode = 'view';
    }
    const effectiveMode = readOnly ? 'view' : modeState.mode;

    if (filteredWhiteboards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-chalkboard-simple cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = t('whiteboards.emptyTitle');
      const desc = document.createElement('p');
      desc.textContent = t('whiteboards.emptyText');
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = readOnly;
      cta.textContent = t('whiteboards.createCta');
      cta.addEventListener('click', openNewWhiteboardDialog);
      empty.append(iconBox, title, desc, cta);
      bodySlot.replaceChildren(empty);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'lc-notes-layout';

    const listEl = document.createElement('div');
    listEl.className = 'lc-notes-list';
    listEl.setAttribute('role', 'navigation');
    listEl.setAttribute('aria-label', t('whiteboards.listLabel'));

    /** @type {Map<string, HTMLElement>} */
    const listTitleEls = new Map();

    for (const wb of filteredWhiteboards) {
      const row = document.createElement('div');
      row.className = 'lc-note-row';

      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'lc-note-item';
      if (activeWb && wb.id === activeWb.id) {
        itemBtn.setAttribute('aria-current', 'true');
        row.classList.add('is-active');
      }
      const tSpan = document.createElement('span');
      tSpan.className = 'lc-note-item__title';
      tSpan.textContent = wb.title;
      listTitleEls.set(wb.id, tSpan);

      const mSpan = document.createElement('span');
      mSpan.className = 'lc-note-item__meta';
      const projName = wb.projectId ? selectProjectById(state, wb.projectId)?.name : null;
      mSpan.textContent = projName
        ? `${projName} · ${wb.updatedAt.slice(0, 10)}`
        : wb.updatedAt.slice(0, 10);

      itemBtn.append(tSpan, mSpan);
      itemBtn.addEventListener('click', () => {
        flushPending?.();
        modeState.whiteboardId = wb.id;
        modeState.mode = 'view';
        if (activeWb && activeWb.id === wb.id) {
          renderBody();
          return;
        }
        store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
      });

      row.append(itemBtn);

      if (!readOnly) {
        const editRowBtn = document.createElement('button');
        editRowBtn.type = 'button';
        editRowBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm lc-note-row__edit';
        editRowBtn.setAttribute('aria-label', t('whiteboards.editNamed', { title: wb.title }));
        window.Covenant?.setTooltip?.(editRowBtn, t('whiteboards.editTitle'));
        const penIc = document.createElement('i');
        penIc.className = 'ph ph-pencil-simple cv-icon';
        penIc.setAttribute('aria-hidden', 'true');
        editRowBtn.append(penIc);
        editRowBtn.addEventListener('click', () => {
          flushPending?.();
          modeState.whiteboardId = wb.id;
          modeState.mode = 'edit';
          if (activeWb && activeWb.id === wb.id) {
            renderBody();
            return;
          }
          store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
        });
        row.append(editRowBtn);
      }

      listEl.append(row);
    }

    const editorCard = document.createElement('section');

    if (activeWb && effectiveMode === 'view') {
      const currentWb = activeWb;
      editorCard.className = 'cv-card lc-consult-card';
      editorCard.setAttribute('aria-label', t('whiteboards.viewCardLabel'));

      const consultHead = document.createElement('div');
      consultHead.className = 'lc-view-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'lc-consult-head';

      const titleH3 = document.createElement('h3');
      titleH3.id = 'whiteboard-consult-title';
      titleH3.className = 'lc-consult-title';
      titleH3.textContent = currentWb.title;

      const modeBadge = document.createElement('span');
      modeBadge.className = 'cv-badge';
      modeBadge.textContent = t('common.viewing');

      const proj = currentWb.projectId ? selectProjectById(state, currentWb.projectId) : null;
      const projBadge = document.createElement('span');
      projBadge.className = 'cv-badge cv-badge--accent';
      projBadge.textContent = proj ? proj.name : t('common.noProject');

      const elCount = currentWb.elements.length;
      const countBadge = document.createElement('span');
      countBadge.className = 'cv-caption cv-num';
      countBadge.textContent = t('whiteboards.countLine', {
        count: elCount,
        date: format.formatShortDate(currentWb.updatedAt.slice(0, 10), true),
      });

      titleWrap.append(titleH3, modeBadge, projBadge, countBadge);

      const headActions = document.createElement('div');
      headActions.className = 'lc-table-actions';
      headActions.style.flexWrap = 'wrap';

      const exportSvgBtn = document.createElement('button');
      exportSvgBtn.type = 'button';
      exportSvgBtn.id = 'btn-export-wb-svg';
      exportSvgBtn.className = 'cv-btn cv-btn--sm';
      exportSvgBtn.textContent = t('whiteboards.exportSvg');
      exportSvgBtn.addEventListener('click', () => void exportCanvas(() => currentWb.title, 'svg'));

      const exportPngBtn = document.createElement('button');
      exportPngBtn.type = 'button';
      exportPngBtn.id = 'btn-export-wb-png';
      exportPngBtn.className = 'cv-btn cv-btn--sm';
      exportPngBtn.textContent = t('whiteboards.exportPng');
      exportPngBtn.addEventListener('click', () => void exportCanvas(() => currentWb.title, 'png'));

      headActions.append(exportSvgBtn, exportPngBtn);

      if (!readOnly) {
        const switchEditBtn = document.createElement('button');
        switchEditBtn.type = 'button';
        switchEditBtn.id = 'btn-switch-wb-edit';
        switchEditBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
        const editIc = document.createElement('i');
        editIc.className = 'ph ph-pencil-simple cv-icon';
        editIc.setAttribute('aria-hidden', 'true');
        switchEditBtn.append(editIc, document.createTextNode(` ${t('common.edit')}`));
        switchEditBtn.addEventListener('click', () => {
          modeState.whiteboardId = currentWb.id;
          modeState.mode = 'edit';
          renderBody();
        });
        headActions.append(switchEditBtn);
      }

      consultHead.append(titleWrap, headActions);

      const linkEditor = createLinkEditor({
        idPrefix: 'whiteboard-links',
        state,
        currentRef: { kind: 'whiteboard', id: currentWb.id },
        initialLinks: currentWb.links ?? [],
        readOnly,
        viewOnly: true,
        onNavigate(ref) {
          onNavigateLocalRef?.(ref);
        },
      });

      const canvasHost = document.createElement('div');
      const toggleMax = wireMaximizeDialog(canvasHost, () => currentWb.title);

      canvasHandle = mountWhiteboardCanvas({
        container: canvasHost,
        initialViewport: currentWb.viewport,
        initialElements: currentWb.elements,
        editable: false,
        ariaLabel: t('whiteboards.canvasNamed', { title: currentWb.title }),
        resolveAssetUrl,
        onUploadImage: async () => null,
        onToggleMaximize: toggleMax,
        onChange() {},
      });

      editorCard.append(consultHead, linkEditor.element, canvasHost);
    } else if (activeWb) {
      const currentWb = activeWb;
      editorCard.className = 'cv-card';
      editorCard.setAttribute('aria-label', t('whiteboards.editorCardLabel'));

      const metaRow = document.createElement('div');
      metaRow.className = 'lc-view-header';

      const titleField = document.createElement('div');
      titleField.className = 'cv-field';
      titleField.style.flex = '1 1 15rem';
      const titleLabel = document.createElement('label');
      titleLabel.className = 'cv-label';
      titleLabel.htmlFor = 'whiteboard-title-input';
      titleLabel.textContent = t('whiteboards.titleLabel');
      const titleInput = document.createElement('input');
      titleInput.id = 'whiteboard-title-input';
      titleInput.type = 'text';
      titleInput.className = 'cv-input';
      titleInput.maxLength = 200;
      titleInput.disabled = readOnly;
      titleInput.value = currentWb.title;
      titleField.append(titleLabel, titleInput);

      const projField = document.createElement('div');
      projField.className = 'cv-field';
      projField.style.minWidth = 'min(100%, 11.25rem)';
      const projLabel = document.createElement('label');
      projLabel.className = 'cv-label';
      projLabel.htmlFor = 'whiteboard-project-select';
      projLabel.textContent = t('common.linkedProject');
      const projSelectWrap = document.createElement('div');
      projSelectWrap.className = 'cv-select';
      const projSelect = document.createElement('select');
      projSelect.id = 'whiteboard-project-select';
      projSelect.className = 'cv-input';
      projSelect.disabled = readOnly;
      const noProjOpt = document.createElement('option');
      noProjOpt.value = '';
      noProjOpt.textContent = t('common.noProject');
      projSelect.append(noProjOpt);
      for (const p of selectProjects(state)) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        projSelect.append(opt);
      }
      projSelect.value = currentWb.projectId ?? '';
      projSelectWrap.append(projSelect);
      projField.append(projLabel, projSelectWrap);

      metaRow.append(titleField, projField);

      const linkEditor = createLinkEditor({
        idPrefix: 'whiteboard-links',
        state,
        currentRef: { kind: 'whiteboard', id: currentWb.id },
        initialLinks: currentWb.links ?? [],
        readOnly,
        onChange() {
          saveNow(false);
        },
        onNavigate(ref) {
          flushPending?.();
          onNavigateLocalRef?.(ref);
        },
      });

      const canvasHost = document.createElement('div');
      /** @type {WhiteboardViewport} */
      let latestViewport = currentWb.viewport;
      /** @type {readonly WhiteboardElement[]} */
      let latestElements = currentWb.elements;
      let dirty = false;

      const statusEl = document.createElement('span');
      statusEl.className = 'cv-caption';
      statusEl.id = 'whiteboard-save-status';
      statusEl.textContent = t('whiteboards.savedLocally');

      function saveNow(showToast = false) {
        if (readOnly) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        const cleanTitle = titleInput.value.trim() || currentWb.title;
        const snapshot = canvasHandle
          ? canvasHandle.getSnapshot()
          : { viewport: latestViewport, elements: [...latestElements] };
        const links = linkEditor.getLinks();
        const assetIds = collectWhiteboardAssetIds(snapshot.elements);
        const projectId = projSelect.value ? projSelect.value : null;
        dirty = false;
        statusEl.textContent = t('whiteboards.savedLocally');
        const listTitle = listTitleEls.get(currentWb.id);
        if (listTitle) listTitle.textContent = cleanTitle;
        dispatchingInlineUpdate = true;
        try {
          store.dispatch({
            type: 'update_whiteboard',
            id: currentWb.id,
            patch: {
              title: cleanTitle,
              projectId,
              viewport: snapshot.viewport,
              elements: snapshot.elements,
              links,
              assetIds,
            },
            now: new Date().toISOString(),
          });
        } catch (err) {
          notify({
            status: 'danger',
            title: t('common.saveFailed'),
            text: errorText(err, t, 'errors.validation'),
          });
          return;
        } finally {
          dispatchingInlineUpdate = false;
        }
        if (showToast) {
          notify({ status: 'success', title: t('whiteboards.saved'), text: cleanTitle });
        }
      }

      flushPending = () => {
        if (dirty || saveTimer !== null) {
          saveNow(false);
        }
      };

      function scheduleSave() {
        if (readOnly) return;
        dirty = true;
        statusEl.textContent = t('common.changesInProgress');
        if (saveTimer !== null) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveNow(false), 200);
      }

      const toggleMax = wireMaximizeDialog(
        canvasHost,
        () => titleInput.value.trim() || currentWb.title,
      );

      canvasHandle = mountWhiteboardCanvas({
        container: canvasHost,
        initialViewport: currentWb.viewport,
        initialElements: currentWb.elements,
        editable: !readOnly,
        ariaLabel: t('whiteboards.canvasNamed', { title: currentWb.title }),
        resolveAssetUrl,
        onUploadImage: uploadLocalImage,
        onBlockedRemoteImage: () => {
          notify({
            status: 'warning',
            title: t('editor.remoteImageBlocked'),
            text: t('editor.remoteImageBlockedText'),
          });
        },
        onToggleMaximize: toggleMax,
        onChange(next) {
          latestViewport = next.viewport;
          latestElements = next.elements;
          scheduleSave();
        },
      });

      titleInput.addEventListener('input', scheduleSave);
      titleInput.addEventListener('blur', () => {
        if (dirty) saveNow(false);
      });
      projSelect.addEventListener('change', () => saveNow(false));

      const footer = document.createElement('div');
      footer.className = 'cv-card__footer';
      footer.style.flexWrap = 'wrap';
      footer.style.gap = 'var(--cv-space-3)';

      const actions = document.createElement('div');
      actions.className = 'lc-table-actions';
      actions.style.flexWrap = 'wrap';

      const consultBtn = document.createElement('button');
      consultBtn.type = 'button';
      consultBtn.id = 'btn-switch-wb-view';
      consultBtn.className = 'cv-btn cv-btn--sm';
      const eyeIc = document.createElement('i');
      eyeIc.className = 'ph ph-eye cv-icon';
      eyeIc.setAttribute('aria-hidden', 'true');
      consultBtn.append(eyeIc, document.createTextNode(` ${t('common.consult')}`));
      consultBtn.addEventListener('click', () => {
        flushPending?.();
        modeState.whiteboardId = currentWb.id;
        modeState.mode = 'view';
        renderBody();
      });

      const openDialogBtn = document.createElement('button');
      openDialogBtn.type = 'button';
      openDialogBtn.id = 'btn-open-whiteboard-dialog';
      openDialogBtn.className = 'cv-btn cv-btn--sm';
      openDialogBtn.textContent = t('common.openEditor');
      openDialogBtn.setAttribute(
        'aria-label',
        t('common.openEditorNamed', { title: currentWb.title }),
      );
      openDialogBtn.addEventListener('click', () => {
        flushPending?.();
        const freshWb =
          store.getState().whiteboards.find((w) => w.id === currentWb.id) ?? currentWb;
        onOpenWhiteboardDialog?.({ whiteboard: freshWb, mode: 'edit' });
      });

      const exportSvgBtn = document.createElement('button');
      exportSvgBtn.type = 'button';
      exportSvgBtn.id = 'btn-export-wb-svg';
      exportSvgBtn.className = 'cv-btn cv-btn--sm';
      exportSvgBtn.textContent = t('whiteboards.exportSvg');
      exportSvgBtn.addEventListener(
        'click',
        () => void exportCanvas(() => titleInput.value.trim() || currentWb.title, 'svg'),
      );

      const exportPngBtn = document.createElement('button');
      exportPngBtn.type = 'button';
      exportPngBtn.id = 'btn-export-wb-png';
      exportPngBtn.className = 'cv-btn cv-btn--sm';
      exportPngBtn.textContent = t('whiteboards.exportPng');
      exportPngBtn.addEventListener(
        'click',
        () => void exportCanvas(() => titleInput.value.trim() || currentWb.title, 'png'),
      );

      const archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.id = 'btn-archive-whiteboard';
      archiveBtn.className = 'cv-btn cv-btn--sm';
      archiveBtn.disabled = readOnly;
      archiveBtn.textContent = t('common.archive');
      archiveBtn.setAttribute(
        'aria-label',
        t('whiteboards.archiveNamed', { title: currentWb.title }),
      );
      archiveBtn.addEventListener('click', () => {
        flushPending?.();
        store.dispatch({
          type: 'toggle_archive_whiteboard',
          id: currentWb.id,
          archived: true,
          now: new Date().toISOString(),
        });
        notify({
          status: 'info',
          title: t('whiteboards.archivedTitle'),
          text: t('whiteboards.archivedText', { title: currentWb.title }),
        });
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.id = 'btn-save-whiteboard';
      saveBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
      saveBtn.disabled = readOnly;
      saveBtn.textContent = t('common.save');
      saveBtn.addEventListener('click', () => saveNow(true));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.id = 'btn-delete-whiteboard';
      deleteBtn.className = 'cv-btn cv-btn--danger cv-btn--sm';
      deleteBtn.disabled = readOnly;
      deleteBtn.textContent = t('common.delete');
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: t('common.deleteTitle', { title: currentWb.title }),
          message: t('whiteboards.deleteConfirm'),
          confirmLabel: t('whiteboards.deleteLabel'),
          danger: true,
        });
        if (!confirmed) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        dirty = false;
        store.dispatch({
          type: 'trash_whiteboard',
          id: currentWb.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({
          status: 'info',
          title: t('whiteboards.trashed'),
          text: currentWb.title,
        });
      });

      const wbTemplatePicker = createTemplatePicker({
        idPrefix: 'wb-tpl',
        labelText: t('whiteboards.templatesLabel'),
        templates: selectTemplates(store.getState(), 'whiteboard', builtinTemplates),
        readOnly,
        showSave: true,
        async onApply(tpl) {
          const snapshot = canvasHandle
            ? canvasHandle.getSnapshot()
            : { viewport: latestViewport, elements: [...latestElements] };
          if (snapshot.elements.length > 0) {
            const confirmed = await confirmAction({
              title: t('whiteboards.applyTemplateTitle', { name: tpl.name }),
              message: t('whiteboards.applyTemplateText'),
              confirmLabel: t('templates.applyLabel'),
            });
            if (!confirmed) return;
          }
          if (saveTimer !== null) {
            window.clearTimeout(saveTimer);
            saveTimer = null;
          }
          dirty = false;
          const cleanTitle = titleInput.value.trim() || currentWb.title;
          const projectId = projSelect.value ? projSelect.value : null;
          const links = linkEditor.getLinks();
          const instantiated = instantiateWhiteboardTemplate(tpl, () => crypto.randomUUID());
          store.dispatch({
            type: 'update_whiteboard',
            id: currentWb.id,
            patch: {
              title: cleanTitle,
              projectId,
              viewport: instantiated.viewport,
              elements: instantiated.elements,
              links,
              assetIds: [],
            },
            now: new Date().toISOString(),
          });
          notify({ status: 'success', title: t('whiteboards.templateApplied'), text: tpl.name });
        },
        onSaveNew(name) {
          const snapshot = canvasHandle
            ? canvasHandle.getSnapshot()
            : { viewport: latestViewport, elements: [...latestElements] };
          const reusable = snapshot.elements.filter((el) => el.type !== 'image');
          if (reusable.length === 0) {
            notify({
              status: 'warning',
              title: t('whiteboards.canvasEmpty'),
              text: t('whiteboards.canvasEmptyText'),
            });
            return false;
          }
          const id = crypto.randomUUID();
          store.dispatch({
            type: 'create_template',
            id,
            kind: 'whiteboard',
            name,
            elements: reusable,
            viewport: snapshot.viewport,
            now: new Date().toISOString(),
          });
          wbTemplatePicker.setTemplates(
            selectTemplates(store.getState(), 'whiteboard', builtinTemplates),
            id,
          );
          notify({ status: 'success', title: t('whiteboards.templateSaved'), text: name });
          return id;
        },
        onDeleteCustom(tpl) {
          store.dispatch({ type: 'delete_template', id: tpl.id });
          wbTemplatePicker.setTemplates(
            selectTemplates(store.getState(), 'whiteboard', builtinTemplates),
          );
          notify({ status: 'info', title: t('templates.deleted'), text: tpl.name });
        },
      });

      actions.append(
        consultBtn,
        openDialogBtn,
        exportSvgBtn,
        exportPngBtn,
        archiveBtn,
        deleteBtn,
        saveBtn,
      );
      footer.append(statusEl, actions);
      editorCard.append(metaRow, linkEditor.element, canvasHost, footer, wbTemplatePicker.element);
    }

    layout.append(listEl, editorCard);
    bodySlot.replaceChildren(layout);
    window.Covenant?.init?.(bodySlot);
  }

  projectFilter.addEventListener('change', () => {
    flushPending?.();
    filters.projectId =
      projectFilter.value === 'all'
        ? 'all'
        : projectFilter.value === 'none'
          ? null
          : projectFilter.value;
    renderBody();
  });

  searchInput.addEventListener('input', () => {
    flushPending?.();
    filters.query = searchInput.value;
    renderBody();
  });

  renderBody();
  container.replaceChildren(header, bodySlot);

  return {
    flushAndDestroy() {
      flushPending?.();
      cleanupCanvas();
    },
    isDispatchingInline() {
      return dispatchingInlineUpdate;
    },
  };
}

/** @import { ArrowEndpointBinding, WhiteboardColorToken, WhiteboardElement, WhiteboardElementType, WhiteboardViewport } from '../types.d.ts' */

import {
  DEFAULT_WHITEBOARD_VIEWPORT,
  WHITEBOARD_COLORS,
  getWhiteboardElementLayerBounds,
  sanitizeWhiteboardElements,
  sanitizeWhiteboardViewport,
  stepWhiteboardElementLayer,
  whiteboardElementSupportsBackground,
} from '../core/model.js';
import {
  DEFAULT_WHITEBOARD_GRID_SIZE,
  buildArrowGeometry,
  computeFitViewport,
  detachUnfollowedArrowBindings,
  duplicateWhiteboardElements,
  findArrowSnapTarget,
  getArrowWorldEndpoints,
  intersectRayWithElementBorder,
  recomputeBoundArrows,
  selectElementsInMarquee,
  snapPointToGrid,
  snapValueToGrid,
  stepValueWithGrid,
} from '../core/whiteboard.js';
import { initTooltips, setTooltip } from './dom/tooltip.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_HISTORY = 50;

/** @type {Record<WhiteboardColorToken, string>} */
const COLOR_LABELS = {
  neutral: 'Neutre',
  accent: 'Accent',
  success: 'Succès',
  warning: 'Avertissement',
  danger: 'Danger',
};

/** @type {Record<WhiteboardElementType, string>} */
const TYPE_LABELS = {
  sticky: 'Post-it',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  arrow: 'Flèche',
  text: 'Texte',
  path: 'Tracé libre',
  image: 'Image locale',
};

/** @type {Record<WhiteboardColorToken, { fillVar: string; strokeVar: string; lineVar: string; textVar: string }>} */
const COLOR_TOKENS = {
  neutral: {
    fillVar: '--lc-wb-neutral-fill',
    strokeVar: '--lc-wb-neutral-stroke',
    lineVar: '--lc-wb-neutral-line',
    textVar: '--cv-fg',
  },
  accent: {
    fillVar: '--lc-wb-accent-fill',
    strokeVar: '--lc-wb-accent-stroke',
    lineVar: '--lc-wb-accent-line',
    textVar: '--cv-fg',
  },
  success: {
    fillVar: '--lc-wb-success-fill',
    strokeVar: '--lc-wb-success-stroke',
    lineVar: '--lc-wb-success-line',
    textVar: '--cv-fg',
  },
  warning: {
    fillVar: '--lc-wb-warning-fill',
    strokeVar: '--lc-wb-warning-stroke',
    lineVar: '--lc-wb-warning-line',
    textVar: '--cv-fg',
  },
  danger: {
    fillVar: '--lc-wb-danger-fill',
    strokeVar: '--lc-wb-danger-stroke',
    lineVar: '--lc-wb-danger-line',
    textVar: '--cv-fg',
  },
};

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Escape XML text content for standalone SVG serialization.
 * @param {string} raw
 * @returns {string}
 */
function escapeXml(raw) {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Word-wrap text into lines fitting inside an SVG box width.
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapTextLines(text, maxWidth) {
  const clean = text.trim();
  if (!clean) return [];
  const maxChars = Math.max(8, Math.floor((maxWidth - 20) / 7.5));
  /** @type {string[]} */
  const lines = [];
  for (const para of clean.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      if (word.length > maxChars) {
        if (current) {
          lines.push(current);
          current = '';
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        continue;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.slice(0, 12);
}

/**
 * Build an accessible description for a whiteboard element.
 * @param {WhiteboardElement} el
 * @returns {string}
 */
function describeElement(el) {
  const typeLabel = TYPE_LABELS[el.type] ?? el.type;
  const textSnippet = el.text ? ` : « ${el.text.slice(0, 60)} »` : '';
  const bgHint = el.transparentBg ? ', fond transparent' : '';
  const boundHint = el.type === 'arrow' && (el.startBinding || el.endBinding) ? ', aimantée' : '';
  return `${typeLabel}${textSnippet}${bgHint}${boundHint}, position ${Math.round(el.x)}, ${Math.round(el.y)}, taille ${Math.round(el.width)} par ${Math.round(el.height)}`;
}

/**
 * Build an SVG path string from normalized relative points.
 * @param {readonly (readonly [number, number])[]} points
 * @returns {string}
 */
function pointsToPathD(points) {
  if (points.length === 0) return '';
  return points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`)
    .join(' ');
}

/**
 * Create a toolbar icon button following Covenant button classes.
 * @param {{ icon: string; label: string; action?: string; tool?: string; toggle?: boolean; text?: string }} opts
 * @returns {HTMLButtonElement}
 */
function createToolbarBtn({ icon, label, action, tool, toggle = false, text }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
  btn.setAttribute('aria-label', label);
  setTooltip(btn, label);
  if (action) btn.dataset.wbAction = action;
  if (tool) btn.dataset.wbTool = tool;
  if (toggle) btn.setAttribute('aria-pressed', 'false');
  const ic = document.createElement('i');
  ic.className = `ph ${icon} cv-icon`;
  ic.setAttribute('aria-hidden', 'true');
  btn.append(ic);
  if (text) {
    btn.append(document.createTextNode(` ${text}`));
  }
  return btn;
}

/**
 * Convert an image blob URL into a self-contained data: URL via local canvas (zero network).
 * @param {string} blobUrl
 * @returns {Promise<string | null>}
 */
function blobUrlToDataUrl(blobUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.max(1, img.naturalWidth || img.width || 1);
        const h = Math.max(1, img.naturalHeight || img.height || 1);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = blobUrl;
  });
}

/**
 * Load natural dimensions of a local image File from an object URL.
 * @param {string} url
 * @returns {Promise<{ width: number; height: number }>}
 */
function measureImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 240;
      const nh = img.naturalHeight || 180;
      const maxDim = 360;
      if (nw <= maxDim && nh <= maxDim) {
        resolve({ width: clamp(nw, 48, maxDim), height: clamp(nh, 48, maxDim) });
      } else {
        const scale = maxDim / Math.max(nw, nh);
        resolve({
          width: Math.max(48, Math.round(nw * scale)),
          height: Math.max(48, Math.round(nh * scale)),
        });
      }
    };
    img.onerror = () => resolve({ width: 240, height: 180 });
    img.src = url;
  });
}

/**
 * Mount a native interactive SVG whiteboard canvas with Covenant toolbar,
 * full keyboard accessibility (WCAG 2.2 AA), multi-selection, duplication (Ctrl+D),
 * undo/redo, zoom/pan/fit-to-view, local image upload, remote image paste blocking,
 * and standalone SVG/PNG export.
 * @param {{
 *   container: HTMLElement;
 *   initialViewport: WhiteboardViewport;
 *   initialElements: readonly WhiteboardElement[];
 *   editable: boolean;
 *   ariaLabel: string;
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   onUploadImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onBlockedRemoteImage?: () => void;
 *   onToggleMaximize?: () => void;
 *   onChange: (next: { viewport: WhiteboardViewport; elements: WhiteboardElement[] }) => void;
 * }} opts
 * @returns {{
 *   getSnapshot: () => { viewport: WhiteboardViewport; elements: WhiteboardElement[] };
 *   exportSvgBlob: () => Promise<Blob>;
 *   exportPngBlob: () => Promise<Blob>;
 *   getRootElement: () => HTMLElement;
 *   setMaximized: (next: boolean) => void;
 *   focusMaximizeButton: () => void;
 *   cancelActiveInteraction: () => boolean;
 *   destroy: () => void;
 * }}
 */
export function mountWhiteboardCanvas({
  container,
  initialViewport,
  initialElements,
  editable,
  ariaLabel,
  resolveAssetUrl,
  onUploadImage,
  onBlockedRemoteImage,
  onToggleMaximize,
  onChange,
}) {
  const uid = `lc-wb-${Math.random().toString(36).slice(2, 8)}`;

  /** @type {WhiteboardViewport} */
  let viewport = sanitizeWhiteboardViewport(initialViewport ?? DEFAULT_WHITEBOARD_VIEWPORT);
  /** @type {WhiteboardElement[]} */
  let elements = [...sanitizeWhiteboardElements(initialElements ?? [])];

  /** @type {'select' | 'marquee' | WhiteboardElementType} */
  let activeTool = 'select';
  /** @type {WhiteboardColorToken} */
  let activeColor = 'accent';
  let activeTransparentBg = false;
  let gridVisible = true;
  let snapToGrid = false;
  const GRID_SIZE = DEFAULT_WHITEBOARD_GRID_SIZE;
  const MAJOR_GRID_SIZE = GRID_SIZE * 5;
  /** @type {Set<string>} */
  let selectedIds = new Set(elements[0]?.id ? [elements[0].id] : []);
  /** @type {string | null} */
  let primarySelectedId = elements[0]?.id ?? null;
  let handlingElementPointer = false;

  /** @type {WhiteboardElement[][]} */
  let historyPast = [];
  /** @type {WhiteboardElement[][]} */
  let historyFuture = [];

  /** @type {Map<string, string>} */
  const resolvedUrlCache = new Map();
  /** @type {Map<string, SVGGElement>} */
  const renderedGroups = new Map();

  let destroyed = false;
  let maximized = false;

  const root = document.createElement('div');
  root.className = 'lc-wb-container';
  if (!editable) root.dataset.readonly = 'true';

  const announcer = document.createElement('div');
  announcer.className = 'lc-sr-only';
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');

  /**
   * Announce a concise status update to assistive technologies.
   * @param {string} msg
   */
  function announce(msg) {
    announcer.textContent = '';
    window.requestAnimationFrame(() => {
      if (!destroyed) announcer.textContent = msg;
    });
  }

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'lc-wb-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Outils du tableau blanc');

  /** @type {Map<'select' | 'marquee' | WhiteboardElementType, HTMLButtonElement>} */
  const toolButtons = new Map();

  /** @type {Array<{ tool: 'select' | 'marquee' | WhiteboardElementType; label: string; icon: string }>} */
  const toolSpecs = [
    { tool: 'select', label: 'Sélectionner', icon: 'ph-cursor' },
    { tool: 'marquee', label: 'Sélection par zone', icon: 'ph-selection' },
    { tool: 'sticky', label: 'Post-it', icon: 'ph-note' },
    { tool: 'rect', label: 'Rectangle', icon: 'ph-rectangle' },
    { tool: 'ellipse', label: 'Ellipse', icon: 'ph-circle' },
    { tool: 'arrow', label: 'Flèche', icon: 'ph-arrow-up-right' },
    { tool: 'text', label: 'Texte', icon: 'ph-text-t' },
    { tool: 'path', label: 'Tracé libre', icon: 'ph-pencil-simple' },
  ];

  const toolsGroup = document.createElement('div');
  toolsGroup.className = 'lc-wb-toolbar__group';

  for (const spec of toolSpecs) {
    const btn = createToolbarBtn({
      icon: spec.icon,
      label: spec.label,
      tool: spec.tool,
      toggle: true,
    });
    btn.addEventListener('click', () => {
      if (!editable) return;
      setActiveTool(spec.tool);
    });
    btn.addEventListener('dblclick', () => {
      if (!editable || spec.tool === 'select' || spec.tool === 'marquee') return;
      insertDefaultElementAtCenter(spec.tool);
    });
    btn.addEventListener('keydown', (e) => {
      if (!editable || spec.tool === 'select' || spec.tool === 'marquee') return;
      if (e.key === 'Enter' && activeTool === spec.tool) {
        e.preventDefault();
        insertDefaultElementAtCenter(spec.tool);
      }
    });
    toolButtons.set(spec.tool, btn);
    toolsGroup.append(btn);
  }

  const addCenterBtn = createToolbarBtn({
    icon: 'ph-plus-circle',
    label: 'Ajouter au centre',
    action: 'add-center',
    text: 'Ajouter au centre',
  });
  addCenterBtn.addEventListener('click', () => {
    if (!editable) return;
    const typeToAdd = activeTool === 'select' || activeTool === 'marquee' ? 'sticky' : activeTool;
    insertDefaultElementAtCenter(typeToAdd);
  });

  const insertImageBtn = createToolbarBtn({
    icon: 'ph-image',
    label: 'Image locale',
    action: 'insert-image',
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileInput.className = 'lc-file-input-hidden';
  fileInput.setAttribute('aria-hidden', 'true');
  fileInput.tabIndex = -1;

  insertImageBtn.addEventListener('click', () => {
    if (editable) fileInput.click();
  });

  toolsGroup.append(addCenterBtn, insertImageBtn);

  // Color selector
  const colorGroup = document.createElement('div');
  colorGroup.className = 'lc-wb-toolbar__group lc-wb-colors';
  colorGroup.setAttribute('role', 'radiogroup');
  colorGroup.setAttribute('aria-label', 'Couleur de l’élément');

  /** @type {Map<WhiteboardColorToken, HTMLButtonElement>} */
  const colorButtons = new Map();
  for (const colorToken of WHITEBOARD_COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cv-btn cv-btn--ghost cv-btn--sm lc-wb-color-btn';
    btn.dataset.wbColor = colorToken;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(colorToken === activeColor));
    btn.setAttribute('aria-label', `Couleur ${COLOR_LABELS[colorToken]}`);
    setTooltip(btn, COLOR_LABELS[colorToken]);

    const swatch = document.createElement('span');
    swatch.className = `lc-wb-swatch lc-wb-swatch--${colorToken}`;
    swatch.setAttribute('aria-hidden', 'true');
    btn.append(swatch);

    btn.addEventListener('click', () => {
      if (!editable) return;
      activeColor = colorToken;
      if (selectedIds.size > 0) {
        const hasDiff = elements.some((el) => selectedIds.has(el.id) && el.color !== colorToken);
        if (hasDiff) {
          commitElements(
            elements.map((el) => (selectedIds.has(el.id) ? { ...el, color: colorToken } : el)),
          );
          announce(`Couleur ${COLOR_LABELS[colorToken]} appliquée`);
        }
      }
      syncToolbarState();
    });
    colorButtons.set(colorToken, btn);
    colorGroup.append(btn);
  }

  const transparentBgBtn = createToolbarBtn({
    icon: 'ph-checkerboard',
    label: 'Fond transparent',
    action: 'toggle-transparent-bg',
    toggle: true,
  });
  setTooltip(transparentBgBtn, 'Fond transparent (permet d’encadrer un autre élément)');
  transparentBgBtn.addEventListener('click', () => {
    if (!editable) return;
    const bgTargets = elements.filter(
      (el) => selectedIds.has(el.id) && whiteboardElementSupportsBackground(el.type),
    );
    if (bgTargets.length > 0) {
      const allTransparent = bgTargets.every((el) => Boolean(el.transparentBg));
      const nextTransparent = !allTransparent;
      activeTransparentBg = nextTransparent;
      const targetIds = new Set(bgTargets.map((el) => el.id));
      commitElements(
        elements.map((el) =>
          targetIds.has(el.id) ? { ...el, transparentBg: nextTransparent ? true : undefined } : el,
        ),
      );
      announce(nextTransparent ? 'Fond transparent activé' : 'Fond rempli activé');
      return;
    }
    activeTransparentBg = !activeTransparentBg;
    syncToolbarState();
    announce(
      activeTransparentBg
        ? 'Fond transparent activé pour les prochains éléments'
        : 'Fond rempli activé pour les prochains éléments',
    );
  });
  colorGroup.append(transparentBgBtn);

  // Selection actions
  const selectionGroup = document.createElement('div');
  selectionGroup.className = 'lc-wb-toolbar__group';

  const editTextBtn = createToolbarBtn({
    icon: 'ph-textbox',
    label: 'Modifier le texte',
    action: 'edit-text',
  });
  editTextBtn.addEventListener('click', () => {
    if (!editable || selectedIds.size !== 1 || !primarySelectedId) return;
    const target = elements.find((el) => el.id === primarySelectedId);
    if (target && supportsText(target.type)) {
      openTextEditor(target);
    }
  });

  const duplicateElBtn = createToolbarBtn({
    icon: 'ph-copy',
    label: 'Dupliquer (Ctrl+D)',
    action: 'duplicate-selected',
  });
  duplicateElBtn.addEventListener('click', () => {
    duplicateSelected();
  });

  const bringForwardBtn = createToolbarBtn({
    icon: 'ph-stack-plus',
    label: 'Avancer d’un niveau',
    action: 'bring-forward',
  });
  setTooltip(bringForwardBtn, 'Avancer d’un niveau (Page précédente)');
  bringForwardBtn.addEventListener('click', () => {
    if (editable && selectedIds.size === 1 && primarySelectedId) {
      stepSelectedLayer(1);
    }
  });

  const sendBackwardBtn = createToolbarBtn({
    icon: 'ph-stack-minus',
    label: 'Reculer d’un niveau',
    action: 'send-backward',
  });
  setTooltip(sendBackwardBtn, 'Reculer d’un niveau (Page suivante)');
  sendBackwardBtn.addEventListener('click', () => {
    if (editable && selectedIds.size === 1 && primarySelectedId) {
      stepSelectedLayer(-1);
    }
  });

  const deleteElBtn = createToolbarBtn({
    icon: 'ph-trash',
    label: 'Supprimer la sélection',
    action: 'delete-selected',
  });
  deleteElBtn.addEventListener('click', () => {
    if (editable && selectedIds.size > 0) {
      deleteSelectedElements();
    }
  });

  selectionGroup.append(editTextBtn, duplicateElBtn, bringForwardBtn, sendBackwardBtn, deleteElBtn);

  // History actions
  const historyGroup = document.createElement('div');
  historyGroup.className = 'lc-wb-toolbar__group';

  const undoBtn = createToolbarBtn({
    icon: 'ph-arrow-counter-clockwise',
    label: 'Annuler (Ctrl+Z)',
    action: 'undo',
  });
  undoBtn.addEventListener('click', () => undo());

  const redoBtn = createToolbarBtn({
    icon: 'ph-arrow-clockwise',
    label: 'Rétablir (Ctrl+Y)',
    action: 'redo',
  });
  redoBtn.addEventListener('click', () => redo());

  historyGroup.append(undoBtn, redoBtn);

  // Grid & alignment snap controls
  const gridGroup = document.createElement('div');
  gridGroup.className = 'lc-wb-toolbar__group';

  const gridBtn = createToolbarBtn({
    icon: 'ph-grid-four',
    label: 'Afficher la grille d’alignement',
    action: 'toggle-grid',
    toggle: true,
  });
  setTooltip(gridBtn, 'Afficher ou masquer la grille d’alignement');
  gridBtn.addEventListener('click', () => {
    gridVisible = !gridVisible;
    syncGridDisplay();
    syncToolbarState();
    announce(gridVisible ? 'Grille d’alignement affichée' : 'Grille d’alignement masquée');
  });

  const snapBtn = createToolbarBtn({
    icon: 'ph-magnet',
    label: 'Magnétisme sur la grille',
    action: 'toggle-snap',
    toggle: true,
  });
  setTooltip(snapBtn, `Magnétisme sur la grille (pas de ${GRID_SIZE} px)`);
  snapBtn.addEventListener('click', () => {
    if (!editable) return;
    snapToGrid = !snapToGrid;
    syncToolbarState();
    announce(
      snapToGrid
        ? `Magnétisme sur la grille activé (${GRID_SIZE} px)`
        : 'Magnétisme sur la grille désactivé',
    );
  });

  gridGroup.append(gridBtn, snapBtn);

  // Zoom controls (always available even in read-only mode)
  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'lc-wb-toolbar__group lc-wb-toolbar__zoom';

  const zoomOutBtn = createToolbarBtn({
    icon: 'ph-magnifying-glass-minus',
    label: 'Zoom -',
    action: 'zoom-out',
  });
  zoomOutBtn.addEventListener('click', () => applyZoomDelta(-0.2));

  const zoomResetBtn = document.createElement('button');
  zoomResetBtn.type = 'button';
  zoomResetBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm cv-num';
  zoomResetBtn.dataset.wbAction = 'zoom-reset';
  zoomResetBtn.setAttribute('aria-label', 'Réinitialiser le zoom à 100 %');
  setTooltip(zoomResetBtn, 'Réinitialiser le zoom à 100 %');
  zoomResetBtn.textContent = `${Math.round(viewport.zoom * 100)} %`;
  zoomResetBtn.addEventListener('click', () => {
    setViewport({ panX: 0, panY: 0, zoom: 1 });
    announce('Zoom réinitialisé à 100 %');
  });

  const zoomInBtn = createToolbarBtn({
    icon: 'ph-magnifying-glass-plus',
    label: 'Zoom +',
    action: 'zoom-in',
  });
  zoomInBtn.addEventListener('click', () => applyZoomDelta(0.2));

  const fitViewBtn = createToolbarBtn({
    icon: 'ph-frame-corners',
    label: 'Ajuster à la vue',
    action: 'fit-to-view',
  });
  fitViewBtn.addEventListener('click', () => {
    fitToView();
  });

  zoomGroup.append(zoomOutBtn, zoomResetBtn, zoomInBtn, fitViewBtn);

  /** @type {HTMLButtonElement | null} */
  let maximizeBtn = null;
  if (onToggleMaximize) {
    maximizeBtn = createToolbarBtn({
      icon: 'ph-arrows-out-simple',
      label: 'Afficher en taille maximum',
      action: 'toggle-maximize',
      toggle: true,
    });
    setTooltip(maximizeBtn, 'Afficher en taille maximum');
    maximizeBtn.addEventListener('click', () => {
      onToggleMaximize();
    });
    zoomGroup.append(maximizeBtn);
  }

  if (editable) {
    toolbar.append(toolsGroup, colorGroup, selectionGroup, historyGroup, gridGroup, zoomGroup);
  } else {
    gridGroup.replaceChildren(gridBtn);
    toolbar.append(gridGroup, zoomGroup);
  }

  // Inline accessible text editor bar (shown on Enter / F2 / double-click / button)
  const textEditorBar = document.createElement('div');
  textEditorBar.className = 'lc-wb-text-editor';
  textEditorBar.hidden = true;
  textEditorBar.setAttribute('role', 'region');
  textEditorBar.setAttribute('aria-label', 'Édition du texte de l’élément');

  const textEditorLabel = document.createElement('label');
  textEditorLabel.className = 'cv-label';
  textEditorLabel.htmlFor = `${uid}-text-input`;
  textEditorLabel.textContent = 'Texte de l’élément';

  const textEditorInput = document.createElement('textarea');
  textEditorInput.id = `${uid}-text-input`;
  textEditorInput.className = 'cv-input';
  textEditorInput.rows = 2;
  textEditorInput.maxLength = 500;

  const textEditorActions = document.createElement('div');
  textEditorActions.className = 'lc-wb-text-editor__actions';

  const textApplyBtn = document.createElement('button');
  textApplyBtn.type = 'button';
  textApplyBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
  textApplyBtn.textContent = 'Valider';

  const textCancelBtn = document.createElement('button');
  textCancelBtn.type = 'button';
  textCancelBtn.className = 'cv-btn cv-btn--sm';
  textCancelBtn.textContent = 'Annuler';

  textEditorActions.append(textCancelBtn, textApplyBtn);
  textEditorBar.append(textEditorLabel, textEditorInput, textEditorActions);

  /** @type {string | null} */
  let editingTextElementId = null;

  // Stage & SVG
  const stage = document.createElement('div');
  stage.className = 'lc-wb-stage';
  stage.tabIndex = 0;
  stage.setAttribute('role', 'region');
  stage.setAttribute('aria-label', ariaLabel);

  const svg = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NS, 'svg'));
  svg.classList.add('lc-wb-svg');
  svg.setAttribute('aria-label', ariaLabel);

  const defs = /** @type {SVGDefsElement} */ (document.createElementNS(SVG_NS, 'defs'));
  for (const colorToken of WHITEBOARD_COLORS) {
    const marker = /** @type {SVGMarkerElement} */ (document.createElementNS(SVG_NS, 'marker'));
    marker.id = `${uid}-arrow-${colorToken}`;
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const poly = /** @type {SVGPathElement} */ (document.createElementNS(SVG_NS, 'path'));
    poly.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z');
    poly.classList.add('lc-wb-arrow-head');
    poly.dataset.color = colorToken;
    marker.append(poly);
    defs.append(marker);
  }

  const minorGridPattern = /** @type {SVGPatternElement} */ (
    document.createElementNS(SVG_NS, 'pattern')
  );
  minorGridPattern.id = `${uid}-grid-minor`;
  minorGridPattern.setAttribute('width', String(GRID_SIZE));
  minorGridPattern.setAttribute('height', String(GRID_SIZE));
  minorGridPattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const minorGridPath = /** @type {SVGPathElement} */ (document.createElementNS(SVG_NS, 'path'));
  minorGridPath.setAttribute('d', `M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`);
  minorGridPath.classList.add('lc-wb-grid-line', 'lc-wb-grid-line--minor');
  minorGridPattern.append(minorGridPath);

  const majorGridPattern = /** @type {SVGPatternElement} */ (
    document.createElementNS(SVG_NS, 'pattern')
  );
  majorGridPattern.id = `${uid}-grid-major`;
  majorGridPattern.setAttribute('width', String(MAJOR_GRID_SIZE));
  majorGridPattern.setAttribute('height', String(MAJOR_GRID_SIZE));
  majorGridPattern.setAttribute('patternUnits', 'userSpaceOnUse');
  const majorFillRect = /** @type {SVGRectElement} */ (document.createElementNS(SVG_NS, 'rect'));
  majorFillRect.setAttribute('width', String(MAJOR_GRID_SIZE));
  majorFillRect.setAttribute('height', String(MAJOR_GRID_SIZE));
  majorFillRect.setAttribute('fill', `url(#${uid}-grid-minor)`);
  const majorGridPath = /** @type {SVGPathElement} */ (document.createElementNS(SVG_NS, 'path'));
  majorGridPath.setAttribute('d', `M ${MAJOR_GRID_SIZE} 0 L 0 0 0 ${MAJOR_GRID_SIZE}`);
  majorGridPath.classList.add('lc-wb-grid-line', 'lc-wb-grid-line--major');
  majorGridPattern.append(majorFillRect, majorGridPath);
  defs.append(minorGridPattern, majorGridPattern);

  const worldGroup = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
  worldGroup.classList.add('lc-wb-world');

  const gridLayer = /** @type {SVGRectElement} */ (document.createElementNS(SVG_NS, 'rect'));
  gridLayer.classList.add('lc-wb-grid-layer');
  gridLayer.setAttribute('x', '-12000');
  gridLayer.setAttribute('y', '-12000');
  gridLayer.setAttribute('width', '24000');
  gridLayer.setAttribute('height', '24000');
  gridLayer.setAttribute('fill', `url(#${uid}-grid-major)`);
  gridLayer.setAttribute('pointer-events', 'none');
  gridLayer.setAttribute('aria-hidden', 'true');

  const elementsLayer = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
  elementsLayer.classList.add('lc-wb-elements');

  const draftLayer = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
  draftLayer.classList.add('lc-wb-draft');

  worldGroup.append(gridLayer, elementsLayer, draftLayer);
  svg.append(defs, worldGroup);
  stage.append(svg);

  if (editable) {
    root.append(toolbar, textEditorBar, stage, announcer, fileInput);
  } else {
    root.append(toolbar, stage, announcer);
  }
  container.replaceChildren(root);
  initTooltips(toolbar);

  /**
   * @param {WhiteboardElementType} type
   * @returns {boolean}
   */
  function supportsText(type) {
    return type === 'sticky' || type === 'rect' || type === 'ellipse' || type === 'text';
  }

  function emitChange() {
    onChange({
      viewport,
      elements: [...elements],
    });
  }

  /**
   * @param {WhiteboardViewport} nextViewport
   * @param {boolean} [emit]
   */
  function setViewport(nextViewport, emit = true) {
    viewport = sanitizeWhiteboardViewport(nextViewport);
    worldGroup.setAttribute(
      'transform',
      `translate(${viewport.panX.toFixed(2)} ${viewport.panY.toFixed(2)}) scale(${viewport.zoom.toFixed(3)})`,
    );
    zoomResetBtn.textContent = `${Math.round(viewport.zoom * 100)} %`;
    if (emit) emitChange();
  }

  /**
   * @param {number} delta
   * @param {number} [anchorClientX]
   * @param {number} [anchorClientY]
   */
  function applyZoomDelta(delta, anchorClientX, anchorClientY) {
    const nextZoom = clamp(Math.round((viewport.zoom + delta) * 100) / 100, 0.25, 3);
    if (nextZoom === viewport.zoom) return;
    const rect = svg.getBoundingClientRect();
    const cx = anchorClientX !== undefined ? anchorClientX - rect.left : rect.width / 2;
    const cy = anchorClientY !== undefined ? anchorClientY - rect.top : rect.height / 2;
    const worldX = (cx - viewport.panX) / viewport.zoom;
    const worldY = (cy - viewport.panY) / viewport.zoom;
    const nextPanX = cx - worldX * nextZoom;
    const nextPanY = cy - worldY * nextZoom;
    setViewport({ panX: nextPanX, panY: nextPanY, zoom: nextZoom });
  }

  function fitToView() {
    const rect = stage.getBoundingClientRect();
    const nextVp = computeFitViewport(elements, rect.width || 800, rect.height || 520, 48);
    setViewport(nextVp);
    announce(
      elements.length > 0 ? 'Vue ajustée au contenu du tableau' : 'Vue réinitialisée à 100 %',
    );
  }

  /**
   * Convert client pointer coordinates into SVG world coordinates.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ x: number; y: number }}
   */
  function clientToWorld(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - viewport.panX) / viewport.zoom,
      y: (sy - viewport.panY) / viewport.zoom,
    };
  }

  /**
   * Get the world coordinates at the center of the visible stage.
   * @returns {{ x: number; y: number }}
   */
  function getViewportCenterWorld() {
    const rect = svg.getBoundingClientRect();
    const cx = rect.width > 0 ? rect.width / 2 : 400;
    const cy = rect.height > 0 ? rect.height / 2 : 260;
    return {
      x: (cx - viewport.panX) / viewport.zoom,
      y: (cy - viewport.panY) / viewport.zoom,
    };
  }

  function pruneSelectionToElements() {
    const validIds = new Set(elements.map((el) => el.id));
    const pruned = new Set([...selectedIds].filter((id) => validIds.has(id)));
    selectedIds = pruned;
    if (!primarySelectedId || !pruned.has(primarySelectedId)) {
      primarySelectedId = pruned.values().next().value ?? null;
    }
  }

  /**
   * Commit a new elements snapshot and push previous snapshot onto undo stack.
   * @param {WhiteboardElement[]} nextElements
   */
  function commitElements(nextElements) {
    historyPast = [...historyPast.slice(-(MAX_HISTORY - 1)), elements];
    historyFuture = [];
    const sanitized = sanitizeWhiteboardElements(nextElements);
    const recomputed = recomputeBoundArrows(sanitized);
    elements = [...sanitizeWhiteboardElements(recomputed)];
    pruneSelectionToElements();
    renderElements();
    syncToolbarState();
    emitChange();
  }

  function undo() {
    if (!editable || historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    if (!prev) return;
    historyPast = historyPast.slice(0, -1);
    historyFuture = [elements, ...historyFuture.slice(0, MAX_HISTORY - 1)];
    elements = [...prev];
    pruneSelectionToElements();
    renderElements();
    syncToolbarState();
    emitChange();
    announce('Action annulée');
  }

  function redo() {
    if (!editable || historyFuture.length === 0) return;
    const next = historyFuture[0];
    if (!next) return;
    historyFuture = historyFuture.slice(1);
    historyPast = [...historyPast.slice(-(MAX_HISTORY - 1)), elements];
    elements = [...next];
    pruneSelectionToElements();
    renderElements();
    syncToolbarState();
    emitChange();
    announce('Action rétablie');
  }

  /** @param {'select' | 'marquee' | WhiteboardElementType} tool */
  function setActiveTool(tool) {
    activeTool = tool;
    if (tool !== 'select' && tool !== 'marquee' && selectedIds.size > 0) {
      setSelection([], null);
      return;
    }
    syncToolbarState();
  }

  function syncGridDisplay() {
    root.dataset.wbGrid = String(gridVisible);
    gridLayer.style.display = gridVisible ? '' : 'none';
    if (gridVisible) {
      gridLayer.removeAttribute('visibility');
    } else {
      gridLayer.setAttribute('visibility', 'hidden');
    }
  }

  function syncToolbarState() {
    root.dataset.wbActiveTool = activeTool;
    root.dataset.wbGrid = String(gridVisible);
    root.dataset.wbSnap = String(snapToGrid);
    root.dataset.wbMaximized = String(maximized);
    if (maximizeBtn) {
      maximizeBtn.setAttribute('aria-pressed', String(maximized));
      setTooltip(
        maximizeBtn,
        maximized ? 'Quitter la taille maximum' : 'Afficher en taille maximum',
      );
      const iconEl = maximizeBtn.querySelector('i');
      if (iconEl) {
        iconEl.className = `ph ${maximized ? 'ph-arrows-in-simple' : 'ph-arrows-out-simple'} cv-icon`;
      }
    }
    gridBtn.setAttribute('aria-pressed', String(gridVisible));
    snapBtn.disabled = !editable;
    snapBtn.setAttribute('aria-pressed', String(snapToGrid));
    const centerType = activeTool === 'select' || activeTool === 'marquee' ? 'sticky' : activeTool;
    setTooltip(
      addCenterBtn,
      `Ajouter (${TYPE_LABELS[centerType]}) au centre de la vue, sans glisser-déposer`,
    );
    for (const [tool, btn] of toolButtons) {
      btn.setAttribute('aria-pressed', String(tool === activeTool));
    }
    for (const [colorToken, btn] of colorButtons) {
      btn.setAttribute('aria-checked', String(colorToken === activeColor));
    }
    const selectedEls = elements.filter((el) => selectedIds.has(el.id));
    const selectedCount = selectedEls.length;
    const primary =
      (primarySelectedId ? elements.find((el) => el.id === primarySelectedId) : undefined) ??
      selectedEls[0];
    const bgTargets = selectedEls.filter((el) => whiteboardElementSupportsBackground(el.type));
    const isBgTransparent =
      bgTargets.length > 0
        ? bgTargets.every((el) => Boolean(el.transparentBg))
        : activeTransparentBg;
    transparentBgBtn.disabled = !editable;
    transparentBgBtn.setAttribute('aria-pressed', String(isBgTransparent));
    const layerBounds =
      selectedCount === 1 && primary
        ? getWhiteboardElementLayerBounds(elements, primary.id)
        : { canBringForward: false, canSendBackward: false };
    editTextBtn.disabled =
      !editable || selectedCount !== 1 || !primary || !supportsText(primary.type);
    duplicateElBtn.disabled = !editable || selectedCount === 0;
    bringForwardBtn.disabled = !editable || !layerBounds.canBringForward;
    sendBackwardBtn.disabled = !editable || !layerBounds.canSendBackward;
    deleteElBtn.disabled = !editable || selectedCount === 0;
    zoomResetBtn.textContent = `${Math.round(viewport.zoom * 100)} %`;
    undoBtn.disabled = !editable || historyPast.length === 0;
    redoBtn.disabled = !editable || historyFuture.length === 0;
  }

  /** @returns {number} */
  function nextZIndex() {
    let maxZ = -1;
    for (const el of elements) {
      if (el.zIndex > maxZ) maxZ = el.zIndex;
    }
    return maxZ + 1;
  }

  /**
   * Create a default element of the given type centered around (cx, cy).
   * @param {WhiteboardElementType} type
   * @param {number} cx
   * @param {number} cy
   * @returns {WhiteboardElement}
   */
  function buildDefaultElement(type, cx, cy) {
    const id = crypto.randomUUID();
    const zIndex = nextZIndex();
    const snapCoord = (/** @type {number} */ val) =>
      clamp(snapValueToGrid(val, GRID_SIZE, snapToGrid), -10000, 10000);
    switch (type) {
      case 'sticky':
        return {
          id,
          type: 'sticky',
          x: snapCoord(cx - 90),
          y: snapCoord(cy - 60),
          width: 180,
          height: 120,
          text: 'Post-it',
          color: activeColor,
          ...(activeTransparentBg ? { transparentBg: true } : {}),
          zIndex,
        };
      case 'rect':
        return {
          id,
          type: 'rect',
          x: snapCoord(cx - 80),
          y: snapCoord(cy - 50),
          width: 160,
          height: 100,
          text: '',
          color: activeColor,
          ...(activeTransparentBg ? { transparentBg: true } : {}),
          zIndex,
        };
      case 'ellipse':
        return {
          id,
          type: 'ellipse',
          x: snapCoord(cx - 75),
          y: snapCoord(cy - 50),
          width: 150,
          height: 100,
          text: '',
          color: activeColor,
          ...(activeTransparentBg ? { transparentBg: true } : {}),
          zIndex,
        };
      case 'arrow':
        return {
          id,
          type: 'arrow',
          x: snapCoord(cx - 70),
          y: snapCoord(cy - 20),
          width: 140,
          height: 40,
          color: activeColor,
          points: [
            [0, 40],
            [140, 0],
          ],
          zIndex,
        };
      case 'text':
        return {
          id,
          type: 'text',
          x: snapCoord(cx - 80),
          y: snapCoord(cy - 24),
          width: 160,
          height: 48,
          text: 'Texte',
          color: activeColor,
          zIndex,
        };
      case 'path':
        return {
          id,
          type: 'path',
          x: snapCoord(cx - 60),
          y: snapCoord(cy - 20),
          width: 120,
          height: 40,
          color: activeColor,
          points: [
            [0, 20],
            [40, 0],
            [80, 40],
            [120, 20],
          ],
          zIndex,
        };
      default:
        return {
          id,
          type: 'rect',
          x: snapCoord(cx - 80),
          y: snapCoord(cy - 50),
          width: 160,
          height: 100,
          color: activeColor,
          zIndex,
        };
    }
  }

  /**
   * Insert a default element at viewport center (WCAG 2.5.7 non-drag creation path).
   * @param {WhiteboardElementType} type
   */
  function insertDefaultElementAtCenter(type) {
    const center = getViewportCenterWorld();
    const offset = (elements.length % 5) * (snapToGrid ? GRID_SIZE : 16);
    const el = buildDefaultElement(type, center.x + offset, center.y + offset);
    selectedIds = new Set([el.id]);
    primarySelectedId = el.id;
    commitElements([...elements, el]);
    const node = renderedGroups.get(el.id);
    node?.focus({ preventScroll: true });
    announce(`${TYPE_LABELS[el.type]} ajouté au tableau`);
  }

  function duplicateSelected() {
    if (!editable || selectedIds.size === 0) return;
    const { nextElements, createdIds } = duplicateWhiteboardElements(elements, selectedIds, {
      snapGridSize: snapToGrid ? GRID_SIZE : 0,
    });
    if (createdIds.length === 0) return;
    selectedIds = new Set(createdIds);
    primarySelectedId = createdIds[0] ?? null;
    commitElements(nextElements);
    if (primarySelectedId) {
      renderedGroups.get(primarySelectedId)?.focus({ preventScroll: true });
    }
    announce(
      createdIds.length > 1 ? `${createdIds.length} éléments dupliqués` : 'Élément dupliqué',
    );
  }

  /**
   * Move the selected element one level forward (+1) or backward (-1) in z-order.
   * @param {1 | -1} direction
   */
  function stepSelectedLayer(direction) {
    if (!editable || selectedIds.size !== 1 || !primarySelectedId) return;
    const result = stepWhiteboardElementLayer(elements, primarySelectedId, direction);
    if (!result.changed) return;
    commitElements([...result.elements]);
    announce(direction === 1 ? 'Élément avancé d’un niveau' : 'Élément reculé d’un niveau');
  }

  function deleteSelectedElements() {
    if (!editable || selectedIds.size === 0) return;
    const toDelete = new Set(selectedIds);
    if (editingTextElementId && toDelete.has(editingTextElementId)) {
      closeTextEditor(false);
    }
    const deleted = elements.filter((el) => toDelete.has(el.id));
    if (deleted.length === 0) return;
    selectedIds = new Set();
    primarySelectedId = null;
    commitElements(elements.filter((el) => !toDelete.has(el.id)));
    if (deleted.length === 1 && deleted[0]) {
      announce(`${TYPE_LABELS[deleted[0].type]} supprimé`);
    } else {
      announce(`${deleted.length} éléments supprimés`);
    }
    stage.focus({ preventScroll: true });
  }

  /**
   * Populate SVG children inside a single element `<g>`.
   * @param {SVGGElement} g
   * @param {WhiteboardElement} el
   * @param {boolean} isSelected
   */
  function populateElementGroup(g, el, isSelected) {
    g.dataset.elId = el.id;
    g.dataset.elType = el.type;
    g.dataset.x = String(Math.round(el.x));
    g.dataset.y = String(Math.round(el.y));
    g.dataset.w = String(Math.round(el.width));
    g.dataset.h = String(Math.round(el.height));
    g.dataset.selected = isSelected ? 'true' : 'false';
    g.setAttribute('transform', `translate(${el.x} ${el.y})`);
    g.setAttribute('aria-label', describeElement(el));

    const childNodes = [];

    if (el.transparentBg && whiteboardElementSupportsBackground(el.type)) {
      g.dataset.transparentBg = 'true';
    } else {
      delete g.dataset.transparentBg;
    }

    if (el.type === 'arrow' && el.startBinding) {
      g.dataset.startBound = el.startBinding.elementId;
    } else {
      delete g.dataset.startBound;
    }
    if (el.type === 'arrow' && el.endBinding) {
      g.dataset.endBound = el.endBinding.elementId;
    } else {
      delete g.dataset.endBound;
    }

    if (el.type === 'sticky' || el.type === 'rect') {
      const rx = el.type === 'sticky' ? '8' : '6';
      if (el.transparentBg) {
        const hitRect = document.createElementNS(SVG_NS, 'rect');
        hitRect.setAttribute('x', '0');
        hitRect.setAttribute('y', '0');
        hitRect.setAttribute('width', String(el.width));
        hitRect.setAttribute('height', String(el.height));
        hitRect.setAttribute('rx', rx);
        hitRect.setAttribute('ry', rx);
        hitRect.classList.add('lc-wb-hit-stroke');
        childNodes.push(hitRect);
      }
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(el.width));
      rect.setAttribute('height', String(el.height));
      rect.setAttribute('rx', rx);
      rect.setAttribute('ry', rx);
      rect.classList.add('lc-wb-shape', el.type === 'sticky' ? 'lc-wb-sticky' : 'lc-wb-rect');
      rect.dataset.color = el.color;
      if (el.transparentBg) rect.dataset.transparent = 'true';
      childNodes.push(rect);
    } else if (el.type === 'ellipse') {
      if (el.transparentBg) {
        const hitEllipse = document.createElementNS(SVG_NS, 'ellipse');
        hitEllipse.setAttribute('cx', String(el.width / 2));
        hitEllipse.setAttribute('cy', String(el.height / 2));
        hitEllipse.setAttribute('rx', String(el.width / 2));
        hitEllipse.setAttribute('ry', String(el.height / 2));
        hitEllipse.classList.add('lc-wb-hit-stroke');
        childNodes.push(hitEllipse);
      }
      const ellipse = document.createElementNS(SVG_NS, 'ellipse');
      ellipse.setAttribute('cx', String(el.width / 2));
      ellipse.setAttribute('cy', String(el.height / 2));
      ellipse.setAttribute('rx', String(el.width / 2));
      ellipse.setAttribute('ry', String(el.height / 2));
      ellipse.classList.add('lc-wb-shape', 'lc-wb-ellipse');
      ellipse.dataset.color = el.color;
      if (el.transparentBg) ellipse.dataset.transparent = 'true';
      childNodes.push(ellipse);
    } else if (el.type === 'arrow') {
      const pts =
        el.points && el.points.length >= 2
          ? el.points
          : [
              [0, el.height / 2],
              [el.width, el.height / 2],
            ];
      const start = pts[0] ?? [0, 0];
      const end = pts[pts.length - 1] ?? [el.width, el.height];

      const hitLine = document.createElementNS(SVG_NS, 'line');
      hitLine.setAttribute('x1', String(start[0]));
      hitLine.setAttribute('y1', String(start[1]));
      hitLine.setAttribute('x2', String(end[0]));
      hitLine.setAttribute('y2', String(end[1]));
      hitLine.classList.add('lc-wb-hit-stroke');
      childNodes.push(hitLine);

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(start[0]));
      line.setAttribute('y1', String(start[1]));
      line.setAttribute('x2', String(end[0]));
      line.setAttribute('y2', String(end[1]));
      line.setAttribute('marker-end', `url(#${uid}-arrow-${el.color})`);
      line.classList.add('lc-wb-arrow-line');
      line.dataset.color = el.color;
      childNodes.push(line);
    } else if (el.type === 'path') {
      const d = pointsToPathD(
        el.points ?? [
          [0, 0],
          [el.width, el.height],
        ],
      );
      const hitPath = document.createElementNS(SVG_NS, 'path');
      hitPath.setAttribute('d', d);
      hitPath.classList.add('lc-wb-hit-stroke');
      childNodes.push(hitPath);

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.classList.add('lc-wb-freehand');
      path.dataset.color = el.color;
      childNodes.push(path);
    } else if (el.type === 'text') {
      const hitRect = document.createElementNS(SVG_NS, 'rect');
      hitRect.setAttribute('x', '0');
      hitRect.setAttribute('y', '0');
      hitRect.setAttribute('width', String(el.width));
      hitRect.setAttribute('height', String(el.height));
      hitRect.setAttribute('rx', '4');
      hitRect.classList.add('lc-wb-text-bg');
      childNodes.push(hitRect);
    } else if (el.type === 'image') {
      const frame = document.createElementNS(SVG_NS, 'rect');
      frame.setAttribute('x', '0');
      frame.setAttribute('y', '0');
      frame.setAttribute('width', String(el.width));
      frame.setAttribute('height', String(el.height));
      frame.setAttribute('rx', '6');
      frame.classList.add('lc-wb-image-frame');
      childNodes.push(frame);

      const svgImg = document.createElementNS(SVG_NS, 'image');
      svgImg.setAttribute('x', '0');
      svgImg.setAttribute('y', '0');
      svgImg.setAttribute('width', String(el.width));
      svgImg.setAttribute('height', String(el.height));
      svgImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      if (el.assetId) {
        svgImg.dataset.assetId = el.assetId;
        const cached = resolvedUrlCache.get(el.assetId);
        if (cached) {
          svgImg.setAttribute('href', cached);
        } else {
          void resolveAssetUrl(el.assetId).then((url) => {
            if (url && !destroyed) {
              resolvedUrlCache.set(/** @type {string} */ (el.assetId), url);
              svgImg.setAttribute('href', url);
            }
          });
        }
      }
      childNodes.push(svgImg);
    }

    if (supportsText(el.type) && el.text) {
      const lines = wrapTextLines(el.text, el.width);
      if (lines.length > 0) {
        const textNode = document.createElementNS(SVG_NS, 'text');
        textNode.classList.add('lc-wb-el-text');
        textNode.dataset.color = el.color;
        const lineHeight = 18;
        const startY =
          el.type === 'text'
            ? 22
            : Math.max(24, el.height / 2 - ((lines.length - 1) * lineHeight) / 2);
        const anchorX = el.type === 'text' ? 8 : el.width / 2;
        if (el.type !== 'text') {
          textNode.setAttribute('text-anchor', 'middle');
        }
        lines.forEach((lineText, idx) => {
          const tspan = document.createElementNS(SVG_NS, 'tspan');
          tspan.setAttribute('x', String(anchorX));
          tspan.setAttribute('y', String(startY + idx * lineHeight));
          tspan.textContent = lineText || ' ';
          textNode.append(tspan);
        });
        childNodes.push(textNode);
      }
    }

    if (isSelected) {
      const selBox = document.createElementNS(SVG_NS, 'rect');
      selBox.setAttribute('x', '-3');
      selBox.setAttribute('y', '-3');
      selBox.setAttribute('width', String(Math.max(8, el.width + 6)));
      selBox.setAttribute('height', String(Math.max(8, el.height + 6)));
      selBox.setAttribute('rx', '6');
      selBox.classList.add('lc-wb-selection-ring');
      childNodes.push(selBox);

      if (el.type === 'arrow' && editable && selectedIds.size === 1) {
        const pts =
          el.points && el.points.length >= 2
            ? el.points
            : [
                [0, el.height / 2],
                [el.width, el.height / 2],
              ];
        const pStart = pts[0] ?? [0, 0];
        const pEnd = pts[pts.length - 1] ?? [el.width, el.height];

        for (const [which, pt] of /** @type {const} */ ([
          ['start', pStart],
          ['end', pEnd],
        ])) {
          const handle = document.createElementNS(SVG_NS, 'circle');
          handle.setAttribute('cx', String(pt[0]));
          handle.setAttribute('cy', String(pt[1]));
          handle.setAttribute('r', '6');
          handle.setAttribute('aria-hidden', 'true');
          handle.classList.add('lc-wb-arrow-handle');
          handle.dataset.wbArrowHandle = which;
          childNodes.push(handle);
        }
      }
    }

    g.replaceChildren(...childNodes);
  }

  /**
   * Render or update all SVG element groups in zIndex order while preserving DOM focus.
   */
  function renderElements() {
    const activeEl = document.activeElement;
    const focusedId =
      activeEl instanceof Element && activeEl.closest('.lc-wb-svg') === svg
        ? (/** @type {HTMLElement | SVGElement} */ (activeEl).dataset.elId ?? null)
        : null;
    const ordered = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const activeIds = new Set(ordered.map((el) => el.id));

    for (const [id, oldGroup] of renderedGroups) {
      if (!activeIds.has(id)) {
        oldGroup.remove();
        renderedGroups.delete(id);
      }
    }

    ordered.forEach((el, idx) => {
      let g = renderedGroups.get(el.id);
      if (!g) {
        g = /** @type {SVGGElement} */ (document.createElementNS(SVG_NS, 'g'));
        g.classList.add('lc-wb-el');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'group');
        wireElementGroupEvents(g, el.id);
        renderedGroups.set(el.id, g);
      }
      populateElementGroup(g, el, selectedIds.has(el.id));
      const currentAtIdx = elementsLayer.children[idx] ?? null;
      if (currentAtIdx !== g) {
        elementsLayer.insertBefore(g, currentAtIdx);
      }
    });

    if (focusedId && (selectedIds.size === 0 || selectedIds.has(focusedId))) {
      const focusedGroup = renderedGroups.get(focusedId);
      if (focusedGroup && document.activeElement !== focusedGroup) {
        handlingElementPointer = true;
        focusedGroup.focus({ preventScroll: true });
        handlingElementPointer = false;
      }
    }
  }

  /**
   * Update active selection set and repaint selection rings without losing focus.
   * @param {Iterable<string>} nextIdsIterable
   * @param {string | null} [nextPrimary]
   */
  function setSelection(nextIdsIterable, nextPrimary = null) {
    const validIds = new Set(elements.map((el) => el.id));
    const nextSet = new Set();
    for (const id of nextIdsIterable) {
      if (validIds.has(id)) nextSet.add(id);
    }
    const resolvedPrimary =
      nextPrimary && nextSet.has(nextPrimary)
        ? nextPrimary
        : (nextSet.values().next().value ?? null);

    const sameSet =
      nextSet.size === selectedIds.size && [...nextSet].every((id) => selectedIds.has(id));
    if (sameSet && resolvedPrimary === primarySelectedId) {
      syncToolbarState();
      return;
    }

    selectedIds = nextSet;
    primarySelectedId = resolvedPrimary;
    for (const el of elements) {
      const g = renderedGroups.get(el.id);
      if (g) populateElementGroup(g, el, selectedIds.has(el.id));
    }
    syncToolbarState();
  }

  /**
   * Open the accessible inline text editor for a given element.
   * @param {WhiteboardElement} el
   */
  function openTextEditor(el) {
    if (!editable || !supportsText(el.type)) return;
    editingTextElementId = el.id;
    textEditorInput.value = el.text ?? '';
    textEditorBar.hidden = false;
    textEditorInput.focus();
    textEditorInput.select();
  }

  /**
   * Close the inline text editor, optionally saving changes.
   * @param {boolean} save
   */
  function closeTextEditor(save) {
    const targetId = editingTextElementId;
    editingTextElementId = null;
    textEditorBar.hidden = true;
    if (save && targetId) {
      const nextText = textEditorInput.value.slice(0, 500);
      commitElements(elements.map((el) => (el.id === targetId ? { ...el, text: nextText } : el)));
      announce('Texte de l’élément mis à jour');
    }
    if (targetId) {
      renderedGroups.get(targetId)?.focus({ preventScroll: true });
    }
  }

  textApplyBtn.addEventListener('click', () => closeTextEditor(true));
  textCancelBtn.addEventListener('click', () => closeTextEditor(false));
  textEditorInput.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      closeTextEditor(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeTextEditor(false);
    }
  });

  /**
   * Scale normalized points when resizing an arrow or freehand path.
   * @param {WhiteboardElement} el
   * @param {number} nextW
   * @param {number} nextH
   * @returns {WhiteboardElement}
   */
  function resizeElement(el, nextW, nextH) {
    const minDim = 16;
    const clampedW = clamp(Math.round(nextW), minDim, 4000);
    const clampedH = clamp(Math.round(nextH), minDim, 4000);
    if (el.points && el.points.length > 0) {
      const sx = el.width > 0 ? clampedW / el.width : 1;
      const sy = el.height > 0 ? clampedH / el.height : 1;
      return {
        ...el,
        width: clampedW,
        height: clampedH,
        points: el.points.map((pt) => [
          Math.round(pt[0] * sx * 10) / 10,
          Math.round(pt[1] * sy * 10) / 10,
        ]),
      };
    }
    return {
      ...el,
      width: clampedW,
      height: clampedH,
    };
  }

  /**
   * Append visual snap indicator nodes (target highlight + anchor dot) to draftLayer.
   * @param {{ binding: ArrowEndpointBinding; point: { x: number; y: number }; target: WhiteboardElement } | null} snap
   * @param {{ x: number; y: number }} [overridePoint]
   * @returns {SVGElement[]}
   */
  function buildSnapIndicatorNodes(snap, overridePoint) {
    if (!snap) return [];
    const pt = overridePoint ?? snap.point;
    const ring = document.createElementNS(SVG_NS, 'rect');
    ring.setAttribute('x', String(snap.target.x - 4));
    ring.setAttribute('y', String(snap.target.y - 4));
    ring.setAttribute('width', String(snap.target.width + 8));
    ring.setAttribute('height', String(snap.target.height + 8));
    ring.setAttribute('rx', '8');
    ring.classList.add('lc-wb-snap-ring');

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(pt.x));
    dot.setAttribute('cy', String(pt.y));
    dot.setAttribute('r', '7');
    dot.classList.add('lc-wb-snap-dot');
    return [ring, dot];
  }

  // Track pointer interactions on elements and stage
  /** @type {{ mode: 'drag-el'; elId: string; pointerId: number; startWorldX: number; startWorldY: number; origPositions: Map<string, { x: number; y: number }>; collapseOnClick: boolean; moved: boolean } | { mode: 'drag-arrow-handle'; elId: string; which: 'start' | 'end'; pointerId: number; startPt: { x: number; y: number }; endPt: { x: number; y: number }; startBinding?: ArrowEndpointBinding; endBinding?: ArrowEndpointBinding; moved: boolean } | { mode: 'pan'; pointerId: number; startClientX: number; startClientY: number; origPanX: number; origPanY: number } | { mode: 'marquee'; pointerId: number; startWorldX: number; startWorldY: number; curWorldX: number; curWorldY: number } | { mode: 'draw-shape'; tool: WhiteboardElementType; pointerId: number; startWorldX: number; startWorldY: number; curWorldX: number; curWorldY: number } | { mode: 'draw-path'; pointerId: number; pts: Array<[number, number]> } | null} */
  let pointerState = null;

  /**
   * Wire focus, keyboard, double-click, and drag interactions for a single element `<g>`.
   * @param {SVGGElement} g
   * @param {string} elId
   */
  function wireElementGroupEvents(g, elId) {
    g.addEventListener('focus', () => {
      if (handlingElementPointer) return;
      if (!selectedIds.has(elId)) {
        setSelection([elId], elId);
      } else {
        primarySelectedId = elId;
        syncToolbarState();
      }
    });

    g.addEventListener('dblclick', (e) => {
      if (!editable || activeTool !== 'select') return;
      e.stopPropagation();
      const target = elements.find((el) => el.id === elId);
      if (target && supportsText(target.type)) {
        openTextEditor(target);
      }
    });

    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (!editable || activeTool !== 'select') return;
      e.stopPropagation();

      if (e.shiftKey) {
        const next = new Set(selectedIds);
        if (next.has(elId)) {
          next.delete(elId);
        } else {
          next.add(elId);
        }
        handlingElementPointer = true;
        setSelection(next, next.has(elId) ? elId : null);
        g.focus({ preventScroll: true });
        handlingElementPointer = false;
        announce(`${next.size} élément(s) sélectionné(s)`);
        return;
      }

      const wasInMulti = selectedIds.size > 1 && selectedIds.has(elId);
      handlingElementPointer = true;
      if (!wasInMulti) {
        setSelection([elId], elId);
      } else {
        primarySelectedId = elId;
        syncToolbarState();
      }
      g.focus({ preventScroll: true });
      handlingElementPointer = false;

      const target = elements.find((el) => el.id === elId);
      if (!target) return;

      const handleEl =
        e.target instanceof Element ? e.target.closest('[data-wb-arrow-handle]') : null;
      const handleWhich = handleEl?.getAttribute('data-wb-arrow-handle');
      if (target.type === 'arrow' && (handleWhich === 'start' || handleWhich === 'end')) {
        const [p1, p2] = getArrowWorldEndpoints(target);
        pointerState = {
          mode: 'drag-arrow-handle',
          elId,
          which: handleWhich,
          pointerId: e.pointerId,
          startPt: p1,
          endPt: p2,
          ...(target.startBinding ? { startBinding: target.startBinding } : {}),
          ...(target.endBinding ? { endBinding: target.endBinding } : {}),
          moved: false,
        };
        try {
          g.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if unavailable.
        }
        return;
      }

      const world = clientToWorld(e.clientX, e.clientY);
      /** @type {Map<string, { x: number; y: number }>} */
      const origPositions = new Map();
      for (const item of elements) {
        if (selectedIds.has(item.id) || item.id === elId) {
          origPositions.set(item.id, { x: item.x, y: item.y });
        }
      }

      pointerState = {
        mode: 'drag-el',
        elId,
        pointerId: e.pointerId,
        startWorldX: world.x,
        startWorldY: world.y,
        origPositions,
        collapseOnClick: wasInMulti,
        moved: false,
      };
      try {
        g.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable in synthetic tests.
      }
    });

    g.addEventListener('pointermove', (e) => {
      if (
        !pointerState ||
        (pointerState.mode !== 'drag-el' && pointerState.mode !== 'drag-arrow-handle') ||
        pointerState.elId !== elId ||
        pointerState.pointerId !== e.pointerId
      ) {
        return;
      }
      if (pointerState.mode === 'drag-arrow-handle') {
        pointerState.moved = true;
        const world = clientToWorld(e.clientX, e.clientY);
        const exclude = new Set([elId]);
        const snap = findArrowSnapTarget(elements, world, { excludeIds: exclude });
        const freePt = snapPointToGrid(world, GRID_SIZE, snapToGrid);
        if (pointerState.which === 'start') {
          pointerState.startPt = snap ? snap.point : freePt;
          pointerState.startBinding = snap ? snap.binding : undefined;
        } else {
          pointerState.endPt = snap ? snap.point : freePt;
          pointerState.endBinding = snap ? snap.binding : undefined;
        }
        const current = elements.find((el) => el.id === elId);
        const groupEl = renderedGroups.get(elId);
        if (current && groupEl) {
          const geom = buildArrowGeometry(pointerState.startPt, pointerState.endPt);
          const { startBinding: _sb, endBinding: _eb, ...rest } = current;
          /** @type {WhiteboardElement} */
          const previewArrow = {
            ...rest,
            x: geom.x,
            y: geom.y,
            width: geom.width,
            height: geom.height,
            points: geom.points,
            ...(pointerState.startBinding ? { startBinding: pointerState.startBinding } : {}),
            ...(pointerState.endBinding ? { endBinding: pointerState.endBinding } : {}),
          };
          populateElementGroup(groupEl, previewArrow, selectedIds.has(elId));
        }
        draftLayer.replaceChildren(...buildSnapIndicatorNodes(snap));
        return;
      }

      if (pointerState.mode !== 'drag-el') {
        return;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      const dx = world.x - pointerState.startWorldX;
      const dy = world.y - pointerState.startWorldY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        pointerState.moved = true;
      }
      const { origPositions } = pointerState;
      const origPrimary = origPositions.get(elId);
      const appliedDx =
        snapToGrid && origPrimary
          ? clamp(snapValueToGrid(origPrimary.x + dx, GRID_SIZE, true), -10000, 10000) -
            origPrimary.x
          : dx;
      const appliedDy =
        snapToGrid && origPrimary
          ? clamp(snapValueToGrid(origPrimary.y + dy, GRID_SIZE, true), -10000, 10000) -
            origPrimary.y
          : dy;
      const movedIds = new Set(origPositions.keys());
      const liveSnapshot = elements.map((el) => {
        const orig = origPositions.get(el.id);
        if (!orig) return el;
        return {
          ...el,
          x: Math.round(clamp(orig.x + appliedDx, -10000, 10000)),
          y: Math.round(clamp(orig.y + appliedDy, -10000, 10000)),
        };
      });
      const detachedSnapshot = detachUnfollowedArrowBindings(liveSnapshot, movedIds);
      const liveRecomputed = recomputeBoundArrows(detachedSnapshot);

      for (const updated of liveRecomputed) {
        const groupEl = renderedGroups.get(updated.id);
        if (!groupEl) continue;
        if (origPositions.has(updated.id)) {
          groupEl.setAttribute('transform', `translate(${updated.x} ${updated.y})`);
          groupEl.dataset.x = String(updated.x);
          groupEl.dataset.y = String(updated.y);
          groupEl.setAttribute('aria-label', describeElement(updated));
        } else if (updated.type === 'arrow' && (updated.startBinding || updated.endBinding)) {
          populateElementGroup(groupEl, updated, selectedIds.has(updated.id));
        }
      }
    });

    const finishDrag = (/** @type {PointerEvent} */ e) => {
      if (
        !pointerState ||
        (pointerState.mode !== 'drag-el' && pointerState.mode !== 'drag-arrow-handle') ||
        pointerState.elId !== elId ||
        pointerState.pointerId !== e.pointerId
      ) {
        return;
      }
      if (pointerState.mode === 'drag-arrow-handle') {
        const state = pointerState;
        pointerState = null;
        draftLayer.replaceChildren();
        if (!state.moved) return;
        const geom = buildArrowGeometry(state.startPt, state.endPt);
        commitElements(
          elements.map((el) => {
            if (el.id !== elId) return el;
            const { startBinding: _sb, endBinding: _eb, ...rest } = el;
            return {
              ...rest,
              x: geom.x,
              y: geom.y,
              width: geom.width,
              height: geom.height,
              points: geom.points,
              ...(state.startBinding ? { startBinding: state.startBinding } : {}),
              ...(state.endBinding ? { endBinding: state.endBinding } : {}),
            };
          }),
        );
        const hasSnap = Boolean(state.startBinding || state.endBinding);
        announce(hasSnap ? 'Extrémité de flèche aimantée' : 'Extrémité de flèche déplacée');
        return;
      }

      if (pointerState.mode !== 'drag-el') {
        return;
      }
      const world = clientToWorld(e.clientX, e.clientY);
      const dx = world.x - pointerState.startWorldX;
      const dy = world.y - pointerState.startWorldY;
      const { moved, origPositions, collapseOnClick } = pointerState;
      pointerState = null;

      if (!moved) {
        if (collapseOnClick) {
          setSelection([elId], elId);
        }
        return;
      }

      const origPrimary = origPositions.get(elId);
      const appliedDx =
        snapToGrid && origPrimary
          ? clamp(snapValueToGrid(origPrimary.x + dx, GRID_SIZE, true), -10000, 10000) -
            origPrimary.x
          : dx;
      const appliedDy =
        snapToGrid && origPrimary
          ? clamp(snapValueToGrid(origPrimary.y + dy, GRID_SIZE, true), -10000, 10000) -
            origPrimary.y
          : dy;
      const movedIds = new Set(origPositions.keys());
      const movedElements = elements.map((el) => {
        const orig = origPositions.get(el.id);
        if (!orig) return el;
        return {
          ...el,
          x: Math.round(clamp(orig.x + appliedDx, -10000, 10000)),
          y: Math.round(clamp(orig.y + appliedDy, -10000, 10000)),
        };
      });
      commitElements(detachUnfollowedArrowBindings(movedElements, movedIds));
      if (origPositions.size > 1) {
        announce(`${origPositions.size} éléments déplacés`);
      } else {
        const nextX = origPrimary ? Math.round(clamp(origPrimary.x + appliedDx, -10000, 10000)) : 0;
        const nextY = origPrimary ? Math.round(clamp(origPrimary.y + appliedDy, -10000, 10000)) : 0;
        announce(`Élément déplacé à ${nextX}, ${nextY}`);
      }
    };

    g.addEventListener('pointerup', finishDrag);
    g.addEventListener('lostpointercapture', () => {
      if (
        (pointerState?.mode === 'drag-el' || pointerState?.mode === 'drag-arrow-handle') &&
        pointerState.elId === elId
      ) {
        pointerState = null;
        draftLayer.replaceChildren();
        renderElements();
      }
    });

    g.addEventListener('keydown', (e) => {
      if (!editable) return;
      const target = elements.find((el) => el.id === elId);
      if (!target) return;

      if (e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const next = new Set(selectedIds);
        if (next.has(elId)) {
          next.delete(elId);
        } else {
          next.add(elId);
        }
        setSelection(next, next.has(elId) ? elId : null);
        announce(`${next.size} élément(s) sélectionné(s)`);
        return;
      }

      const step = e.shiftKey ? 1 : 10;
      if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        e.preventDefault();
        e.stopPropagation();

        const useSnap = snapToGrid && !e.shiftKey;
        if (e.altKey) {
          let nextW = target.width;
          let nextH = target.height;
          if (useSnap) {
            if (e.key === 'ArrowRight') {
              nextW = stepValueWithGrid(target.width, 1, {
                gridSize: GRID_SIZE,
                snapEnabled: true,
              });
            }
            if (e.key === 'ArrowLeft') {
              nextW = stepValueWithGrid(target.width, -1, {
                gridSize: GRID_SIZE,
                snapEnabled: true,
              });
            }
            if (e.key === 'ArrowDown') {
              nextH = stepValueWithGrid(target.height, 1, {
                gridSize: GRID_SIZE,
                snapEnabled: true,
              });
            }
            if (e.key === 'ArrowUp') {
              nextH = stepValueWithGrid(target.height, -1, {
                gridSize: GRID_SIZE,
                snapEnabled: true,
              });
            }
            nextW = Math.max(GRID_SIZE, nextW);
            nextH = Math.max(GRID_SIZE, nextH);
          } else {
            if (e.key === 'ArrowRight') nextW += step;
            if (e.key === 'ArrowLeft') nextW -= step;
            if (e.key === 'ArrowDown') nextH += step;
            if (e.key === 'ArrowUp') nextH -= step;
          }
          const resized = resizeElement(target, nextW, nextH);
          commitElements(elements.map((el) => (el.id === elId ? resized : el)));
          announce(`Taille ${Math.round(resized.width)} par ${Math.round(resized.height)}`);
          return;
        }

        const dx = useSnap
          ? e.key === 'ArrowRight'
            ? stepValueWithGrid(target.x, 1, { gridSize: GRID_SIZE, snapEnabled: true }) - target.x
            : e.key === 'ArrowLeft'
              ? stepValueWithGrid(target.x, -1, { gridSize: GRID_SIZE, snapEnabled: true }) -
                target.x
              : 0
          : e.key === 'ArrowRight'
            ? step
            : e.key === 'ArrowLeft'
              ? -step
              : 0;
        const dy = useSnap
          ? e.key === 'ArrowDown'
            ? stepValueWithGrid(target.y, 1, { gridSize: GRID_SIZE, snapEnabled: true }) - target.y
            : e.key === 'ArrowUp'
              ? stepValueWithGrid(target.y, -1, { gridSize: GRID_SIZE, snapEnabled: true }) -
                target.y
              : 0
          : e.key === 'ArrowDown'
            ? step
            : e.key === 'ArrowUp'
              ? -step
              : 0;
        const moveIds = selectedIds.has(elId) ? selectedIds : new Set([elId]);
        const movedElements = elements.map((el) =>
          moveIds.has(el.id)
            ? {
                ...el,
                x: clamp(Math.round(el.x + dx), -10000, 10000),
                y: clamp(Math.round(el.y + dy), -10000, 10000),
              }
            : el,
        );
        commitElements(detachUnfollowedArrowBindings(movedElements, moveIds));
        if (moveIds.size > 1) {
          announce(`${moveIds.size} éléments déplacés`);
        } else {
          announce(
            `Position ${clamp(Math.round(target.x + dx), -10000, 10000)}, ${clamp(Math.round(target.y + dy), -10000, 10000)}`,
          );
        }
        return;
      }

      if (e.key === 'Enter' || e.key === 'F2') {
        if (supportsText(target.type)) {
          e.preventDefault();
          e.stopPropagation();
          openTextEditor(target);
        }
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        stepSelectedLayer(1);
        return;
      }

      if (e.key === 'PageDown') {
        e.preventDefault();
        e.stopPropagation();
        stepSelectedLayer(-1);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedIds.has(elId)) {
          setSelection([elId], elId);
        }
        deleteSelectedElements();
      }
    });
  }

  /**
   * Render temporary preview geometry while drawing or marquee-selecting with pointer.
   */
  function renderDraftPreview() {
    if (!pointerState) {
      draftLayer.replaceChildren();
      return;
    }
    if (pointerState.mode === 'marquee') {
      const { startWorldX, startWorldY, curWorldX, curWorldY } = pointerState;
      const x = Math.min(startWorldX, curWorldX);
      const y = Math.min(startWorldY, curWorldY);
      const w = Math.abs(curWorldX - startWorldX);
      const h = Math.abs(curWorldY - startWorldY);
      const box = document.createElementNS(SVG_NS, 'rect');
      box.setAttribute('x', String(x));
      box.setAttribute('y', String(y));
      box.setAttribute('width', String(Math.max(2, w)));
      box.setAttribute('height', String(Math.max(2, h)));
      box.setAttribute('rx', '4');
      box.classList.add('lc-wb-marquee');
      draftLayer.replaceChildren(box);
      return;
    }
    if (pointerState.mode === 'draw-shape') {
      const { tool, startWorldX, startWorldY, curWorldX, curWorldY } = pointerState;
      const sx = snapValueToGrid(startWorldX, GRID_SIZE, snapToGrid);
      const sy = snapValueToGrid(startWorldY, GRID_SIZE, snapToGrid);
      const cx = snapValueToGrid(curWorldX, GRID_SIZE, snapToGrid);
      const cy = snapValueToGrid(curWorldY, GRID_SIZE, snapToGrid);
      const x = Math.min(sx, cx);
      const y = Math.min(sy, cy);
      const w = Math.abs(cx - sx);
      const h = Math.abs(cy - sy);
      if (tool === 'arrow') {
        const startSnap = findArrowSnapTarget(elements, { x: startWorldX, y: startWorldY });
        const endSnap = findArrowSnapTarget(elements, { x: curWorldX, y: curWorldY });
        const refP1 = startSnap
          ? startSnap.point
          : snapPointToGrid({ x: startWorldX, y: startWorldY }, GRID_SIZE, snapToGrid);
        const refP2 = endSnap
          ? endSnap.point
          : snapPointToGrid({ x: curWorldX, y: curWorldY }, GRID_SIZE, snapToGrid);
        const p1 =
          startSnap && startSnap.binding.anchor === 'center'
            ? intersectRayWithElementBorder(startSnap.target, refP2)
            : refP1;
        const p2 =
          endSnap && endSnap.binding.anchor === 'center'
            ? intersectRayWithElementBorder(endSnap.target, refP1)
            : refP2;

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(p1.x));
        line.setAttribute('y1', String(p1.y));
        line.setAttribute('x2', String(p2.x));
        line.setAttribute('y2', String(p2.y));
        line.setAttribute('marker-end', `url(#${uid}-arrow-${activeColor})`);
        line.classList.add('lc-wb-arrow-line');
        line.dataset.color = activeColor;

        draftLayer.replaceChildren(
          ...buildSnapIndicatorNodes(startSnap, p1),
          ...buildSnapIndicatorNodes(endSnap, p2),
          line,
        );
      } else if (tool === 'ellipse') {
        const el = document.createElementNS(SVG_NS, 'ellipse');
        el.setAttribute('cx', String(x + w / 2));
        el.setAttribute('cy', String(y + h / 2));
        el.setAttribute('rx', String(Math.max(4, w / 2)));
        el.setAttribute('ry', String(Math.max(4, h / 2)));
        el.classList.add('lc-wb-shape', 'lc-wb-ellipse');
        el.dataset.color = activeColor;
        if (activeTransparentBg) el.dataset.transparent = 'true';
        draftLayer.replaceChildren(el);
      } else {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(Math.max(8, w)));
        rect.setAttribute('height', String(Math.max(8, h)));
        rect.setAttribute('rx', '6');
        rect.classList.add('lc-wb-shape', 'lc-wb-rect');
        rect.dataset.color = activeColor;
        if (activeTransparentBg && whiteboardElementSupportsBackground(tool)) {
          rect.dataset.transparent = 'true';
        }
        draftLayer.replaceChildren(rect);
      }
    } else if (pointerState.mode === 'draw-path') {
      const d = pointsToPathD(pointerState.pts);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.classList.add('lc-wb-freehand');
      path.dataset.color = activeColor;
      draftLayer.replaceChildren(path);
    }
  }

  // Stage pointer handlers (pan, marquee select, click-to-create, drag-to-size, freehand draw)
  svg.addEventListener('pointerdown', (e) => {
    const isMiddle = e.button === 1;
    if (e.button !== 0 && !isMiddle) return;

    if (
      !isMiddle &&
      editable &&
      (activeTool === 'marquee' || (activeTool === 'select' && e.shiftKey))
    ) {
      const world = clientToWorld(e.clientX, e.clientY);
      pointerState = {
        mode: 'marquee',
        pointerId: e.pointerId,
        startWorldX: world.x,
        startWorldY: world.y,
        curWorldX: world.x,
        curWorldY: world.y,
      };
      renderDraftPreview();
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if unavailable.
      }
      return;
    }

    if (isMiddle || !editable || activeTool === 'select') {
      setSelection([], null);
      pointerState = {
        mode: 'pan',
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: viewport.panX,
        origPanY: viewport.panY,
      };
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if unavailable.
      }
      return;
    }

    const drawTool = /** @type {WhiteboardElementType} */ (activeTool);
    const world = clientToWorld(e.clientX, e.clientY);
    if (drawTool === 'path') {
      pointerState = {
        mode: 'draw-path',
        pointerId: e.pointerId,
        pts: [[world.x, world.y]],
      };
    } else {
      pointerState = {
        mode: 'draw-shape',
        tool: drawTool,
        pointerId: e.pointerId,
        startWorldX: world.x,
        startWorldY: world.y,
        curWorldX: world.x,
        curWorldY: world.y,
      };
    }
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if unavailable.
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (!pointerState || pointerState.pointerId !== e.pointerId) return;
    if (pointerState.mode === 'pan') {
      const dx = e.clientX - pointerState.startClientX;
      const dy = e.clientY - pointerState.startClientY;
      setViewport(
        {
          panX: pointerState.origPanX + dx,
          panY: pointerState.origPanY + dy,
          zoom: viewport.zoom,
        },
        false,
      );
      return;
    }
    const world = clientToWorld(e.clientX, e.clientY);
    if (pointerState.mode === 'marquee' || pointerState.mode === 'draw-shape') {
      pointerState.curWorldX = world.x;
      pointerState.curWorldY = world.y;
      renderDraftPreview();
    } else if (pointerState.mode === 'draw-path') {
      const prev = pointerState.pts[pointerState.pts.length - 1];
      if (!prev || Math.hypot(world.x - prev[0], world.y - prev[1]) >= 3) {
        if (pointerState.pts.length < 2000) {
          pointerState.pts.push([world.x, world.y]);
        }
        renderDraftPreview();
      }
    }
  });

  /** @param {PointerEvent} e */
  function finishStagePointer(e) {
    if (!pointerState || pointerState.pointerId !== e.pointerId) return;
    const state = pointerState;
    pointerState = null;
    draftLayer.replaceChildren();

    if (state.mode === 'pan') {
      emitChange();
      return;
    }

    if (state.mode === 'marquee') {
      const x = Math.min(state.startWorldX, state.curWorldX);
      const y = Math.min(state.startWorldY, state.curWorldY);
      const width = Math.abs(state.curWorldX - state.startWorldX);
      const height = Math.abs(state.curWorldY - state.startWorldY);
      const hitIds = selectElementsInMarquee(elements, { x, y, width, height });
      setSelection(hitIds, hitIds[0] ?? null);
      if (activeTool === 'marquee') {
        setActiveTool('select');
      }
      if (hitIds[0]) {
        renderedGroups.get(hitIds[0])?.focus({ preventScroll: true });
      }
      announce(`${hitIds.length} élément(s) sélectionné(s)`);
      return;
    }

    if (state.mode === 'draw-shape') {
      const dx = state.curWorldX - state.startWorldX;
      const dy = state.curWorldY - state.startWorldY;
      const dist = Math.hypot(dx, dy);

      /** @type {WhiteboardElement} */
      let created;
      if (dist < 10) {
        // Single-click without drag creates a well-sized default element (WCAG 2.5.7)
        created = buildDefaultElement(state.tool, state.startWorldX, state.startWorldY);
      } else if (state.tool === 'arrow') {
        const startSnap = findArrowSnapTarget(elements, {
          x: state.startWorldX,
          y: state.startWorldY,
        });
        const endSnap = findArrowSnapTarget(elements, {
          x: state.curWorldX,
          y: state.curWorldY,
        });
        const refP1 = startSnap
          ? startSnap.point
          : snapPointToGrid({ x: state.startWorldX, y: state.startWorldY }, GRID_SIZE, snapToGrid);
        const refP2 = endSnap
          ? endSnap.point
          : snapPointToGrid({ x: state.curWorldX, y: state.curWorldY }, GRID_SIZE, snapToGrid);
        const p1 =
          startSnap && startSnap.binding.anchor === 'center'
            ? intersectRayWithElementBorder(startSnap.target, refP2)
            : refP1;
        const p2 =
          endSnap && endSnap.binding.anchor === 'center'
            ? intersectRayWithElementBorder(endSnap.target, refP1)
            : refP2;
        const geom = buildArrowGeometry(p1, p2);
        created = {
          id: crypto.randomUUID(),
          type: 'arrow',
          x: geom.x,
          y: geom.y,
          width: geom.width,
          height: geom.height,
          color: activeColor,
          points: geom.points,
          ...(startSnap ? { startBinding: startSnap.binding } : {}),
          ...(endSnap ? { endBinding: endSnap.binding } : {}),
          zIndex: nextZIndex(),
        };
      } else {
        const sx = snapValueToGrid(state.startWorldX, GRID_SIZE, snapToGrid);
        const sy = snapValueToGrid(state.startWorldY, GRID_SIZE, snapToGrid);
        const cx = snapValueToGrid(state.curWorldX, GRID_SIZE, snapToGrid);
        const cy = snapValueToGrid(state.curWorldY, GRID_SIZE, snapToGrid);
        const minX = Math.min(sx, cx);
        const minY = Math.min(sy, cy);
        const rawW = Math.abs(cx - sx);
        const rawH = Math.abs(cy - sy);
        const minBox = snapToGrid ? GRID_SIZE : 24;
        created = {
          id: crypto.randomUUID(),
          type: state.tool,
          x: snapToGrid ? clamp(minX, -10000, 10000) : Math.round(minX),
          y: snapToGrid ? clamp(minY, -10000, 10000) : Math.round(minY),
          width: Math.max(
            minBox,
            snapToGrid ? snapValueToGrid(rawW, GRID_SIZE, true) : Math.round(rawW),
          ),
          height: Math.max(
            minBox,
            snapToGrid ? snapValueToGrid(rawH, GRID_SIZE, true) : Math.round(rawH),
          ),
          text: state.tool === 'sticky' ? 'Post-it' : state.tool === 'text' ? 'Texte' : '',
          color: activeColor,
          ...(activeTransparentBg && whiteboardElementSupportsBackground(state.tool)
            ? { transparentBg: true }
            : {}),
          zIndex: nextZIndex(),
        };
      }

      selectedIds = new Set();
      primarySelectedId = null;
      commitElements([...elements, created]);
      announce(`${TYPE_LABELS[created.type]} ajouté au tableau`);
      return;
    }

    if (state.mode === 'draw-path') {
      const pts = state.pts;
      if (pts.length < 2) {
        const created = buildDefaultElement('path', pts[0]?.[0] ?? 200, pts[0]?.[1] ?? 200);
        selectedIds = new Set();
        primarySelectedId = null;
        commitElements([...elements, created]);
        announce('Tracé libre ajouté au tableau');
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of pts) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] > maxY) maxY = pt[1];
      }
      const created = /** @type {WhiteboardElement} */ ({
        id: crypto.randomUUID(),
        type: 'path',
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.max(16, Math.round(maxX - minX)),
        height: Math.max(16, Math.round(maxY - minY)),
        color: activeColor,
        points: pts.map((pt) => [
          Math.round((pt[0] - minX) * 10) / 10,
          Math.round((pt[1] - minY) * 10) / 10,
        ]),
        zIndex: nextZIndex(),
      });
      selectedIds = new Set();
      primarySelectedId = null;
      commitElements([...elements, created]);
      announce('Tracé libre ajouté au tableau');
    }
  }

  svg.addEventListener('pointerup', finishStagePointer);
  svg.addEventListener('lostpointercapture', () => {
    if (
      pointerState &&
      pointerState.mode !== 'drag-el' &&
      pointerState.mode !== 'drag-arrow-handle'
    ) {
      pointerState = null;
      draftLayer.replaceChildren();
    }
  });

  // Wheel zoom with Ctrl/Meta
  svg.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.15 : -0.15;
      applyZoomDelta(step, e.clientX, e.clientY);
    },
    { passive: false },
  );

  /**
   * Handle uploading and placing one or more local image files.
   * @param {File[]} files
   */
  async function insertUploadedImages(files) {
    if (!editable) return;
    const center = getViewportCenterWorld();
    let offset = 0;
    /** @type {WhiteboardElement[]} */
    const added = [];
    for (const file of files) {
      const uploaded = await onUploadImage(file);
      if (!uploaded || destroyed) continue;
      const url = await resolveAssetUrl(uploaded.assetId);
      if (url) resolvedUrlCache.set(uploaded.assetId, url);
      const dims = url ? await measureImageUrl(url) : { width: 240, height: 180 };
      added.push({
        id: crypto.randomUUID(),
        type: 'image',
        x: clamp(
          snapValueToGrid(center.x - dims.width / 2 + offset, GRID_SIZE, snapToGrid),
          -10000,
          10000,
        ),
        y: clamp(
          snapValueToGrid(center.y - dims.height / 2 + offset, GRID_SIZE, snapToGrid),
          -10000,
          10000,
        ),
        width: dims.width,
        height: dims.height,
        text: uploaded.alt,
        color: 'neutral',
        assetId: uploaded.assetId,
        zIndex: nextZIndex() + added.length,
      });
      offset += 20;
    }
    if (added.length > 0) {
      const last = added[added.length - 1];
      if (last) {
        selectedIds = new Set([last.id]);
        primarySelectedId = last.id;
      }
      commitElements([...elements, ...added]);
      if (last) renderedGroups.get(last.id)?.focus({ preventScroll: true });
      announce(`${added.length} image(s) locale(s) ajoutée(s)`);
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    void insertUploadedImages([file]);
  });

  // Clipboard paste handler: allow local image files, block remote image URLs
  /** @param {ClipboardEvent} e */
  function handlePaste(e) {
    if (!editable) return;
    const dt = e.clipboardData;
    if (!dt) return;

    const files = [...dt.files].filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      e.preventDefault();
      void insertUploadedImages(files);
      return;
    }

    const html = dt.getData('text/html');
    const plain = dt.getData('text/plain').trim();
    const hasRemoteHtmlImg =
      /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\//i.test(html) ||
      /<img\b[^>]*\bsrc\s*=\s*["']?\s*data:/i.test(html);
    const isRemoteImageUrl = /^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i.test(plain);

    if (hasRemoteHtmlImg || isRemoteImageUrl) {
      e.preventDefault();
      onBlockedRemoteImage?.();
      announce('Image distante bloquée');
    }
  }

  root.addEventListener('paste', handlePaste);

  // Local image drag & drop
  stage.addEventListener('dragover', (e) => {
    if (!editable) return;
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
    }
  });

  stage.addEventListener('drop', (e) => {
    if (!editable) return;
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = [...dt.files].filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    void insertUploadedImages(files);
  });

  // Container-level keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+D, Ctrl+A, Escape)
  root.addEventListener('keydown', (e) => {
    if (e.target === textEditorInput) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      if (!editable) return;
      e.preventDefault();
      duplicateSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      const allIds = elements.map((el) => el.id);
      setSelection(allIds, allIds[0] ?? null);
      announce(`${allIds.length} élément(s) sélectionné(s)`);
    } else if (e.key === 'Escape') {
      if (pointerState) {
        e.preventDefault();
        pointerState = null;
        draftLayer.replaceChildren();
        return;
      }
      if (maximized) {
        return;
      }
      if (editable && activeTool !== 'select') {
        setActiveTool('select');
        announce('Outil Sélectionner activé');
      } else if (selectedIds.size > 0) {
        setSelection([], null);
        announce('Sélection effacée');
      }
    }
  });

  /**
   * Build a self-contained standalone SVG XML string with resolved theme tokens and data URLs.
   * @returns {Promise<{ svgString: string; width: number; height: number }>}
   */
  async function buildStandaloneSvg() {
    const computed = getComputedStyle(root);
    /**
     * Resolve a CSS value or custom property reference (including chained var(--..., ...)).
     * @param {string} expr
     * @param {string} fallback
     * @param {number} [depth]
     * @returns {string}
     */
    const resolveCssExpr = (expr, fallback, depth = 0) => {
      const trimmed = expr.trim();
      if (!trimmed) return fallback;
      if (depth > 8) return fallback;
      const resolved = trimmed.replace(
        /var(s*(--[A-Za-z0-9_-]+)s*(?:,s*([^)]+))?)/g,
        (_m, varName, innerFallback) => {
          const propVal = computed.getPropertyValue(varName).trim();
          if (propVal) return resolveCssExpr(propVal, innerFallback || fallback, depth + 1);
          return innerFallback ? resolveCssExpr(innerFallback, fallback, depth + 1) : fallback;
        },
      );
      return resolved.trim() || fallback;
    };
    const readVar = (/** @type {string} */ name, /** @type {string} */ fallback) => {
      const val = computed.getPropertyValue(name).trim();
      return val ? resolveCssExpr(val, fallback) : fallback;
    };

    const bgColor = readVar('--cv-bg', '#fafafa');
    const fgColor = readVar('--cv-fg', '#18181b');
    const fontFamily = readVar('--cv-font-sans', 'sans-serif');

    /** @type {Record<WhiteboardColorToken, { fill: string; stroke: string; line: string; text: string }>} */
    const palette = {
      neutral: {
        fill: readVar(COLOR_TOKENS.neutral.fillVar, '#ffffff'),
        stroke: readVar(COLOR_TOKENS.neutral.strokeVar, '#d4d4d8'),
        line: readVar(COLOR_TOKENS.neutral.lineVar, fgColor),
        text: readVar(COLOR_TOKENS.neutral.textVar, fgColor),
      },
      accent: {
        fill: readVar(COLOR_TOKENS.accent.fillVar, '#fff7ed'),
        stroke: readVar(COLOR_TOKENS.accent.strokeVar, '#ea580c'),
        line: readVar(COLOR_TOKENS.accent.lineVar, '#ea580c'),
        text: readVar(COLOR_TOKENS.accent.textVar, fgColor),
      },
      success: {
        fill: readVar(COLOR_TOKENS.success.fillVar, '#f0fdf4'),
        stroke: readVar(COLOR_TOKENS.success.strokeVar, '#15803d'),
        line: readVar(COLOR_TOKENS.success.lineVar, '#15803d'),
        text: readVar(COLOR_TOKENS.success.textVar, fgColor),
      },
      warning: {
        fill: readVar(COLOR_TOKENS.warning.fillVar, '#fefce8'),
        stroke: readVar(COLOR_TOKENS.warning.strokeVar, '#a16207'),
        line: readVar(COLOR_TOKENS.warning.lineVar, '#a16207'),
        text: readVar(COLOR_TOKENS.warning.textVar, fgColor),
      },
      danger: {
        fill: readVar(COLOR_TOKENS.danger.fillVar, '#fdf2f8'),
        stroke: readVar(COLOR_TOKENS.danger.strokeVar, '#be123c'),
        line: readVar(COLOR_TOKENS.danger.lineVar, '#be123c'),
        text: readVar(COLOR_TOKENS.danger.textVar, fgColor),
      },
    };

    // Compute world bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of elements) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.width > maxX) maxX = el.x + el.width;
      if (el.y + el.height > maxY) maxY = el.y + el.height;
    }
    const pad = 32;
    const vbX = Number.isFinite(minX) ? Math.floor(minX - pad) : 0;
    const vbY = Number.isFinite(minY) ? Math.floor(minY - pad) : 0;
    const width = Number.isFinite(maxX) ? Math.max(320, Math.ceil(maxX - minX + pad * 2)) : 800;
    const height = Number.isFinite(maxY) ? Math.max(240, Math.ceil(maxY - minY + pad * 2)) : 600;

    // Resolve embedded images as self-contained data URLs (no external fetch)
    /** @type {Map<string, string>} */
    const embeddedImages = new Map();
    for (const el of elements) {
      if (el.type === 'image' && el.assetId && !embeddedImages.has(el.assetId)) {
        const blobUrl = resolvedUrlCache.get(el.assetId) ?? (await resolveAssetUrl(el.assetId));
        if (blobUrl) {
          resolvedUrlCache.set(el.assetId, blobUrl);
          const dataUrl = await blobUrlToDataUrl(blobUrl);
          if (dataUrl) embeddedImages.set(el.assetId, dataUrl);
        }
      }
    }

    const markersXml = WHITEBOARD_COLORS.map((colorToken) => {
      const c = palette[colorToken];
      return `<marker id="export-arrow-${colorToken}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="${escapeXml(c.line)}" /></marker>`;
    }).join('');

    const ordered = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const itemsXml = ordered
      .map((el) => {
        const c = palette[el.color];
        const parts = [];
        const fillColor = el.transparentBg ? 'none' : escapeXml(c.fill);
        if (el.type === 'sticky' || el.type === 'rect') {
          const rx = el.type === 'sticky' ? 8 : 6;
          parts.push(
            `<rect x="0" y="0" width="${el.width}" height="${el.height}" rx="${rx}" ry="${rx}" fill="${fillColor}" stroke="${escapeXml(c.stroke)}" stroke-width="2" />`,
          );
        } else if (el.type === 'ellipse') {
          parts.push(
            `<ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${fillColor}" stroke="${escapeXml(c.stroke)}" stroke-width="2" />`,
          );
        } else if (el.type === 'arrow') {
          const pts =
            el.points && el.points.length >= 2
              ? el.points
              : [
                  [0, el.height / 2],
                  [el.width, el.height / 2],
                ];
          const start = pts[0] ?? [0, 0];
          const end = pts[pts.length - 1] ?? [el.width, el.height];
          parts.push(
            `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="${escapeXml(c.line)}" stroke-width="2.5" stroke-linecap="round" marker-end="url(#export-arrow-${el.color})" />`,
          );
        } else if (el.type === 'path') {
          const d = pointsToPathD(
            el.points ?? [
              [0, 0],
              [el.width, el.height],
            ],
          );
          parts.push(
            `<path d="${escapeXml(d)}" fill="none" stroke="${escapeXml(c.line)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`,
          );
        } else if (el.type === 'image' && el.assetId) {
          const href = embeddedImages.get(el.assetId);
          if (href) {
            parts.push(
              `<image x="0" y="0" width="${el.width}" height="${el.height}" href="${escapeXml(href)}" preserveAspectRatio="xMidYMid meet" />`,
            );
          }
        }

        if (supportsText(el.type) && el.text) {
          const lines = wrapTextLines(el.text, el.width);
          if (lines.length > 0) {
            const lineHeight = 18;
            const startY =
              el.type === 'text'
                ? 22
                : Math.max(24, el.height / 2 - ((lines.length - 1) * lineHeight) / 2);
            const anchorX = el.type === 'text' ? 8 : el.width / 2;
            const anchorAttr = el.type === 'text' ? '' : ' text-anchor="middle"';
            const tspans = lines
              .map(
                (line, idx) =>
                  `<tspan x="${anchorX}" y="${startY + idx * lineHeight}">${escapeXml(line || ' ')}</tspan>`,
              )
              .join('');
            parts.push(
              `<text fill="${escapeXml(c.text)}" font-family="${escapeXml(fontFamily)}" font-size="14" font-weight="500"${anchorAttr}>${tspans}</text>`,
            );
          }
        }

        return `<g transform="translate(${el.x} ${el.y})">${parts.join('')}</g>`;
      })
      .join('');

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${width} ${height}" width="${width}" height="${height}"><defs>${markersXml}</defs><rect x="${vbX}" y="${vbY}" width="${width}" height="${height}" fill="${escapeXml(bgColor)}" />${itemsXml}</svg>`;
    return { svgString, width, height };
  }

  syncGridDisplay();
  setViewport(viewport, false);
  renderElements();
  syncToolbarState();

  return {
    getSnapshot() {
      return {
        viewport,
        elements: [...elements],
      };
    },

    async exportSvgBlob() {
      const { svgString } = await buildStandaloneSvg();
      return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    },

    async exportPngBlob() {
      const { svgString, width, height } = await buildStandaloneSvg();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const scale = Math.min(2, 4096 / Math.max(width, height, 1));
      const outW = Math.max(1, Math.round(width * scale));
      const outH = Math.max(1, Math.round(height * scale));
      try {
        const blob = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Impossible d’initialiser le contexte 2D.'));
              return;
            }
            ctx.drawImage(img, 0, 0, outW, outH);
            canvas.toBlob((png) => {
              if (png) {
                resolve(png);
              } else {
                reject(new Error('Échec de la génération PNG.'));
              }
            }, 'image/png');
          };
          img.onerror = () => reject(new Error('Impossible de rendre le SVG en PNG.'));
          img.src = svgUrl;
        });
        return /** @type {Blob} */ (blob);
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    },

    getRootElement() {
      return root;
    },

    setMaximized(next) {
      maximized = Boolean(next);
      if (!maximized && pointerState) {
        pointerState = null;
        draftLayer.replaceChildren();
      }
      syncToolbarState();
    },

    focusMaximizeButton() {
      maximizeBtn?.focus();
    },

    cancelActiveInteraction() {
      if (editingTextElementId !== null) {
        closeTextEditor(false);
        return true;
      }
      if (pointerState) {
        pointerState = null;
        draftLayer.replaceChildren();
        return true;
      }
      return false;
    },

    destroy() {
      destroyed = true;
      renderedGroups.clear();
      container.replaceChildren();
    },
  };
}

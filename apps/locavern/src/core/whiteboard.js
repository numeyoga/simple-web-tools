/** @import { ArrowEndpointBinding, ArrowSnapAnchor, WhiteboardElement, WhiteboardViewport } from '../types.d.ts' */

export const DEFAULT_WHITEBOARD_GRID_SIZE = 20;

/**
 * Clamp a numeric coordinate or dimension to bounds.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNum(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Snap a single coordinate or length value to the alignment grid when enabled.
 * @param {number} value
 * @param {number} [gridSize]
 * @param {boolean} [enabled]
 * @returns {number}
 */
export function snapValueToGrid(value, gridSize = DEFAULT_WHITEBOARD_GRID_SIZE, enabled = true) {
  if (!Number.isFinite(value)) return 0;
  if (!enabled || !Number.isFinite(gridSize) || gridSize <= 1) {
    const rounded = Math.round(value);
    return rounded === 0 ? 0 : rounded;
  }
  const snapped = Math.round(value / gridSize) * gridSize;
  return snapped === 0 ? 0 : snapped;
}

/**
 * Snap a 2D point to the alignment grid when enabled.
 * @param {{ x: number; y: number }} point
 * @param {number} [gridSize]
 * @param {boolean} [enabled]
 * @returns {{ x: number; y: number }}
 */
export function snapPointToGrid(point, gridSize = DEFAULT_WHITEBOARD_GRID_SIZE, enabled = true) {
  return {
    x: snapValueToGrid(point.x, gridSize, enabled),
    y: snapValueToGrid(point.y, gridSize, enabled),
  };
}

/**
 * Step a coordinate or dimension forward/backward, aligning to the next grid line when snap is enabled.
 * @param {number} value
 * @param {number} direction - Positive to step forward, negative to step backward
 * @param {{ gridSize?: number; snapEnabled?: boolean; fineStep?: number }} [opts]
 * @returns {number}
 */
export function stepValueWithGrid(value, direction, opts = {}) {
  const gridSize = opts.gridSize ?? DEFAULT_WHITEBOARD_GRID_SIZE;
  const snapEnabled = opts.snapEnabled ?? false;
  const fineStep = opts.fineStep ?? 10;
  if (direction === 0) return snapValueToGrid(value, gridSize, snapEnabled);
  if (!snapEnabled || !Number.isFinite(gridSize) || gridSize <= 1) {
    const next = Math.round(value + Math.sign(direction) * fineStep);
    return next === 0 ? 0 : next;
  }
  const raw =
    direction > 0
      ? Math.floor((value + 1e-6) / gridSize + 1) * gridSize
      : Math.ceil((value - 1e-6) / gridSize - 1) * gridSize;
  return raw === 0 ? 0 : raw;
}

/**
 * Return true if an element can act as an arrow snap target.
 * @param {WhiteboardElement} el
 * @returns {boolean}
 */
export function isArrowBindableShape(el) {
  return el.type !== 'arrow' && el.type !== 'path';
}

/**
 * Compute world coordinates of a named anchor on a whiteboard element.
 * @param {WhiteboardElement} el
 * @param {ArrowSnapAnchor} [anchor]
 * @returns {{ x: number; y: number }}
 */
export function getShapeAnchorPoint(el, anchor = 'center') {
  switch (anchor) {
    case 'top':
      return { x: el.x + el.width / 2, y: el.y };
    case 'right':
      return { x: el.x + el.width, y: el.y + el.height / 2 };
    case 'bottom':
      return { x: el.x + el.width / 2, y: el.y + el.height };
    case 'left':
      return { x: el.x, y: el.y + el.height / 2 };
    case 'center':
    default:
      return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  }
}

/**
 * Intersect a ray from an element's center toward `towardPt` with the element perimeter.
 * @param {WhiteboardElement} targetEl
 * @param {{ x: number; y: number }} towardPt
 * @returns {{ x: number; y: number }}
 */
export function intersectRayWithElementBorder(targetEl, towardPt) {
  const cx = targetEl.x + targetEl.width / 2;
  const cy = targetEl.y + targetEl.height / 2;
  const dx = towardPt.x - cx;
  const dy = towardPt.y - cy;
  if (Math.hypot(dx, dy) < 1) {
    return { x: cx, y: cy };
  }

  if (targetEl.type === 'ellipse') {
    const rx = Math.max(1, targetEl.width / 2);
    const ry = Math.max(1, targetEl.height / 2);
    const norm = Math.hypot(dx / rx, dy / ry);
    if (norm === 0) return { x: cx, y: cy };
    const t = 1 / norm;
    return {
      x: cx + dx * t,
      y: cy + dy * t,
    };
  }

  const hw = Math.max(1, targetEl.width / 2);
  const hh = Math.max(1, targetEl.height / 2);
  const factor = Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
  if (factor === 0) return { x: cx, y: cy };
  const t = 1 / factor;
  return {
    x: cx + dx * t,
    y: cy + dy * t,
  };
}

/**
 * Find the closest snap target shape & anchor for a world coordinate.
 * @param {readonly WhiteboardElement[]} elements
 * @param {{ x: number; y: number }} worldPt
 * @param {{ snapRadius?: number; excludeIds?: ReadonlySet<string> }} [opts]
 * @returns {{ binding: ArrowEndpointBinding; point: { x: number; y: number }; target: WhiteboardElement } | null}
 */
export function findArrowSnapTarget(elements, worldPt, opts = {}) {
  const snapRadius = opts.snapRadius ?? 24;
  const excludeIds = opts.excludeIds;

  const candidates = [...elements]
    .filter((el) => isArrowBindableShape(el) && !(excludeIds && excludeIds.has(el.id)))
    .sort((a, b) => b.zIndex - a.zIndex);

  /** @type {readonly ArrowSnapAnchor[]} */
  const edgeAnchors = ['top', 'right', 'bottom', 'left'];

  /** @type {{ dist: number; binding: ArrowEndpointBinding; point: { x: number; y: number }; target: WhiteboardElement } | null} */
  let bestEdge = null;

  for (const el of candidates) {
    for (const anchor of edgeAnchors) {
      const pt = getShapeAnchorPoint(el, anchor);
      const dist = Math.hypot(worldPt.x - pt.x, worldPt.y - pt.y);
      if (dist <= snapRadius && (!bestEdge || dist < bestEdge.dist)) {
        bestEdge = {
          dist,
          binding: { elementId: el.id, anchor },
          point: pt,
          target: el,
        };
      }
    }
  }

  if (bestEdge) {
    return {
      binding: bestEdge.binding,
      point: bestEdge.point,
      target: bestEdge.target,
    };
  }

  const margin = 6;
  for (const el of candidates) {
    if (
      worldPt.x >= el.x - margin &&
      worldPt.x <= el.x + el.width + margin &&
      worldPt.y >= el.y - margin &&
      worldPt.y <= el.y + el.height + margin
    ) {
      return {
        binding: { elementId: el.id, anchor: 'center' },
        point: getShapeAnchorPoint(el, 'center'),
        target: el,
      };
    }
  }

  return null;
}

/**
 * Extract world-space [start, end] endpoints of an arrow element.
 * @param {WhiteboardElement} arrowEl
 * @returns {[{ x: number; y: number }, { x: number; y: number }]}
 */
export function getArrowWorldEndpoints(arrowEl) {
  const pts =
    arrowEl.points && arrowEl.points.length >= 2
      ? arrowEl.points
      : [
          [0, arrowEl.height / 2],
          [arrowEl.width, arrowEl.height / 2],
        ];
  const p0 = pts[0] ?? [0, 0];
  const p1 = pts[pts.length - 1] ?? [arrowEl.width, arrowEl.height];
  return [
    { x: arrowEl.x + p0[0], y: arrowEl.y + p0[1] },
    { x: arrowEl.x + p1[0], y: arrowEl.y + p1[1] },
  ];
}

/**
 * Compute bounding box + relative points for an arrow defined by world endpoints (p1 -> p2).
 * @param {{ x: number; y: number }} p1
 * @param {{ x: number; y: number }} p2
 * @returns {{
 *   x: number;
 *   y: number;
 *   width: number;
 *   height: number;
 *   points: [[number, number], [number, number]];
 * }}
 */
export function buildArrowGeometry(p1, p2) {
  const minX = Math.min(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const x = clampNum(Math.round(minX), -10000, 10000);
  const y = clampNum(Math.round(minY), -10000, 10000);
  const width = clampNum(Math.round(Math.abs(p2.x - p1.x)), 16, 4000);
  const height = clampNum(Math.round(Math.abs(p2.y - p1.y)), 16, 4000);
  return {
    x,
    y,
    width,
    height,
    points: [
      [Math.round(p1.x - x), Math.round(p1.y - y)],
      [Math.round(p2.x - x), Math.round(p2.y - y)],
    ],
  };
}

/**
 * Recompute geometry & strip dangling bindings for every bound arrow in `elements`.
 * @param {readonly WhiteboardElement[]} elements
 * @returns {WhiteboardElement[]}
 */
export function recomputeBoundArrows(elements) {
  /** @type {Map<string, WhiteboardElement>} */
  const byId = new Map();
  for (const el of elements) {
    byId.set(el.id, el);
  }

  return elements.map((el) => {
    if (el.type !== 'arrow' || (!el.startBinding && !el.endBinding)) {
      return el;
    }

    const startTarget =
      el.startBinding?.elementId && el.startBinding.elementId !== el.id
        ? byId.get(el.startBinding.elementId)
        : undefined;
    const endTarget =
      el.endBinding?.elementId && el.endBinding.elementId !== el.id
        ? byId.get(el.endBinding.elementId)
        : undefined;

    const validStartBinding =
      startTarget && isArrowBindableShape(startTarget) && el.startBinding
        ? el.startBinding
        : undefined;
    const validEndBinding =
      endTarget && isArrowBindableShape(endTarget) && el.endBinding ? el.endBinding : undefined;

    const [curP1, curP2] = getArrowWorldEndpoints(el);
    const startAnchor = validStartBinding?.anchor ?? 'center';
    const endAnchor = validEndBinding?.anchor ?? 'center';

    const refStart =
      startTarget && validStartBinding ? getShapeAnchorPoint(startTarget, startAnchor) : curP1;
    const refEnd = endTarget && validEndBinding ? getShapeAnchorPoint(endTarget, endAnchor) : curP2;

    const nextP1 =
      startTarget && validStartBinding
        ? startAnchor === 'center'
          ? intersectRayWithElementBorder(startTarget, refEnd)
          : getShapeAnchorPoint(startTarget, startAnchor)
        : curP1;

    const nextP2 =
      endTarget && validEndBinding
        ? endAnchor === 'center'
          ? intersectRayWithElementBorder(endTarget, refStart)
          : getShapeAnchorPoint(endTarget, endAnchor)
        : curP2;

    const geom = buildArrowGeometry(nextP1, nextP2);
    const { startBinding: _sb, endBinding: _eb, ...rest } = el;
    /** @type {WhiteboardElement} */
    const nextEl = {
      ...rest,
      x: geom.x,
      y: geom.y,
      width: geom.width,
      height: geom.height,
      points: geom.points,
      ...(validStartBinding ? { startBinding: validStartBinding } : {}),
      ...(validEndBinding ? { endBinding: validEndBinding } : {}),
    };
    return nextEl;
  });
}

/**
 * Strip bindings from arrows that are moved individually while leaving their target shapes behind.
 * @param {readonly WhiteboardElement[]} elements
 * @param {ReadonlySet<string>} movedIds
 * @returns {WhiteboardElement[]}
 */
export function detachUnfollowedArrowBindings(elements, movedIds) {
  return elements.map((el) => {
    if (el.type !== 'arrow' || !movedIds.has(el.id)) return el;
    if (!el.startBinding && !el.endBinding) return el;
    const keepStart =
      el.startBinding && movedIds.has(el.startBinding.elementId) ? el.startBinding : undefined;
    const keepEnd =
      el.endBinding && movedIds.has(el.endBinding.elementId) ? el.endBinding : undefined;
    const { startBinding: _sb, endBinding: _eb, ...rest } = el;
    return {
      ...rest,
      ...(keepStart ? { startBinding: keepStart } : {}),
      ...(keepEnd ? { endBinding: keepEnd } : {}),
    };
  });
}

/**
 * Duplicate all selected whiteboard elements in z-order with a visual offset.
 * Remaps arrow bindings when both the arrow and its bound shapes are duplicated together.
 * @param {readonly WhiteboardElement[]} elements
 * @param {ReadonlySet<string>} selectedIds
 * @param {{ generateId?: () => string; offset?: number; snapGridSize?: number }} [opts]
 * @returns {{ nextElements: WhiteboardElement[]; createdIds: string[] }}
 */
export function duplicateWhiteboardElements(elements, selectedIds, opts = {}) {
  const generateId = opts.generateId ?? (() => crypto.randomUUID());
  const snapGridSize = opts.snapGridSize ?? 0;
  const offset = opts.offset ?? (snapGridSize > 1 ? snapGridSize : 24);
  if (selectedIds.size === 0) {
    return { nextElements: [...elements], createdIds: [] };
  }

  let maxZ = -1;
  for (const el of elements) {
    if (el.zIndex > maxZ) maxZ = el.zIndex;
  }

  const orderedSelected = elements
    .map((el, idx) => ({ el, idx }))
    .filter((entry) => selectedIds.has(entry.el.id))
    .sort((a, b) => a.el.zIndex - b.el.zIndex || a.idx - b.idx);

  /** @type {Map<string, string>} */
  const idMap = new Map();
  /** @type {string[]} */
  const createdIds = [];
  for (const entry of orderedSelected) {
    const newId = generateId();
    idMap.set(entry.el.id, newId);
    createdIds.push(newId);
  }

  /** @type {WhiteboardElement[]} */
  const clones = [];
  for (let i = 0; i < orderedSelected.length; i += 1) {
    const src = orderedSelected[i]?.el;
    if (!src) continue;
    const newId = idMap.get(src.id) ?? generateId();
    const mappedStart = src.startBinding
      ? {
          ...src.startBinding,
          elementId: idMap.get(src.startBinding.elementId) ?? src.startBinding.elementId,
        }
      : undefined;
    const mappedEnd = src.endBinding
      ? {
          ...src.endBinding,
          elementId: idMap.get(src.endBinding.elementId) ?? src.endBinding.elementId,
        }
      : undefined;
    const rawX = clampNum(src.x + offset, -10000, 10000);
    const rawY = clampNum(src.y + offset, -10000, 10000);
    /** @type {WhiteboardElement} */
    const cloned = {
      ...src,
      id: newId,
      x:
        snapGridSize > 1
          ? clampNum(snapValueToGrid(rawX, snapGridSize, true), -10000, 10000)
          : Math.round(rawX),
      y:
        snapGridSize > 1
          ? clampNum(snapValueToGrid(rawY, snapGridSize, true), -10000, 10000)
          : Math.round(rawY),
      zIndex: maxZ + 1 + i,
      ...(src.points ? { points: src.points.map((pt) => [pt[0], pt[1]]) } : {}),
      ...(mappedStart ? { startBinding: mappedStart } : {}),
      ...(mappedEnd ? { endBinding: mappedEnd } : {}),
    };
    clones.push(cloned);
  }

  return {
    nextElements: recomputeBoundArrows([...elements, ...clones]),
    createdIds,
  };
}

/**
 * Compute a viewport (panX, panY, zoom) that fits all elements nicely within stage dimensions.
 * Caps auto-zoom at 1 so small diagrams remain crisp instead of over-magnifying.
 * @param {readonly WhiteboardElement[]} elements
 * @param {number} stageWidth
 * @param {number} stageHeight
 * @param {number} [padding]
 * @returns {WhiteboardViewport}
 */
export function computeFitViewport(elements, stageWidth, stageHeight, padding = 48) {
  if (elements.length === 0 || stageWidth <= 0 || stageHeight <= 0) {
    return { panX: 0, panY: 0, zoom: 1 };
  }

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

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const availW = Math.max(80, stageWidth - padding * 2);
  const availH = Math.max(80, stageHeight - padding * 2);

  const rawZoom = Math.min(availW / contentW, availH / contentH);
  const zoom = clampNum(Math.round(Math.min(1, rawZoom) * 100) / 100, 0.25, 3);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const panX = clampNum(Math.round((stageWidth / 2 - centerX * zoom) * 10) / 10, -20000, 20000);
  const panY = clampNum(Math.round((stageHeight / 2 - centerY * zoom) * 10) / 10, -20000, 20000);

  return { panX, panY, zoom };
}

/**
 * Return IDs of elements intersecting a world-space marquee rectangle.
 * @param {readonly WhiteboardElement[]} elements
 * @param {{ x: number; y: number; width: number; height: number }} box
 * @returns {string[]}
 */
export function selectElementsInMarquee(elements, box) {
  const bx1 = box.x;
  const by1 = box.y;
  const bx2 = box.x + box.width;
  const by2 = box.y + box.height;

  return elements
    .filter((el) => {
      const ex1 = el.x;
      const ey1 = el.y;
      const ex2 = el.x + el.width;
      const ey2 = el.y + el.height;
      return ex1 <= bx2 && ex2 >= bx1 && ey1 <= by2 && ey2 >= by1;
    })
    .map((el) => el.id);
}

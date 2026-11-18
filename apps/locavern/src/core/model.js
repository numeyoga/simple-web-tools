/** @import { ActiveView, AllowedImageMimeType, ArrowEndpointBinding, ArrowSnapAnchor, ChecklistItem, LocalEntityKind, LocalRef, InputPresentation, InputPresentationMap, Note, Project, RichTextDoc, RichTextMark, RichTextNode, Task, TaskPriority, TaskRecurrence, TaskStatus, TaskStatusConfig, TaskStatusRole, Whiteboard, WhiteboardColorToken, WhiteboardElement, WhiteboardElementType, WhiteboardViewport } from '../types.d.ts' */

import { parseTimeHhMm } from './dates.js';

/** @type {readonly import('../types.d.ts').InputPresentationScreen[]} */
export const INPUT_PRESENTATION_SCREENS = Object.freeze([
  'tasks',
  'projects',
  'notes',
  'whiteboards',
]);

/** @type {readonly ActiveView[]} */
export const ACTIVE_VIEWS = Object.freeze([
  'today',
  'tasks',
  'projects',
  'calendar',
  'notes',
  'whiteboards',
  'archives',
]);

/** @type {readonly InputPresentation[]} */
export const INPUT_PRESENTATIONS = Object.freeze(['drawer', 'modal']);

/** @type {InputPresentationMap} */
export const DEFAULT_INPUT_PRESENTATIONS = Object.freeze({
  tasks: 'drawer',
  projects: 'modal',
  notes: 'drawer',
  whiteboards: 'modal',
});

/**
 * Normalize a per-screen input presentation map from stored or partial preferences.
 * @param {unknown} raw
 * @returns {InputPresentationMap}
 */
export function normalizeInputPresentations(raw) {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? /** @type {Record<string, unknown>} */ (raw)
      : {};
  return Object.freeze({
    tasks:
      src.tasks === 'drawer' || src.tasks === 'modal'
        ? src.tasks
        : DEFAULT_INPUT_PRESENTATIONS.tasks,
    projects:
      src.projects === 'drawer' || src.projects === 'modal'
        ? src.projects
        : DEFAULT_INPUT_PRESENTATIONS.projects,
    notes:
      src.notes === 'drawer' || src.notes === 'modal'
        ? src.notes
        : DEFAULT_INPUT_PRESENTATIONS.notes,
    whiteboards:
      src.whiteboards === 'drawer' || src.whiteboards === 'modal'
        ? src.whiteboards
        : DEFAULT_INPUT_PRESENTATIONS.whiteboards,
  });
}

export const DEFAULT_TOAST_DURATION_SECONDS = 6;
export const MIN_TOAST_DURATION_SECONDS = 1;
export const MAX_TOAST_DURATION_SECONDS = 60;

export const DEFAULT_TRASH_RETENTION_DAYS = 30;
export const MIN_TRASH_RETENTION_DAYS = 1;
export const MAX_TRASH_RETENTION_DAYS = 365;

/**
 * Normalize trash retention delay in days (integer clamped between 1 and 365).
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeTrashRetentionDays(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_TRASH_RETENTION_DAYS;
  }
  const rounded = Math.round(raw);
  return Math.max(MIN_TRASH_RETENTION_DAYS, Math.min(MAX_TRASH_RETENTION_DAYS, rounded));
}

/**
 * Compute expiration ISO timestamp by adding retention days to deletedAt.
 * @param {string} deletedAtIso
 * @param {number} retentionDays
 * @returns {string}
 */
export function computeTrashExpiresAt(deletedAtIso, retentionDays) {
  const baseMs = Date.parse(deletedAtIso);
  const safeBase = Number.isNaN(baseMs) ? Date.now() : baseMs;
  const days = normalizeTrashRetentionDays(retentionDays);
  return new Date(safeBase + days * 86_400_000).toISOString();
}

/**
 * Normalize a toast auto-dismiss duration in seconds (integer clamped between 1 and 60).
 * @param {unknown} raw
 * @returns {number}
 */
export function normalizeToastDurationSeconds(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_TOAST_DURATION_SECONDS;
  }
  const rounded = Math.round(raw);
  return Math.max(MIN_TOAST_DURATION_SECONDS, Math.min(MAX_TOAST_DURATION_SECONDS, rounded));
}

/** @type {readonly TaskStatusConfig[]} */
export const DEFAULT_TASK_STATUSES = Object.freeze([
  Object.freeze({ id: 'todo', label: 'À faire', isInitial: true }),
  Object.freeze({ id: 'in_progress', label: 'En cours' }),
  Object.freeze({ id: 'done', label: 'Terminé', isTerminal: true }),
]);

/** @type {readonly TaskStatus[]} */
export const TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);

/** @type {Readonly<Record<string, string>>} */
const BUILTIN_STATUS_LABELS = Object.freeze({
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
});

/** @type {ReadonlySet<string>} */
const RESERVED_STATUS_IDS = new Set(['all', '__none__', '__unknown__']);

/**
 * Normalize a configured list of Kanban task statuses.
 * Returns `DEFAULT_TASK_STATUSES` when `raw` is not an array; allows an empty array if explicitly configured.
 * Enforces mutual exclusion between `isInitial` and `isTerminal` (terminal wins if both are set).
 * @param {unknown} raw
 * @returns {readonly TaskStatusConfig[]}
 */
export function normalizeTaskStatuses(raw) {
  if (!Array.isArray(raw)) {
    return DEFAULT_TASK_STATUSES;
  }
  /** @type {TaskStatusConfig[]} */
  const out = [];
  /** @type {Set<string>} */
  const seenIds = new Set();
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const candidate = /** @type {Record<string, unknown>} */ (item);
    const id = typeof candidate.id === 'string' ? candidate.id.trim().slice(0, 64) : '';
    const label = typeof candidate.label === 'string' ? candidate.label.trim().slice(0, 60) : '';
    if (!id || !label || RESERVED_STATUS_IDS.has(id) || seenIds.has(id)) continue;
    seenIds.add(id);
    const isTerminal = candidate.isTerminal === true;
    const isInitial = !isTerminal && candidate.isInitial === true;
    out.push(
      Object.freeze({
        id,
        label,
        ...(isInitial ? { isInitial: true } : {}),
        ...(isTerminal ? { isTerminal: true } : {}),
      }),
    );
  }
  return Object.freeze(out);
}

/**
 * Upgrade legacy stored status configurations that had no explicit role metadata
 * so built-in `todo` and `done` retain their initial and terminal roles.
 * @param {readonly TaskStatusConfig[]} statuses
 * @returns {readonly TaskStatusConfig[]}
 */
export function inferLegacyTaskStatusRoles(statuses) {
  if (statuses.some((s) => s.isInitial === true || s.isTerminal === true)) {
    return statuses;
  }
  return Object.freeze(
    statuses.map((s) => {
      if (s.id === 'done') return Object.freeze({ ...s, isTerminal: true });
      if (s.id === 'todo') return Object.freeze({ ...s, isInitial: true });
      return s;
    }),
  );
}

/**
 * Return the semantic role ('initial' | 'terminal' | null) for a status ID.
 * @param {TaskStatus | null | undefined} status
 * @param {readonly TaskStatusConfig[]} [taskStatuses]
 * @returns {TaskStatusRole | null}
 */
export function getTaskStatusRole(status, taskStatuses = DEFAULT_TASK_STATUSES) {
  const clean = typeof status === 'string' ? status.trim() : '';
  if (!clean) return null;
  const entry = taskStatuses.find((s) => s.id === clean);
  if (!entry) return null;
  if (entry.isTerminal === true) return 'terminal';
  if (entry.isInitial === true) return 'initial';
  return null;
}

/**
 * Return true if `status` is configured as an initial status.
 * @param {TaskStatus | null | undefined} status
 * @param {readonly TaskStatusConfig[]} [taskStatuses]
 * @returns {boolean}
 */
export function isInitialTaskStatus(status, taskStatuses = DEFAULT_TASK_STATUSES) {
  return getTaskStatusRole(status, taskStatuses) === 'initial';
}

/**
 * Return true if `status` is configured as a terminal status.
 * @param {TaskStatus | null | undefined} status
 * @param {readonly TaskStatusConfig[]} [taskStatuses]
 * @returns {boolean}
 */
export function isTerminalTaskStatus(status, taskStatuses = DEFAULT_TASK_STATUSES) {
  return getTaskStatusRole(status, taskStatuses) === 'terminal';
}

/**
 * Pick the default status ID for newly created or recurring tasks
 * (prefers the first `isInitial` status, falling back to the first configured status).
 * @param {readonly TaskStatusConfig[]} [taskStatuses]
 * @returns {TaskStatus | null}
 */
export function getDefaultInitialTaskStatusId(taskStatuses = DEFAULT_TASK_STATUSES) {
  const explicit = taskStatuses.find((s) => s.isInitial === true);
  if (explicit) return explicit.id;
  return taskStatuses[0]?.id ?? null;
}

/**
 * Pick the default terminal status ID used by quick-complete actions
 * (prefers the first `isTerminal` status, or null if none is configured).
 * @param {readonly TaskStatusConfig[]} [taskStatuses]
 * @returns {TaskStatus | null}
 */
export function getDefaultTerminalTaskStatusId(taskStatuses = DEFAULT_TASK_STATUSES) {
  return taskStatuses.find((s) => s.isTerminal === true)?.id ?? null;
}

/**
 * Generate a unique slug identifier for a new task status from its label.
 * @param {string} label
 * @param {Iterable<string>} [existingIds]
 * @returns {string}
 */
export function createTaskStatusId(label, existingIds = []) {
  const baseSlug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const base = baseSlug && !RESERVED_STATUS_IDS.has(baseSlug) ? baseSlug : 'statut';
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

/**
 * Resolve presentation metadata for a task's status against the configured Kanban statuses.
 * @param {TaskStatus | null | undefined} status
 * @param {readonly TaskStatusConfig[]} [taskStatuses]
 * @returns {{ known: boolean; kind: 'known' | 'missing' | 'unknown'; label: string; badgeClass: string }}
 */
export function getTaskStatusMeta(status, taskStatuses = DEFAULT_TASK_STATUSES) {
  const clean = typeof status === 'string' ? status.trim() : '';
  if (!clean) {
    return {
      known: false,
      kind: 'missing',
      label: 'Sans statut',
      badgeClass: 'cv-badge cv-badge--warning',
    };
  }
  const index = taskStatuses.findIndex((entry) => entry.id === clean);
  if (index !== -1) {
    const entry = taskStatuses[index];
    let badgeClass = 'cv-badge cv-badge--info';
    if (entry?.isTerminal === true || entry?.id === 'done') {
      badgeClass = 'cv-badge cv-badge--success';
    } else if (entry?.isInitial === true || entry?.id === 'todo' || index === 0) {
      badgeClass = 'cv-badge';
    }
    return {
      known: true,
      kind: 'known',
      label: entry?.label ?? clean,
      badgeClass,
    };
  }
  const fallbackName = BUILTIN_STATUS_LABELS[clean] ?? clean;
  return {
    known: false,
    kind: 'unknown',
    label: `Statut inconnu (${fallbackName})`,
    badgeClass: 'cv-badge cv-badge--warning',
  };
}

/** @type {readonly TaskPriority[]} */
export const TASK_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

/** @type {readonly TaskRecurrence[]} */
export const TASK_RECURRENCES = Object.freeze(['daily', 'weekly', 'monthly']);

/**
 * Normalize an optional task recurrence cadence.
 * @param {unknown} value
 * @returns {TaskRecurrence | null}
 */
export function normalizeTaskRecurrence(value) {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') {
    return value;
  }
  return null;
}

/**
 * Return a human-readable French label for a task recurrence cadence.
 * @param {TaskRecurrence | null | undefined} recurrence
 * @returns {string}
 */
export function getTaskRecurrenceLabel(recurrence) {
  if (recurrence === 'daily') return 'Quotidienne';
  if (recurrence === 'weekly') return 'Hebdomadaire';
  if (recurrence === 'monthly') return 'Mensuelle';
  return '';
}

/** @type {ReadonlySet<AllowedImageMimeType>} */
export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** @type {readonly WhiteboardElementType[]} */
export const WHITEBOARD_ELEMENT_TYPES = Object.freeze([
  'sticky',
  'rect',
  'ellipse',
  'arrow',
  'text',
  'path',
  'image',
]);

/** @type {readonly WhiteboardColorToken[]} */
export const WHITEBOARD_COLORS = Object.freeze([
  'neutral',
  'accent',
  'success',
  'warning',
  'danger',
]);

/** @type {WhiteboardViewport} */
export const DEFAULT_WHITEBOARD_VIEWPORT = Object.freeze({
  panX: 0,
  panY: 0,
  zoom: 1,
});

/** @type {RichTextDoc} */
export const EMPTY_RICH_DOC = Object.freeze({
  type: 'doc',
  content: Object.freeze([{ type: 'paragraph' }]),
});

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'hardBreak',
  'localImage',
]);

const ALLOWED_MARK_TYPES = new Set(['bold', 'italic', 'code', 'strike', 'link']);

/**
 * Validate and sanitize a link URL (only https: and mailto: allowed).
 * @param {unknown} rawHref
 * @returns {string | null}
 */
export function sanitizeLinkHref(rawHref) {
  if (typeof rawHref !== 'string') return null;
  const trimmed = rawHref.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize a single ProseMirror/Tiptap mark.
 * @param {unknown} raw
 * @returns {RichTextMark | null}
 */
function sanitizeMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = /** @type {Record<string, unknown>} */ (raw);
  if (typeof candidate.type !== 'string' || !ALLOWED_MARK_TYPES.has(candidate.type)) {
    return null;
  }
  if (candidate.type === 'link') {
    const attrs =
      candidate.attrs && typeof candidate.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (candidate.attrs)
        : null;
    const safeHref = sanitizeLinkHref(attrs?.href);
    if (!safeHref) return null;
    return {
      type: 'link',
      attrs: {
        href: safeHref,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    };
  }
  return { type: candidate.type };
}

/**
 * Sanitize a single ProseMirror/Tiptap node recursively.
 * @param {unknown} raw
 * @returns {RichTextNode | null}
 */
function sanitizeNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const node = /** @type {Record<string, unknown>} */ (raw);
  if (typeof node.type !== 'string' || !ALLOWED_NODE_TYPES.has(node.type)) {
    return null;
  }

  if (node.type === 'text') {
    if (typeof node.text !== 'string') return null;
    const rawMarks = Array.isArray(node.marks) ? node.marks : [];
    /** @type {RichTextMark[]} */
    const marks = [];
    for (const m of rawMarks) {
      const cleanMark = sanitizeMark(m);
      if (cleanMark) marks.push(cleanMark);
    }
    return node.marks !== undefined
      ? { type: 'text', text: node.text, marks }
      : { type: 'text', text: node.text };
  }

  if (node.type === 'localImage') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    const assetId = typeof attrs?.assetId === 'string' ? attrs.assetId.trim() : '';
    if (!assetId) return null;
    const alt = typeof attrs?.alt === 'string' ? attrs.alt.slice(0, 200) : '';
    return {
      type: 'localImage',
      attrs: { assetId, alt },
    };
  }

  /** @type {Record<string, unknown> | undefined} */
  let cleanAttrs;
  if (node.type === 'heading') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    const level =
      typeof attrs?.level === 'number' && [1, 2, 3].includes(attrs.level) ? attrs.level : 2;
    cleanAttrs = { level };
  } else if (node.type === 'taskItem') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    cleanAttrs = { checked: Boolean(attrs?.checked) };
  }

  const rawContent = Array.isArray(node.content) ? node.content : undefined;
  /** @type {RichTextNode[] | undefined} */
  let cleanContent;
  if (rawContent) {
    cleanContent = [];
    for (const child of rawContent) {
      const sanitized = sanitizeNode(child);
      if (sanitized) cleanContent.push(sanitized);
    }
  }

  /** @type {RichTextNode} */
  const out = { type: node.type };
  if (cleanAttrs) {
    return cleanContent !== undefined
      ? { ...out, attrs: cleanAttrs, content: cleanContent }
      : { ...out, attrs: cleanAttrs };
  }
  return cleanContent !== undefined ? { ...out, content: cleanContent } : out;
}

/**
 * Sanitize an arbitrary Tiptap JSON document and remove remote images / unsafe links.
 * @param {unknown} rawDoc
 * @returns {RichTextDoc}
 */
export function sanitizeRichTextDoc(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return EMPTY_RICH_DOC;
  }
  const candidate = /** @type {Record<string, unknown>} */ (rawDoc);
  if (candidate.type !== 'doc' || !Array.isArray(candidate.content)) {
    return EMPTY_RICH_DOC;
  }
  /** @type {RichTextNode[]} */
  const cleanContent = [];
  for (const child of candidate.content) {
    if (
      child &&
      typeof child === 'object' &&
      /** @type {Record<string, unknown>} */ (child).type === 'doc'
    ) {
      continue;
    }
    const clean = sanitizeNode(child);
    if (clean) cleanContent.push(clean);
  }
  if (cleanContent.length === 0) {
    return EMPTY_RICH_DOC;
  }
  return { type: 'doc', content: cleanContent };
}

/**
 * Extract all unique localImage assetIds referenced in a RichTextDoc.
 * @param {RichTextDoc} doc
 * @returns {string[]}
 */
export function collectDocAssetIds(doc) {
  /** @type {Set<string>} */
  const ids = new Set();

  /** @param {readonly RichTextNode[] | undefined} nodes */
  function walk(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'localImage' && typeof node.attrs?.assetId === 'string') {
        const assetId = node.attrs.assetId.trim();
        if (assetId) ids.add(assetId);
      }
      if (node.content) walk(node.content);
    }
  }

  walk(doc.content);
  return [...ids];
}

/**
 * Normalize an optional due date (YYYY-MM-DD or null).
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeDueDate(value) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return trimmed;
    }
  }
  throw new Error('Date d’échéance invalide. Utilisez le format AAAA-MM-JJ.');
}

/**
 * Normalize an optional wall-clock due time (HH:MM 24h format or null).
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeDueTime(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const parsed = parseTimeHhMm(trimmed);
  if (!parsed) {
    throw new Error('Heure d’échéance invalide. Utilisez le format HH:MM.');
  }
  return parsed.normalized;
}

/**
 * Normalize a checklist array.
 * @param {readonly ChecklistItem[] | undefined} items
 * @returns {readonly ChecklistItem[]}
 */
export function normalizeChecklist(items) {
  if (!items) return [];
  return items
    .map((item) => ({
      id: item.id.trim(),
      text: item.text.trim(),
      done: Boolean(item.done),
    }))
    .filter((item) => item.id.length > 0 && item.text.length > 0);
}

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize a whiteboard viewport (finite panX/panY within [-10000, 10000], zoom within [0.25, 3]).
 * @param {unknown} raw
 * @returns {WhiteboardViewport}
 */
export function sanitizeWhiteboardViewport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_WHITEBOARD_VIEWPORT;
  }
  const candidate = /** @type {Record<string, unknown>} */ (raw);
  const rawPanX = candidate.panX;
  const rawPanY = candidate.panY;
  const rawZoom = candidate.zoom;
  const panX =
    typeof rawPanX === 'number' && Number.isFinite(rawPanX)
      ? clampNumber(rawPanX, -10000, 10000)
      : 0;
  const panY =
    typeof rawPanY === 'number' && Number.isFinite(rawPanY)
      ? clampNumber(rawPanY, -10000, 10000)
      : 0;
  const zoom =
    typeof rawZoom === 'number' && Number.isFinite(rawZoom) ? clampNumber(rawZoom, 0.25, 3) : 1;
  return Object.freeze({ panX, panY, zoom });
}

/**
 * Detect whether a string looks like a remote or inline URL rather than a local assetId.
 * @param {unknown} value
 * @returns {boolean}
 */
function hasRemoteOrInlineUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^(https?:|\/\/|data:|javascript:|blob:)/i.test(trimmed);
}

/**
 * Return true if the element type supports a background fill (and transparent background).
 * @param {WhiteboardElementType} type
 * @returns {boolean}
 */
export function whiteboardElementSupportsBackground(type) {
  return type === 'sticky' || type === 'rect' || type === 'ellipse';
}

/**
 * Determine whether an element can move forward (+1) or backward (-1) in z-order.
 * @param {readonly WhiteboardElement[]} elements
 * @param {string} elementId
 * @returns {{ canBringForward: boolean; canSendBackward: boolean }}
 */
export function getWhiteboardElementLayerBounds(elements, elementId) {
  if (elements.length < 2) {
    return { canBringForward: false, canSendBackward: false };
  }
  const indexed = elements.map((el, idx) => ({ el, idx }));
  indexed.sort((a, b) => a.el.zIndex - b.el.zIndex || a.idx - b.idx);
  const pos = indexed.findIndex((entry) => entry.el.id === elementId);
  if (pos === -1) {
    return { canBringForward: false, canSendBackward: false };
  }
  return {
    canBringForward: pos < indexed.length - 1,
    canSendBackward: pos > 0,
  };
}

/**
 * Move one whiteboard element one level forward (+1) or backward (-1) in z-order.
 * Reassigns clean sequential zIndex values (0..n-1) while preserving relative order of others.
 * @param {readonly WhiteboardElement[]} elements
 * @param {string} elementId
 * @param {1 | -1} direction
 * @returns {{ elements: readonly WhiteboardElement[]; changed: boolean }}
 */
export function stepWhiteboardElementLayer(elements, elementId, direction) {
  if (elements.length < 2) return { elements, changed: false };
  const indexed = elements.map((el, idx) => ({ el, idx }));
  indexed.sort((a, b) => a.el.zIndex - b.el.zIndex || a.idx - b.idx);
  const pos = indexed.findIndex((entry) => entry.el.id === elementId);
  if (pos === -1) return { elements, changed: false };
  const targetPos = pos + direction;
  if (targetPos < 0 || targetPos >= indexed.length) {
    return { elements, changed: false };
  }
  const swapped = [...indexed];
  const currentItem = swapped[pos];
  const neighborItem = swapped[targetPos];
  if (!currentItem || !neighborItem) return { elements, changed: false };
  swapped[pos] = neighborItem;
  swapped[targetPos] = currentItem;

  /** @type {Map<string, number>} */
  const zMap = new Map();
  swapped.forEach((entry, z) => {
    zMap.set(entry.el.id, z);
  });

  const next = elements.map((el) => {
    const nextZ = zMap.get(el.id) ?? el.zIndex;
    return nextZ === el.zIndex ? el : Object.freeze({ ...el, zIndex: nextZ });
  });
  return { elements: Object.freeze(next), changed: true };
}

/** @type {readonly ArrowSnapAnchor[]} */
const ARROW_SNAP_ANCHORS = Object.freeze(['center', 'top', 'right', 'bottom', 'left']);

/**
 * Sanitize an optional arrow endpoint binding.
 * @param {unknown} raw
 * @returns {ArrowEndpointBinding | undefined}
 */
function sanitizeArrowBinding(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const elementId = typeof obj.elementId === 'string' ? obj.elementId.trim() : '';
  if (!elementId) return undefined;
  const rawAnchor = /** @type {ArrowSnapAnchor} */ (obj.anchor);
  const anchor = ARROW_SNAP_ANCHORS.includes(rawAnchor) ? rawAnchor : undefined;
  return Object.freeze(anchor ? { elementId, anchor } : { elementId });
}

/**
 * Sanitize and validate an array of whiteboard elements.
 * @param {unknown} rawElements
 * @returns {readonly WhiteboardElement[]}
 */
export function sanitizeWhiteboardElements(rawElements) {
  if (!Array.isArray(rawElements)) return [];
  /** @type {WhiteboardElement[]} */
  const out = [];
  /** @type {Set<string>} */
  const seenIds = new Set();

  for (let i = 0; i < rawElements.length; i += 1) {
    const raw = rawElements[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const el = /** @type {Record<string, unknown>} */ (raw);

    const id = typeof el.id === 'string' ? el.id.trim() : '';
    if (!id || seenIds.has(id)) continue;

    const type = /** @type {WhiteboardElementType} */ (el.type);
    if (!WHITEBOARD_ELEMENT_TYPES.includes(type)) continue;

    if (typeof el.x !== 'number' || !Number.isFinite(el.x)) continue;
    if (typeof el.y !== 'number' || !Number.isFinite(el.y)) continue;
    if (typeof el.width !== 'number' || !Number.isFinite(el.width)) continue;
    if (typeof el.height !== 'number' || !Number.isFinite(el.height)) continue;

    const minDim = type === 'arrow' || type === 'path' ? 0 : 16;
    const width = clampNumber(el.width, minDim, 4000);
    const height = clampNumber(el.height, minDim, 4000);

    const rawColor = /** @type {WhiteboardColorToken} */ (el.color);
    const color = WHITEBOARD_COLORS.includes(rawColor) ? rawColor : 'neutral';

    const transparentBg = whiteboardElementSupportsBackground(type) && el.transparentBg === true;

    const zIndex =
      typeof el.zIndex === 'number' && Number.isFinite(el.zIndex) ? Math.trunc(el.zIndex) : i;

    /** @type {string | undefined} */
    let text;
    if (typeof el.text === 'string') {
      text = el.text.slice(0, 500);
    }

    /** @type {readonly (readonly [number, number])[] | undefined} */
    let points;
    if (Array.isArray(el.points)) {
      /** @type {Array<readonly [number, number]>} */
      const cleanPoints = [];
      for (const pt of el.points) {
        if (cleanPoints.length >= 2000) break;
        if (
          Array.isArray(pt) &&
          pt.length >= 2 &&
          typeof pt[0] === 'number' &&
          Number.isFinite(pt[0]) &&
          typeof pt[1] === 'number' &&
          Number.isFinite(pt[1])
        ) {
          cleanPoints.push(Object.freeze([pt[0], pt[1]]));
        }
      }
      points = Object.freeze(cleanPoints);
    }

    /** @type {string | undefined} */
    let assetId;
    if (type === 'image') {
      if (hasRemoteOrInlineUrl(el.src) || hasRemoteOrInlineUrl(el.url)) continue;
      const cleanAssetId = typeof el.assetId === 'string' ? el.assetId.trim() : '';
      if (!cleanAssetId || hasRemoteOrInlineUrl(cleanAssetId)) continue;
      assetId = cleanAssetId;
    }

    seenIds.add(id);

    /** @type {{
     *   id: string;
     *   type: WhiteboardElementType;
     *   x: number;
     *   y: number;
     *   width: number;
     *   height: number;
     *   color: WhiteboardColorToken;
     *   transparentBg?: boolean;
     *   zIndex: number;
     *   text?: string;
     *   points?: readonly (readonly [number, number])[];
     *   startBinding?: ArrowEndpointBinding;
     *   endBinding?: ArrowEndpointBinding;
     *   assetId?: string;
     * }} */
    const cleanEl = {
      id,
      type,
      x: el.x,
      y: el.y,
      width,
      height,
      color,
      zIndex,
    };
    const startBinding = type === 'arrow' ? sanitizeArrowBinding(el.startBinding) : undefined;
    const endBinding = type === 'arrow' ? sanitizeArrowBinding(el.endBinding) : undefined;

    if (transparentBg) cleanEl.transparentBg = true;
    if (text !== undefined) cleanEl.text = text;
    if (points !== undefined) cleanEl.points = points;
    if (startBinding !== undefined) cleanEl.startBinding = startBinding;
    if (endBinding !== undefined) cleanEl.endBinding = endBinding;
    if (assetId !== undefined) cleanEl.assetId = assetId;

    out.push(Object.freeze(cleanEl));
  }

  return Object.freeze(out);
}

/**
 * Extract all unique local image assetIds referenced in whiteboard elements.
 * @param {readonly WhiteboardElement[]} elements
 * @returns {string[]}
 */
export function collectWhiteboardAssetIds(elements) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const el of elements) {
    if (el.type === 'image' && typeof el.assetId === 'string') {
      const clean = el.assetId.trim();
      if (clean) ids.add(clean);
    }
  }
  return [...ids];
}

/**
 * Create a validated Project record.
 * @param {{ id: string; name: string; description?: string; archived?: boolean; archivedAt?: string | null; now: string }} input
 * @returns {Project}
 */
export function createProject({
  id,
  name,
  description = '',
  archived = false,
  archivedAt = null,
  now,
}) {
  const cleanId = id.trim();
  const cleanName = name.trim();
  if (!cleanId) {
    throw new Error('Identifiant de projet requis.');
  }
  if (!cleanName) {
    throw new Error('Le nom du projet ne peut pas être vide.');
  }
  if (cleanName.length > 120) {
    throw new Error('Le nom du projet ne peut pas dépasser 120 caractères.');
  }
  const isArchived = Boolean(archived);
  const cleanArchivedAt = isArchived ? (archivedAt ?? now) : null;
  return Object.freeze({
    id: cleanId,
    name: cleanName,
    description: description.trim().slice(0, 1000),
    archived: isArchived,
    ...(cleanArchivedAt ? { archivedAt: cleanArchivedAt } : {}),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Normalize a list of cross-cutting tags (trimmed, stripped of leading #, deduplicated case-insensitively).
 * @param {unknown} rawTags
 * @returns {readonly string[]}
 */
export function normalizeTags(rawTags) {
  if (!Array.isArray(rawTags)) return Object.freeze([]);
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seenLower = new Set();
  for (const entry of rawTags) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seenLower.has(key)) continue;
    seenLower.add(key);
    out.push(cleaned);
    if (out.length >= 20) break;
  }
  return Object.freeze(out);
}

/** @type {ReadonlySet<LocalEntityKind>} */
const LOCAL_ENTITY_KINDS = new Set(['task', 'note', 'whiteboard']);

/**
 * Normalize and deduplicate an array of internal local entity references, stripping self-links.
 * @param {unknown} rawRefs
 * @param {LocalRef | null} [selfRef]
 * @returns {readonly LocalRef[]}
 */
export function normalizeLocalRefs(rawRefs, selfRef = null) {
  if (!Array.isArray(rawRefs)) return Object.freeze([]);
  /** @type {LocalRef[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const entry of rawRefs) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = /** @type {Record<string, unknown>} */ (entry);
    const kind = /** @type {LocalEntityKind} */ (obj.kind);
    if (!LOCAL_ENTITY_KINDS.has(kind)) continue;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    if (!id) continue;
    if (selfRef && selfRef.kind === kind && selfRef.id === id) continue;
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(Object.freeze({ kind, id }));
    if (out.length >= 50) break;
  }
  return Object.freeze(out);
}

/**
 * Parse a comma-separated tag input string into normalized tags.
 * @param {string} rawText
 * @returns {readonly string[]}
 */
export function parseTagsInput(rawText) {
  return normalizeTags(String(rawText).split(/[,;]/));
}

/**
 * Create a validated Task record.
 * @param {{
 *   id: string;
 *   projectId: string;
 *   title: string;
 *   status?: TaskStatus | null;
 *   priority?: TaskPriority;
 *   dueDate?: string | null;
 *   dueTime?: string | null;
 *   recurrence?: TaskRecurrence | null;
 *   position?: number;
 *   descriptionDoc?: RichTextDoc;
 *   checklist?: readonly ChecklistItem[];
 *   tags?: readonly string[];
 *   links?: readonly LocalRef[];
 *   assetIds?: readonly string[];
 *   archived?: boolean;
 *   archivedAt?: string | null;
 *   allowedStatuses?: readonly string[];
 *   now: string;
 * }} input
 * @returns {Task}
 */
export function createTask({
  id,
  projectId,
  title,
  status = 'todo',
  priority = 'medium',
  dueDate = null,
  dueTime = null,
  recurrence = null,
  position = 0,
  descriptionDoc,
  checklist = [],
  tags = [],
  links = [],
  assetIds,
  archived = false,
  archivedAt = null,
  allowedStatuses = TASK_STATUSES,
  now,
}) {
  const cleanId = id.trim();
  const cleanProjectId = projectId.trim();
  const cleanTitle = title.trim();
  if (!cleanId) throw new Error('Identifiant de tâche requis.');
  if (!cleanProjectId) throw new Error('Une tâche doit être rattachée à un projet.');
  if (!cleanTitle) throw new Error('Le titre de la tâche ne peut pas être vide.');
  if (cleanTitle.length > 200) {
    throw new Error('Le titre de la tâche ne peut pas dépasser 200 caractères.');
  }
  const cleanStatus = typeof status === 'string' ? status.trim() || null : null;
  if (cleanStatus !== null && !allowedStatuses.includes(cleanStatus)) {
    throw new Error(`Statut de tâche invalide : ${String(status)}.`);
  }
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new Error(`Priorité de tâche invalide : ${priority}.`);
  }

  const cleanDueDate = normalizeDueDate(dueDate);
  const cleanDueTime = cleanDueDate ? normalizeDueTime(dueTime) : null;
  const cleanRecurrence = normalizeTaskRecurrence(recurrence);
  const cleanDoc = sanitizeRichTextDoc(descriptionDoc);
  const derivedAssetIds = collectDocAssetIds(cleanDoc);
  const mergedAssets = [...new Set([...(assetIds ?? []), ...derivedAssetIds])];
  const isArchived = Boolean(archived);
  const cleanArchivedAt = isArchived ? (archivedAt ?? now) : null;

  return Object.freeze({
    id: cleanId,
    projectId: cleanProjectId,
    title: cleanTitle,
    status: cleanStatus,
    priority,
    dueDate: cleanDueDate,
    ...(cleanDueTime ? { dueTime: cleanDueTime } : {}),
    ...(cleanRecurrence ? { recurrence: cleanRecurrence } : {}),
    position: Number.isFinite(position) && position >= 0 ? Math.trunc(position) : 0,
    descriptionDoc: cleanDoc,
    checklist: normalizeChecklist(checklist),
    tags: normalizeTags(tags),
    links: normalizeLocalRefs(links, { kind: 'task', id: cleanId }),
    assetIds: mergedAssets,
    ...(isArchived
      ? { archived: true, ...(cleanArchivedAt ? { archivedAt: cleanArchivedAt } : {}) }
      : {}),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Create a validated Note record.
 * @param {{
 *   id: string;
 *   projectId: string | null;
 *   title: string;
 *   contentDoc?: RichTextDoc;
 *   tags?: readonly string[];
 *   links?: readonly LocalRef[];
 *   assetIds?: readonly string[];
 *   archived?: boolean;
 *   archivedAt?: string | null;
 *   now: string;
 * }} input
 * @returns {Note}
 */
export function createNote({
  id,
  projectId,
  title,
  contentDoc,
  tags = [],
  links = [],
  assetIds,
  archived = false,
  archivedAt = null,
  now,
}) {
  const cleanId = id.trim();
  const cleanTitle = title.trim();
  if (!cleanId) throw new Error('Identifiant de note requis.');
  if (!cleanTitle) throw new Error('Le titre de la note ne peut pas être vide.');
  if (cleanTitle.length > 200) {
    throw new Error('Le titre de la note ne peut pas dépasser 200 caractères.');
  }
  const cleanDoc = sanitizeRichTextDoc(contentDoc);
  const derivedAssetIds = collectDocAssetIds(cleanDoc);
  const mergedAssets = [...new Set([...(assetIds ?? []), ...derivedAssetIds])];
  const isArchived = Boolean(archived);
  const cleanArchivedAt = isArchived ? (archivedAt ?? now) : null;

  return Object.freeze({
    id: cleanId,
    projectId: projectId ? projectId.trim() : null,
    title: cleanTitle,
    contentDoc: cleanDoc,
    tags: normalizeTags(tags),
    links: normalizeLocalRefs(links, { kind: 'note', id: cleanId }),
    assetIds: mergedAssets,
    ...(isArchived
      ? { archived: true, ...(cleanArchivedAt ? { archivedAt: cleanArchivedAt } : {}) }
      : {}),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Create a validated Whiteboard record.
 * @param {{
 *   id: string;
 *   projectId: string | null;
 *   title: string;
 *   viewport?: WhiteboardViewport;
 *   elements?: readonly WhiteboardElement[];
 *   links?: readonly LocalRef[];
 *   assetIds?: readonly string[];
 *   archived?: boolean;
 *   archivedAt?: string | null;
 *   now: string;
 * }} input
 * @returns {Whiteboard}
 */
export function createWhiteboard({
  id,
  projectId,
  title,
  viewport,
  elements,
  links = [],
  assetIds,
  archived = false,
  archivedAt = null,
  now,
}) {
  const cleanId = id.trim();
  const cleanTitle = title.trim();
  if (!cleanId) throw new Error('Identifiant de tableau blanc requis.');
  if (!cleanTitle) throw new Error('Le titre du tableau blanc ne peut pas être vide.');
  if (cleanTitle.length > 200) {
    throw new Error('Le titre du tableau blanc ne peut pas dépasser 200 caractères.');
  }
  const cleanViewport = sanitizeWhiteboardViewport(viewport);
  const cleanElements = sanitizeWhiteboardElements(elements);
  const derivedAssetIds = collectWhiteboardAssetIds(cleanElements);
  const cleanProvidedAssets = (assetIds ?? [])
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
  const mergedAssets = [...new Set([...cleanProvidedAssets, ...derivedAssetIds])];
  const isArchived = Boolean(archived);
  const cleanArchivedAt = isArchived ? (archivedAt ?? now) : null;

  return Object.freeze({
    id: cleanId,
    projectId: projectId ? projectId.trim() : null,
    title: cleanTitle,
    viewport: cleanViewport,
    elements: cleanElements,
    links: normalizeLocalRefs(links, { kind: 'whiteboard', id: cleanId }),
    assetIds: mergedAssets,
    ...(isArchived
      ? { archived: true, ...(cleanArchivedAt ? { archivedAt: cleanArchivedAt } : {}) }
      : {}),
    createdAt: now,
    updatedAt: now,
  });
}

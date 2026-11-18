/** @import { ChecklistItem, LocalTemplate, RichTextDoc, RichTextNode, TemplateKind, WhiteboardElement, WhiteboardViewport } from '../types.d.ts' */

import {
  DEFAULT_WHITEBOARD_VIEWPORT,
  EMPTY_RICH_DOC,
  sanitizeRichTextDoc,
  sanitizeWhiteboardElements,
  sanitizeWhiteboardViewport,
} from './model.js';

/** @type {readonly TemplateKind[]} */
export const TEMPLATE_KINDS = Object.freeze(['checklist', 'note', 'whiteboard']);

/**
 * Remove `localImage` nodes from a RichTextDoc so saved templates never hold dangling assetIds.
 * @param {RichTextNode} node
 * @returns {RichTextNode | null}
 */
function stripNodeLocalImages(node) {
  if (node.type === 'localImage') return null;
  if (!Array.isArray(node.content)) return node;
  /** @type {RichTextNode[]} */
  const kept = [];
  for (const child of node.content) {
    const cleaned = stripNodeLocalImages(child);
    if (cleaned) kept.push(cleaned);
  }
  return {
    ...node,
    content: kept,
  };
}

/**
 * Sanitize a RichTextDoc for storage in a reusable local template.
 * @param {RichTextDoc | null | undefined} doc
 * @returns {RichTextDoc}
 */
export function sanitizeTemplateRichDoc(doc) {
  const safe = sanitizeRichTextDoc(doc ?? EMPTY_RICH_DOC);
  if (!Array.isArray(safe.content)) return EMPTY_RICH_DOC;
  /** @type {RichTextNode[]} */
  const kept = [];
  for (const child of safe.content) {
    const cleaned = stripNodeLocalImages(child);
    if (cleaned) kept.push(cleaned);
  }
  return kept.length > 0 ? { type: 'doc', content: kept } : EMPTY_RICH_DOC;
}

/**
 * Sanitize whiteboard elements for a reusable local template (removes binary image elements).
 * @param {readonly WhiteboardElement[] | null | undefined} elements
 * @returns {WhiteboardElement[]}
 */
export function sanitizeTemplateWhiteboardElements(elements) {
  const safe = sanitizeWhiteboardElements(elements ?? []);
  return safe.filter((el) => el.type !== 'image');
}

/**
 * Normalize checklist item labels for a reusable checklist template.
 * @param {readonly string[] | null | undefined} items
 * @returns {string[]}
 */
export function normalizeTemplateChecklistItems(items) {
  if (!Array.isArray(items)) return [];
  /** @type {string[]} */
  const clean = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const text = raw.trim().slice(0, 200);
    if (text) clean.push(text);
    if (clean.length >= 100) break;
  }
  return clean;
}

/**
 * Create a validated, frozen LocalTemplate record.
 * @param {{
 *   id: string;
 *   kind: TemplateKind;
 *   name: string;
 *   builtin?: boolean;
 *   now: string;
 *   checklistItems?: readonly string[];
 *   contentDoc?: RichTextDoc;
 *   elements?: readonly WhiteboardElement[];
 *   viewport?: WhiteboardViewport;
 * }} input
 * @returns {LocalTemplate}
 */
export function createLocalTemplate(input) {
  const cleanName = input.name.trim().slice(0, 120);
  if (!cleanName) {
    throw new Error('Le nom du modèle ne peut pas être vide.');
  }
  if (!TEMPLATE_KINDS.includes(input.kind)) {
    throw new Error(`Type de modèle inconnu : ${String(input.kind)}`);
  }

  if (input.kind === 'checklist') {
    const items = normalizeTemplateChecklistItems(input.checklistItems);
    if (items.length === 0) {
      throw new Error('Le modèle de checklist doit contenir au moins une étape.');
    }
    return Object.freeze({
      id: input.id,
      kind: 'checklist',
      name: cleanName,
      ...(input.builtin ? { builtin: true } : {}),
      createdAt: input.now,
      checklistItems: Object.freeze(items),
    });
  }

  if (input.kind === 'note') {
    return Object.freeze({
      id: input.id,
      kind: 'note',
      name: cleanName,
      ...(input.builtin ? { builtin: true } : {}),
      createdAt: input.now,
      contentDoc: sanitizeTemplateRichDoc(input.contentDoc),
    });
  }

  const elements = sanitizeTemplateWhiteboardElements(input.elements);
  if (elements.length === 0) {
    throw new Error('Le modèle de tableau blanc doit contenir au moins un élément.');
  }
  return Object.freeze({
    id: input.id,
    kind: 'whiteboard',
    name: cleanName,
    ...(input.builtin ? { builtin: true } : {}),
    createdAt: input.now,
    elements: Object.freeze(elements),
    viewport: sanitizeWhiteboardViewport(input.viewport ?? DEFAULT_WHITEBOARD_VIEWPORT),
  });
}

/**
 * Curated built-in local starter templates available offline out of the box.
 * @type {readonly LocalTemplate[]}
 */
export const BUILTIN_TEMPLATES = Object.freeze([
  createLocalTemplate({
    id: 'builtin-checklist-release',
    kind: 'checklist',
    name: 'Préparation de livraison',
    builtin: true,
    now: '2026-01-01T00:00:00.000Z',
    checklistItems: [
      'Vérifier les tests automatisés',
      'Exporter une sauvegarde ZIP locale',
      'Relire les points ouverts et notes liées',
      'Valider l’accessibilité clavier et le contraste',
    ],
  }),
  createLocalTemplate({
    id: 'builtin-checklist-review',
    kind: 'checklist',
    name: 'Revue qualité et sécurité',
    builtin: true,
    now: '2026-01-01T00:00:00.000Z',
    checklistItems: [
      'Contrôler les cas limites et messages d’erreur',
      'Vérifier la persistance après rechargement',
      'Nettoyer les éléments temporaires et orphelins',
    ],
  }),
  createLocalTemplate({
    id: 'builtin-note-meeting',
    kind: 'note',
    name: 'Compte-rendu de réunion',
    builtin: true,
    now: '2026-01-01T00:00:00.000Z',
    contentDoc: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Ordre du jour' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 1' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Point 2' }] }],
            },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Décisions' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Synthèse des décisions retenues.' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Actions à suivre' }],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Première action' }] },
              ],
            },
          ],
        },
      ],
    },
  }),
  createLocalTemplate({
    id: 'builtin-note-adr',
    kind: 'note',
    name: 'Note de décision (ADR)',
    builtin: true,
    now: '2026-01-01T00:00:00.000Z',
    contentDoc: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Contexte' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Problème traité et contraintes locales.' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Option retenue' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Choix d’architecture et justification.' }],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Conséquences' }] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Avantages et compromis' }] },
              ],
            },
          ],
        },
      ],
    },
  }),
  createLocalTemplate({
    id: 'builtin-wb-retro',
    kind: 'whiteboard',
    name: 'Rétrospective (3 colonnes)',
    builtin: true,
    now: '2026-01-01T00:00:00.000Z',
    viewport: { panX: 0, panY: 0, zoom: 1 },
    elements: [
      {
        id: 'r-col-1',
        type: 'rect',
        x: 40,
        y: 40,
        width: 220,
        height: 320,
        text: 'Points positifs',
        color: 'success',
        transparentBg: true,
        zIndex: 0,
      },
      {
        id: 'r-col-2',
        type: 'rect',
        x: 280,
        y: 40,
        width: 220,
        height: 320,
        text: 'À améliorer',
        color: 'warning',
        transparentBg: true,
        zIndex: 1,
      },
      {
        id: 'r-col-3',
        type: 'rect',
        x: 520,
        y: 40,
        width: 220,
        height: 320,
        text: 'Actions',
        color: 'accent',
        transparentBg: true,
        zIndex: 2,
      },
      {
        id: 'r-card-1',
        type: 'sticky',
        x: 60,
        y: 220,
        width: 180,
        height: 100,
        text: 'Ce qui a bien fonctionné',
        color: 'success',
        zIndex: 3,
      },
      {
        id: 'r-card-2',
        type: 'sticky',
        x: 300,
        y: 220,
        width: 180,
        height: 100,
        text: 'Point de friction',
        color: 'warning',
        zIndex: 4,
      },
      {
        id: 'r-card-3',
        type: 'sticky',
        x: 540,
        y: 220,
        width: 180,
        height: 100,
        text: 'Prochaine étape',
        color: 'accent',
        zIndex: 5,
      },
    ],
  }),
  createLocalTemplate({
    id: 'builtin-wb-flow',
    kind: 'whiteboard',
    name: 'Flux en 3 étapes',
    builtin: true,
    now: '2026-01-01T00:00:00.000Z',
    viewport: { panX: 0, panY: 0, zoom: 1 },
    elements: [
      {
        id: 'f-step-1',
        type: 'rect',
        x: 40,
        y: 120,
        width: 160,
        height: 100,
        text: 'Entrée',
        color: 'neutral',
        zIndex: 0,
      },
      {
        id: 'f-step-2',
        type: 'rect',
        x: 280,
        y: 120,
        width: 160,
        height: 100,
        text: 'Traitement',
        color: 'accent',
        zIndex: 1,
      },
      {
        id: 'f-step-3',
        type: 'rect',
        x: 520,
        y: 120,
        width: 160,
        height: 100,
        text: 'Sortie',
        color: 'success',
        zIndex: 2,
      },
      {
        id: 'f-arr-1',
        type: 'arrow',
        x: 200,
        y: 162,
        width: 80,
        height: 16,
        color: 'accent',
        points: [
          [0, 8],
          [80, 8],
        ],
        startBinding: { elementId: 'f-step-1', anchor: 'right' },
        endBinding: { elementId: 'f-step-2', anchor: 'left' },
        zIndex: 3,
      },
      {
        id: 'f-arr-2',
        type: 'arrow',
        x: 440,
        y: 162,
        width: 80,
        height: 16,
        color: 'success',
        points: [
          [0, 8],
          [80, 8],
        ],
        startBinding: { elementId: 'f-step-2', anchor: 'right' },
        endBinding: { elementId: 'f-step-3', anchor: 'left' },
        zIndex: 4,
      },
    ],
  }),
]);

/**
 * Instantiate fresh ChecklistItem objects from a checklist template.
 * @param {LocalTemplate} template
 * @param {() => string} [generateId]
 * @returns {ChecklistItem[]}
 */
export function instantiateChecklistTemplate(template, generateId = () => crypto.randomUUID()) {
  if (template.kind !== 'checklist') return [];
  return (template.checklistItems ?? []).map((text) => ({
    id: generateId(),
    text,
    done: false,
  }));
}

/**
 * Instantiate a fresh, sanitized RichTextDoc from a note outline template.
 * @param {LocalTemplate} template
 * @returns {RichTextDoc}
 */
export function instantiateNoteTemplate(template) {
  if (template.kind !== 'note') return EMPTY_RICH_DOC;
  return sanitizeTemplateRichDoc(structuredClone(template.contentDoc ?? EMPTY_RICH_DOC));
}

/**
 * Instantiate fresh Whiteboard elements + viewport from a whiteboard canvas template,
 * generating fresh element IDs and remapping bound arrow references.
 * @param {LocalTemplate} template
 * @param {() => string} [generateId]
 * @returns {{ elements: WhiteboardElement[]; viewport: WhiteboardViewport }}
 */
export function instantiateWhiteboardTemplate(template, generateId = () => crypto.randomUUID()) {
  if (template.kind !== 'whiteboard') {
    return { elements: [], viewport: { ...DEFAULT_WHITEBOARD_VIEWPORT } };
  }
  const source = template.elements ?? [];
  /** @type {Map<string, string>} */
  const idMap = new Map();
  for (const el of source) {
    idMap.set(el.id, generateId());
  }
  const elements = source.map((el) => {
    const newId = idMap.get(el.id) ?? generateId();
    const mappedStart = el.startBinding
      ? {
          ...el.startBinding,
          elementId: idMap.get(el.startBinding.elementId) ?? el.startBinding.elementId,
        }
      : undefined;
    const mappedEnd = el.endBinding
      ? {
          ...el.endBinding,
          elementId: idMap.get(el.endBinding.elementId) ?? el.endBinding.elementId,
        }
      : undefined;
    return {
      ...el,
      id: newId,
      ...(el.points ? { points: el.points.map((pt) => [pt[0], pt[1]]) } : {}),
      ...(mappedStart ? { startBinding: mappedStart } : {}),
      ...(mappedEnd ? { endBinding: mappedEnd } : {}),
    };
  });
  return {
    elements: [...sanitizeWhiteboardElements(elements)],
    viewport: sanitizeWhiteboardViewport(template.viewport ?? DEFAULT_WHITEBOARD_VIEWPORT),
  };
}

/**
 * Return built-in + custom templates matching a specific kind.
 * @param {readonly LocalTemplate[]} customTemplates
 * @param {TemplateKind} kind
 * @returns {LocalTemplate[]}
 */
export function getTemplatesForKind(customTemplates, kind) {
  const builtins = BUILTIN_TEMPLATES.filter((t) => t.kind === kind);
  const custom = customTemplates.filter((t) => t.kind === kind && !t.builtin);
  return [...builtins, ...custom];
}

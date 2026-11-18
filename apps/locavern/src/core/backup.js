/** @import { AppState, AssetMeta, BackupData, BackupManifest, Note, Project, RichTextDoc, RichTextNode, Task, TaskStatusConfig, Whiteboard } from '../types.d.ts' */

import { collectDocAssetIds, collectWhiteboardAssetIds } from './model.js';
import {
  CURRENT_SCHEMA_VERSION,
  MAX_ARCHIVE_BYTES,
  MAX_ASSET_BYTES,
  migrateBackupData,
} from './schema.js';

/**
 * Build manifest.json and data.json payloads from the current store state.
 * @param {AppState} state
 * @param {{ now: string; appVersion: string }} opts
 * @returns {{ manifest: BackupManifest; data: BackupData }}
 */
export function buildBackupPayload(state, { now, appVersion }) {
  /** @type {BackupData} */
  const data = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now,
    projects: [...state.projects],
    tasks: [...state.tasks],
    notes: [...state.notes],
    whiteboards: [...state.whiteboards],
    assets: [...state.assets],
    taskStatuses: [...state.preferences.taskStatuses],
  };

  /** @type {BackupManifest} */
  const manifest = {
    format: 'locavern-archive',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    exportedAt: now,
    counts: {
      projects: data.projects.length,
      tasks: data.tasks.length,
      notes: data.notes.length,
      whiteboards: data.whiteboards.length,
      assets: data.assets.length,
    },
  };

  return { manifest, data };
}

/**
 * Format the elapsed age since the last ZIP backup ISO timestamp.
 * @param {string | null | undefined} lastBackupAt
 * @param {number} [nowMs]
 * @returns {string}
 */
export function formatBackupAgeLabel(lastBackupAt, nowMs = Date.now()) {
  if (!lastBackupAt) return 'Aucune sauvegarde ZIP';
  const parsedMs = Date.parse(lastBackupAt);
  if (Number.isNaN(parsedMs)) return 'Aucune sauvegarde ZIP';
  const diffMs = Math.max(0, nowMs - parsedMs);
  if (diffMs < 60_000) return 'À l’instant';
  if (diffMs < 3_600_000) {
    return `Il y a ${Math.floor(diffMs / 60_000)} min`;
  }
  if (diffMs < 86_400_000) {
    return `Il y a ${Math.floor(diffMs / 3_600_000)} h`;
  }
  const days = Math.floor(diffMs / 86_400_000);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
}

/**
 * Validate an extracted backup archive (manifest + data + binary asset map) before importing.
 * @param {unknown} rawManifest
 * @param {unknown} rawData
 * @param {ReadonlyMap<string, Uint8Array>} binaryAssets
 * @returns {{ ok: true; data: BackupData } | { ok: false; error: string }}
 */
export function validateArchiveContents(rawManifest, rawData, binaryAssets) {
  if (!rawManifest || typeof rawManifest !== 'object' || Array.isArray(rawManifest)) {
    return {
      ok: false,
      error: 'Impossible d’importer l’archive. Le fichier manifest.json est invalide.',
    };
  }
  const manifest = /** @type {Record<string, unknown>} */ (rawManifest);
  if (manifest.format !== 'locavern-archive') {
    return {
      ok: false,
      error: 'Archive non reconnue. Ce fichier n’est pas une sauvegarde Locavern.',
    };
  }
  if (
    typeof manifest.schemaVersion !== 'number' ||
    manifest.schemaVersion > CURRENT_SCHEMA_VERSION ||
    manifest.schemaVersion < 1
  ) {
    return {
      ok: false,
      error: `Version d’archive non prise en charge (${String(manifest.schemaVersion)}).`,
    };
  }

  const migrated = migrateBackupData(rawData);
  if (!migrated.ok) {
    return migrated;
  }

  let totalBinaryBytes = 0;
  for (const meta of migrated.data.assets) {
    const bytes = binaryAssets.get(meta.id);
    if (!bytes) {
      return {
        ok: false,
        error: `Image manquante dans l’archive (${meta.filename}). Restauration annulée.`,
      };
    }
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
      return {
        ok: false,
        error: `Taille de fichier invalide pour l’image ${meta.filename}.`,
      };
    }
    totalBinaryBytes += bytes.byteLength;
    if (totalBinaryBytes > MAX_ARCHIVE_BYTES) {
      return {
        ok: false,
        error: 'L’archive dépasse la taille totale maximale autorisée (25 Mio).',
      };
    }
  }

  return { ok: true, data: migrated.data };
}

/**
 * Allocate a non-colliding ID relative to `taken`, reusing `preferredId` when available.
 * @param {string} preferredId
 * @param {Set<string>} taken
 * @param {() => string} generateId
 * @returns {string}
 */
function allocateUniqueId(preferredId, taken, generateId) {
  if (!taken.has(preferredId)) {
    taken.add(preferredId);
    return preferredId;
  }
  let candidate = generateId();
  while (taken.has(candidate)) {
    candidate = generateId();
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Rewrite `localImage` assetId references inside a RichTextNode tree.
 * @param {RichTextNode} node
 * @param {ReadonlyMap<string, string>} assetIdMap
 * @returns {RichTextNode}
 */
function remapRichTextNodeAssets(node, assetIdMap) {
  let changed = false;
  let nextAttrs = node.attrs;
  if (node.type === 'localImage' && node.attrs && typeof node.attrs.assetId === 'string') {
    const mapped = assetIdMap.get(node.attrs.assetId);
    if (mapped && mapped !== node.attrs.assetId) {
      nextAttrs = { ...node.attrs, assetId: mapped };
      changed = true;
    }
  }

  /** @type {RichTextNode[] | undefined} */
  let nextContent;
  if (Array.isArray(node.content)) {
    nextContent = node.content.map((child) => {
      const remappedChild = remapRichTextNodeAssets(child, assetIdMap);
      if (remappedChild !== child) changed = true;
      return remappedChild;
    });
  }

  if (!changed) return node;
  return {
    ...node,
    ...(nextAttrs !== undefined ? { attrs: nextAttrs } : {}),
    ...(nextContent !== undefined ? { content: nextContent } : {}),
  };
}

/**
 * Rewrite `localImage` assetId references inside a RichTextDoc.
 * @param {RichTextDoc} doc
 * @param {ReadonlyMap<string, string>} assetIdMap
 * @returns {RichTextDoc}
 */
function remapRichTextDocAssets(doc, assetIdMap) {
  if (assetIdMap.size === 0 || !Array.isArray(doc.content)) return doc;
  let changed = false;
  const nextContent = doc.content.map((child) => {
    const remapped = remapRichTextNodeAssets(child, assetIdMap);
    if (remapped !== child) changed = true;
    return remapped;
  });
  return changed ? Object.freeze({ type: 'doc', content: nextContent }) : doc;
}

/**
 * Map and deduplicate assetIds through `assetIdMap`.
 * @param {readonly string[]} assetIds
 * @param {ReadonlyMap<string, string>} assetIdMap
 * @returns {string[]}
 */
function remapAssetIdList(assetIds, assetIdMap) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const id of assetIds) {
    out.add(assetIdMap.get(id) ?? id);
  }
  return [...out];
}

/**
 * Prepare a non-destructive merge or project-selective import from a validated backup archive.
 * Existing local records are never overwritten; colliding IDs are remapped cleanly along with references.
 * @param {AppState} currentState
 * @param {BackupData} importedData
 * @param {ReadonlyMap<string, Blob>} importedBlobs
 * @param {{
 *   mode: 'merge' | 'projects';
 *   selectedProjectIds?: readonly string[];
 *   includeUnassigned?: boolean;
 *   generateId?: () => string;
 * }} options
 * @returns {{
 *   projects: Project[];
 *   tasks: Task[];
 *   notes: Note[];
 *   whiteboards: Whiteboard[];
 *   assets: AssetMeta[];
 *   taskStatuses?: TaskStatusConfig[];
 *   blobs: Map<string, Blob>;
 * }}
 */
export function prepareBackupMerge(currentState, importedData, importedBlobs, options) {
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const selectedSet = new Set(options.selectedProjectIds ?? []);
  const includeUnassigned = options.mode === 'merge' ? true : Boolean(options.includeUnassigned);

  const takenProjectIds = new Set(currentState.projects.map((p) => p.id));
  const takenTaskIds = new Set(currentState.tasks.map((t) => t.id));
  const takenNoteIds = new Set(currentState.notes.map((n) => n.id));
  const takenWhiteboardIds = new Set(currentState.whiteboards.map((w) => w.id));
  const takenAssetIds = new Set(currentState.assets.map((a) => a.id));

  const candidateProjects =
    options.mode === 'projects'
      ? importedData.projects.filter((p) => selectedSet.has(p.id))
      : importedData.projects;

  /** @type {Map<string, string>} */
  const projectIdMap = new Map();
  /** @type {Project[]} */
  const projects = [];
  for (const project of candidateProjects) {
    const nextId = allocateUniqueId(project.id, takenProjectIds, generateId);
    projectIdMap.set(project.id, nextId);
    projects.push(nextId === project.id ? project : Object.freeze({ ...project, id: nextId }));
  }

  const candidateTasks = importedData.tasks.filter((t) => projectIdMap.has(t.projectId));
  const candidateNotes = importedData.notes.filter((n) =>
    n.projectId === null ? includeUnassigned : projectIdMap.has(n.projectId),
  );
  const candidateWhiteboards = importedData.whiteboards.filter((w) =>
    w.projectId === null ? includeUnassigned : projectIdMap.has(w.projectId),
  );

  /** @type {Set<string>} */
  const neededAssetIds = new Set();
  for (const task of candidateTasks) {
    for (const id of task.assetIds) neededAssetIds.add(id);
    for (const id of collectDocAssetIds(task.descriptionDoc)) neededAssetIds.add(id);
  }
  for (const note of candidateNotes) {
    for (const id of note.assetIds) neededAssetIds.add(id);
    for (const id of collectDocAssetIds(note.contentDoc)) neededAssetIds.add(id);
  }
  for (const wb of candidateWhiteboards) {
    for (const id of wb.assetIds) neededAssetIds.add(id);
    for (const id of collectWhiteboardAssetIds(wb.elements)) neededAssetIds.add(id);
  }

  /** @type {Map<string, string>} */
  const assetIdMap = new Map();
  /** @type {AssetMeta[]} */
  const assets = [];
  /** @type {Map<string, Blob>} */
  const blobs = new Map();

  for (const asset of importedData.assets) {
    if (!neededAssetIds.has(asset.id)) continue;
    const nextAssetId = allocateUniqueId(asset.id, takenAssetIds, generateId);
    assetIdMap.set(asset.id, nextAssetId);
    const nextAsset =
      nextAssetId === asset.id ? asset : Object.freeze({ ...asset, id: nextAssetId });
    assets.push(nextAsset);
    const blob = importedBlobs.get(asset.id);
    if (blob) {
      blobs.set(nextAssetId, blob);
    }
  }

  /** @type {Task[]} */
  const tasks = candidateTasks.map((task) => {
    const nextId = allocateUniqueId(task.id, takenTaskIds, generateId);
    const nextProjectId = projectIdMap.get(task.projectId) ?? task.projectId;
    const nextDoc = remapRichTextDocAssets(task.descriptionDoc, assetIdMap);
    const nextAssetIds = remapAssetIdList(task.assetIds, assetIdMap);
    return Object.freeze({
      ...task,
      id: nextId,
      projectId: nextProjectId,
      descriptionDoc: nextDoc,
      assetIds: nextAssetIds,
    });
  });

  /** @type {Note[]} */
  const notes = candidateNotes.map((note) => {
    const nextId = allocateUniqueId(note.id, takenNoteIds, generateId);
    const nextProjectId =
      note.projectId === null ? null : (projectIdMap.get(note.projectId) ?? note.projectId);
    const nextDoc = remapRichTextDocAssets(note.contentDoc, assetIdMap);
    const nextAssetIds = remapAssetIdList(note.assetIds, assetIdMap);
    return Object.freeze({
      ...note,
      id: nextId,
      projectId: nextProjectId,
      contentDoc: nextDoc,
      assetIds: nextAssetIds,
    });
  });

  /** @type {Whiteboard[]} */
  const whiteboards = candidateWhiteboards.map((wb) => {
    const nextId = allocateUniqueId(wb.id, takenWhiteboardIds, generateId);
    const nextProjectId =
      wb.projectId === null ? null : (projectIdMap.get(wb.projectId) ?? wb.projectId);
    const nextElements = wb.elements.map((el) => {
      if (!el.assetId) return el;
      const mapped = assetIdMap.get(el.assetId);
      return mapped && mapped !== el.assetId ? Object.freeze({ ...el, assetId: mapped }) : el;
    });
    const nextAssetIds = remapAssetIdList(wb.assetIds, assetIdMap);
    return Object.freeze({
      ...wb,
      id: nextId,
      projectId: nextProjectId,
      elements: nextElements,
      assetIds: nextAssetIds,
    });
  });

  // Preserve all local statuses, and append any missing custom status used by imported tasks
  const existingStatusIds = new Set(currentState.preferences.taskStatuses.map((s) => s.id));
  const importedStatusMap = new Map((importedData.taskStatuses ?? []).map((s) => [s.id, s]));
  /** @type {TaskStatusConfig[]} */
  const extraStatuses = [];
  for (const task of tasks) {
    if (task.status && !existingStatusIds.has(task.status)) {
      const cfg = importedStatusMap.get(task.status);
      if (cfg) {
        existingStatusIds.add(task.status);
        extraStatuses.push(cfg);
      }
    }
  }

  return {
    projects,
    tasks,
    notes,
    whiteboards,
    assets,
    ...(extraStatuses.length > 0
      ? { taskStatuses: [...currentState.preferences.taskStatuses, ...extraStatuses] }
      : {}),
    blobs,
  };
}

// Types of the data and of the state machine of Transient Notes. The core (`src/core`) and the
// adapters share them; nothing here is executable.

import type { RichTextDoc } from '@simple-web-tools/rich-text';

export type { RichTextDoc };

/** The four PARA categories: a fixed list, in this order. */
export type ParaCategory = 'projects' | 'areas' | 'resources' | 'archives';

/** A folder belongs to exactly one category. `createdAt` is an ISO 8601 timestamp. */
export interface Folder {
  readonly id: string;
  readonly name: string;
  readonly category: ParaCategory;
  readonly createdAt: string;
}

/** `folderId: null` is a note with no folder (shown in "All notes" only). */
export interface Note {
  readonly id: string;
  /** May be empty: the views show a placeholder ("Untitled") and the exports a fallback. */
  readonly title: string;
  readonly doc: RichTextDoc;
  readonly folderId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The metadata of a local image. The Blob is stored next to it in IndexedDB, never in the state. */
export interface AssetMeta {
  readonly id: string;
  /** One of `ALLOWED_IMAGE_MIMES`. */
  readonly mime: string;
  /** Size in bytes. */
  readonly size: number;
  readonly createdAt: string;
}

/** What the notes list shows: everything, one category (all its folders) or one folder. */
export type Selection =
  | { readonly kind: 'all' }
  | { readonly kind: 'category'; readonly category: ParaCategory }
  | { readonly kind: 'folder'; readonly folderId: string };

export type SortKey = 'updated' | 'created' | 'title';

/** Preferences kept with the data of a workspace (the `meta` store, key `preferences`). */
export interface WorkspacePreferences {
  readonly sort: SortKey;
}

export interface AppState {
  readonly schemaVersion: 1;
  /** True in a tab that does not hold the write lock: data commands are refused. */
  readonly readOnly: boolean;
  readonly folders: readonly Folder[];
  readonly notes: readonly Note[];
  readonly assets: readonly AssetMeta[];
  readonly selection: Selection;
  readonly selectedNoteId: string | null;
  /** The text typed in the search field (not normalized). */
  readonly search: string;
  readonly preferences: WorkspacePreferences;
}

/** What is read from a workspace database at start and when a read-only tab refreshes. */
export interface WorkspaceData {
  readonly folders: readonly Folder[];
  readonly notes: readonly Note[];
  readonly assets: readonly AssetMeta[];
}

/** A command carries everything it needs: ids and timestamps are made by the caller. */
export type AppCommand =
  | {
      type: 'hydrate';
      payload: WorkspaceData & {
        readOnly?: boolean;
        preferences?: Partial<WorkspacePreferences>;
      };
    }
  | { type: 'reload_data'; payload: WorkspaceData }
  | { type: 'set_read_only'; readOnly: boolean }
  | { type: 'select'; selection: Selection }
  | { type: 'select_note'; noteId: string | null }
  | { type: 'set_search'; query: string }
  | { type: 'set_sort'; sort: SortKey }
  | { type: 'create_folder'; id: string; name: string; category: ParaCategory; now: string }
  | { type: 'rename_folder'; id: string; name: string }
  | { type: 'move_folder'; id: string; category: ParaCategory }
  | { type: 'delete_folder'; id: string }
  | {
      type: 'create_note';
      id: string;
      now: string;
      /** A quick create in a category: the first folder of the category, or the default one. */
      category?: ParaCategory;
      /** Used only when the target category has no folder yet. */
      defaultFolder?: { id: string; name: string };
    }
  | { type: 'update_note'; id: string; now: string; title?: string; doc?: RichTextDoc }
  | { type: 'move_note'; id: string; folderId: string | null }
  | { type: 'delete_note'; id: string }
  | { type: 'add_asset'; asset: AssetMeta; blob: Blob }
  | { type: 'purge_orphaned_assets' };

/** What the adapter has to persist after a command. Written in one transaction, in order. */
export type StoreEffect =
  | { type: 'persist_folder'; folder: Folder }
  | { type: 'remove_folder'; id: string }
  | { type: 'persist_note'; note: Note }
  | { type: 'remove_note'; id: string }
  | { type: 'persist_asset'; asset: AssetMeta; blob: Blob }
  | { type: 'remove_asset'; id: string }
  | { type: 'persist_preferences'; preferences: WorkspacePreferences };

/** A note, folder or asset list rebuilt from a backup file, with what was left out. */
export interface BackupAsset extends AssetMeta {
  /** The picture, base64 encoded (no `data:` prefix). */
  readonly data: string;
}

export interface BackupData {
  readonly folders: readonly Folder[];
  readonly notes: readonly Note[];
  readonly assets: readonly BackupAsset[];
}

export interface BackupSkipped {
  readonly folders: number;
  readonly notes: number;
  readonly assets: number;
}

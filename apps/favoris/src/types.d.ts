// Types of the data and of the state machine of Favoris. The core (`src/core`) and the adapters
// share them; nothing here is executable.

/** A Covenant category colour, 1 to 16 (`data-cat`). The number is stored, never a hex value. */
export type CategoryNumber = number;

/**
 * A group of links, with a colour. `position` is its place among the groups (0, 1, 2...): the
 * core keeps it equal to the index of the group in the list.
 */
export interface Group {
  readonly id: string;
  readonly label: string;
  readonly category: CategoryNumber;
  /** A featured group is shown first. */
  readonly featured: boolean;
  /** A folded group shows its title only. */
  readonly collapsed: boolean;
  readonly position: number;
}

/**
 * A bookmark. `url` is always an `http:` or `https:` address. `groupId: null` is a link with no
 * group (shown in the "Ungrouped" card). `position` is its place among all the links; the links
 * of a group keep that relative order.
 */
export interface Link {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly groupId: string | null;
  readonly position: number;
}

export interface AppState {
  readonly schemaVersion: 1;
  /** True in a tab that does not hold the write lock: data commands are refused. */
  readonly readOnly: boolean;
  readonly groups: readonly Group[];
  readonly links: readonly Link[];
  /** The text typed in the search field (not normalized). */
  readonly search: string;
  /** Edit mode: drag handles, the move menus, empty groups and the group controls. */
  readonly editMode: boolean;
}

/** What is read from a workspace database at start and when a read-only tab refreshes. */
export interface WorkspaceData {
  readonly groups: readonly Group[];
  readonly links: readonly Link[];
}

/** Where a dragged or moved item goes, relative to another item. */
export type Place = 'before' | 'after';

/** A command carries everything it needs: ids are made by the caller. */
export type AppCommand =
  | { type: 'hydrate'; payload: WorkspaceData & { readOnly?: boolean } }
  | { type: 'reload_data'; payload: WorkspaceData }
  | { type: 'set_read_only'; readOnly: boolean }
  | { type: 'set_search'; query: string }
  | { type: 'set_edit_mode'; editMode: boolean }
  | {
      type: 'create_group';
      id: string;
      label: string;
      category: CategoryNumber;
      featured?: boolean;
    }
  | {
      type: 'update_group';
      id: string;
      label?: string;
      category?: CategoryNumber;
      featured?: boolean;
      collapsed?: boolean;
    }
  | { type: 'delete_group'; id: string }
  | { type: 'move_group'; id: string; targetId: string; place: Place }
  | { type: 'shift_group'; id: string; delta: -1 | 1 }
  | { type: 'create_link'; id: string; name: string; url: string; groupId: string | null }
  | {
      type: 'update_link';
      id: string;
      name?: string;
      url?: string;
      groupId?: string | null;
    }
  | { type: 'delete_link'; id: string }
  /**
   * Puts a link in a group: next to `targetId` (a link, `place` says on which side) or, without
   * a target, at the end of `groupId`. With a target, the link joins the group of the target.
   */
  | {
      type: 'move_link';
      id: string;
      groupId: string | null;
      targetId?: string;
      place?: Place;
    }
  | { type: 'shift_link'; id: string; delta: -1 | 1 };

/** What the adapter has to persist after a command. Written in one transaction, in order. */
export type StoreEffect =
  | { type: 'persist_group'; group: Group }
  | { type: 'remove_group'; id: string }
  | { type: 'persist_link'; link: Link }
  | { type: 'remove_link'; id: string };

/** What a file or an old record left out. */
export interface Skipped {
  /** Groups that were not valid records. */
  readonly groups: number;
  /** Links that were not valid records. */
  readonly links: number;
  /** Links whose address is not an `http:` or `https:` one. */
  readonly unsafeUrls: number;
}

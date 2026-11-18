export type TaskStatus = string;

export type TaskStatusRole = 'initial' | 'terminal';

export interface TaskStatusConfig {
  readonly id: TaskStatus;
  readonly label: string;
  readonly isInitial?: boolean;
  readonly isTerminal?: boolean;
}

export type TaskStatusFilter = TaskStatus | 'all' | '__none__' | '__unknown__';

export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskRecurrence = 'daily' | 'weekly' | 'monthly';

export type LocalEntityKind = 'task' | 'note' | 'whiteboard';

export type TemplateKind = 'checklist' | 'note' | 'whiteboard';

export interface LocalTemplate {
  readonly id: string;
  readonly kind: TemplateKind;
  readonly name: string;
  readonly builtin?: boolean;
  readonly createdAt: string;
  readonly checklistItems?: readonly string[];
  readonly contentDoc?: RichTextDoc;
  readonly elements?: readonly WhiteboardElement[];
  readonly viewport?: WhiteboardViewport;
}

export type TrashItemKind = 'project' | 'task' | 'note' | 'whiteboard';

export interface TrashItem {
  readonly id: string;
  readonly kind: TrashItemKind;
  readonly title: string;
  readonly deletedAt: string;
  readonly expiresAt: string;
  readonly projectId: string | null;
  readonly projectName?: string | null;
  readonly project?: Project;
  readonly tasks?: readonly Task[];
  readonly task?: Task;
  readonly note?: Note;
  readonly whiteboard?: Whiteboard;
  readonly assetIds: readonly string[];
}

export interface LocalRef {
  readonly kind: LocalEntityKind;
  readonly id: string;
}

export type TaskDueFilter = 'all' | 'overdue' | 'today' | 'week' | 'undated';

export type AllowedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export type InputPresentationScreen = 'tasks' | 'projects' | 'notes' | 'whiteboards';

export type ActiveView = InputPresentationScreen | 'calendar' | 'today' | 'archives';

export type TaskDisplayMode = 'list' | 'kanban';

export type InputPresentation = 'drawer' | 'modal';

export type InputPresentationMap = Readonly<Record<InputPresentationScreen, InputPresentation>>;

export type WhiteboardElementType =
  'sticky' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'path' | 'image';

export type WhiteboardColorToken = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export type ArrowSnapAnchor = 'center' | 'top' | 'right' | 'bottom' | 'left';

export interface ArrowEndpointBinding {
  readonly elementId: string;
  readonly anchor?: ArrowSnapAnchor;
}

export interface WhiteboardElement {
  readonly id: string;
  readonly type: WhiteboardElementType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text?: string;
  readonly color: WhiteboardColorToken;
  readonly transparentBg?: boolean;
  readonly points?: readonly (readonly [number, number])[];
  readonly startBinding?: ArrowEndpointBinding | null;
  readonly endBinding?: ArrowEndpointBinding | null;
  readonly assetId?: string;
  readonly zIndex: number;
}

export interface WhiteboardViewport {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

export interface Whiteboard {
  readonly id: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly viewport: WhiteboardViewport;
  readonly elements: readonly WhiteboardElement[];
  readonly links?: readonly LocalRef[];
  readonly assetIds: readonly string[];
  readonly archived?: boolean;
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RichTextMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}

export interface RichTextNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly text?: string;
  readonly marks?: readonly RichTextMark[];
  readonly content?: readonly RichTextNode[];
}

export interface RichTextDoc {
  readonly type: 'doc';
  readonly content?: readonly RichTextNode[];
}

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly archived: boolean;
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: TaskStatus | null;
  readonly priority: TaskPriority;
  readonly dueDate: string | null;
  readonly dueTime?: string | null;
  readonly recurrence?: TaskRecurrence | null;
  readonly position: number;
  readonly descriptionDoc: RichTextDoc;
  readonly checklist: readonly ChecklistItem[];
  readonly tags?: readonly string[];
  readonly links?: readonly LocalRef[];
  readonly assetIds: readonly string[];
  readonly archived?: boolean;
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Note {
  readonly id: string;
  readonly projectId: string | null;
  readonly title: string;
  readonly contentDoc: RichTextDoc;
  readonly tags?: readonly string[];
  readonly links?: readonly LocalRef[];
  readonly assetIds: readonly string[];
  readonly archived?: boolean;
  readonly archivedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AssetMeta {
  readonly id: string;
  readonly mimeType: AllowedImageMimeType;
  readonly sizeBytes: number;
  readonly filename: string;
  readonly createdAt: string;
}

export interface AppPreferences {
  readonly activeView: ActiveView;
  readonly taskDisplayMode: TaskDisplayMode;
  readonly selectedProjectId: string | null;
  readonly selectedNoteId: string | null;
  readonly selectedWhiteboardId: string | null;
  readonly inputPresentations: InputPresentationMap;
  readonly taskStatuses: readonly TaskStatusConfig[];
  readonly statusRolesConfigured?: boolean;
  readonly toastDurationSeconds: number;
  readonly trashRetentionDays: number;
}

export interface AppState {
  readonly schemaVersion: 2;
  readonly readOnly: boolean;
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly whiteboards: readonly Whiteboard[];
  readonly assets: readonly AssetMeta[];
  readonly trash: readonly TrashItem[];
  readonly templates: readonly LocalTemplate[];
  readonly preferences: AppPreferences;
}

export interface HydratePayload {
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly whiteboards?: readonly Whiteboard[];
  readonly assets: readonly AssetMeta[];
  readonly trash?: readonly TrashItem[];
  readonly templates?: readonly LocalTemplate[];
  readonly preferences?: Partial<Omit<AppPreferences, 'inputPresentations' | 'taskStatuses'>> & {
    readonly inputPresentations?: Partial<InputPresentationMap>;
    readonly taskStatuses?: readonly TaskStatusConfig[];
  };
  readonly readOnly?: boolean;
}

export interface BackupData {
  readonly schemaVersion: 2;
  readonly exportedAt: string;
  readonly projects: readonly Project[];
  readonly tasks: readonly Task[];
  readonly notes: readonly Note[];
  readonly whiteboards: readonly Whiteboard[];
  readonly assets: readonly AssetMeta[];
  readonly taskStatuses?: readonly TaskStatusConfig[];
}

export interface BackupManifest {
  readonly format: 'locavern-archive';
  readonly schemaVersion: 2;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly counts: {
    readonly projects: number;
    readonly tasks: number;
    readonly notes: number;
    readonly whiteboards: number;
    readonly assets: number;
  };
}

export type AppCommand =
  | { readonly type: 'hydrate'; readonly payload: HydratePayload }
  | { readonly type: 'set_read_only'; readonly readOnly: boolean }
  | { readonly type: 'set_view'; readonly view: ActiveView }
  | { readonly type: 'set_task_display_mode'; readonly mode: TaskDisplayMode }
  | {
      readonly type: 'set_input_presentation';
      readonly screen: InputPresentationScreen;
      readonly presentation: InputPresentation;
    }
  | {
      readonly type: 'set_task_statuses';
      readonly statuses: readonly TaskStatusConfig[];
    }
  | { readonly type: 'set_toast_duration'; readonly seconds: number }
  | { readonly type: 'set_trash_retention_days'; readonly days: number }
  | { readonly type: 'select_project'; readonly projectId: string | null }
  | { readonly type: 'select_note'; readonly noteId: string | null }
  | { readonly type: 'select_whiteboard'; readonly whiteboardId: string | null }
  | {
      readonly type: 'create_project';
      readonly id: string;
      readonly name: string;
      readonly description?: string;
      readonly now: string;
    }
  | {
      readonly type: 'update_project';
      readonly id: string;
      readonly name: string;
      readonly description: string;
      readonly now: string;
    }
  | {
      readonly type: 'toggle_archive_project';
      readonly id: string;
      readonly archived: boolean;
      readonly now: string;
    }
  | { readonly type: 'delete_project'; readonly id: string }
  | {
      readonly type: 'trash_project';
      readonly id: string;
      readonly trashId?: string;
      readonly now: string;
    }
  | {
      readonly type: 'create_task';
      readonly id: string;
      readonly projectId: string;
      readonly title: string;
      readonly status?: TaskStatus | null;
      readonly priority?: TaskPriority;
      readonly dueDate?: string | null;
      readonly dueTime?: string | null;
      readonly recurrence?: TaskRecurrence | null;
      readonly descriptionDoc?: RichTextDoc;
      readonly checklist?: readonly ChecklistItem[];
      readonly tags?: readonly string[];
      readonly links?: readonly LocalRef[];
      readonly assetIds?: readonly string[];
      readonly now: string;
    }
  | {
      readonly type: 'update_task';
      readonly id: string;
      readonly patch: {
        readonly title?: string;
        readonly projectId?: string;
        readonly status?: TaskStatus | null;
        readonly priority?: TaskPriority;
        readonly dueDate?: string | null;
        readonly dueTime?: string | null;
        readonly recurrence?: TaskRecurrence | null;
        readonly descriptionDoc?: RichTextDoc;
        readonly checklist?: readonly ChecklistItem[];
        readonly tags?: readonly string[];
        readonly links?: readonly LocalRef[];
        readonly assetIds?: readonly string[];
      };
      readonly nextOccurrenceId?: string;
      readonly todayIso?: string;
      readonly now: string;
    }
  | {
      readonly type: 'toggle_archive_task';
      readonly id: string;
      readonly archived: boolean;
      readonly now: string;
    }
  | {
      readonly type: 'move_task';
      readonly id: string;
      readonly targetStatus: TaskStatus;
      readonly targetIndex: number;
      readonly nextOccurrenceId?: string;
      readonly todayIso?: string;
      readonly now: string;
    }
  | { readonly type: 'delete_task'; readonly id: string }
  | {
      readonly type: 'trash_task';
      readonly id: string;
      readonly trashId?: string;
      readonly now: string;
    }
  | {
      readonly type: 'create_note';
      readonly id: string;
      readonly projectId: string | null;
      readonly title: string;
      readonly contentDoc?: RichTextDoc;
      readonly tags?: readonly string[];
      readonly links?: readonly LocalRef[];
      readonly assetIds?: readonly string[];
      readonly now: string;
    }
  | {
      readonly type: 'update_note';
      readonly id: string;
      readonly patch: {
        readonly projectId?: string | null;
        readonly title?: string;
        readonly contentDoc?: RichTextDoc;
        readonly tags?: readonly string[];
        readonly links?: readonly LocalRef[];
        readonly assetIds?: readonly string[];
      };
      readonly now: string;
    }
  | {
      readonly type: 'toggle_archive_note';
      readonly id: string;
      readonly archived: boolean;
      readonly now: string;
    }
  | { readonly type: 'delete_note'; readonly id: string }
  | {
      readonly type: 'trash_note';
      readonly id: string;
      readonly trashId?: string;
      readonly now: string;
    }
  | {
      readonly type: 'create_whiteboard';
      readonly id: string;
      readonly projectId: string | null;
      readonly title: string;
      readonly viewport?: WhiteboardViewport;
      readonly elements?: readonly WhiteboardElement[];
      readonly links?: readonly LocalRef[];
      readonly assetIds?: readonly string[];
      readonly now: string;
    }
  | {
      readonly type: 'update_whiteboard';
      readonly id: string;
      readonly patch: {
        readonly projectId?: string | null;
        readonly title?: string;
        readonly viewport?: WhiteboardViewport;
        readonly elements?: readonly WhiteboardElement[];
        readonly links?: readonly LocalRef[];
        readonly assetIds?: readonly string[];
      };
      readonly now: string;
    }
  | {
      readonly type: 'toggle_archive_whiteboard';
      readonly id: string;
      readonly archived: boolean;
      readonly now: string;
    }
  | { readonly type: 'delete_whiteboard'; readonly id: string }
  | {
      readonly type: 'trash_whiteboard';
      readonly id: string;
      readonly trashId?: string;
      readonly now: string;
    }
  | { readonly type: 'restore_trash_item'; readonly id: string; readonly now: string }
  | { readonly type: 'purge_trash_item'; readonly id: string }
  | { readonly type: 'empty_trash' }
  | { readonly type: 'purge_expired_trash'; readonly now: string }
  | {
      readonly type: 'create_template';
      readonly id: string;
      readonly kind: TemplateKind;
      readonly name: string;
      readonly checklistItems?: readonly string[];
      readonly contentDoc?: RichTextDoc;
      readonly elements?: readonly WhiteboardElement[];
      readonly viewport?: WhiteboardViewport;
      readonly now: string;
    }
  | { readonly type: 'delete_template'; readonly id: string }
  | { readonly type: 'register_asset'; readonly asset: AssetMeta }
  | { readonly type: 'delete_asset'; readonly id: string }
  | {
      readonly type: 'replace_all';
      readonly payload: {
        readonly projects: readonly Project[];
        readonly tasks: readonly Task[];
        readonly notes: readonly Note[];
        readonly whiteboards: readonly Whiteboard[];
        readonly assets: readonly AssetMeta[];
        readonly taskStatuses?: readonly TaskStatusConfig[];
      };
    }
  | {
      readonly type: 'merge_backup';
      readonly payload: {
        readonly projects: readonly Project[];
        readonly tasks: readonly Task[];
        readonly notes: readonly Note[];
        readonly whiteboards: readonly Whiteboard[];
        readonly assets: readonly AssetMeta[];
        readonly taskStatuses?: readonly TaskStatusConfig[];
      };
    };

export type StoreEffect =
  | { readonly type: 'persist_project'; readonly project: Project }
  | {
      readonly type: 'remove_project';
      readonly id: string;
      readonly deletedTaskIds: readonly string[];
      readonly updatedNotes: readonly Note[];
      readonly updatedWhiteboards: readonly Whiteboard[];
    }
  | { readonly type: 'persist_task'; readonly task: Task }
  | { readonly type: 'persist_tasks'; readonly tasks: readonly Task[] }
  | { readonly type: 'remove_task'; readonly id: string }
  | { readonly type: 'persist_note'; readonly note: Note }
  | { readonly type: 'remove_note'; readonly id: string }
  | { readonly type: 'persist_whiteboard'; readonly whiteboard: Whiteboard }
  | { readonly type: 'remove_whiteboard'; readonly id: string }
  | { readonly type: 'persist_asset_meta'; readonly asset: AssetMeta }
  | { readonly type: 'remove_asset'; readonly id: string }
  | { readonly type: 'persist_preferences'; readonly preferences: AppPreferences }
  | { readonly type: 'persist_trash_item'; readonly item: TrashItem }
  | { readonly type: 'persist_trash_items'; readonly items: readonly TrashItem[] }
  | { readonly type: 'remove_trash_item'; readonly id: string }
  | { readonly type: 'remove_trash_items'; readonly ids: readonly string[] }
  | { readonly type: 'persist_template'; readonly template: LocalTemplate }
  | { readonly type: 'remove_template'; readonly id: string }
  | {
      readonly type: 'persist_replace_all';
      readonly payload: {
        readonly projects: readonly Project[];
        readonly tasks: readonly Task[];
        readonly notes: readonly Note[];
        readonly whiteboards: readonly Whiteboard[];
        readonly assets: readonly AssetMeta[];
        readonly taskStatuses?: readonly TaskStatusConfig[];
      };
    }
  | {
      readonly type: 'persist_merge';
      readonly payload: {
        readonly projects: readonly Project[];
        readonly tasks: readonly Task[];
        readonly notes: readonly Note[];
        readonly whiteboards: readonly Whiteboard[];
        readonly assets: readonly AssetMeta[];
        readonly taskStatuses?: readonly TaskStatusConfig[];
      };
    };

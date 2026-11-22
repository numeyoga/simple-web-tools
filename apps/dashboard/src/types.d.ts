// Types of the data and of the state machine of Dashboard. The core (`src/core`) and the adapters
// share them; nothing here is executable.

/** How a metadata field is entered: free text, text in mono, one of a list, or a date. */
export type MetaFieldType = 'text' | 'mono' | 'select' | 'date';

/** An environment of a template (`dev`, `prod`): `key` is what `{env}` stands for. */
export interface Env {
  readonly key: string;
  readonly label: string;
}

/**
 * A metadata field of a template: each application fills it in, per environment, and a link
 * pattern reads it as `{meta.<key>}` (or `{<key>}`, as the earlier version wrote it).
 */
export interface MetaField {
  readonly key: string;
  readonly label: string;
  readonly type: MetaFieldType;
  /** The choices of a `select` field; empty for the other types. */
  readonly options: readonly string[];
}

/** `env`: one address per environment; `global`: meant to be the same address in every one. */
export type LinkScope = 'env' | 'global';

/** A link of a template: a name, a tag and a pattern the applications fill in. */
export interface TemplateLink {
  readonly id: string;
  readonly name: string;
  /** The key of a tag (see `Tag`); `''` is a link with no tag. */
  readonly tag: string;
  readonly scope: LinkScope;
  readonly pattern: string;
}

/**
 * A template: the environments, the metadata fields and the links an application of that kind
 * has. `position` is its place among the templates (0, 1, 2...).
 */
export interface Template {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly envs: readonly Env[];
  readonly metaFields: readonly MetaField[];
  readonly links: readonly TemplateLink[];
  readonly position: number;
}

/** What an application holds for one environment of its template. */
export interface EnvData {
  /** The values of the metadata fields, by field key. */
  readonly meta: Readonly<Record<string, string>>;
  /** An address that replaces the resolved pattern of a template link, by link id. */
  readonly overrides: Readonly<Record<string, string>>;
}

/** A link of one application that belongs to no environment. `url` is `http:` or `https:`. */
export interface Extra {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  /** The key of a tag; `''` is no tag. */
  readonly tag: string;
}

/** An application. `position` is its place among the applications (0, 1, 2...). */
export interface App {
  readonly id: string;
  readonly name: string;
  /** Lowercase letters, digits and dashes: what `{slug}` stands for. */
  readonly slug: string;
  readonly templateId: string;
  /** What `{jiraKey}` stands for. */
  readonly jiraKey: string;
  readonly description: string;
  /** By environment key. */
  readonly envs: Readonly<Record<string, EnvData>>;
  readonly extras: readonly Extra[];
  readonly position: number;
}

/** A tag groups links: a label and a Phosphor icon name. The list order is the order shown. */
export interface Tag {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
}

/** Which environment an application opens on. */
export type DefaultEnv = 'first' | 'last' | 'remember';

/** What belongs to the workspace as a whole (the `settings` record). */
export interface Settings {
  /** `''`: the page shows the name of the workspace. */
  readonly dashboardName: string;
  /** The application opened at the start; `null`: the last one the person looked at. */
  readonly defaultAppId: string | null;
  readonly defaultEnv: DefaultEnv;
  readonly tags: readonly Tag[];
}

export interface AppState {
  readonly schemaVersion: 1;
  /** True in a tab that does not hold the write lock: data commands are refused. */
  readonly readOnly: boolean;
  readonly settings: Settings;
  readonly templates: readonly Template[];
  readonly apps: readonly App[];
  /** The text typed in the search field of the sidebar (not normalized). */
  readonly search: string;
  /** Edit mode: the fields of the application can be changed in place. */
  readonly editMode: boolean;
}

/** What is read from a workspace database at start and when a read-only tab refreshes. */
export interface WorkspaceData {
  readonly settings: Settings;
  readonly templates: readonly Template[];
  readonly apps: readonly App[];
}

/** A command carries everything it needs: ids are made by the caller. */
export type AppCommand =
  | { type: 'hydrate'; payload: WorkspaceData & { readOnly?: boolean } }
  | { type: 'reload_data'; payload: WorkspaceData }
  | { type: 'set_read_only'; readOnly: boolean }
  | { type: 'set_search'; query: string }
  | { type: 'set_edit_mode'; editMode: boolean }
  | {
      type: 'update_settings';
      dashboardName?: string;
      defaultAppId?: string | null;
      defaultEnv?: DefaultEnv;
    }
  | { type: 'add_tag'; key: string; label: string; icon: string }
  | { type: 'update_tag'; key: string; label?: string; icon?: string }
  | { type: 'rename_tag'; key: string; newKey: string }
  | { type: 'delete_tag'; key: string }
  | { type: 'shift_tag'; key: string; delta: -1 | 1 }
  | { type: 'add_template'; template: Omit<Template, 'position'> }
  | { type: 'update_template'; id: string; name?: string; description?: string }
  | { type: 'delete_template'; id: string }
  | { type: 'add_env'; templateId: string; key: string; label: string }
  | { type: 'update_env'; templateId: string; key: string; label?: string; newKey?: string }
  | { type: 'delete_env'; templateId: string; key: string }
  | { type: 'shift_env'; templateId: string; key: string; delta: -1 | 1 }
  | {
      type: 'add_meta_field';
      templateId: string;
      key: string;
      label: string;
      fieldType?: MetaFieldType;
    }
  | {
      type: 'update_meta_field';
      templateId: string;
      key: string;
      label?: string;
      newKey?: string;
      fieldType?: MetaFieldType;
      options?: readonly string[];
    }
  | { type: 'delete_meta_field'; templateId: string; key: string }
  | { type: 'shift_meta_field'; templateId: string; key: string; delta: -1 | 1 }
  | {
      type: 'add_template_link';
      templateId: string;
      id: string;
      name: string;
      tag: string;
      scope?: LinkScope;
      pattern: string;
    }
  | {
      type: 'update_template_link';
      templateId: string;
      id: string;
      name?: string;
      tag?: string;
      scope?: LinkScope;
      pattern?: string;
    }
  | { type: 'delete_template_link'; templateId: string; id: string }
  | { type: 'shift_template_link'; templateId: string; id: string; delta: -1 | 1 }
  | { type: 'add_app'; app: Omit<App, 'position'> }
  | {
      type: 'update_app';
      id: string;
      name?: string;
      slug?: string;
      jiraKey?: string;
      description?: string;
    }
  | { type: 'delete_app'; id: string }
  | { type: 'set_meta'; appId: string; envKey: string; fieldKey: string; value: string }
  | { type: 'set_override'; appId: string; envKey: string; linkId: string; url: string }
  | { type: 'add_extra'; appId: string; id: string; name: string; url: string; tag: string }
  | {
      type: 'update_extra';
      appId: string;
      id: string;
      name?: string;
      url?: string;
      tag?: string;
    }
  | { type: 'delete_extra'; appId: string; id: string }
  /** Adds what the data holds and the workspace does not (by id; tags by key). */
  | { type: 'merge_data'; data: WorkspaceData };

/** What the adapter has to persist after a command. Written in one transaction, in order. */
export type StoreEffect =
  | { type: 'persist_settings'; settings: Settings }
  | { type: 'persist_template'; template: Template }
  | { type: 'remove_template'; id: string }
  | { type: 'persist_app'; app: App }
  | { type: 'remove_app'; id: string };

/** What a file or a record left out. */
export interface Skipped {
  /** Templates that were not valid records. */
  readonly templates: number;
  /** Applications that were not valid records. */
  readonly apps: number;
  /** Tags, environments, fields, links and the like that were not valid. */
  readonly parts: number;
  /** Addresses that are not an `http:` or `https:` one (an extra link, an override). */
  readonly unsafeUrls: number;
}

/** Why a resolved address cannot be opened. */
export type LinkProblem = 'empty' | 'unresolved' | 'unsafe' | 'invalid';

/** A link of a template resolved for one application and one environment. */
export interface ResolvedLink {
  readonly link: TemplateLink;
  /** The address once the placeholders are filled in (or the override). */
  readonly url: string;
  readonly overridden: boolean;
  /** `null`: the address is an `http:` or `https:` one and can be opened. */
  readonly problem: LinkProblem | null;
  /** The placeholders that stayed unfilled, as written (`{cluster}`). */
  readonly missing: readonly string[];
}

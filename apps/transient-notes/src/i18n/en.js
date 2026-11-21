// English interface catalog of Transient Notes, the reference: it has every key, and it is the
// fallback (decision 0002). `fr.js` is checked against it (see tests/unit/i18n-catalogs.test.js).
// Voice: sentence case, no exclamation mark, buttons are verbs, an error says what failed, why
// and what to do next. "Workspace" is a separate set of notes (its own database); a "folder"
// belongs to one of the four PARA categories (Projects, Areas, Resources, Archives).
//
// Layout of the keys: `app` (name, title), `common` (shared button labels), `shell` (frame,
// read-only tab, storage errors), `nav`, `para` (the four categories and their default
// folders), `notes`, `export` (texts written into export files), `prefs`, `workspaces`, `pwa`,
// `importErrors`.

export default {
  app: {
    name: 'Transient Notes',
    title: 'Transient Notes · notes sorted with PARA',
  },

  common: {
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    create: 'Create',
    delete: 'Delete',
  },

  shell: {
    skipLink: 'Skip to content',
    navLabel: 'Main navigation',
    menu: 'Menu',
    preferences: 'Preferences',
    workspace: 'Workspace',
    loading: 'Loading…',
    loadError: 'Loading failed: {message}',
    readOnly: {
      title: 'Transient Notes is open in another tab.',
      text: 'This tab is read-only.',
      resume: 'Resume editing',
      stillWriting: 'Another tab is still editing',
      closeIt: 'Close it, then try again.',
      toastTitle: 'Read-only',
      toastBody: 'Transient Notes is open in another tab. This tab is read-only.',
      restored: 'Editing restored',
      restoredBody: 'This tab can edit your notes again.',
    },
    storageBlocked: {
      title: 'Transient Notes is blocked by another tab',
      body: 'Another window or tab keeps an older version of Transient Notes open, which prevents the database from updating. Close all other Transient Notes tabs, then reload this page.',
    },
    storageUnavailable: {
      title: 'Transient Notes cannot use browser storage',
      body: 'Transient Notes saves your notes in IndexedDB, which is unavailable here (private browsing, blocked storage or an outdated browser). Nothing was read or written. Allow storage for this site or open Transient Notes in a regular browser window, then reload the page.',
    },
    writeFailed: {
      title: 'Your changes were not saved',
      body: 'The browser refused to write to its storage (it may be full). Free some space, then keep editing: the app tries again on the next change.',
    },
    reload: 'Reload the page',
    notifications: 'Notifications',
    dismissNotification: 'Dismiss notification',
  },

  nav: {
    allNotes: 'All notes',
  },

  para: {
    projects: 'Projects',
    areas: 'Areas',
    resources: 'Resources',
    archives: 'Archives',
    // Folder created when a note is added to a category that has none.
    defaultFolder: {
      projects: 'General projects',
      areas: 'General areas',
      resources: 'General resources',
      archives: 'General archives',
    },
  },

  notes: {
    new: 'New note',
    untitled: 'Untitled',
    count: { '=0': 'No notes', one: '{count} note', other: '{count} notes' },
    listLabel: 'Notes',
    emptyTitle: 'No notes here yet',
    emptyText: 'Create a note to start. It is saved in this browser only.',
  },

  // Texts written inside the files of an export (text and Markdown), in the language of the page.
  export: {
    heading: 'TRANSIENT NOTES - Full export',
    exportedAt: 'Date: {date}',
    count: 'Number of notes: {count}',
    imageAlt: 'Image',
  },

  prefs: {
    title: 'Preferences',
    language: 'Language / Langue',
    languageAuto: 'Automatic',
    languageEnglish: 'English',
    languageFrench: 'Français',
    languageHint:
      'Automatic follows your browser language. Changing the language reloads the page.',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeHint: 'System follows your device setting. Light and dark override it.',
    textSize: 'Text size',
    textSizeAuto: 'Automatic',
    textSizeStandard: 'Standard',
    textSizeComfortable: 'Comfortable',
    textSizeLarge: 'Large',
    textSizeHint: 'Automatic enlarges the text on large screens.',
    singleKey: 'Single-key shortcuts',
    singleKeyHint:
      'N, 1, 2, 3 and 4 work without any other key. They never fire while you type or when a dialog is open.',
    shortcuts: 'Shortcuts',
    shortcutNew: 'New note',
    shortcutCategory: 'New note in Projects, Areas, Resources or Archives',
  },

  workspaces: {
    defaultLabel: 'Main workspace',
    title: 'Workspaces',
    intro:
      'Each workspace is a separate set of notes, stored in its own IndexedDB database. Use them to keep notes apart by role or by importance.',
    active: 'Active',
    created: 'created {date}',
    nameLabel: 'Workspace name',
    validate: 'Confirm',
    switch: 'Switch',
    switchTitle: 'Switch workspace?',
    switchMessage: 'The page will reload to show the workspace “{name}”.',
    rename: 'Rename',
    cannotDelete: 'Unavailable: active or last workspace',
    deleteTitle: 'Delete this workspace?',
    deleteMessage:
      'All the notes of the workspace “{name}” will be erased (folders, notes and images). You cannot undo this.',
    deleted: 'Workspace deleted',
    newTitle: 'New workspace',
    newName: 'New workspace name',
    newPlaceholder: 'E.g. Work, Personal, Archive…',
    nameEmpty: 'The name is empty. Enter a name for the new workspace.',
    createFailed: 'Could not create the workspace',
    switchToNewTitle: 'Switch to this workspace?',
    switchToNewMessage: 'The workspace “{name}” was created. Switch to it now?',
    createdToast: 'Workspace created',
    backup: 'Backup',
    backupHint:
      'Export or import the active workspace as JSON, images included. Handy to archive or move your notes.',
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    exported: 'Backup downloaded',
    exportFailed: 'Could not export',
    replaceTitle: 'Replace the notes?',
    replaceMessage:
      'All the current notes of the workspace “{name}” will be replaced with the contents of the file. You cannot undo this.',
    replaceConfirm: 'Replace notes',
    imported: 'Import complete',
    importedSkipped: 'Some records of the file could not be used and were skipped.',
    reloading: 'Reloading…',
    importFailed: 'Could not import',
  },

  pwa: {
    updateTitle: 'A new version is ready',
    updateBody: 'Reload Transient Notes to use it. It is already available offline.',
    reload: 'Reload',
    reloading: 'Reloading…',
  },

  importErrors: {
    invalidJson: 'The file is not valid JSON.',
    invalidFormat: 'The file is not a Transient Notes backup.',
    invalidData: 'The backup has no usable notes or folders.',
    wrongApp: 'This file was not exported by Transient Notes.',
    newerVersion:
      'This file comes from a newer version of Transient Notes. Update the app, then try again.',
    cannotConvert: 'This file cannot be converted.',
  },
};

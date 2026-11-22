// English interface catalog of Favoris, the reference: it has every key, and it is the fallback
// (decision 0002). `fr.js` is checked against it (see tests/unit/i18n-catalogs.test.js).
// Voice: sentence case, no exclamation mark, buttons are verbs, an error says what failed, why
// and what to do next. A "workspace" is a separate page of bookmarks (the "space" of the previous
// version of the app, with its own database); a "group" holds links and has a colour; a "link"
// is a bookmark.
//
// Layout of the keys: `app` (name, title), `common` (shared button labels), `shell` (frame,
// read-only tab, storage errors), `nav`, `board` (toolbar and board), `groups`, `links`,
// `colors` (the names of the 16 category colours), `data` (export, import, clear), `legacy`
// (the import of the previous version), `prefs`, `workspaces`, `pwa`, `importErrors`.

export default {
  app: {
    name: 'Favoris',
    title: 'Favoris · bookmarks in colour groups',
  },

  common: {
    add: 'Add',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    create: 'Create',
    delete: 'Delete',
    save: 'Save',
  },

  shell: {
    skipLink: 'Skip to content',
    navLabel: 'Main navigation',
    menu: 'Menu',
    apps: 'Apps',
    preferences: 'Preferences',
    workspace: 'Workspace',
    loading: 'Loading…',
    loadError: 'Loading failed: {message}',
    readOnly: {
      title: 'Favoris is open in another tab.',
      text: 'This tab is read-only.',
      resume: 'Resume editing',
      stillWriting: 'Another tab is still editing',
      closeIt: 'Close it, then try again.',
      toastTitle: 'Read-only',
      toastBody: 'Favoris is open in another tab. This tab is read-only.',
      restored: 'Editing restored',
      restoredBody: 'This tab can edit your bookmarks again.',
    },
    storageBlocked: {
      title: 'Favoris is blocked by another tab',
      body: 'Another window or tab keeps an older version of Favoris open, which prevents the database from updating. Close all other Favoris tabs, then reload this page.',
    },
    storageUnavailable: {
      title: 'Favoris cannot use browser storage',
      body: 'Favoris saves your bookmarks in IndexedDB, which is unavailable here (private browsing, blocked storage or an outdated browser). Nothing was read or written. Allow storage for this site or open Favoris in a regular browser window, then reload the page.',
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
    groups: 'Groups',
  },

  board: {
    addLink: 'New link',
    newGroup: 'New group',
    edit: 'Edit',
    more: 'More actions',
    moreMenu: 'Data and groups',
    searchLabel: 'Search the links',
    searchPlaceholder: 'Search name, address or group…',
    count: { '=0': 'No links', one: '{count} link', other: '{count} links' },
    found: { '=0': 'No match', one: '{count} match', other: '{count} matches' },
    emptyTitle: 'No bookmarks yet',
    emptyText:
      'Add a link to start, or create a group to sort them. Everything is saved in this browser only.',
    noResultsTitle: 'No result',
    noResultsText: 'No link matches “{query}”. Change or clear the search to see more links.',
  },

  groups: {
    ungrouped: 'Ungrouped',
    empty: 'No links in this group yet.',
    noMatch: 'No link matches the search.',
    featuredMark: 'Featured',
    feature: 'Feature “{name}”',
    addLink: 'Add a link to “{name}”',
    addLinkUngrouped: 'Add a link',
    menu: 'Actions for the group “{name}”',
    edit: 'Edit the group',
    moveUp: 'Move up',
    moveDown: 'Move down',
    newTitle: 'New group',
    editTitle: 'Edit the group',
    nameLabel: 'Group name',
    namePlaceholder: 'E.g. Recipes',
    nameEmpty: 'The name is empty. Enter a name for the group.',
    deleteTitle: 'Delete this group?',
    deleteMessage: {
      '=0': 'The group “{name}” will be deleted. It has no links.',
      one: 'The group “{name}” will be deleted. Its link is kept, with no group.',
      other: 'The group “{name}” will be deleted. Its {count} links are kept, with no group.',
    },
    deleted: 'Group deleted',
  },

  links: {
    newTitle: 'New link',
    editTitle: 'Edit the link',
    nameLabel: 'Name',
    namePlaceholder: 'E.g. Internal documentation',
    urlLabel: 'Address',
    urlPlaceholder: 'https://…',
    urlHint: 'Only web addresses (http or https). https:// is added when you leave it out.',
    urlEmpty: 'The address is empty. Enter the address of the link.',
    urlUnsupported:
      'Only http and https addresses are accepted. Enter a web address such as https://example.org.',
    urlInvalid: 'This is not a valid web address. Check it, then try again.',
    groupLabel: 'Group',
    noGroup: 'No group',
    newGroup: 'New group…',
    added: 'Link added',
    updated: 'Link updated',
    deleteTitle: 'Delete this link?',
    deleteMessage: 'The link “{name}” will be deleted. You cannot undo this.',
    deleted: 'Link deleted',
    newTab: '(opens in a new tab)',
    copy: 'Copy the address of “{name}”',
    copied: 'Address copied',
    copyFailed: 'Could not copy the address',
    edit: 'Edit “{name}”',
    delete: 'Delete “{name}”',
    moveMenu: 'Move “{name}”',
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveToGroup: 'Move to a group…',
    moveTitle: 'Move “{name}”',
    moveLabel: 'Group',
    move: 'Move',
    moved: 'Link moved',
  },

  colors: {
    label: 'Colour',
    orange: 'Orange',
    amber: 'Amber',
    yellow: 'Yellow',
    lime: 'Lime',
    green: 'Green',
    teal: 'Teal',
    cyan: 'Cyan',
    sky: 'Sky',
    blue: 'Blue',
    indigo: 'Indigo',
    violet: 'Violet',
    purple: 'Purple',
    fuchsia: 'Fuchsia',
    pink: 'Pink',
    rose: 'Rose',
    slate: 'Slate',
  },

  data: {
    exportJson: 'Export JSON',
    importJson: 'Import JSON',
    exported: 'Backup downloaded',
    exportFailed: 'Could not export',
    replaceTitle: 'Replace the bookmarks?',
    replaceMessage: {
      '=0': 'All the groups and links of the workspace “{name}” will be replaced with the contents of the file, which has no links. You cannot undo this.',
      one: 'All the groups and links of the workspace “{name}” will be replaced with the contents of the file (1 link). You cannot undo this.',
      other:
        'All the groups and links of the workspace “{name}” will be replaced with the contents of the file ({count} links). You cannot undo this.',
    },
    replaceConfirm: 'Replace bookmarks',
    imported: 'Import complete',
    importedOld: 'Import complete (file of the previous version)',
    importedSkipped: {
      one: '1 record of the file could not be used and was skipped.',
      other:
        '{count} records of the file could not be used and were skipped. {unsafe} of them had an address that is not an http or https one.',
    },
    importFailed: 'Could not import',
    clear: 'Clear all',
    clearTitle: 'Clear this workspace?',
    clearMessage:
      'All the groups and links of the workspace “{name}” will be erased. You cannot undo this.',
    clearConfirm: 'Clear all',
    cleared: 'Workspace cleared',
  },

  legacy: {
    title: 'Your bookmarks were imported',
    body: {
      one: 'The previous version of Favoris had {count} space: it is now a workspace. Links imported: {links}. The old data stays untouched in this browser.',
      other:
        'The previous version of Favoris had {count} spaces: they are now workspaces. Links imported: {links}. The old data stays untouched in this browser.',
    },
    skippedTitle: 'Some records were not imported',
    skipped: {
      one: '1 record could not be used and was skipped.',
      other:
        '{count} records could not be used and were skipped. {unsafe} of them had an address that is not an http or https one.',
    },
    unreadable: {
      one: '1 space held data that could not be read: it was imported empty.',
      other: '{count} spaces held data that could not be read: they were imported empty.',
    },
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
    siteIcons: 'Load site icons from Google (Google sees the domains of your links)',
    siteIconsHint:
      'Off by default: each link shows a coloured initial and nothing leaves your device. On, the browser asks Google’s favicon service for one icon per link, which tells Google the domain of each link and your IP address.',
    singleKey: 'Single-key shortcuts',
    singleKeyHint:
      'N and / work without any other key. They never fire while you type or when a dialog is open.',
    shortcuts: 'Shortcuts',
    shortcutNew: 'New link',
    shortcutSearch: 'Search the links',
    keySearchModifier: 'Ctrl+K',
    shortcutSearchModifier: 'Search the links (always on)',
  },

  workspaces: {
    defaultLabel: 'My bookmarks',
    title: 'Workspaces',
    intro:
      'Each workspace is a separate page of bookmarks, stored in its own IndexedDB database. Use them to keep links apart, for example for work and for home.',
    active: 'Active',
    created: 'created {date}',
    nameLabel: 'Workspace name',
    validate: 'Confirm',
    switch: 'Switch',
    switchTitle: 'Switch workspace?',
    switchMessage: 'The page will reload to show the workspace “{name}”.',
    rename: 'Rename',
    duplicate: 'Duplicate',
    copyName: '{name} (copy)',
    duplicated: 'Workspace duplicated',
    duplicateFailed: 'Could not duplicate the workspace',
    cannotDelete: 'Unavailable: active or last workspace',
    deleteTitle: 'Delete this workspace?',
    deleteMessage:
      'All the bookmarks of the workspace “{name}” will be erased (groups and links). You cannot undo this.',
    deleted: 'Workspace deleted',
    newTitle: 'New workspace',
    newName: 'New workspace name',
    newPlaceholder: 'E.g. Work, Home, Reading…',
    nameEmpty: 'The name is empty. Enter a name for the new workspace.',
    createFailed: 'Could not create the workspace',
    switchToNewTitle: 'Switch to this workspace?',
    switchToNewMessage: 'The workspace “{name}” was created. Switch to it now?',
    createdToast: 'Workspace created',
  },

  pwa: {
    updateTitle: 'A new version is ready',
    updateBody: 'Reload Favoris to use it. It is already available offline.',
    reload: 'Reload',
    reloading: 'Reloading…',
  },

  importErrors: {
    invalidJson: 'The file is not valid JSON.',
    invalidFormat: 'The file is not a Favoris backup.',
    invalidData: 'The file has no usable groups or links.',
    wrongApp: 'This file was not exported by Favoris.',
    newerVersion:
      'This file comes from a newer version of Favoris. Update the app, then try again.',
    cannotConvert: 'This file cannot be converted.',
  },
};

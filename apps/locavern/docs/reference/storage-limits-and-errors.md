# Local storage, archive format and error messages

Factual specification of browser storage, export and archive formats, technical limits and the
messages Locavern displays. Messages are quoted from the English catalog (`src/i18n/en.js`); the
French interface shows the matching entries of `src/i18n/fr.js`.

## Contents

- [Storage in the browser](#storage-in-the-browser)
- [ZIP archive format (plain and encrypted)](#zip-archive-format-plain-and-encrypted)
- [Markdown (.md) and iCalendar (.ics) export formats](#markdown-md-and-icalendar-ics-export-formats)
- [Scope of archives and technical limits](#scope-of-archives-and-technical-limits)
- [Warning and error messages](#warning-and-error-messages)

## Storage in the browser

All data is stored locally on the device, in the browser origin. All the apps of the Simple Web Tools
repository are published on the same origin, so **every storage name of Locavern starts with
`locavern`** and never collides with another app's.

- **`IndexedDB` database `locavern-db`, version `4`**, with eight object stores. The database is
  opened through the shared `@simple-web-tools/storage` package, and its names are frozen because
  existing users' data lives under them:
  - `meta`: key `preferences` (display preferences, active view, List/Kanban mode, current
    selections, notification duration, trash retention, Kanban columns with `isInitial` /
    `isTerminal` roles) and key `lastBackupAt` (ISO timestamp of the last ZIP backup saved);
  - `projects`: projects (including `archived` / `archivedAt`);
  - `tasks`: tasks, due dates (`dueDate`, optional `dueTime` as `HH:MM`), recurrence, tags,
    internal links, checklists, descriptions and archiving (`archived` / `archivedAt`);
  - `notes`: rich-text notes, tags, internal links and archiving;
  - `whiteboards`: whiteboards (title, project, `viewport`, `elements`, internal links, `assetIds`
    and archiving);
  - `assets`: metadata and binary data (`Blob`) of local images;
  - `trash`: the local trash (`TrashItem`: a snapshot of the deleted item, its deletion date and
    its expiry date);
  - `templates`: custom local templates (`LocalTemplate` for a checklist, a note or a whiteboard).
- **`localStorage`**: `locavern-color-scheme` (`light` or `dark`, removed when the choice matches
  the system theme), `locavern-text-size` (`standard`, `comfortable` or `large`, removed for
  `Automatic`) and `locavern-locale` (`en` or `fr`, removed for `Automatic`).
- **Multi-tab lock**: the Web Lock `locavern-write-lock` and the `BroadcastChannel`
  `locavern-lock-channel`.
- **Storage statuses**:
  - `Persistent storage`: `navigator.storage.persisted()` returns `true`;
  - `Standard storage`: `navigator.storage.persisted()` returns `false`.
- **Service worker** (`public/sw.js`): the cache is named `locavern-shell-v4`. A newly installed
  worker waits until it receives the message `{ type: 'SKIP_WAITING' }`, sent when the user asks
  for the update. The worker only accepts that message from a page inside its own scope, and when
  it activates it deletes only the caches whose name starts with `locavern-`.

## ZIP archive format (plain and encrypted)

Default name on export: `locavern-backup-YYYY-MM-DD.zip` (`locavern-sauvegarde-AAAA-MM-JJ.zip` in
the French interface). The file is written with `window.showSaveFilePicker` when it is available and
accepted, with the chosen export folder when there is one, or else by an `<a download>` download.
Cancelling the native picker (`AbortError`) writes no file and does not update `meta.lastBackupAt`.

### Standard (plain) ZIP archive

| Entry           | Role                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json` | Archive metadata: `format` (`locavern-archive`), `schemaVersion` (`2`), `appVersion`, `exportedAt`, `counts` (`projects`, `tasks`, `notes`, `whiteboards`, `assets`)                  |
| `data.json`     | JSON collections: `schemaVersion` (`2`), `exportedAt`, `projects`, `tasks`, `notes`, `whiteboards`, `assets`, `taskStatuses`; archives with `schemaVersion: 1` are migrated on import |
| `assets/<id>`   | Binary files of the local images referenced from `data.json`                                                                                                                          |

### Password-encrypted container (optional)

When a password is given, the inner ZIP archive (`level: 6`) is encrypted on the client with the Web
Crypto API (`crypto.subtle`), then packed into a ZIP envelope (`level: 0`):

| Parameter / entry  | Specification                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Key derivation     | `PBKDF2` with `SHA-256`, `310,000` iterations by default (accepted range `[100,000; 2,000,000]`)                                               |
| Authenticated mode | `AES-256-GCM` (`tagLength: 128`), AAD `locavern-encrypted-archive:v1`                                                                          |
| Random parameters  | 16-byte salt and 12-byte initialization vector (`iv`) generated with `crypto.getRandomValues`                                                  |
| `encryption.json`  | `format` (`locavern-encrypted-archive`), `version` (`1`), `kdf`, `hash`, `iterations`, `cipher`, `keyLength` (`256`), `salt` and `iv` (base64) |
| `payload.enc`      | The encrypted bytes of the whole inner ZIP archive                                                                                             |

## Markdown (.md) and iCalendar (.ics) export formats

- **Markdown export of a note** (`src/core/markdown.js`):
  - File name: `<title-slug>.md`;
  - Header: `# <Title>` and a line `> Project: <name> · Updated: YYYY-MM-DD` (in French `> Projet :
<nom> · Mise à jour : AAAA-MM-JJ`), without YAML front matter;
  - Body: CommonMark/GFM blocks (`h1` to `h3`, bold, italic, strikethrough, inline code, links,
    bulleted, numbered and checklist `- [ ]` / `- [x]` lists); local images are written as
    `![alt](local-asset://<assetId>)`.
- **iCalendar export of due dates** (`src/core/ical.js`):
  - File name: `locavern-<project-slug|due-dates>-YYYY-MM-DD.ics`;
  - Standard: RFC 5545 (`VCALENDAR` `VERSION:2.0`, `METHOD:PUBLISH`), lines folded at 75 UTF-8
    bytes. The calendar name and the description labels follow the interface language. The
    `PRODID` is `-//Locavern//Locavern PWA//FR` whatever the language;
  - Scope: only the non-archived tasks of the current filter that have a valid `dueDate`. A task
    without `dueTime` becomes an all-day event (`DTSTART;VALUE=DATE`, `DTEND;VALUE=DATE` on the next
    day); a task with `dueTime` becomes a one-hour event (local `DTSTART`, `DTEND`, midnight
    crossing handled). Each event has `UID:locavern-task-<id>@locavern.local`, `STATUS`
    (`COMPLETED` on a final status, `TENTATIVE` on an initial status, otherwise `CONFIRMED`),
    `PRIORITY` (`1` high, `5` medium, `9` low) and `CATEGORIES` (the project name).

## Scope of archives and technical limits

- **Scope of archive `schemaVersion: 2`**:
  - Included and restored by ZIP import (`replace`, `merge`, `projects`): `projects` (`archived`,
    `archivedAt`), `tasks` (including `dueTime`, `archived`, `archivedAt`, `recurrence`,
    `checklist`, `descriptionDoc`, and the `tags` and `links` they carry), `notes` (`archived`,
    `archivedAt`, tags, links), `whiteboards` (`archived`, `archivedAt`, links), `assets` and
    `taskStatuses` (including the `isInitial` / `isTerminal` flags). In `merge` and `projects`
    modes, colliding identifiers are reallocated consistently with the references between
    entities and the `assetIds`.
  - Not carried by the `v2` archive schema (`src/core/schema.js`), so they stay local to this
    device's `IndexedDB` / `localStorage`: the content of the trash (`trash`), custom templates
    (`templates`), the other display preferences, and the `localStorage` settings.

| Item                                               | Value or verified constraint                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Archive schema version                             | `2` (`schemaVersion: 2`, transparent migration from `schemaVersion: 1` on import)                                       |
| `IndexedDB` schema version                         | `4` (`DB_VERSION = 4`, eight object stores)                                                                             |
| Accepted image formats                             | `image/png`, `image/jpeg`, `image/webp`, `image/gif` (SVG and remote images excluded)                                   |
| Maximum size per image                             | 5 MiB (`5,242,880` bytes)                                                                                               |
| Maximum size of a ZIP archive (and decrypted)      | 25 MiB (`26,214,400` bytes)                                                                                             |
| Maximum records on import                          | `10,000` (sum of projects, tasks, notes, whiteboards and images)                                                        |
| Link protocols allowed in the editor               | `https://` and `mailto:` only (`target="_blank"`, `rel="noopener noreferrer"`)                                          |
| Maximum length of a project name                   | 120 characters                                                                                                          |
| Maximum length of a project description            | 1,000 characters                                                                                                        |
| Maximum length of a task, note or whiteboard title | 200 characters                                                                                                          |
| Maximum length of a checklist step                 | 200 characters                                                                                                          |
| Tags                                               | 20 tags per task or note, 40 characters per tag, de-duplicated ignoring case (`#` removed)                              |
| Internal links                                     | 50 links per active entity (`task`, `note`, `whiteboard`), self-references ignored, new links blocked on a final status |
| Custom templates                                   | Local images (`localImage` / `image`) are left out when saving                                                          |
| Local trash retention                              | Whole number in `[1; 365]` days (`30` by default); purging cleans up invalid links and orphaned images                  |
| Notification duration (success / information)      | Whole number in `[1; 60]` seconds (`6` by default)                                                                      |
| Kanban status label                                | 60 characters maximum (`isInitial` and `isTerminal` mutually exclusive)                                                 |
| Whiteboard element limits                          | Dimensions `[16, 4000]` (`[0, 4000]` for `arrow` / `path`), text 500 characters, 2,000 points per stroke                |
| Whiteboard viewport and grid limits                | `zoom` in `[0.25; 3]`, `panX` and `panY` in `[-10,000; 10,000]`, 20 px grid step, 50-state history                      |
| Visible results of the `Ctrl+K` palette            | 60 items maximum, archived items excluded                                                                               |

## Warning and error messages

### Editor, whiteboard, templates and input

| Title or context         | Message shown                                                                                                                                | Cause                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Read-only mode`         | `Cannot add an image while another tab holds the lock.`                                                                                      | Adding an image while another tab holds `locavern-write-lock`                                    |
| `Image rejected`         | `Image format not supported. Use PNG, JPEG, WebP or GIF.`                                                                                    | MIME type not allowed (for example SVG, TIFF, PDF)                                               |
| `Image rejected`         | `The image must not be empty or larger than 5 MiB.`                                                                                          | Empty file (0 bytes) or larger than 5 MiB                                                        |
| `Remote image blocked`   | `Only local images saved on this device are allowed.`                                                                                        | Pasting a remote image URL or HTML containing `<img src="https://...">` / `<img src="data:...">` |
| `Link rejected`          | `Only https:// and mailto: links are accepted.`                                                                                              | Invalid URL, or one that uses another protocol (`http://`, `javascript:`, etc.)                  |
| `<format> export failed` | `Cannot generate the <format> file.`                                                                                                         | Error while serializing the SVG canvas or rendering it to a `<canvas>` for PNG                   |
| `Markdown export failed` | `Cannot save the file locally.`                                                                                                              | Disk write error other than a user cancellation (`AbortError`)                                   |
| `No dated tasks`         | `Add a due date to at least one task to export an .ics file.`                                                                                | `.ics` export while no active task in the filter has a due date                                  |
| `.ics export failed`     | `Cannot save the calendar file locally.`                                                                                                     | Disk write error during the `.ics` export                                                        |
| `Empty checklist`        | `Add at least one step before saving a template.`                                                                                            | Saving a checklist template with no step                                                         |
| `Empty canvas`           | `Add at least one shape, sticky note or arrow before saving a template.`                                                                     | Saving a template from a whiteboard with no non-image element                                    |
| Template validation      | `The template name cannot be empty.` / `A checklist template needs at least one step.` / `A whiteboard template needs at least one element.` | Creating a template with an empty name or empty content                                          |
| Project form             | `Enter a project name.`                                                                                                                      | Submitting with an empty name, or one made only of spaces                                        |
| Task form                | `Enter a task title.`                                                                                                                        | Submitting with an empty title, or one made only of spaces                                       |
| Note form                | `Enter a note title.`                                                                                                                        | Submitting the note input window with an empty title                                             |
| Whiteboard form          | `Enter a whiteboard title.`                                                                                                                  | Submitting the whiteboard input window with an empty title                                       |
| Display preferences      | `Invalid duration: the value is out of range or not a whole number. Enter a whole number between 1 and 60 seconds.`                          | Value outside `[1; 60]` or not a whole number in the notification duration field                 |
| Display preferences      | `Invalid delay: enter a whole number between 1 and 365 days.`                                                                                | Value outside `[1; 365]` or not a whole number in the trash retention field                      |

### Multi-tab lock, trash and persistence

| Title or context  | Message shown                                                                                                                            | Cause                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Top banner        | `Read-only mode is on.` `Another tab holds the write lock on the local database. Close the other tab, then try again to edit your data.` | Another tab or installed window already holds the write lock |
| `Lock still held` | `Another tab is still using Locavern to write.`                                                                                          | Clicking `Resume editing` while the other tab is still open  |
| `Cannot restore`  | `Cannot restore this task. Create or restore an active project first.` (or `Cannot restore this item.`)                                  | Restoring a task while its parent project is still deleted   |
| `Save error`      | `Cannot save the change to IndexedDB.`                                                                                                   | Write failure in `IndexedDB` (for example quota exceeded)    |

### ZIP archive import, export and encryption

| Message shown                                                                                    | Cause                                                                      |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `Enter a password to encrypt the archive.`                                                       | `Protect the archive with a password (AES-GCM)` ticked with an empty field |
| `The two passwords do not match.`                                                                | `Encryption password` and `Confirm password` differ                        |
| `Enter the password to unlock this archive.`                                                     | Submitting an empty password when unlocking                                |
| `Select at least one project or the items without a project.`                                    | `Import selected projects without overwriting` with nothing ticked         |
| `Export failed` / `Cannot save the ZIP archive. Try again.`                                      | Error while reading `Blob`s, encrypting or writing the ZIP                 |
| `Cannot import the archive. The file is empty.`                                                  | Selected file of size 0                                                    |
| `Cannot import the archive. The file exceeds the 25 MiB limit.`                                  | ZIP file larger than 25 MiB                                                |
| `Cannot open the archive. The ZIP file is corrupted or invalid.`                                 | Not a ZIP file, or a damaged archive                                       |
| `The encryption metadata in the archive is unreadable.` / `Invalid encryption metadata.`         | Invalid JSON or wrong structure in `encryption.json`                       |
| `Encryption format not recognized. This file is not a Locavern encrypted archive.`               | `format` other than `locavern-encrypted-archive`                           |
| `Encryption version not supported (<v>).`                                                        | Encryption envelope version other than `1`                                 |
| `Cryptographic parameters not supported in the archive.`                                         | Algorithm other than `PBKDF2` / `SHA-256` / `AES-GCM` (256 bits)           |
| `Invalid number of PBKDF2 iterations in the encrypted archive.`                                  | `iterations` outside `[100,000; 2,000,000]`                                |
| `Salt or initialization vector missing from the archive.` / `... corrupted in the archive.`      | `salt` or `iv` missing, badly encoded or of invalid length (16 / 12 bytes) |
| `Incomplete encrypted archive. The payload.enc file is missing.`                                 | `encryption.json` present without `payload.enc`                            |
| `Encrypted data missing or corrupted in the archive.`                                            | Empty `payload.enc`, or smaller than the minimum GCM tag size              |
| `This archive is protected by a password.`                                                       | Encrypted archive opened with no password (shows the dedicated panel)      |
| `Wrong password or damaged archive.`                                                             | `AES-GCM` authentication failure on decryption                             |
| `The Web Crypto API is unavailable in this browser.`                                             | Context without `crypto.subtle`                                            |
| `The decrypted archive exceeds the allowed limit of 25 MiB.`                                     | Decrypted inner ZIP larger than 25 MiB                                     |
| `The decrypted archive is invalid or corrupted.`                                                 | Decrypted content that cannot be opened as a ZIP archive                   |
| `Incomplete archive. The manifest.json and data.json files are required.`                        | One of the two JSON files is missing at the root of the ZIP                |
| `Cannot read the data. The JSON content of the archive is invalid.`                              | Syntactically invalid JSON in `manifest.json` or `data.json`               |
| `Cannot import the archive. The manifest.json file is invalid.`                                  | Wrong manifest structure                                                   |
| `Archive not recognized. This file is not a Locavern backup.`                                    | `format` other than `locavern-archive`                                     |
| `Archive version not supported (<v>).`                                                           | `schemaVersion` missing or greater than `2` in `manifest.json`             |
| `This backup uses a future schema version (<v>) that this version of Locavern does not support.` | `schemaVersion` greater than `2` in `data.json`                            |
| `The backup exceeds the limit of 10000 records.`                                                 | Total number of items above the safety ceiling                             |
| `Invalid or duplicated project data in the backup.`                                              | Malformed project or duplicate identifier                                  |
| `Invalid task data, or a task attached to a project that does not exist.`                        | Malformed, duplicated or orphaned task                                     |
| `Invalid note data, or a note attached to a project that does not exist.`                        | Malformed or duplicated note, or one linked to a missing `projectId`       |
| `Invalid whiteboard data, or a whiteboard attached to a project that does not exist.`            | Malformed or duplicated whiteboard, or one linked to a missing `projectId` |
| `Invalid image metadata or a MIME type that is not allowed in the backup.`                       | Inconsistent `assets` entry or a format that is not allowed                |
| `Image missing from the archive (<name>). The restore was cancelled.`                            | Binary missing under `assets/<id>` for a referenced image                  |
| `Invalid file size for the image <name>.`                                                        | Empty image, or larger than 5 MiB, in the archive                          |
| `The archive exceeds the maximum total size allowed (25 MiB).`                                   | Sum of the decompressed binaries above 25 MiB                              |

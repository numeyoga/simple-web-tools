# Local-first, privacy and scope

This page explains the design principles of Locavern that directly shape your daily use: storage on
your device, optional archive encryption, the local trash, tab locking, media safety and the
current scope of the app.

## Contents

- [Your data stays on your device](#your-data-stays-on-your-device)
- [Why export ZIP archives regularly (and when to encrypt them)](#why-export-zip-archives-regularly-and-when-to-encrypt-them)
- [Why a local trash rather than deleting at once](#why-a-local-trash-rather-than-deleting-at-once)
- [Why only one tab writes at a time](#why-only-one-tab-writes-at-a-time)
- [Why remote images and some links are blocked](#why-remote-images-and-some-links-are-blocked)
- [Current scope and structural limits](#current-scope-and-structural-limits)

## Your data stays on your device

Locavern follows a **local-first** approach: there is no account creation, no remote application
server and no automatic background synchronization. Your projects, tasks, notes, whiteboards, custom
templates, trashed items and images are kept only in your browser's `IndexedDB` database.

This guarantees that no personal data leaves your machine, but it also means your data is not
automatically shared between two browsers or two devices: transfers go only through manual export
and import of ZIP archives (or one-off `.ics` and `.md` exports).

Locavern is published on a static host, and loading it requires requests for static files. The
promise is about not transmitting your data, not about the absence of any connection to the host.
The app shares its origin with the other apps of the Simple Web Tools repository; for that reason
every storage name it uses starts with `locavern`, so the apps never read or overwrite each
other's data (see [decision 0005](../../../../docs/decisions/0005-single-origin-hosting.md)).

## Why export ZIP archives regularly (and when to encrypt them)

Even when the browser grants **Persistent storage**, the local database stays tied to your browser
profile and your computer. Manually clearing site data in the browser settings, resetting the
profile or a hardware failure would erase the local content.

A ZIP archive keeps a portable copy on your disk or an external drive, and the age indicator helps
you know how old your last recovery point is:

- **By default the ZIP archive is plain**: the JSON files and images stay directly readable and
  inspectable without any special tool, so nothing is blocked if you lose access to a secret;
- **With password protection on**, the inner archive is encrypted locally before it is written to
  disk (`AES-256-GCM` with `PBKDF2-SHA-256` key derivation), so you can put a backup on a shared
  medium or third-party storage without exposing its content. The direct cost of a serverless model
  is that no password reset exists: if you forget the password, the encrypted archive cannot be
  recovered.

When importing on a computer that already holds data, the option to **merge without overwriting**,
or to choose only some projects, covers partial transfers between workspaces without any risk of
overwriting the recent items of the receiving device.

## Why a local trash rather than deleting at once

An accidental deletion is hard to undo in an app with no continuous server-side backup if it
destroys the data and its images immediately. Putting projects, tasks, notes and whiteboards in a
**local trash** first leaves a recovery window (configurable from `1` to `365` days), while still
avoiding an endless pile of orphaned images in `IndexedDB`: binary files are only released at the
final purge, together with the cleanup of the internal links that became invalid.

## Why only one tab writes at a time

In an app with no central server, letting two tabs change the same `IndexedDB` database at once
causes silent overwrites: the last tab to write erases the recent changes of the other.

To prevent data loss, the first tab opened takes an exclusive lock (`Web Locks`) and the following
tabs switch automatically to **read-only mode**. As soon as the editing tab is closed, the next tab
takes the lock and reloads the current state. See
[How to resume editing when several tabs are open](../how-to/resume-editing-across-tabs.md).

## Why remote images and some links are blocked

In notes as on the whiteboard, Locavern blocks pasting remote images (`https://…`) and only embeds
local files stored in binary form in `IndexedDB`. Two reasons drive this rule:

- **Privacy**: showing an image hosted on a third-party server would trigger a network request each
  time the item is opened, revealing your IP address and the time of viewing (a tracking-pixel
  effect), which is incompatible with a strict no-third-party-request policy (the app's
  Content Security Policy also forbids it);
- **Offline availability**: a local image stored in `IndexedDB` and included in the ZIP archive
  stays displayable without an Internet connection, even if the original site disappears. When a
  whiteboard with local images is exported as `.svg` or `.png`, those images are rendered locally in
  the browser to produce a standalone file with no external request.

In the same way, only `https://` and `mailto:` links are accepted, to rule out potentially dangerous
or ambiguous schemes in imported content.

## Current scope and structural limits

Locavern covers the whole local productivity space: the **Today** dashboard, **Projects** (active and
archived), **Tasks** (List, customizable Kanban, quick add, recurrence), the **Calendar** (month and
week views with interactive rescheduling and `.ics` export), rich-text **Notes** (duplication and
`.md` export), SVG **Whiteboards** (multi-select, duplication, snapping, grid and `.svg` / `.png`
export), local cross-cutting features (**tags**, **internal links** and **templates**), the local
**Trash** and ZIP **Backups** (plain or encrypted). The interface is available in English and French.

Some limits follow directly from the serverless architecture and the `schemaVersion: 2` backup
format:

- **No real-time synchronization and no collaborative work**: each browser keeps its own isolated
  database and transfers between devices stay manual;
- **Scope of the `v2` ZIP archive**: the content of the trash and custom templates live in
  `IndexedDB` on the current device and are not carried by a ZIP export or import (tags and
  internal links are stored on the tasks, notes and whiteboards, so they travel with the archive);
- **No password recovery**: no recovery key is stored when you encrypt a ZIP archive.

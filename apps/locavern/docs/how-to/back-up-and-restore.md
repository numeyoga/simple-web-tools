# How to back up, restore or erase your data

Locavern keeps your data locally in the browser. This guide explains how to check persistence and
the age of your last backup, export a plain or encrypted ZIP archive, merge or selectively import
an archive, recover or purge items in the local trash, and erase local data.

For the technical details of the ZIP format, the exact scope of archives and error messages, see
[Local storage, archive format and error messages](../reference/storage-limits-and-errors.md).

## Contents

- [Check the storage status and request persistence](#check-the-storage-status-and-request-persistence)
- [Choose a folder for exports](#choose-a-folder-for-exports)
- [Export a ZIP archive (plain or encrypted)](#export-a-zip-archive-plain-or-encrypted)
- [Import, merge or restore a ZIP archive](#import-merge-or-restore-a-zip-archive)
- [Recover or purge from the local trash](#recover-or-purge-from-the-local-trash)
- [Erase all local data](#erase-all-local-data)

## Check the storage status and request persistence

Click **Backups** in the side menu (French: **Sauvegardes**), under **Data**, to open the
**Backups and storage** window. On narrow screens, open the side menu first with the menu button of
the top bar. The `Ctrl+K` command palette also has an `Open backups` command.

The **Local storage status** section shows the number of projects, tasks, notes, whiteboards and
local images stored, the space used, the quota estimated by your browser and the **Last ZIP
backup** indicator (`No ZIP backup yet`, `Just now`, `<n> min ago`, `<n> h ago`, `<n> days ago`).

- If the badge says **Persistent storage**, the browser protects the database from automatic
  deletion when disk space runs low.
- If the badge says **Standard storage**, click **Ask the browser for persistence** (visible outside
  read-only mode). If the browser refuses, export ZIP archives regularly to keep your data safe.

## Choose a folder for exports

1. Open **Backups and storage**.
2. In **Export folder**, click **Choose a folder** and allow write access in the browser picker.
3. Your next ZIP, Markdown, iCalendar, SVG and PNG exports are saved directly in that folder. A file
   with the same name is replaced.

Locavern remembers the folder on this device when the browser allows it. Otherwise a message says
the choice only lasts for this session. After you reopen the app, the browser may ask for permission
again at the next export. If access is refused, the export reports an error; you can allow access
again or remove the folder.

Use **Change folder** to select another location, or **Remove folder** to go back to the file picker
or the regular download. Removing the folder does not delete any file on disk. Browsers that do not
support this feature keep the regular download.

## Export a ZIP archive (plain or encrypted)

1. Open **Backups and storage** (**Backups** in the side menu).
2. By default the archive is generated in plain form. To protect its content with a password, tick
   **Protect the archive with a password (AES-GCM)**, then type and confirm the password in
   **Encryption password** and **Confirm password** (the eye button lets you check what you typed).
3. Click **Export ZIP archive**.
4. If an export folder is chosen, the file `locavern-backup-YYYY-MM-DD.zip` is saved there directly.
   Otherwise choose its location in the native file picker (or let the standard browser download
   happen). If you cancel the native picker, no file is written and the **Last ZIP backup** date is
   not changed.

The archive includes your projects, tasks (with recurrence, checklists, descriptions, tags and
internal links), notes, whiteboards, custom Kanban statuses and local images in their original binary
format. Items in the trash and custom templates stay in `IndexedDB` on this device only (see
[Scope of archives](../reference/storage-limits-and-errors.md#scope-of-archives-and-technical-limits)).

> **Important:** if you turn on password encryption, keep the password somewhere safe. With no
> server or account, nothing can be recovered if you forget it.

Note: export stays available even when the tab is in read-only mode.

## Import, merge or restore a ZIP archive

1. Open **Backups and storage**.
2. Under **Import an archive**, click **Backup file (.zip)** and select your `.zip` archive.
3. If the archive is password-protected, type the **Archive password**, then click **Unlock
   archive**. Locavern then validates the format, the schema and the presence of every referenced
   image, without touching your local data if anything is wrong.
4. Once the preview is shown, choose one of the three **Import mode** options:
   - **Merge everything without overwriting local data** (selected by default if you already have
     local data): adds the whole archive without touching your existing items (identifiers are
     reassigned automatically on collision and missing Kanban statuses are completed), then click
     **Start import**;
   - **Import selected projects without overwriting**: tick only the projects you want under
     **Projects to import** (and, if the archive has any, **Include items without a project**), then
     click **Start import**;
   - **Replace all local data** (selected by default if the local database is empty): click
     **Import and replace**, then confirm in the **Replace local data?** window to replace the local
     data entirely with the archive content.

The view updates immediately and a notification (**Archive merged** or **Backup restored**) confirms
the operation.

## Recover or purge from the local trash

When you delete a project, task, note or whiteboard from the interface, the item moves to the
local **Trash** instead of being destroyed immediately.

- **View and restore an item**: click **Trash** in the side navigation (or run **Open the trash**
  from `Ctrl+K`), then click **Restore** next to the item. If you restore a project, the tasks
  trashed with it are restored too; a task deleted on its own can only be restored if its parent
  project still exists.
- **Purge for good before it expires**: click **Purge** on a row (or **Empty trash** at the top of
  the window) and confirm. Local images used only by the purged items are then released from
  `IndexedDB`, and internal links pointing to the deleted items are cleaned up.
- **Adjust the retention period**: click **Set the retention period** in the **Local trash**
  window (or open the **Preferences** gear of the top bar > **Trash retention (days)**) to set a whole number of days from `1`
  to `365` (`30` by default). When the app starts, every item past its expiry is purged
  automatically.

## Erase all local data

1. Open **Backups and storage**.
2. Under **Local reset**, click **Erase all local data**.
3. In the confirmation window, click **Erase everything**.

All projects, tasks, notes, whiteboards and local images are permanently deleted from `IndexedDB`
on this device. This action cannot be undone unless you have exported a ZIP archive first.

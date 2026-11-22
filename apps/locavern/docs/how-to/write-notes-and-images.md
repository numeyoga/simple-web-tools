# How to write notes with formatting and local images

This guide explains how to create, filter, duplicate, archive, export as Markdown, format and
illustrate your notes in Locavern. To add tags, create internal links or use ready-made outlines,
see [How to organize your work with tags, links and templates](organize-with-tags-links-and-templates.md).
The detailed validation rules for images and links are listed in
[Local storage, archive format and error messages](../reference/storage-limits-and-errors.md).

## Contents

- [Create, filter, duplicate, archive and delete a note](#create-filter-duplicate-archive-and-delete-a-note)
- [Format text and insert links](#format-text-and-insert-links)
- [Insert local images](#insert-local-images)
- [Export a note as Markdown (.md)](#export-a-note-as-markdown-md)
- [Understand autosave](#understand-autosave)

## Create, filter, duplicate, archive and delete a note

Open the **Notes** view from the side navigation.

- **Create a note**: click **New note** (or **Create a note** when the list is empty, or run
  **Create a note**... from `Ctrl+K`), fill in **Note title** and optionally **Project** and
  **Content**, then click **Create note**. The window opens as a side drawer or a modal depending on
  the **Input style per screen** setting in the preferences.
- **Edit in the built-in workspace or in the input window**: select a note to edit it directly in
  the built-in workspace, or click **Open the editor** in its header to edit it in the configured
  input window.
- **Attach or detach a project**: in the editor header (or the input window), change the **Project**
  drop-down to choose an active project or **No project**.
- **Filter and search**: use the project selector (**All notes**, **No project** or an active
  project), the **Tag** selector (**All tags** or `#<name>`) and the **Search title or content**
  field (multi-word search on title, body and tags). Notes are sorted from the most recently
  modified to the oldest.
- **Duplicate a note**: click **Duplicate** in the card footer to create a copy named
  `<title> (copy)` that keeps the content, tags and images.
- **Archive a note**: click **Archive** in the card footer (or in the input window). The note leaves
  the **Notes** view and moves to the **Archive** screen, where you can filter it, unarchive it or
  move it to the trash.
- **Move a note to the local trash**: click **Delete** in the card footer (or in the input window),
  then confirm with **Delete note**. The note can be recovered from the **Trash** during the
  configured retention period (see
  [How to back up, restore or erase your data](back-up-and-restore.md#recover-or-purge-from-the-local-trash)).

## Format text and insert links

The toolbar above the text area offers these commands (also available in a task **Description**
and in the note input window):

- **Bold**, **Italic**, **Strikethrough**, **Inline code**;
- **Heading 1**, **Heading 2**, **Heading 3**;
- **Bulleted list**, **Numbered list** and a checklist (interactive checkboxes).

To add or change a link:

1. Select the text to turn into a link, then click the **Link** button in the toolbar.
2. In the bar that opens, type an address starting with `https://` or `mailto:`.
3. Click **Apply**.

To remove an existing link, put the cursor on it, open the **Link** bar, clear the address field and
click **Apply**. Addresses that use other protocols (such as `http://` or `javascript:`) are
rejected and trigger a **Link rejected** warning.

## Insert local images

You can attach images stored on your computer in **PNG**, **JPEG**, **WebP** or **GIF** format
(maximum **5 MiB** per image). Three methods are available:

- Click the **Insert a local image** button in the toolbar and select a file;
- Paste an image from the clipboard into the writing area;
- Drag an image file from your file manager into the editor.

The image is copied into your browser's local database (`IndexedDB`) and included in ZIP exports.

If you try to paste a remote image URL (`https://…`) or HTML that contains an external image,
Locavern blocks the insertion and shows the **Remote image blocked** alert. Save the image on your
device first, then insert the local file.

## Export a note as Markdown (.md)

To get a portable text copy of a note:

1. Open the note to export in the **Notes** view.
2. Click **Export (.md)** in the card footer.
3. Save the proposed `.md` file with the native file picker, the export folder or the browser
   download.

The file starts with the title `# <Title>` and a line `> Project: … · Updated: YYYY-MM-DD` (in
French: `> Projet : … · Mise à jour : AAAA-MM-JJ`), followed by the content as Markdown (`h1` to
`h3`, formatting, `- [ ]` / `- [x]` checklists, links and local image references
`local-asset://<id>`).

## Understand autosave

Each keystroke in the title or body of the note in the built-in editor triggers an automatic save
after a short pause (about 200 ms): the indicator at the bottom left changes from **Changes in
progress** to **Saved locally**. Changing the project, a tag or an internal link saves immediately.

You can also click **Save** at any time to force an immediate save with a confirmation
notification.

Note: the **Note title** field cannot stay empty. If you clear it completely in the built-in editor,
the previous title is kept when saving.

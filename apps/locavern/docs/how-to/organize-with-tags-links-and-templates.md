# How to organize your work with tags, links and templates

This guide shows how to sort tasks and notes with cross-cutting tags, relate tasks, notes and
whiteboards with internal links, and reuse local templates for checklists, notes and diagrams. Input
limits and retention rules are described in
[Local storage, archive format and error messages](../reference/storage-limits-and-errors.md).

## Contents

- [Sort tasks and notes with tags](#sort-tasks-and-notes-with-tags)
- [Link tasks, notes and whiteboards together](#link-tasks-notes-and-whiteboards-together)
- [Reuse and create local templates](#reuse-and-create-local-templates)

## Sort tasks and notes with tags

Tags apply to tasks and notes, whatever project they belong to.

1. Open the form of a **task** or the editor of a **note** (in the built-in workspace or in its
   input window).
2. In **Tags**, type a keyword (with or without `#`; you can separate several tags with commas),
   optionally pick a suggestion already used elsewhere, then press `Enter` or `,`, or click
   **Add tag**.
3. Save the task (the built-in note editor saves automatically). To remove a tag, click the
   **Remove tag** button on its chip.

To filter by tag:

- In **Tasks** (**List** or **Kanban**), in **Notes** or in the **Archive**, use the **Tag**
  selector (`All tags` or `#<name>`) to isolate every item carrying that keyword.
- In the `Ctrl+K` palette, type the name of a tag to find the active tasks and notes that carry it.

## Link tasks, notes and whiteboards together

You can create cross-references between any active task, note or whiteboard, subject to the status
and archive rules:

1. Open the **Linked items** section in a task form, under the header of a note or above the canvas
   of a whiteboard.
2. In the **Choose an item to link…** list, select the target task, note or whiteboard, then click
   **Link**.
3. At any time, click a chip under **Linked items** to open the item directly (even if it belongs
   to another project).

Rules applied to internal links:

- **Final statuses are protected**: when a task has a status marked **Final**, it can no longer
  receive new links or create links to other items (its **Linked items** selector is disabled with
  an explanatory message, and it is excluded from the targets offered by other items). Its existing
  links stay visible and removable.
- **Archived items are excluded**: archived tasks, notes and whiteboards (directly or through their
  project) no longer appear in the link target pickers.
- **Two-way backlinks and cleanup**: the items that are pointed to show incoming references in the
  read-only **Linked from:** area. When an item is permanently deleted from the local trash,
  Locavern automatically cleans up the references that became invalid.

## Reuse and create local templates

Locavern ships built-in templates that work offline, and lets you save your own in `IndexedDB`:

- **Checklist templates** (task form, **Checklist** section > **Checklist templates**): select a
  template (for example `Release preparation` or `Quality and security review`) and click **Apply**
  to add its steps to the task checklist without overwriting the existing steps.
- **Note templates** (note editor > **Note templates**): select an outline (for example `Meeting
notes` or `Decision record (ADR)`) and click **Apply**. If the note already has text or images,
  confirm the replacement you are asked about.
- **Canvas templates** (whiteboard > **Canvas templates**): select a diagram (for example
  `Retrospective (3 columns)` or `3-step flow`) and click **Apply**. If the whiteboard already has
  elements, confirm the replacement you are asked about.

To save your own template:

1. Prepare the task checklist, the note outline or the whiteboard shapes (local images are left out
   of saved templates, to avoid broken references).
2. Click **Save as template** in the matching template bar.
3. Type a template name, then click **Confirm** (or press `Enter`).

Your template immediately appears under **My local templates**. To delete a custom template you no
longer use, select it in the list and click the trash icon next to **Apply** (built-in templates
cannot be deleted).

Custom templates are stored on this device only. They are not part of ZIP archives (see
[Scope of archives](../reference/storage-limits-and-errors.md#scope-of-archives-and-technical-limits)).

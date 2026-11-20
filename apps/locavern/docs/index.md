# Locavern documentation

User and technical documentation for Locavern, organized by [Diataxis](https://diataxis.fr/)
(tutorial, how-to guides, reference, explanation). It describes version `0.2.0`, with an interface
in English and French. The pages use the English labels; French labels are given in parentheses where
that helps.

## User documentation

### Tutorial

- [Create your first workspace](tutorials/first-workspace.md): a guided walk from start to finish
  (first project, task, Kanban, note, whiteboard and ZIP export).

### How-to guides

- [How to organize your projects and tasks](how-to/organize-projects-and-tasks.md): manage, archive
  and find projects and tasks in the **Archive**, use quick add, configure the status roles
  (**Initial** / **Final**), sort the List view, drive the Kanban and the `Ctrl+K` palette.
- [How to plan your day and your calendar](how-to/plan-your-day-and-calendar.md): drive the **Today**
  view, tell weekends and the 18:00–07:00 slot apart in the **Calendar**, plan by the hour, set up
  recurring tasks and export `.ics`.
- [How to organize your work with tags, links and templates](how-to/organize-with-tags-links-and-templates.md):
  sort with cross-cutting tags, link tasks, notes and whiteboards (with protection of final statuses)
  and reuse or create local templates.
- [How to write notes with formatting and local images](how-to/write-notes-and-images.md): the rich
  editor (headings 1 to 3), duplication, archiving, Markdown (`.md`) export, allowed links, local
  images and autosave.
- [How to use the whiteboard](how-to/use-the-whiteboard.md): create whiteboards, select by area and
  duplicate (`Ctrl+D`), snap arrows and grid, insert local images, archive and export as SVG/PNG.
- [How to back up, restore or erase your data](how-to/back-up-and-restore.md): persistent storage,
  plain or encrypted ZIP export, merge and selective import, the local trash and reset.
- [How to install Locavern and use it offline](how-to/use-offline.md): PWA installation in
  Chrome/Chromium, use without a network and updating offline.
- [How to resume editing when several tabs are open](how-to/resume-editing-across-tabs.md):
  read-only mode and taking the write lock over.

### Reference

- [Interface, views and keyboard shortcuts](reference/interface-and-shortcuts.md): the views
  (including the **Archive**), fields, input limits, commands and shortcuts.
- [Local storage, archive format and error messages](reference/storage-limits-and-errors.md): the
  `IndexedDB` database (`DB_VERSION = 4`), plain and encrypted ZIP archives, `.md` / `.ics`
  formats, limits and the catalog of errors.

### Explanation

- [Local-first, privacy and scope](explanation/local-first-and-privacy.md): the local-first model,
  optional encryption, the local trash, tab locking, blocking of remote images and structural limits.

## For contributors

### Explanation

- [Architecture choices](explanation/architecture-choices.md): motivations, trade-offs and the pure
  core / adapters split.
- [Technical choices](explanation/technical-choices.md): the original constraints and decisions, the
  alternatives considered and what became of each.

### Project-wide documents

Locavern lives in the Simple Web Tools monorepo. Repository decisions are in
[docs/decisions](../../../docs/decisions/README.md) and the work in progress in the
[roadmap](../../../docs/roadmap.md). The commands to run and check the app are in the app's
[README](../README.md).

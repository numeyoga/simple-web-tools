# How to organize your projects and tasks

This guide covers creating, archiving, unarchiving and deleting projects and tasks, working with
tasks in the List view, the Kanban board or the keyboard, and customizing the status columns and
their roles (**Initial** / **Final**). To plan due dates in **Today** and the **Calendar**, see
[How to plan your day and your calendar](plan-your-day-and-calendar.md). For tags, internal links
and checklist templates, see
[How to organize your work with tags, links and templates](organize-with-tags-links-and-templates.md).
For every field and shortcut, see [Interface, views and shortcuts](../reference/interface-and-shortcuts.md).

The interface is bilingual. Labels below are the English ones; the French label is given once in
parentheses where it differs a lot.

## Contents

- [Manage projects and the archive](#manage-projects-and-the-archive)
- [Create, archive and edit a task](#create-archive-and-edit-a-task)
- [Configure the Kanban statuses](#configure-the-kanban-statuses)
- [Filter, sort and fix unknown statuses in the List view](#filter-sort-and-fix-unknown-statuses-in-the-list-view)
- [Move and filter tasks on the Kanban board](#move-and-filter-tasks-on-the-kanban-board)
- [Use the command palette](#use-the-command-palette)

## Manage projects and the archive

Open the **Projects** view from the side navigation: only active projects are listed there.

- **Create a project**: click **New project**, enter a name (required) and an optional
  description, then click **Create project**. The window opens as a modal or a side drawer
  depending on the **Input style per screen** setting in the display preferences.
- **Edit a project**: on the project card, click **Edit**, change the name or description, then
  click **Save**.
- **Open the items of a project**: click **Open tasks**, **Open notes** or **Open whiteboards** on
  the project card to switch to that view, already filtered on the project.
- **Archive a project**: click **Archive**. The project, with its tasks, notes and whiteboards,
  leaves every usual view (**Today**, **Tasks**, **Projects**, **Calendar**, **Notes**,
  **Whiteboards**, link pickers and the `Ctrl+K` palette) and moves to the **Archive** screen
  (French: **Archives**).
- **Browse and restore from the archive**: open **Archive** in the side navigation (the badge
  shows the number of archived items). Filter by **Search**, **Type** (`All types`, `Projects`,
  `Tasks`, `Notes`, `Whiteboards`), **Project**, **Tag** or sort order, select an item to see its
  details, then click **Unarchive** (unarchiving a task, note or whiteboard of an archived project
  also reactivates that project) or **Move to trash**.
- **Move a project to the local trash**: click **Delete**, then confirm with **Delete project**.
  The project and its tasks go to the local **Trash** for the configured retention period. Its
  notes and whiteboards stay available as items with **No project**. To restore or purge it, see
  [How to back up, restore or erase your data](back-up-and-restore.md#recover-or-purge-from-the-local-trash).

## Create, archive and edit a task

Every task belongs to an existing project.

- **Quick add in one line**:
  - In the **List** view, type a title in **Quick add a task…**, pick the target project if needed
    (when **All projects** is selected), then press `Enter` or click **Quick add**.
  - In the **Kanban** view, type a title in **Quick add…** at the top of the target column, then
    click **Add to <column>** or press `Enter` to create the task directly in that status.
- **Full creation or edit**:
  1. In the **Tasks** view, select a project in the drop-down (or keep **All projects**), then
     click **New task**, or the **+** button at the top of a Kanban column to prefill its status.
     The form opens as a side drawer or a modal depending on the display preferences.
  2. Fill in **Title** (required), **Project**, **Status** (one of the configured statuses or
     **No status**; an **Initial** or **Final** badge shows its role), **Priority**, **Due date and
     time** (the time is optional, `HH:MM`) and, if needed, **Recurrence** (**Daily**, **Weekly**
     or **Monthly**).
  3. Add **Tags** or **Linked items** (links are unavailable when the selected status is **Final**)
     to relate the task to other content.
  4. Under **Checklist**, type a step in **New checklist step** and click **Add** (or apply a
     template from **Checklist templates**). Tick finished steps or remove steps with **×**.
  5. Write the **Description** with the formatting toolbar if needed.
  6. Click **Create task** (or **Save** when editing).

To reopen a task, click its title in the List view or on the Kanban board, click **View** in the
List view, or use the actions menu of the Kanban card. To archive it, click **Archive** in its
form, in the Kanban actions menu (**⋮**) or on its List row. To send it to the local **Trash**,
click **Delete** in its form or in the List view and confirm.

## Configure the Kanban statuses

By default the Kanban board has three columns: **To do** (**Initial** role), **In progress**
(**Intermediate**) and **Done** (**Final** role). You can adapt the statuses and their roles to your
workflow:

1. In the header of the **Tasks** view click **Statuses** (or **Configure the Kanban columns**; you
   can also use **Configure the Kanban statuses** in the display preferences or in the `Ctrl+K`
   palette).
2. In the **Kanban statuses** window:
   - **Rename a status**: edit its label in the list.
   - **Choose its role**: use the role list next to each status to mark it **Initial** (the entry
     point of the flow, shown with the **Initial** badge), **Intermediate** or **Final** (it closes
     the task, removes urgency indicators and prevents new links on the task).
   - **Add a status**: type its name in **Add a status**, choose the role of the new status, then
     click **Add**.
   - **Reorder columns**: use the up and down buttons (**Move status up**, **Move status down**).
   - **Delete a status**: click its delete button. Tasks that carried the status are not deleted:
     they keep its identifier and show the warning badge **Unknown status**.
   - **Reset**: click **Restore defaults** to restore the three default columns.
3. Click **Save** to apply the new configuration.

## Filter, sort and fix unknown statuses in the List view

In the header of the **Tasks** view select **List**. The List view shows every non-archived task,
including those with **No status** or an **Unknown status**, flags initial and final statuses with
their badge, and highlights near or past due dates with the **Overdue**, **Today** and **This
week** badges.

- **Spot the tasks to fix**: tasks without status or with an unknown status have a warning border
  and an orange badge (**No status** or **Unknown status (<old status>)**).
- **Filter by project**: choose **All projects** or one project in the drop-down at the top left.
- **Refine the display**: use **Search** (multi-word filter on title, description, checklist and
  tags), **Status** (including **No status** and unknown statuses), **Priority** and **Tag**.
- **Sort the rows**: in **Sort by** choose **Kanban order**, **Due date** (dated tasks first, in
  date and time order) or **Priority** (from `High` to `Low`).
- **Change a status quickly**: use the status drop-down in the **Actions** column of the row to
  give it an active status or **No status**.

## Move and filter tasks on the Kanban board

In the header of the **Tasks** view select **Kanban**.

- **Filter the board**: use **Search the board** (title, description, checklist and tags),
  **Priority**, **Due date** (**All due dates**, **Overdue**, **Today**, **Within 7 days**,
  **No due date**) and **Tag**.
- **Fix tasks outside the columns**: if tasks with **No status** or an **Unknown status** exist in
  the filtered scope, an alert panel at the top of the Kanban (`<n> tasks outside the columns (no
status or unknown status):`) lets you open each task or place it with **Move to a column…**.

Three methods move a card:

- **With the mouse (drag and drop)**: drag a card to another column (it is added at the end of the
  column) or onto another card of the same project to insert it at that position.
- **With the actions menu**: click the **⋮** button of the card, then choose **Move to <column>**,
  **Move up in the column**, **Move down in the column** or **Archive**.
- **With the keyboard**: focus the card (with `Tab`), then hold `Alt` and press the arrow keys:
  - `Alt + Right arrow` / `Alt + Left arrow` to change column;
  - `Alt + Up arrow` / `Alt + Down arrow` to reorder the card within its project in the same
    column.

When a task with a **Recurrence** reaches a **Final** status, Locavern immediately creates the next
occurrence on the **Initial** status (or the first configured status) and shows the **Next
occurrence created** notification.

## Use the command palette

Press `Ctrl+K` (`Cmd+K` on macOS), or click **Search or run a command** in the top bar, to open the
command palette. Type one or more words (case and accent insensitive) to filter the action
commands and your active projects, tasks, notes, whiteboards and tags, then press `Enter` to
switch view (including **Archive**), open an item directly or run an action (including **Trash**,
**Backups**, the display preferences or the light/dark theme).

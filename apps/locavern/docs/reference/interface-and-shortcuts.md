# Interface, views and keyboard shortcuts

Factual description of Locavern's user interface, fields, defaults and keyboard shortcuts.

The interface is available in English and French. It follows the browser language unless you choose
a language in the display preferences (**Language / Langue**: `Automatic`, `English`, `Français`);
changing the language reloads the page. This page uses the English labels, which come from the
English catalog (`src/i18n/en.js`). A few French labels are given in parentheses.

## Contents

- [General structure (shell)](#general-structure-shell)
- [Today view](#today-view)
- [Tasks view, List mode](#tasks-view-list-mode)
- [Tasks view, Kanban mode](#tasks-view-kanban-mode)
- [Kanban statuses window](#kanban-statuses-window)
- [Task form (side drawer or modal)](#task-form-side-drawer-or-modal)
- [Projects view](#projects-view)
- [Calendar view](#calendar-view)
- [Notes view and rich-text editor](#notes-view-and-rich-text-editor)
- [Whiteboards view and SVG canvas](#whiteboards-view-and-svg-canvas)
- [Archive view](#archive-view)
- [Local trash and Backups](#local-trash-and-backups)
- [Command palette and keyboard shortcuts](#command-palette-and-keyboard-shortcuts)

## General structure (shell)

- **Skip link**: `Skip to content`.
- **Side navigation** (`Main navigation`):
  - `Today` (French: Aujourd'hui);
  - `Tasks` (the default view on first start);
  - `Projects`;
  - `Calendar`;
  - `Notes`;
  - `Whiteboards`;
  - `Archive` (French: Archives), with a counter badge that is hidden when nothing is archived;
  - `Data` group: `Backups` (opens **Backups and storage**) and `Trash` (opens **Local trash**, with
    a counter badge hidden when the trash is empty);
  - `Preferences` group: `Display` (opens **Display preferences**).
  - On narrow screens (below 1024 px) the `Open the menu` button in the top bar opens and closes the
    side navigation.
- **Top bar**:
  - the title of the active view;
  - the `Search or run a command` button (`Ctrl+K`), which opens the command palette;
  - the `Dark` switch, which toggles between the light and dark themes. The choice is kept locally
    under `locavern-color-scheme`; without it the app follows the system `prefers-color-scheme`;
  - the `Back up` button, which opens **Backups and storage**.
- **Service worker update banner**: shown when a new version is installed and waiting: `A new
version is ready offline. Reload the app to use the updated version.`, with the buttons `Reload`
  and `Later`.
- **Display preferences window**:
  - `Text size` segmented control: `Automatic` (default: scaled by 1.125 from 2000 px and by 1.25
    from 2400 px), `Standard` (1), `Comfortable` (1.125) and `Large` (1.25). An explicit choice is
    kept in `localStorage` under `locavern-text-size` and synchronized across tabs (`Automatic`
    removes the key);
  - `Input style per screen` segmented controls, to choose `Side drawer` or `Modal` independently for
    each of four screens: `Tasks` (`Side drawer` by default), `Projects` (`Modal`), `Notes` (`Side
drawer`) and `Whiteboards` (`Modal`);
  - `Notification duration (seconds)`: whole number from `1` to `60` (`6` by default), after which
    success and information notifications close by themselves;
  - `Trash retention (days)`: whole number from `1` to `365` (`30` by default) before permanent
    automatic purge at startup;
  - `Configure the Kanban columns` button, which opens the **Kanban statuses** window;
  - `Language / Langue`: `Automatic`, `English`, `Français`. The choice is kept under
    `locavern-locale` in `localStorage`; `Automatic` removes the key and follows the browser.
  - The other preferences (active view, List or Kanban mode, current selections, input styles,
    notification duration, trash retention, Kanban statuses) are saved locally in `IndexedDB`
    (`meta`, key `preferences`) and kept when data is replaced (except the Kanban statuses when
    the imported archive brings its own list).
- **Notifications**: success and information notifications close by themselves after the configured
  duration (paused while hovered or focused); warnings and errors stay until you dismiss them.

## Today view

- **Header**: the title, today's date formatted for the interface language, and the buttons `New
task`, `New note` and `New whiteboard` (disabled in read-only mode; `New task` opens project
  creation when no active project exists).
- **Figures** (four tiles): `Overdue`, `Due today`, `Within 7 days`, `High priorities`. Archived
  tasks and tasks with a **Final** status are left out of the counters.
- **Sections**:
  - `Overdue tasks`: non-archived, non-final tasks whose due date is before today, with an `<n> days
overdue (<date>)` badge and a `Mark as done` action (it moves the task to the final status; not
    available in read-only mode);
  - `Upcoming due dates`: non-archived, non-final tasks due today or in the next 7 days;
  - `High priorities`: non-archived, non-final tasks with `High` priority, with their status and
    optional date and time;
  - `Recent items`: up to 8 active items (tasks, notes, whiteboards), most recently updated first.

## Tasks view, List mode

Header shared by the task views:

| Control           | Options and behavior                                                                                            | Default                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Project selector  | `All projects`, or an existing project (with the suffix `(archived)` if archived)                               | `All projects` (then the first project made) |
| Display mode      | `List`, `Kanban`                                                                                                | `List`                                       |
| `Statuses` button | Opens the **Kanban statuses** window; disabled in read-only mode                                                | none                                         |
| `New task` button | Opens the creation form (side drawer or modal per preferences); disabled without an active project or read-only | none                                         |

Quick add bar, filters and table (List):

| Element           | Available values                                                         | Behavior                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick add         | `Quick add a task…`, target project, `Quick add`                         | Creates a task in the filtered status (or the default initial status) and the filtered priority (or `Medium`)                                                                                                                                        |
| `Search`          | Free text (`Title, description, checklist`)                              | Multi-word filter, case and accent insensitive, on title, description, checklist steps and tags                                                                                                                                                      |
| `Status`          | `All statuses`, configured statuses, `No status`, unknown status         | Exact filter on a configured status, on tasks with no status, or on tasks whose status identifier is no longer in the Kanban                                                                                                                         |
| `Priority`        | `All priorities`, `High`, `Medium`, `Low`                                | Exact filter on priority                                                                                                                                                                                                                             |
| `Tag`             | `All tags` or `#<name>`                                                  | Filter on tasks carrying the selected tag                                                                                                                                                                                                            |
| `Sort by`         | `Kanban order`, `Due date`, `Priority`                                   | `Due date` puts dated tasks before undated ones (by date, then due time); `Priority` sorts from `High` to `Low`                                                                                                                                      |
| Table columns     | `Task`, `Project`, `Status`, `Priority`, `Due date`, `Actions`           | `Status` shows the status badge and its role badge (`Initial` / `Final`); `Due date` shows date, optional time, the off-hours chip and the `Overdue`, `Today`, `This week` badges; `Actions` has a quick status control, `View`, `Archive`, `Delete` |
| Unresolved status | Warning badge `No status` or `Unknown status (<name>)` + highlighted row | Flags tasks missing from the Kanban so that you can give them an active status                                                                                                                                                                       |

## Tasks view, Kanban mode

- **Configurable columns**: they match the configured statuses (default: `To do` (`Initial`), `In
progress` and `Done` (`Final`)). Each header shows the role badge if any (`Initial` or `Final`), a
  counter, a `+` button (opens creation prefilled for the column) and a quick add bar (`Quick
add…`).
- **Tasks outside the columns**: tasks with no status, or carrying an identifier that is not among
  the configured statuses, are not in the columns. When some exist in the filtered scope, an alert
  reports `<n> tasks outside the columns (no status or unknown status):` with direct opening and a
  `Move to a column…` selector.
- **Filters**: `Search the board` (`Title, description, checklist`), `Priority`, `Due date` (`All due
dates`, `Overdue`, `Today`, `Within 7 days`, `No due date`) and `Tag` (`All tags`, `#<name>`).
- **Card content**: clickable title, actions button (`⋮`), priority badge, due date badge (`Overdue`,
  `Today`, `This week`, removed on a final status) and date and time, recurrence badge, `#<tag>`
  chips, checklist counter `done/total` (when not empty), and the project name (only when `All
projects` is selected).
- **Card actions menu**: `View`, `Move to <other column>`, `Move up in the column` (unless it
  is the first card of its project), `Move down in the column` (unless it is the last), `Archive`,
  `Delete` (sends to the trash after confirmation). In read-only mode only `View` is
  present.
- **Recurrence on move**: moving a recurring task to a **Final** status creates a new task on the
  configured **Initial** status (or the first status) and shows `Next occurrence created`.

## Kanban statuses window

Reachable from the `Statuses` button of the **Tasks** header, from the display preferences
(`Configure the Kanban columns`), or from the command palette (`Configure the Kanban statuses`).

| Element                 | Constraint and behavior                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status list             | Each row lets you edit the label (60 characters maximum), choose the role (`Intermediate`, `Initial`, `Final`), and move the column up or down or delete it |
| `Add a status`          | Creates a status with a unique slug identifier, a required label (60 characters maximum) and a role (`Intermediate`, `Initial` or `Final`)                  |
| `Restore defaults`      | Restores the three default statuses (`To do` initial, `In progress` intermediate, `Done` final) in the editing list                                         |
| Initial and Final rules | `isInitial` and `isTerminal` are mutually exclusive; a final status blocks new links (outgoing and incoming) for the tasks that carry it                    |
| Deleting a column       | Deletes no task: tasks attached to the removed status become `Unknown status`                                                                               |

Status labels are stored as you saved them: changing the interface language does not rename them.

## Task form (side drawer or modal)

Shown as a `Side drawer` by default, or as a `Modal` according to the `Tasks` setting in the display
preferences.

| Field               | Type                                                            | Required | Limit or default                                                                   |
| ------------------- | --------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `Title`             | Text                                                            | Yes      | 200 characters maximum                                                             |
| `Project`           | Drop-down                                                       | Yes      | Selected project or first active project                                           |
| `Status`            | Configured statuses + `No status` (and `Initial`/`Final` badge) | No       | Default initial status (or the column status when added with Kanban `+`)           |
| `Priority`          | `Low`, `Medium`, `High`                                         | Yes      | `Medium`                                                                           |
| `Due date and time` | Date (`YYYY-MM-DD`) + optional time (`HH:MM`)                   | No       | Empty, or the date and time of the cell or slot when created from the **Calendar** |
| `Recurrence`        | `None`, `Daily`, `Weekly`, `Monthly`                            | No       | `None`                                                                             |
| `Tags`              | Input + suggestions + `#<name>` chips                           | No       | 20 tags maximum, 40 characters per tag                                             |
| `Linked items`      | Selector (`Choose an item to link…`) + backlinks `Linked from:` | No       | 50 internal links maximum; adding is disabled on a **Final** status                |
| `Checklist`         | Tickable steps + `Checklist templates` bar                      | No       | 200 characters per step; built-in and personal templates                           |
| `Description`       | Rich-text editor                                                | No       | Empty document                                                                     |

Footer actions: `Delete` and `Archive` (when editing, outside read-only mode), `Cancel`,
`Create task` / `Save`.

## Projects view

The **Projects** view only shows active projects (archived projects are found and filtered in the
**Archive** view). The `New project` / `Edit project` input appears as a `Modal` by default, or as a
`Side drawer`, according to the `Projects` setting in the display preferences.

| Element             | Constraint and behavior                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Project name`      | Required, 120 characters maximum                                                                                                                   |
| `Description`       | Optional, 1,000 characters maximum                                                                                                                 |
| State badges        | `Active` (archived projects move to the **Archive** view)                                                                                          |
| Counters shown      | Number of active tasks, notes and whiteboards of the project                                                                                       |
| Actions per card    | `Open tasks`, `Open notes`, `Open whiteboards`, `Edit`, `Archive`, `Delete`                                                                        |
| Archiving a project | Hides the project and its items from the usual views; an empty state offers `Open the archive` and `Create a project` if all projects are archived |
| Deleting a project  | Moves the project and its tasks to the local **Trash**; detaches its notes and whiteboards (`projectId` becomes `null`, shown under `No project`)  |

## Calendar view

| Element             | Values and behavior                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header              | Project selector (`All projects` or an active project), scale (`Month` / `Week`), navigation (`Previous`, `Today`, `Next`), `Export (.ics)`, `New task`                                                                                                                                                |
| Visual legend       | Tells apart **Saturday & Sunday (weekend)** (warm amber background + accented top border + `Weekend` badge) from the **Off-hours slot, 18:00–07:00 (evening and night)** (cool slate background + side rail + moon icon)                                                                               |
| `Month` grid        | Weeks from Monday to Sunday; weekends differentiated visually, a `Today` badge, a `+` button per day                                                                                                                                                                                                   |
| `Week` grid         | Day strip + a `No time` row + 24 hourly slots (`00:00` to `23:00`), weekend and off-hours differentiation (`18:00–06:59`, separators at `07:00` and `18:00`), a `+` button per day and hour                                                                                                            |
| Task card           | Priority icon before the title (up arrow `High`, equals `Medium`, down arrow `Low`, tooltip with the priority) and a coloured left stripe; click to open the detail, drag and drop to another date or time slot (`No time` or `HH:00`), quick buttons `-1 d` / `+1 d`, `Alt`/`Shift` + arrow shortcuts |
| `No due date` panel | Lists the active tasks without a due date of the selected project, with drag and drop to the grid or a time slot, and a `Schedule for today` button                                                                                                                                                    |
| `Export (.ics)`     | Generates `locavern-<project\|due-dates>-YYYY-MM-DD.ics` (RFC 5545 `VEVENT`: `VALUE=DATE` without time, one-hour `DTSTART`/`DTEND` with the due time, archived tasks excluded)                                                                                                                         |

## Notes view and rich-text editor

- **Filters**: project selector (`All notes`, `No project`, or an active project), `Tag` selector
  (`All tags`, `#<name>`), and the `Search title or content` field (multi-word filter on title,
  content and tags). Archived notes (directly or through their project) are hidden; notes are
  sorted by update date, newest first.
- **Note input window** (`New note` / `Edit note`): a `Side drawer` by default or a `Modal`
  according to the `Notes` setting. Opened by `New note`, `Create a note`, `Open the editor` or
  `Ctrl+K` > `Create a note`. Fields: `Note title` (200 characters maximum), `Project`, `Content`
  (rich editor). Actions: `Delete`, `Archive`, `Cancel`, `Create note` / `Save`.
- **Built-in workspace**: `Note title`, `Project`, `Tags` editor, `Linked items` editor with
  backlinks `Linked from:`, the Tiptap editor, the `Note templates` bar (`Apply`, `Save as
template`, deleting personal templates) and the card footer (`Open the editor`, `Duplicate`, which
  creates `<title> (copy)`, `Export (.md)`, `Archive`, `Delete`, `Save`).
- **Editor toolbar** (shared with task descriptions and the input window):

| Button                                | Action                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `Bold`, `Italic`, `Strikethrough`     | Toggle the matching typographic marks                                        |
| `Inline code`                         | Toggle inline code style                                                     |
| `Heading 1`, `Heading 2`, `Heading 3` | Toggle between a paragraph and an `h1`, `h2` or `h3` heading                 |
| `Bulleted list`, `Numbered list`      | Unordered or ordered list                                                    |
| Checklist                             | List of nestable checkboxes                                                  |
| `Link`                                | Opens the `Link (https://)` bar with `Apply` and `Cancel` buttons            |
| `Insert a local image`                | Opens the file picker (`image/png`, `image/jpeg`, `image/webp`, `image/gif`) |

- **Save indicator**: `Changes in progress` during the typing delay (200 ms), then `Saved locally`.

## Whiteboards view and SVG canvas

- **Filters**: project selector (`All whiteboards`, `No project`, or an active project) and the
  `Search whiteboard title or text` field (title and element texts). Archived whiteboards (directly
  or through their project) are hidden; sorted by update date, newest first.
- **Input window** (`New whiteboard` / `Edit whiteboard`): a `Modal` by default or a `Side drawer`
  according to the `Whiteboards` setting. Fields: `Whiteboard title` (200 characters maximum),
  `Project`, and a `Canvas template` choice. Actions: `Delete`, `Archive`, `Cancel`, `Create
whiteboard` / `Save`.
- **Built-in workspace**: `Whiteboard title`, `Project`, `Linked items` editor with backlinks
  `Linked from:`, the `Canvas templates` bar (`Apply`, `Save as template`, deleting personal
  templates) and the SVG canvas.
- **Canvas toolbar** (`Whiteboard tools`):

| Control                                                    | Action                                                                                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Select`                                                   | Selects (`Shift+click` / `Shift+Space` multi-select), moves, or pans on the background (`Shift+drag` starts a selection by area) |
| `Select by area`                                           | Draws a multi-element selection rectangle                                                                                        |
| `Sticky note`, `Rectangle`, `Ellipse`                      | Creates a shape on click or by dragging (500 characters of text maximum)                                                         |
| `Arrow`                                                    | Creates a directed arrow with snapping to shape anchors (`center`, `top`, `right`, `bottom`, `left`)                             |
| `Text`, `Freehand drawing`                                 | Creates a text block or a freehand stroke (2,000 points maximum per stroke)                                                      |
| `Add to center`                                            | Inserts the element of the active tool at the center of the view (`Sticky note` with `Select` / `Select by area`)                |
| `Local image`                                              | Inserts a local image (`PNG`, `JPEG`, `WebP`, `GIF`; paste and drop also work)                                                   |
| Color picker (five swatches)                               | `Neutral`, `Accent`, `Success`, `Warning`, `Danger` (Covenant semantic tokens)                                                   |
| `Transparent background`                                   | Turns the transparent background (`fill: none`) on or off for `Sticky note`, `Rectangle`, `Ellipse`                              |
| `Edit text`                                                | Opens the text editing bar of the single selected element                                                                        |
| `Duplicate (Ctrl+D)`                                       | Duplicates the current selection with an offset and resets the attachments that are not included                                 |
| `Bring forward one level`, `Send backward one level`       | Moves the single selected element one step forward or backward (`zIndex`)                                                        |
| `Delete selection`                                         | Deletes every selected element                                                                                                   |
| `Undo (Ctrl+Z)`, `Redo (Ctrl+Y)`                           | Local editing history (50 states)                                                                                                |
| `Show alignment grid`                                      | Shows or hides the SVG grid (20 px, on by default, left out of `.svg` / `.png` exports)                                          |
| `Snap to grid`                                             | Turns snapping to the grid (20 px) on or off when creating and moving                                                            |
| `Zoom out`, `Reset zoom to 100%`, `Zoom in`, `Fit to view` | Adjusts the zoom (25% to 300%), resets to 100% or frames the visible content                                                     |
| `Show at maximum size`                                     | Opens the canvas and its toolbar in a modal that fills the visible area of the main content                                      |

- **Card footer**: indicator `Saved locally` / `Changes in progress` (200 ms delay), buttons `Open the
editor`, `Export SVG`, `Export PNG`, `Archive`, `Delete` (sends to the trash after confirmation) and
  `Save`.

## Archive view

Reachable from the side navigation (`Archive`) or through `Ctrl+K` > `Go to the archive`. It gathers
every item archived directly or made archived by its parent project (`Project`, `Task`, `Note`,
`Whiteboard`).

| Element          | Constraint and behavior                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filters and sort | `Search`, `Type` (`All types`, `Projects`, `Tasks`, `Notes`, `Whiteboards`), `Project` (`All projects`, `No project`, a project), `Tag`, sort (`Recently archived`, `Recently modified`, `Title (A–Z)`), and a `Reset` button |
| Archive list     | Shows the type badge, the `Via project` badge when relevant, the title, the original project and the archive date                                                                                                             |
| Detail panel     | Shows where the archiving comes from, the metadata (project, archived on, updated on, related content, status and role, priority, due date, tags), a preview and the existing links                                           |
| `Unarchive`      | Reactivates the selected item; for a task, note or whiteboard attached to an archived project, it also reactivates the parent project                                                                                         |
| `Move to trash`  | Sends the archived item to the local **Trash** after confirmation                                                                                                                                                             |

## Local trash and Backups

- **Local trash window**:
  - Retention banner (`Retention set to <n> days before permanent purge.`), buttons `Set the
retention period` (focuses the retention field) and `Empty trash` (with confirmation);
  - Each entry shows the type badge (`Project`, `Task`, `Note`, `Whiteboard`), the title, the
    original project or the number of tasks included, the deletion date, the time left (`Purged in
<n> days` / `Purge imminent`) and the buttons `Restore` and `Purge`.
- **Backups and storage window**:
  - **Local storage status**: counters (projects, tasks, notes, whiteboards, `Local images`), `Space
used`, `Estimated quota`, `Last ZIP backup`, the `Persistent storage` / `Standard storage` badge and
    the `Ask the browser for persistence` button;
  - **Export folder**: `Choose a folder`, `Change folder`, `Remove folder`;
  - **Export an archive**: the `Protect the archive with a password (AES-GCM)` checkbox, the
    `Encryption password` and `Confirm password` fields (with a show/hide toggle), the `Export ZIP
archive` button;
  - **Import an archive**: the `Backup file (.zip)` field, optional unlocking with `Archive
password`, the `Import mode` selector (`Merge everything without overwriting local data`, `Import
selected projects without overwriting`, `Replace all local data`) with the `Projects to import` and
    `Include items without a project` checkboxes in selective mode;
  - **Local reset**: the `Erase all local data` button, with confirmation.

## Command palette and keyboard shortcuts

Static commands of the palette (`Ctrl+K` / `Cmd+K`):

| Label                                 | Action                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Go to Today`                         | Shows the **Today** view                                                                   |
| `Go to tasks`                         | Shows the **Tasks** view                                                                   |
| `Go to projects`                      | Shows the **Projects** view                                                                |
| `Go to the calendar`                  | Shows the **Calendar** view                                                                |
| `Go to notes`                         | Shows the **Notes** view                                                                   |
| `Go to whiteboards`                   | Shows the **Whiteboards** view                                                             |
| `Go to the archive`                   | Shows the **Archive** view                                                                 |
| `Create a task`                       | Opens `New task` (or `New project` if no active project exists); ignored in read-only mode |
| `Create a project`                    | Opens `New project`; ignored in read-only mode                                             |
| `Create a note`                       | Opens `New note` and shows **Notes** after creation; ignored in read-only mode             |
| `Create a whiteboard`                 | Opens `New whiteboard` and shows **Whiteboards** after creation; ignored in read-only mode |
| `Configure the Kanban statuses`       | Opens the **Kanban statuses** window; ignored in read-only mode                            |
| `Open backups`                        | Opens **Backups and storage**                                                              |
| `Open the trash`                      | Opens **Local trash**                                                                      |
| `Open display preferences`            | Opens **Display preferences**                                                              |
| `Switch between light and dark theme` | Inverts the active theme and saves the preference                                          |

The palette indexes active projects, tasks, notes and whiteboards (items archived directly or
through their project are excluded; multi-word, accent-insensitive search on titles, descriptions,
checklists, tags and whiteboard texts; up to 60 results shown).

Global and contextual keyboard shortcuts:

| Context                               | Shortcut                                                         | Effect                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Global                                | `Ctrl+K` / `Cmd+K`                                               | Opens the command palette                                                                                           |
| Modals, drawers, palette, mobile menu | `Esc`                                                            | Closes the open window or menu                                                                                      |
| Command palette                       | `Up arrow` / `Down arrow`, `Enter`                               | Moves through the entries and runs the selected one                                                                 |
| Focused Kanban card                   | `Alt + Left arrow` / `Alt + Right arrow`                         | Moves the card to the previous / next column                                                                        |
| Focused Kanban card                   | `Alt + Up arrow` / `Alt + Down arrow`                            | Moves the card up / down among the tasks of its project in the column                                               |
| Open Kanban actions menu              | `Up arrow` / `Down arrow`, `Home`, `End`, `Enter`, `Tab`         | Navigates the actions, activates the option or closes the menu                                                      |
| Focused task in the **Calendar**      | `Alt` or `Shift + Left/Right arrow`                              | Moves the due date back or forward by 1 day                                                                         |
| Focused task in the **Calendar**      | `Alt` or `Shift + Up/Down arrow`                                 | Moves the due date back or forward by 7 days                                                                        |
| Focused whiteboard SVG element        | `Arrow keys` (with `Shift` for a fine step of 1)                 | Moves the selection by 10 units (20 with snap on; 1 with `Shift`)                                                   |
| Focused whiteboard SVG element        | `Alt + Arrow keys`                                               | Resizes the element by 10 units (1 with `Shift`)                                                                    |
| Focused whiteboard SVG element        | `Shift + Space`                                                  | Adds or removes the focused element from the multiple selection                                                     |
| Focused whiteboard SVG element        | `Page Up` / `Page Down`                                          | Brings the element forward or sends it backward one level in the stacking order                                     |
| Focused whiteboard SVG element        | `Enter` or `F2`                                                  | Opens the accessible text editor (sticky note, rectangle, ellipse, text)                                            |
| Focused whiteboard SVG element        | `Delete` or `Backspace`                                          | Deletes every selected element                                                                                      |
| Active whiteboard                     | `Ctrl+A` / `Cmd+A`, `Ctrl+D` / `Cmd+D`                           | Selects everything / duplicates the current selection                                                               |
| Active whiteboard                     | `Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`, `Ctrl + mouse wheel`, `Esc` | Undoes, redoes, zooms, closes the current edit or goes back to the `Select` tool (or closes the maximum size modal) |

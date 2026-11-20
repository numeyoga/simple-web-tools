# How to plan your day and your calendar

This guide explains how to drive your daily due dates from the **Today** view, reschedule tasks and
time slots in the **Calendar** view, set up recurring tasks and export an `.ics` calendar. For the
full list of controls and shortcuts, see [Interface, views and shortcuts](../reference/interface-and-shortcuts.md).

## Contents

- [Run your day from Today](#run-your-day-from-today)
- [Plan and reschedule tasks in the calendar](#plan-and-reschedule-tasks-in-the-calendar)
- [Set up a recurring task](#set-up-a-recurring-task)
- [Export your due dates as iCalendar (.ics)](#export-your-due-dates-as-icalendar-ics)

## Run your day from Today

Open the **Today** view in the side navigation (or press `Ctrl+K`, then choose **Go to Today**).

1. Read the four figures at the top of the screen (**Overdue**, **Due today**, **Within 7 days**,
   **High priorities**) to gauge the load of the day.
2. Go through the **Overdue tasks**, **Upcoming due dates** (the next 7 days) and **High
   priorities** sections:
   - Click a row to open the task and adjust its due date, time, priority or steps.
   - Click the **Mark as done** button (check icon) on the right of a task to move it straight to
     the **Final** status. If the task is recurring, Locavern creates the next occurrence at once.
3. Use **Recent items** to reopen one of the eight most recently modified active tasks, notes or
   whiteboards, or create an item with the **New task**, **New note** and **New whiteboard** buttons
   in the header.

## Plan and reschedule tasks in the calendar

Open the **Calendar** view in the side navigation (or press `Ctrl+K`, then choose **Go to the
calendar**).

The legend under the header explains how to read the calendar:

- **Saturdays and Sundays** have a warm amber background and a **Weekend** badge (in the **Month**
  and **Week** views), so they stand out from working days.
- The **off-hours slot, 18:00–07:00** (from `18:00` to `06:59`) is set apart by a cool slate
  background, a dedicated side border, separators at `07:00` and `18:00` and a moon icon (in the
  **Week** view, and as a time chip on the tasks concerned).

Available actions:

- **Read a card's priority**: besides the colour of its left stripe, each task card shows an icon
  before its title: an up arrow for **High**, an equals sign for **Medium**, a down arrow for
  **Low**. Hover the icon to see the priority in words.
- **Change scale and navigate**: switch between **Month** and **Week**, move with **Previous** and
  **Next**, or go back to the current date with **Today**.
- **Filter by project**: select **All projects** or an active project in the drop-down at the top
  left.
- **Create a task at a given date (or time)**:
  - In the **Month** view, click **+** in the cell of the day you want.
  - In the **Week** view, click **+** in the **No time** cell of a day or in a time slot (`00:00`
    to `23:00`) to prefill both the date and the time.
- **Schedule a task without a due date**: scroll to the **No due date** panel under the grid, then
  click **Schedule for today** or drag the task chip onto the day (or time slot) you choose.
- **Reschedule a due date or change its time**:
  - **With the mouse**: drag the task card to another date cell (or, in the **Week** view, to a time
    slot, or to **No time** to remove the time).
  - **With the quick buttons**: click `-1 d` or `+1 d` on the card.
  - **With the keyboard**: focus a dated task and use `Alt + Left/Right arrow` (or `Shift +
Left/Right arrow`) to move by `±1` day, and `Alt + Up/Down arrow` (or `Shift + Up/Down arrow`)
    to move by `±7` days.

## Set up a recurring task

1. Create or open a task in its detail form.
2. Ideally set a **Due date** (and a time if useful): it is the reference used to compute the next
   occurrence. Without one, today's date is used when you save.
3. In **Recurrence**, select **Daily**, **Weekly** or **Monthly**, then save.

When you move this task to a **Final** status (from **Today**, the **List** view, the **Kanban**
board or the task form), Locavern automatically creates the next occurrence on the configured
**Initial** status. It shifts the due date (keeping the time, if any), resets the checklist and
keeps the description, tags, internal links and local images.

## Export your due dates as iCalendar (.ics)

1. In the **Calendar** view, choose **All projects** or the active project to export in the
   project selector.
2. Click **Export (.ics)**.
3. Save the file `locavern-<project|due-dates>-YYYY-MM-DD.ics` with the native file picker, the
   export folder or the browser download.

The file contains one event for every non-archived task in the filter that has a due date: an
all-day event (`VALUE=DATE`) when no time is set, or a one-hour timed event (`DTSTART`/`DTEND`)
when a time (`HH:MM`) is set, with its status, priority, description and checklist. Import the
`.ics` file into your personal calendar to see your due dates outside Locavern.

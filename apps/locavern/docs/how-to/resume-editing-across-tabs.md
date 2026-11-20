# How to resume editing when several tabs are open

Locavern lets only one tab write at a time, to avoid conflicts in your local database. If you open
a second tab in the same browser, a banner says **Read-only mode is on.** at the top of the page.

## Contents

- [What stays available in read-only mode](#what-stays-available-in-read-only-mode)
- [Move editing to the current tab](#move-editing-to-the-current-tab)

## What stays available in read-only mode

In a read-only tab:

- You can view **Today**, **Projects**, filter and sort **Tasks** (List and Kanban), browse the
  **Calendar**, read your **Notes**, inspect your **Whiteboards**, browse the **Archive** and view
  the contents of the **Trash**.
- You can export your data locally: ZIP backup (**Back up** > **Export ZIP archive**), `.ics`
  calendar, Markdown note, `.svg` or `.png` image.
- Creating, editing, moving, archiving and unarchiving, deleting, restoring from the trash,
  importing a ZIP and erasing local data are disabled.

## Move editing to the current tab

1. Close the tab or the installed window that held Locavern in write mode.
2. Wait a moment on the remaining tab. Locavern notices that the lock was released, reloads the
   latest state from `IndexedDB` and shows the **Editing restored** notification.
3. If the banner stays visible (for example because the first tab was suspended rather than
   closed), make sure every other Locavern tab is closed, then click **Resume editing** in the
   banner.

If another tab is still open, a **Lock still held** notification asks you to check that no other
Locavern window is open in the same browser profile.

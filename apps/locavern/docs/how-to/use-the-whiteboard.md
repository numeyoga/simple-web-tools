# How to use the whiteboard

This guide explains how to create and archive a whiteboard, select by area and duplicate elements,
snap arrows and use the grid, work with shapes by mouse or keyboard, insert local images and export
your diagram as SVG or PNG. To add internal links or apply a canvas template, see
[How to organize your work with tags, links and templates](organize-with-tags-links-and-templates.md).
Complete shortcuts and data limits are in [Interface, views and shortcuts](../reference/interface-and-shortcuts.md)
and [Local storage, archive format and error messages](../reference/storage-limits-and-errors.md).

## Contents

- [Create, filter, archive and delete a whiteboard](#create-filter-archive-and-delete-a-whiteboard)
- [Add, select by area, duplicate and edit elements](#add-select-by-area-duplicate-and-edit-elements)
- [Snap arrows, show the grid and manage layers](#snap-arrows-show-the-grid-and-manage-layers)
- [Use the whiteboard with the keyboard only](#use-the-whiteboard-with-the-keyboard-only)
- [Insert a local image](#insert-a-local-image)
- [Navigate, undo and export as SVG or PNG](#navigate-undo-and-export-as-svg-or-png)

## Create, filter, archive and delete a whiteboard

Open the **Whiteboards** view from the side navigation (or press `Ctrl+K`, then choose **Go to
whiteboards**).

- **Create a whiteboard**: click **New whiteboard** (or **Create a whiteboard** when the list is
  empty, or run **Create a whiteboard** from `Ctrl+K`), type the **Whiteboard title** and optionally
  choose the **Project**, then click **Create whiteboard**. The window opens as a modal or a side
  drawer depending on the **Input style per screen** setting in the display preferences.
- **Rename and attach to a project**: edit **Whiteboard title** and **Project** directly in the
  whiteboard header, or click **Open the editor** to edit them in the configured input window.
- **Filter and search**: use the drop-down at the top left (**All whiteboards**, **No project** or
  an active project) and the **Search whiteboard title or text** field (it searches the whiteboard
  title and the text of its elements).
- **Archive a whiteboard**: click **Archive** in the card footer (or in the input window). The
  whiteboard leaves the **Whiteboards** view and moves to the **Archive** screen, where you can
  unarchive it or move it to the trash.
- **Move a whiteboard to the local trash**: click **Delete** in the card footer (or in the input
  window), then confirm with **Delete whiteboard**. It can be recovered from the **Trash** during
  the configured retention period (see
  [How to back up, restore or erase your data](back-up-and-restore.md#recover-or-purge-from-the-local-trash)).

## Add, select by area, duplicate and edit elements

The toolbar above the canvas offers the tools below. **The chosen tool stays active until you select
another one** (or press `Esc`), so you can draw several shapes in a row:

1. **Select**: click an element to select it, drag it to move it, double-click to edit its text,
   or drag the background to pan the view. Hold `Shift` and drag on the canvas to draw a selection
   rectangle without leaving the **Select** tool.
2. **Select by area**: draw a rectangle on the canvas to select several elements in one gesture.
3. **Sticky note**, **Rectangle**, **Ellipse**, **Arrow**, **Text**: select the tool, then click
   once on the canvas to create the element at its standard size, or click and drag to choose its
   dimensions.
4. **Freehand drawing**: click and drag on the canvas to draw by hand, as many strokes as needed.

To work on a multiple selection or duplicate quickly:

- **Add or remove an element from the selection**: use `Shift+click` (or `Shift+Space` on the
  keyboard) on an element.
- **Select everything**: press `Ctrl+A` (`Cmd+A` on macOS) while the canvas has focus.
- **Move or delete a group**: drag one of the selected elements, or press `Delete` (or click
  **Delete selection**) to act on the whole selection.
- **Duplicate**: select one or more elements, then click **Duplicate (Ctrl+D)** or press `Ctrl+D`
  (`Cmd+D`) to create an offset copy.

To change the color of an element, or of the next ones, pick one of the five color swatches
(`Neutral`, `Accent`, `Success`, `Warning`, `Danger`).

To edit the text of a **Sticky note**, a **Rectangle**, an **Ellipse** or a **Text** block:

- Switch to **Select**, then double-click the element (or select it and click **Edit text**);
- Type your text in the editing bar (up to 500 characters; `Shift+Enter` inserts a line break);
- Click **Confirm** (or press `Enter`).

## Snap arrows, show the grid and manage layers

- **Snap an arrow to shapes**: when you draw an **Arrow** or drag one of its end handles near a
  **Sticky note**, **Rectangle**, **Ellipse**, **Text** block or **Local image**, snap anchors appear
  (center and the four sides); release to attach the end to the shape. While the attachment holds,
  the arrow follows the movement or resizing of the attached shape.
- **Show the grid and turn on snapping**: in the toolbar, show or hide **Show alignment grid**
  (visible by default, never included in `.svg` or `.png` exports) and toggle **Snap to grid** to
  align creations and moves on a `20 px` grid (`Shift+Arrows` on the keyboard keeps a fine step of
  `1` unit even when snapping is on).
- **Change the stacking order one level at a time**: select the element, then click **Bring forward
  one level** (`Page Up`) or **Send backward one level** (`Page Down`).
- **Make the background transparent**: turn on **Transparent background** (checkerboard icon)
  before drawing a **Rectangle**, an **Ellipse** or a **Sticky note**, or after selecting an existing
  element to remove or restore its fill. Only the colored border stays visible and clickable.

## Use the whiteboard with the keyboard only

Every creating, selecting and editing operation works without drag and drop or a mouse:

- **Create an element without dragging**: select a shape tool in the toolbar, then activate **Add to
  center** (or press `Enter` on a tool that is already active) to place the element of that tool at
  the center of the visible area (when **Select** or **Select by area** is active, **Add to center**
  inserts a **Sticky note**).
- **Navigate and select**: use `Tab` to go through each element of the SVG canvas, `Shift+Space` to
  toggle adding an element to the current selection and `Ctrl+A` / `Cmd+A` to select everything.
- **Move the selection**: use the arrow keys (`10` units by default, or a `20 px` step when snap to
  grid is on; `Shift+Arrows` for a fine step of `1` unit).
- **Resize the focused element**: use `Alt+Arrows` (`10` units, or `Alt+Shift+Arrows` for `1` unit).
- **Change the stacking order**: press `Page Up` to bring forward one level or `Page Down` to send
  backward one level.
- **Duplicate**: press `Ctrl+D` (`Cmd+D`).
- **Edit the text**: press `Enter` or `F2` on the selected element.
- **Delete the selection**: press `Delete` or `Backspace`.
- **Go back to Select**: press `Esc` while a drawing tool is active.

## Insert a local image

Locavern accepts local images in **PNG**, **JPEG**, **WebP** and **GIF** format (up to **5 MiB** per
image):

- Click **Local image** in the whiteboard toolbar and choose a file;
- Or paste an image file directly (`Ctrl+V`) or drag and drop it onto the canvas.

Remote images (`https://…`) pasted from the clipboard are blocked and trigger the **Remote image
blocked** warning. Added files are copied into `IndexedDB` and included in ZIP archives.

## Navigate, undo and export as SVG or PNG

- **Edit history**: click **Undo (Ctrl+Z)** or **Redo (Ctrl+Y)** (`Ctrl+Y` / `Ctrl+Shift+Z`).
- **Zoom, fit and pan**: use **Zoom out**, **Reset zoom to 100%**, **Zoom in** and **Fit to view** in
  the toolbar, or `Ctrl + mouse wheel` over the canvas. With the **Select** tool, drag an empty area
  to pan the canvas.
- **Show at maximum size**: click **Show at maximum size** on the right of the toolbar to enlarge
  the canvas and its tools in a modal that fills the visible area of the main content. Press `Esc`,
  click outside the window, click **Close** or click the button again to return to the normal view
  without losing your selection or history.
- **Autosave**: every change is saved locally after `200 ms` (**Saved locally**). Click **Save** to
  force an immediate save.
- **Export an image**: click **Export SVG** to download a standalone `.svg` file (colors resolved
  for the active theme, transparent backgrounds kept and local images embedded, without the grid or
  selection frames), or **Export PNG** to generate a `.png` file locally in your browser.

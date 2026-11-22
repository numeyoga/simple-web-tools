# Back up, restore and move your data

## Export and import

Open **More actions**:

- **Export JSON** downloads the active workspace as `favoris-<workspace>-<date>.json`.
- **Import JSON** replaces everything the active workspace holds with the content of a file, after
  asking. Records that cannot be used are skipped and counted in a message that stays until you
  dismiss it; a link whose address is not `http` or `https` is always skipped.
- **Clear all** empties the active workspace, after asking.

The import also reads the file the earlier version of Favoris exported (`space`, `tags`, `links`).

## If you used the earlier version of Favoris

It was served from the same address as these apps, so the new Favoris finds its data on the first
start: each **space** becomes a **workspace**, with its groups (the **tags**) and links, in the same
order. The space that was open stays open, and your theme is kept. A message says what was imported
and what was skipped.

- The old data is only read. It stays in your browser, untouched, as a backup.
- The import runs once. If you later add data to the old keys by hand, it is not imported again.
- Colours: the 12 colours of the earlier version become the 16 colours of the new palette with the
  same hue (blue stays blue); you can change them in the group editor.
- Links with an address that is not `http` or `https`, which the earlier version let through, are
  not imported.
- The optional sync of the earlier version is not part of this app.

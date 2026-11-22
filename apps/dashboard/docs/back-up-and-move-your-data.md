# Back up, restore and move your data

## Export and import

Open **Administration, Import and export**.

- **Download the JSON file** saves the active workspace as `dashboard-<workspace>-<date>.json`.
  **Copy the JSON** puts the same text on the clipboard.
- **Choose a file** reads a file and checks it. Nothing changes until you confirm. The summary says
  how many applications, templates and links it holds, and how many records cannot be used (they
  are skipped, never fatal; an address that is not `http` or `https` is always skipped).
- Then choose how to bring it in:
  - **Merge** adds the templates, applications and tags the workspace does not have (matched by
    identifier, or by key for the tags). What the workspace already has is kept, and so is its
    name and settings.
  - **Replace** replaces everything in the workspace, after asking.
  - **New workspace** puts the file in a new workspace, and leaves this one as it is.

Under **Settings**, **Clear the workspace** empties it (after asking) and keeps nothing but the
default tags.

## If you used the earlier version of the dashboard

The earlier dashboard was served from another address (GitLab Pages), so a browser keeps its data
apart: the new Dashboard cannot read it. Move it with the export file:

1. Open the **earlier dashboard**, go to **Administration, Import / Export** and **Télécharger .json**
   for each profile you want to keep (a profile is one "key" of its storage; switch under
   **Stockage local**).
2. Open the new Dashboard, then **Administration, Import and export**.
3. **Choose a file** and pick the `.json` you downloaded. The file is the wrapped one
   (`{ version, exportedAt, data }`) or the bare object: both work.
4. Pick **New workspace** (one workspace per profile is the closest to the earlier version), or
   **Replace** to fill an empty workspace.
5. Check the summary, then **Import**.

What comes over: the name, the default application and environment, the tags, the templates, and
the applications with their metadata, changed addresses and extra links. Your `{cluster}` style
patterns keep working.

What does not:

- The earlier **theme and density** are preferences here: set them in the preferences.
- An application whose template is not in the file is kept, and says that its template is missing.
- An address that is not `http` or `https` (in a changed address or an extra link) is skipped, and
  counted in a message that stays until you dismiss it.
- The earlier dashboard is not touched: keep it as a backup until you are sure.

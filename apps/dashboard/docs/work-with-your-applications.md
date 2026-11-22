# Work with your applications

## The application screen

Pick an application in the sidebar. The tabs are the environments of its template; the strip above
the links holds the metadata of the environment; below, the links of the template grouped by tag.

- The **copy** button copies the address, the **open** button opens it in a new tab.
- **Open all the links** and **Copy all the links** work on the environment that is shown. Your
  browser may block the new tabs: allow pop-ups for this site.
- **Extra links** belong to this application only, outside the environments.

## Edit mode

Press **Edit**. The name, slug, Jira key and description become fields, and so do the metadata
values. A field saves when you leave it or press Enter.

- **Change the address of a link** for one environment with the pencil on its row. The row says
  "Changed"; the arrow brings the pattern back. Only `http` and `https` addresses are accepted.
- **Add, edit and delete an extra link** with a name, an address and a tag.
- **Add an environment**: it is added to the **template**, so every application made from it gets
  it. Rename it under Administration, Templates.
- **Duplicate** copies the application with a free slug (`name-copy`); **Delete** asks first.

## The filter and the command menu

- The **filter** in the sidebar keeps the applications that match by name, slug, Jira key,
  description, template or extra link, and filters the links of the open application. Case and
  accents do not matter; every word must be found. `/` goes to it.
- **Ctrl+K** (⌘K) opens the **command menu**: type a few letters to go to an application or a
  screen, or to run an action (new application, edit mode, export, preferences, workspaces).

## What opens at the start

Under **Administration, Settings**: the application (a fixed one, or the last one you looked at),
and the environment: the **first** or the **last** of the template (often production), or
**remember** the one you used last in each application.

## Workspaces

The button at the top of the sidebar manages **workspaces**: separate dashboards, for example one
per team or per client. Each has its own templates, tags and applications. You can create, rename,
duplicate and delete them (not the last one, not the active one) and switch. Theme, text size,
density and language are yours, and the same in every workspace.

## Several tabs

Only one tab can change data. A second tab shows a banner and is read-only; it follows what the
first one does, and takes over when the first one is closed.

# How to install Locavern and use it offline

Locavern is a progressive web app (PWA): after a first load, its static files are cached locally,
so it works without a network connection.

## Contents

- [Install Locavern on your computer](#install-locavern-on-your-computer)
- [Check offline availability](#check-offline-availability)
- [Update an installed version](#update-an-installed-version)

## Install Locavern on your computer

Prerequisite: open Locavern in a recent Chrome or Chromium from its published address (HTTPS), or
from `127.0.0.1` when you run it locally (see the [README](../../README.md)).

1. Load the app once with a connection, so that the service worker can cache its files.
2. In the address bar of Chrome or Chromium, click the install icon (or look for an install entry in the browser menu; its
   wording depends on the browser version).
3. Confirm the installation.

Locavern opens in its own window, without an address bar. It uses the same `IndexedDB` data as
the browser tab, because both share one origin.

## Check offline availability

1. After the first complete load, turn the network off (or enable offline mode in the browser
   developer tools).
2. Reload the page or reopen the installed app.

The whole interface (fonts, icons, light and dark themes, the **Today**, **Tasks**, **Projects**,
**Calendar**, **Notes**, **Whiteboards** and **Archive** views, **Trash**, **Backups**, the
built-in templates and the local `.zip`, `.ics`, `.md`, `.svg` and `.png` exports) stays available,
and your changes keep being saved locally.

## Update an installed version

When Locavern is updated on its host and you reload the app with a connection, the new service
worker installs in the background and waits. When the new version is ready, a banner appears at the
top of the page: **A new version is ready offline. Reload the app to use the updated version.**

1. As a precaution, first export a ZIP archive, see
   [How to back up, restore or erase your data](back-up-and-restore.md).
2. Click **Reload** in the banner to switch to the new version now, or **Later** to keep working
   with the current one until the app is reopened in all tabs.

The service worker only deletes the caches whose name starts with `locavern-`: the other apps
hosted on the same origin keep their own caches.

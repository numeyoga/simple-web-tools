# 0005. All apps on one GitHub Pages origin, with prefixed storage

Status: accepted, 2026-11-18

## Context

A GitHub repository publishes a single Pages site, so every app is served from the same
origin (`https://<user>.github.io`), under its own path. Browsers isolate storage **by origin,
not by path**: IndexedDB, `localStorage`, Web Locks, `BroadcastChannel`, cookies, permissions
and the storage quota are all shared between the apps.

Moving an app to a new origin (for example from `gitlab.io` to `github.io`) leaves its users'
data behind in the old origin.

## Decision

- Every persisted or shared name starts with the app name: `locavern-db`,
  `locavern-write-lock`, `chrono__default`…
- Each Service Worker is registered with a scope limited to its app's path, and caches are
  named after the app.
- No app reads or deletes storage it does not own. "Clear all data" in one app only removes
  that app's own names.
- When an app changes origin, its old address stays online for a transition period with a
  notice that explains how to export the data and import it at the new address.

## Consequences

- Each app gets a test that asserts the prefix, written with `packages/storage`.
- Locavern's existing users keep their data: it was already served from `numeyoga.github.io`,
  and only its path changes.
- Chrono's users must export from `wallartn.gitlab.io/chrono` and import at the new address,
  see [Moving your data](../moving-your-data.md).
- A custom domain with one subdomain per app would give real isolation. It stays an option if
  an app ever needs different permissions.

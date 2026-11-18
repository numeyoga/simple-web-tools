# 0004. Locavern's architecture is the reference

Status: accepted, 2026-11-18

## Context

Locavern is the largest app and already has a clear structure, typed code and browser tests.
Aligning the other apps on it costs less than designing a third structure.

## Decision

Every app follows this structure:

- `src/core/`: pure domain logic. State changes go through `reduce(state, command)`, which
  returns the new state and typed effects. There is no DOM, no storage and no clock read in
  this folder: time is passed in as a parameter.
- `src/adapters/`: IndexedDB storage, DOM views, file import and export.
- **Types** are written in JSDoc and checked with `tsc --checkJs --strict`.
- **Tests**: Vitest for `core` and the storage adapter (with a fake IndexedDB); Playwright with
  axe for user journeys and accessibility.
- **Multiple tabs**: a single tab writes, through a Web Lock. The other tabs are read-only and
  reload when they are told about a change.
- **Security**: a strict Content Security Policy (`default-src 'none'`), no CDN, no inline
  script.
- **Dates**: calendar dates are local `YYYY-MM-DD` strings, never `toISOString()`. Days are
  added with `setDate`, never as 24-hour steps. Tests run in several time zones.

## Consequences

- Code shared by two apps moves to `packages/` (design system, storage, dates, i18n, test
  helpers), with the same rules.
- Chrono's multi-tab model (several writers synchronized with `BroadcastChannel`) is replaced
  by the single-writer model when it is ported.

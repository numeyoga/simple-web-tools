# 0001. One public monorepo with npm workspaces

Status: accepted, 2026-11-18

## Context

Several small browser apps share the same philosophy (local-first, no backend, static
hosting) but grew in separate repositories on GitHub and GitLab. Their tooling drifted: one
has no build and no linter, another has Vite, typed JSDoc, Vitest and Playwright. Fixes to
common concerns (storage, dates, accessibility) had to be made twice.

## Decision

- One public GitHub repository, `apps/<app>` for applications and `packages/<name>` for
  shared code.
- **npm workspaces**: a single lockfile and a single install, with no extra tool (pnpm,
  Nx, Turborepo). This is worth revisiting past roughly ten packages, or if CI gets slow.
- Apps are imported **with their git history** (subtree merge), so `git log` still explains
  past choices.
- A shared package is extracted only once **two apps** need it. Until then, the code stays in
  its app.

## Consequences

- One CI and one deployment for every app. A change in a package is tested against all its
  users at once.
- Commit scopes name the app or package (`feat(chrono): …`), which keeps the history
  readable and leaves room for path-filtered CI later.
- Hosting on GitHub gives access to Claude Code on the web for maintenance.

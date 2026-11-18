# 0003. No runtime framework, Vite as a tool

Status: accepted, 2026-11-18

## Context

The apps are small, long-lived and maintained occasionally. A runtime framework brings
upgrades and churn that outweigh its benefits at this size. Chrono, however, also had no
build step at all, which rules out shared packages, npm dependencies and a strict CSP
with hashed bundles.

## Decision

- **No UI framework at runtime** (no React, Vue, Svelte, Lit…): vanilla JavaScript ES modules,
  native DOM and CSS custom properties.
- **Vite** is used for the dev server, the production build and Vitest. Small, focused runtime
  libraries are allowed when they remove real complexity (for example `idb`, `fflate`,
  Tiptap core).
- Builds use `base: './'`, so each app works under any sub-path.

## Consequences

- Chrono moves from global IIFE scripts to ES modules (see the [roadmap](../roadmap.md)).
- Each runtime dependency must be justified in the app's README.

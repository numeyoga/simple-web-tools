# 0006. MIT license

Status: accepted, 2026-11-18

## Context

The repository is public. Locavern was already under the MIT license. The bundled third-party
assets use permissive licenses: Phosphor Icons (MIT), IBM Plex (SIL OFL 1.1).

## Decision

The whole repository is under the **MIT license**, with a single `LICENSE` file at the root.
Third-party files keep their own license notice next to them.

## Consequences

- Anyone may reuse the apps or the shared packages, including in closed-source work, provided
  the notice is kept.
- A third-party dependency must have a license compatible with MIT redistribution. A copyleft
  dependency (GPL, AGPL) is not accepted at runtime.

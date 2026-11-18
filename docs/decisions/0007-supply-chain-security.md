# 0007. Supply-chain and workflow security

Status: accepted, 2026-11-18

## Context

The apps run with no server and a strict Content Security Policy, so the most likely way to
harm their users is through the build: a compromised npm package or GitHub Action would be
bundled into every deployed app. The repository is public, so its workflows can also be
targeted through pull requests.

## Decision

- **Node.js 26** for development, CI and builds (`.nvmrc`, `engines`, `engine-strict`).
- **No install scripts**: `.npmrc` sets `ignore-scripts=true`. No current dependency needs
  one; Playwright's browser is installed by an explicit command.
- **Checks on every pull request**:
  - `npm audit signatures` verifies registry signatures and provenance attestations;
  - `npm audit --omit=dev` fails on any advisory in the code that ships to users;
  - dependency review rejects a new dependency that is vulnerable or has a license
    incompatible with MIT;
  - CodeQL (`security-extended`) analyzes the JavaScript and the workflows;
  - zizmor audits the workflows.
- **Actions pinned to a commit SHA**, with the version in a comment. Reusable workflows of this
  repository use the `$/` self-repository syntax.
- **Least privilege**: every workflow starts from `permissions: {}`, and each job asks only for
  what it needs. Checkouts do not keep credentials.
- **Dependabot** proposes npm and Actions updates every week, grouped, after a 14-day cooldown,
  so that a malicious release has time to be detected and withdrawn first.
- OpenSSF Scorecard tracks these practices over time.

## Consequences

- Development dependencies are audited by Dependabot alerts and dependency review, not by the
  `npm audit` gate. Advisories in build tools are frequent, rarely exploitable in a static
  build, and sometimes withdrawn (as `picomatch` GHSA-fc5q-39xc-vjpf was on 2026-11-18).
- A dependency that truly needs an install script must be allowed explicitly and justified.

---
name: testing
description: Test strategy for any development work. Decides which tests to write (type, level, depth, ritual, batching) from the application's tier, surface, external access, complexity and criticality, then enforces test hygiene and a quiet, token-cheap test run. Use whenever code is written, changed or fixed, whenever tests are written, run, debugged or reviewed, and for TDD, red-green-refactor, regression tests, coverage, flaky tests, mocks, test libraries or noisy test logs. Replaces the tdd skill. This copy carries the reference for the vanilla web apps of this repository.
---

# Testing

Goal: the fewest tokens and least time for the same or better confidence. Four levers: test at the highest level where the behavior is observable, go through public interfaces only, scale depth with risk, and let deterministic tools do the mechanical work.

This file holds the concepts and the procedure. Details live in `references/`: read only what the procedure sends you to.

## Fast path

A change that cannot alter behavior (docs, comments, formatting, a rename the compiler verifies) needs no new test: run the targeted existing tests and stop. Anything else goes through the procedure.

## Procedure

0. **Read the project rules first**: `TESTING.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, plus the project's *criticality map and test decisions* if it has one. Project rules win over this skill on conflict; do not copy them into it. If a project rule or an existing test convention looks wrong (a mismatched tag, a rule contradicting the code), follow it, flag it in the report, and do not correct it in the same change.
1. **Classify** each behavior to change by tier, surface, external access, complexity, criticality → [classification.md](references/classification.md). Unknown criticality: ask once, then record the answer in the project docs; until answered, a matching high candidate counts as high. A behavior the specification does not define is a decision to confirm, not a free choice.
2. **Choose the test types** and their level → [test-types.md](references/test-types.md).
3. **Choose the ritual and batching** from the depth table below. The full failing-test-first loop is described in [tdd.md](references/tdd.md).
4. **Write, run, keep it quiet and clean** → [hygiene.md](references/hygiene.md), [output-and-logs.md](references/output-and-logs.md). Use a tool before reasoning when one exists → [tooling.md](references/tooling.md), [libraries.md](references/libraries.md). Run each quality tool at its moment, and the end-of-work chain once the suite is green → [quality-tools.md](references/quality-tools.md).
5. **Report** the choices: classification, types, ritual, batching used, every white-box exception with its reason, tools proposed or declined, and what was deliberately not tested.

## Concepts

**Black box by default.** A test exercises a public interface (UI route, HTTP endpoint, CLI, message, public function of a context) and asserts what a caller can observe. White box is an exception, allowed only when the property is real and cannot be observed from outside: an internal invariant of a concurrency primitive, a performance bound, a state transition with no outward effect. State the reason in the report.

**Highest observable level.** A behavior is tested once, at the highest level where it is observable. Testing it again below is redundant; testing below is justified only when that level has its own contract.

**Depth follows risk.** Criticality is declared by the humans, not guessed from code. Complexity is read from the code.

| Criticality \ Complexity | Low | High |
|---|---|---|
| **High** (money, safety, security, data loss, irreversible external effect) | Failing test first at the boundary; regression test for every bug | Full loop; examples + properties; mutation check; contract tests at boundaries |
| **Medium** (business-visible, recoverable) | One acceptance test per behavior, written with the code | Acceptance + examples for the rules; failing test first on the rules; mutation check on the rules |
| **Low** (cosmetic, internal, dev-only) | One smoke test or none | One acceptance test; no per-function tests |

**Rituals.** *Full loop*: failing test first, one slice at a time. *Boundary-first*: the acceptance test defines "done", the implementation is free. *Test-with*: written alongside the code. *Smoke*: the thing boots and renders. A bug always starts with a failing reproduction, whatever the table says.

**Batching.** "One test at a time" is the default only for discovery work. Write several tests of a slice in one go when all hold: (a) the cases are enumerated by a human or a specification table, (b) they do not depend on discovering the design, (c) a failure stays localizable. Pure examples, tables, properties and contract operations qualify. The first test of a new module, exploratory acceptance and concurrency do not. Batching never skips seeing each test fail for the right reason.

**Doubles at boundaries only.** Own database: real. Time and randomness: injected. Third-party or external services: a contract-bound double (a mock derived from a declared interface), never a hand-written fake that invents behavior. Never mock your own modules.

**Tools before tokens.** If a deterministic tool or a bundled script produces the answer in a few lines (targeted run, failed-only rerun, flaky sample, mutation check, coverage of changed files, static analysis), run it instead of reasoning or reading. When a useful tool is missing, propose it once (see tooling.md); never add a dependency silently.

**Quiet runs.** A noisy suite costs tokens on every run. Logs are captured inside the tests that need them and shown only on failure; diagnostic logs go to files read only after a failure.

## References

| Need | Read |
|---|---|
| Classifying; declaring criticality | [classification.md](references/classification.md) |
| Picking test types, batching, doubles, white-box criteria | [test-types.md](references/test-types.md) |
| Failing-test-first loop, bug fixes, mutation check | [tdd.md](references/tdd.md) |
| Named good practices | [hygiene.md](references/hygiene.md) |
| Silent suite, `capture_log`, per-test log files | [output-and-logs.md](references/output-and-logs.md) |
| Automation, scripts, proposing a tool, recording the answer | [tooling.md](references/tooling.md) |
| Which test libraries | [libraries.md](references/libraries.md) |
| Which quality tool, what it adds, when to run it | [quality-tools.md](references/quality-tools.md) |
| Vanilla web apps of this repository (Vitest, Playwright, axe, IndexedDB) | [stacks/vanilla-web.md](references/stacks/vanilla-web.md) |
| Another stack | none yet: apply this core, tell the user no reference exists, offer to create one |

Read the stack reference before the first test. Read the others when the procedure step names them.

## Don'ts

- Write tests that mirror the implementation (mocking own modules, private functions, call counts, call order).
- Test the same behavior at two levels without a separate contract at the lower one.
- Treat a test as valid before seeing it fail for the right reason, or without the mutation check when it was green on first run.
- Guess criticality, or add a dependency, a tool or a project decision file without asking.
- Read every reference by reflex; run the full suite or the full quality chain inside the inner loop.
- Run tests behind a pipe (`| tail`, `| head`) without capturing the exit code.
- "Fix" a flaky test with a longer sleep, a retry, or one green run; blame flakiness on a known cause without a sample of runs on each side.
- Leave a noisy log in the suite output, or silence it by lowering the level globally without reading what it said.
- Skip or comment out a failing test to get green; skip a bug's regression test.
- Copy a project's `TESTING.md` rules into this skill; point to the file.
- Invent a missing stack reference or apply one stack's idioms to another: stop and flag it.

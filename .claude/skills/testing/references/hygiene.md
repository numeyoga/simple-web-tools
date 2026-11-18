# Test hygiene

Named practices. Each one is checkable; none is a matter of taste.

## Design

- **Behavior, not mechanism.** The name says what the system guarantees ("rejects an order above the limit"), not how ("calls validate/1").
- **One logical fact per test.** A fact is a behavior, not an assertion: check every observable consequence of one state and action in one test.
- **One state, one action.** Two tests with the same starting state and action, differing only in the assertion, are one test.
- **Arrange, act, assert**, visibly separated; no logic (conditionals, loops, computed expected values that repeat the implementation).
- **Expected values are literals** a reader can verify, not recomputed with the code under test.
- **The test reads as a specification.** A reader reconstructs the rule without opening the production code.

## Web front-end selectors

- **Add `data-testid` while writing the test.** A web UI test selects by role, label or visible text first; when the element has none of these that is stable (a repeated row, an icon button, a counter, a result option), add a `data-testid="..."` to the markup *in the same change*, as part of the failing test. A test that fails because the attribute is missing fails for the right reason; the attribute is the test's contract with the template, not an afterthought.
- Name it for the thing, not the place: `payee-row-42`, `palette-count`, never `div-2` or a CSS-derived name. Keep it stable across restyling and copy changes. Compose with the entity id for repeated elements.
- Never select by CSS class, DOM depth or index, and never assert on translated copy when a `data-testid` exists. A project rule on the attribute name or on `id` vs `data-testid` wins over this default.

## Isolation and determinism

- **Independent**: any test passes alone and in any order.
- **No shared mutable state** between tests: no global named processes, shared tables, shared topics or rows. Give each test unique identifiers rather than serializing the suite.
- **Controlled inputs**: inject the clock, randomness and identifiers; never read the real ones.
- **No waiting by time.** Wait on a message, an event, a process exit, a barrier you control. A sleep is a defect.
- **Seeds are reported**, so a random order failure replays.
- **No network in unit-level tests.**

## Data

- **Minimal**: only what the behavior needs. Builders (small functions, validating constructors) over large fixture files.
- **Exact types**: decimals or integers in the smallest unit for money and quantities; tolerance only for genuinely floating-point scientific results.
- **No production data, no real secrets** in fixtures, logs or recorded cassettes. Credentials come from the environment.
- **Cleanup by construction**: per-test transaction or sandbox, per-test temporary directory, processes that die with the test. Do not clean up resources the test does not own.

## Doubles

- Boundaries only; derived from a declared contract; one interface per operation (see test-types.md).
- Do not mock a type you do not own: wrap it behind your own interface, then double that.

## Speed

- Run in parallel by default; serialize only a file that demonstrably contends for a shared resource, and prove it with an A/B sample.
- Slow tests are tagged and excluded from the inner loop, and **included in CI**: a tag that silently removes coverage is a defect.
- The inner loop runs the targeted test; the full suite runs once before delivery.

## Failure quality

- A failure message identifies the broken behavior without a debugger. Prefer structural matching on the result over comparing opaque blobs.
- Never `assert true`, never assert on a value the test itself just built.
- A failing test is investigated, not retried.

## Maintenance

- Delete a test when its behavior is gone; do not comment it out or skip it without a reason and an owner.
- Coverage is an indicator of untested branches, not a target.
- Test code is code: formatted, linted, reviewed, and free of duplication that hides intent.
- Intermittent failure is a defect to explain: reproduce, fix the cause, prove with a sample of at least 20 runs on each side.

## Process

- Run the suite without masking the exit code; confirm green before refactoring and before delivering.
- Every bug gets a regression test at the level where it was observed.
- Record test decisions (a dependency accepted or declined, a deliberate `async: false`, an exclusion tag) in the project docs so they are not re-litigated.

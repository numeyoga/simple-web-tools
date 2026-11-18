# Test types

Pick the **lowest-cost type that proves the behavior through a public surface**. Cost = tokens to write and read + run time + fragility.

## Catalog

| Type | Proves | Level / boundary | Batch | Cost |
|---|---|---|---|---|
| **Examples** (table-driven) | A rule on named cases, edge cases | Pure function, public API | Yes | Low |
| **Property** | A universal invariant (idempotence, bounds, symmetry, monotonicity, round-trip) | Pure function | Yes, one property per invariant | Low |
| **Context integration** | A use case end to end through the logic tier with the real database | Public context function | First test alone, then batch enumerated cases | Medium |
| **Process / state machine** | Reaction to a sequence of events, lifecycle | Public API + messages | Alone for a new machine; batch an enumerated transition table | Medium |
| **Acceptance** (UI driver) | A user story as the user sees it | Route, form, event | One per story; tracer first | Medium |
| **Browser end to end** | What the driver cannot see (real browser semantics, JS hooks) | Real browser | No | High |
| **Contract** | A boundary behaves the same real and simulated | One suite run against both | Yes, one case per operation | Medium |
| **Boundary-consumer** | Upper layers handle the boundary's failures (timeout, rejection, malformed reply) | Contract-bound double | Yes | Low |
| **Regression** | A bug stays fixed | Level where it was observed | No | Low |
| **Characterization** | Current behavior of untested code, before changing it | Public API | Yes | Low |
| **Smoke** | The thing boots, the route renders | Whole app | n/a | Low |
| **Snapshot / golden** | A rendered or serialized output stays the same | Output | Yes | Low, brittle |

Not tests: benchmarks (measure time/memory, report; see tooling.md), static analysis, dependency audit.

## Choosing by tier

- **Presentation**: acceptance per story. Component-level tests only for components with real conditional logic. Browser end to end for the few critical journeys and for anything the driver cannot observe.
- **Logic**: examples + properties for pure rules; context integration for use cases; process tests for lifecycles. This is where the full loop and the mutation check pay off.
- **Data / integration**: contract tests for external boundaries; a context-level test per business integrity rule (uniqueness, foreign keys that carry meaning); a test per non-trivial query on realistic data. No test per changeset validation or per `Repo` call.

## Batching, precisely

Allowed when (a) the cases are enumerated by a human or a specification table, (b) they do not depend on discovering the design, (c) a failure stays localizable. Then:

1. Write the first test alone and watch it fail for the right reason (tracer).
2. Write the rest of the slice as one batch.
3. Create the stub first (the function exists and returns a neutral value or raises "not implemented"), then run the batch: each failing test must fail on its **assertion**, not on a missing function.
4. Implement until all are green.
5. Tests that were **green against the stub** (typically the `nil`/empty cases) have never been seen red: they are validated only by the mutation check. Run it on the branches they cover (`tdd.md`, « Mutation check »).

Not allowed: first test of a new module, exploratory acceptance, concurrency, any case where the previous test would change the next.

## Test doubles

- **Real by default**: own database, own processes, own modules.
- **Inject** time, randomness, identifiers, and external clients as arguments or configuration. A module that builds its own client cannot be tested without hitting it.
- **Contract-bound doubles**: derive the double from a declared interface so that a change to the real component breaks the test. A hand-written fake that accepts anything stays green while the real component has changed.
- **One interface per operation** at a boundary, not one generic `call(endpoint, opts)` that forces conditionals into the double.
- **Never mock** your own modules, internal collaborators, or what you control.
- A double that **invents** a behavior of the real service is a defect: the behavior must be measured against the real service first (contract test), then simulated.

## White-box exceptions

Allowed when all hold: the property is real (the project guarantees it), it cannot be observed from outside, and no public change would expose it cheaply. Typical: an invariant of a concurrency primitive, an ordering guarantee with no outward effect, a performance bound. Keep the test narrow, name the guarantee, and put the reason in the report. Reading internal state only to *synchronize* (wait for a message to be handled) is not white-box testing.

## Anti-patterns

| Smell | Why it hurts |
|---|---|
| Asserts a mock was called with arguments | Pins the implementation; breaks on refactor without a behavior change |
| Reads the database to verify a use case | Back channel; hides a missing public read |
| Two tests, same state and same action, different assertion | Redundant; merge them |
| A test needing the whole system to check one rule | Slow and hard to diagnose; push the rule down to a pure function |
| Always-green test | Verifies nothing; run the mutation check |
| Test named after the mechanism or the ticket | Does not read as a specification |

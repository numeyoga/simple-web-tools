# Failing-test-first loop (the essence of TDD)

Applies where the depth table in `SKILL.md` prescribes the *full loop*, and to every bug. Language idioms live in `stacks/`.

## Model

Run the loop on the latest Sonnet model (currently Sonnet 5.5, `claude-sonnet-5-5`; prefer a newer Sonnet if the environment lists one). The loop is many short, well-specified iterations, which suits it. The saving in tokens is a **hypothesis** (not yet measured); quality is protected by the loop's own guards: seeing each test fail for the right reason, the mutation check, the project's quality tools. If you are on a larger model, delegate the loop to a subagent with `model: "sonnet"` only when the user's environment allows spawning agents.

## The principle

A test verifies behavior through a public interface, not an implementation detail. Code can change entirely; the test should not.

## Vertical slices, not horizontal

Writing all tests first and all code after produces tests of *imagined* behavior and of *shape*; they pass when behavior breaks. Do one slice at a time:

```
RED → GREEN: test1 → impl1
RED → GREEN: test2 → impl2
```

Exception: a batch under the batching rule in `test-types.md`, where the cases are already enumerated.

## The loop

1. **Frame.** List the *behaviors* (not implementation steps), prioritized; shape the interface so it is testable (accept dependencies, return results, small surface). You cannot test everything: aim at critical paths and complex logic.
2. **Tracer bullet.** One test, one behavior, RED then GREEN, proving the path end to end.
   - **The first RED must fail for the right reason.** A missing module or function gives a compile or import error that proves nothing. Create a *stub* that exists but returns a neutral value or raises "not implemented", so the failure is an assertion on the behavior. The stub is scaffolding and contains no logic.
3. **Increment.** Next behavior: RED, then the minimum GREEN. Only the code the current test needs.
4. **Refactor** only when green: duplication, shallow modules, feature envy, primitive obsession. Rerun after each step. **Never refactor while RED.**

## Mutation check

A test that passes the moment it is written (a property, an "already in bounds" case) has not been seen red. Validate it: deliberately break the implementation (invert a comparison, return the input), confirm the test fails, restore, confirm the working tree holds only the intended change. If it stays green, it verifies nothing: fix or delete it.

For a **new function**, the validity proof of the whole batch comes from here, not from the first RED: several tests fail for the same reason (undefined function or a stub's neutral value) and the cases that pass against the stub were never red. Mutate each branch the batch claims to cover (each guard clause, each operator, each constant).

Automate it: `scripts/mutation-check.sh` applies one hand-picked mutation to one named test and prints one verdict line; for a whole module use Muex through `scripts/muex-survivors.sh` (both in tooling.md).

## Fixing a bug

A bug fix is a slice whose RED is the bug.

1. **Reproduce through the public interface.** The test must fail with the *symptom* (wrong value, wrong error), not an unrelated error. If it cannot be reproduced in a test, say so; do not fix blind.
2. **Find the cause** at the lowest level that explains it. Keep the regression test at the level where the bug was observed; add a narrower one only if that level has its own contract.
3. **Minimal fix → GREEN**; run the neighbors.
4. **Prove the test guards the fix**: revert or mutate the fix, watch the test go red, restore.
5. **Stay in scope.** Report adjacent problems; do not fix them in the same change.

Name the regression test after the behavior now guaranteed ("rejects a negative quantity"), not after the ticket.

## Per-cycle checklist

```
[ ] The test failed first, for the right reason
[ ] It describes behavior, through the public interface
[ ] It would survive an internal refactor
[ ] The code is minimal for this test; nothing speculative
[ ] No existing test already covers the same state (otherwise enrich that one)
```

## Don'ts

- Mistake a compile or import error for a valid RED.
- Anticipate the next tests while implementing the current one.
- Refactor while the suite is red.
- Fix a bug without a test that failed on the bug first.

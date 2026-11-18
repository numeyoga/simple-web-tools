# Classifying a change

Classify **per behavior**, not per project: one feature often mixes a high-criticality rule and a low-criticality screen. Output a small table before writing tests:

```
behavior                          tier          surface            external   complexity  criticality
reject an order above the limit   logic         context function   db         high        high
list pending tasks                presentation  LiveView route     db         low         low
```

## The five dimensions

### 1. Tier (where the behavior lives)

| Tier | What it is | Typical Elixir/Phoenix form |
|---|---|---|
| Presentation | What a user or caller touches | LiveView, controller, component, TUI screen, CLI command |
| Business logic | Rules, calculations, state machines, orchestration | Context modules, pure modules, GenServers |
| Data / integration | Persistence and everything outside the process | Ecto schemas and queries, HTTP clients, broker adapters, file system |

A behavior belongs to the **highest** tier where it is observable. A validation rule shown in a form but defined in the logic tier is a logic behavior, with at most one presentation test proving the message is displayed.

### 2. Surface (what callers can touch)

List the public interfaces of the change: routes, endpoints, CLI arguments and exit codes, messages and topics, public functions of context modules. Black-box tests use **only** these. If a behavior has no public surface, it is either dead code or a missing interface: say so rather than testing a private function.

### 3. External access

| Access | Policy |
|---|---|
| Own database | Real database in the test environment, isolated per test |
| Own processes (GenServer, PubSub) | Real, started under the test supervisor |
| Third-party or external service | Contract test against the real service when possible; contract-bound double for the layers above |
| File system | Temporary directory per test |
| Clock, randomness, environment | Inject at the boundary; never read the real value in a test |
| Network, OS processes | Only in dedicated integration or end-to-end tests |

### 4. Complexity

Read it from the code and the request. High when any holds: branching rules with many cases, a state machine or lifecycle, concurrency or ordering guarantees, an algorithm with invariants, or exact numeric or temporal arithmetic **that also carries several rules or edge cases** (rounding modes, units, ranges, order of operations). Low: pass-through CRUD, formatting, wiring, and a single-expression conversion. A one-line formula on exact types is low complexity; its *criticality* may still be high, and that drives the depth.

### 5. Criticality

**Declared by humans.** Resolution order:

1. The project's criticality map (see below).
2. The user's statement in the request.
3. Ask once, with the candidate high-criticality list below, then record the answer.

Candidates for **high**: moves or computes money, authentication or authorization, deletes or corrupts data, has an irreversible external side effect (an order, an email, a payment), enforces a legal or safety limit, is the persistence-before-emission kind of ordering guarantee.
**Medium**: user-visible business behavior that can be corrected afterwards. **Low**: cosmetic, internal tooling, developer-only screens.

While unanswered, the default depends on the candidates: if **any high candidate matches**, treat the behavior as **high** until a human lowers it (an unrecorded money, security or data-loss path must not get the thin depth by omission); otherwise treat as **medium**. Either way, list the matching candidates and the assumption in the report.

## When the specification is silent

A behavior with no stated expected outcome (an out-of-domain input, a zero, an empty list: should it return `nil`, an error, or raise?) is a **product decision**, not an implementation detail. Name it in the report as « decision to confirm » with the choice made and the alternative. Pick the choice consistent with the neighboring behavior (an unknown input already returns `nil` ⇒ so does an undecidable one), keep it to one named test, and never invent a behavior silently.

## Application types and what they change

| Type | Surface | Heaviest test types | Watch out |
|---|---|---|---|
| Server-rendered web / LiveView | Routes, forms, events | Context integration, acceptance via the test driver, few browser tests | Behavior that depends on real browser semantics is invisible to the driver |
| HTTP API | Endpoints, status, payload | Request-level integration, contract tests | Versioned payloads: pin the contract |
| TUI | Key events, rendered screen | Model/update tests on state, render snapshots | Terminal differences, resize |
| CLI | Arguments, stdout, exit code | Run the entry point with arguments | Exit code and stderr are the contract |
| Library | Public functions | Examples + properties, doc tests | No hidden state |
| Worker / event processor | Messages in, effects out | Sequence tests, idempotency, failure and retry | Ordering, duplicates, time |

## Recording the answers in the project

Keep a short section in the project's test documentation (name it « Criticality map and test decisions », or follow the project's wording). Two tables:

```
| Area / module        | Criticality | Why                     | Date       |
|----------------------|-------------|-------------------------|------------|

| Decision                          | Choice   | Why                       | Date       |
|-----------------------------------|----------|---------------------------|------------|
| Mutation testing library          | declined | no maintained library     | 2026-10-10 |
```

Read it at step 0 of the procedure; do not re-ask what it already answers. Create it on first need with the user's agreement.

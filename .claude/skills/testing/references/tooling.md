# Tooling and automation

Rule: **a deterministic tool beats reasoning** whenever it answers in a few lines. Reading a 400-line test file to guess coverage costs more than one coverage command.

## Need → tool

| Need | Use | Effect |
|---|---|---|
| Run one test | `mix test file:line` | Smallest feedback loop |
| Re-run failures | `mix test --failed` | Skips the green part |
| Tests touching changed code | `mix test --stale` | Targeted suite |
| Stop early | `mix test --max-failures 1` | One failure to act on |
| Replay an order | `mix test --seed N` | Reproduces order-dependent failures |
| Sample a flaky test | `scripts/flaky-sample.sh <runs> <target>` | `runs=20 pass=17 fail=3` + failing seeds, a few lines |
| Mutation testing of a module | `scripts/muex-survivors.sh <files> <tests>` (Muex) | Score line + the surviving mutants, one per line |
| Mutation check of one test | `scripts/mutation-check.sh <file> '<sed>' <target>` | One verdict line: KILLED / SURVIVED / INVALID; file always restored |
| Failing test's logs | `scripts/test-log-extract.sh <dir> <pattern>` | One test's log, not the whole run |
| Quiet, per-test logs | `templates/test_log_files.ex` | See output-and-logs.md |
| Untested branches in changed files | Coverage tool (`mix coveralls`) | Find gaps; not a target |
| Pure-function invariants | Property library | Many cases for few tokens |
| Format, warnings, style, types, security, dependencies | Project's declared tools, once, at the end | See [quality-tools.md](quality-tools.md) |
| Time / memory of a computation | Benchmark library, in dev | A measurement, not a test |

The scripts assume `mix test` and the project's cwd; read their header for arguments. They are bash; `muex-survivors.sh` also uses `jq` or `python3`.

## Mutation testing

**Muex** (`muex`, MIT, Hex 0.11.3 published 2026-10-05) is the recommended library: 18 mutators, equivalent-mutant detection, `--since <ref>` to mutate only changed lines, JSON output. Declare it `{:muex, "~> 0.11", only: [:dev, :test], runtime: false}` after the proposal protocol below. Other Elixir options are not recommended (`muzak`: non-commercial license, last release 2022; `exavier`: last release 2020).

Run it through `scripts/muex-survivors.sh <files> <test-paths>`: one score line and the survivors as `file:line  description`. Each survivor is a behavior no test pins (a boundary, an accumulation, a swapped argument): add the missing test, or judge the mutant equivalent and say so. Validated on a throwaway project (2026-10-10): a 14-line module scored 82.1% with 10 survivors, 96.4% after three added tests.

Facts about running it (measured on the throwaway project, Muex 0.11.3):

- Run in `MIX_ENV=test`. The task takes **tens of seconds even for a tiny module**: always scope with `--files` and `--test-paths`, never run it on the whole project in the inner loop.
- The file filter (`--min-score`, default 20) skips small files and the optimizer (on by default) can discard **every** mutant of a small module, reporting "No mutations to test". For a scoped run use `--no-filter --no-optimize` (the script does).
- `--fail-at` defaults to 80, so a run with no mutant still exits non-zero; set it explicitly per criticality (for example 90 for high, 80 for medium).
- Pull-request scope: `--since main`. Large modules: `--optimize --optimize-level conservative`, `--coverage-guided`, `--max-mutations N`. Framework-heavy code: `--preset phoenix` (or `ecto`).
- Not yet verified: behavior on a suite that shares a single-file database across parallel mutants. On such a project, try `--concurrency 1` first and record the outcome in the project's test decisions.

Where to apply: modules of high criticality and the rules of medium criticality, once the suite is green; properties and tests that were green on first run. Not every module, not every cycle.

**Muex is not declared in the project?** Do not stop and do not add it silently: run `scripts/mutation-check.sh` for one mutation per guard clause, operator and constant of the changed code (3 to 6 runs, a few seconds each, no dependency), and propose Muex through the protocol below only when the module is large or the same question comes back (several modules, a pull-request scope). Say in the report which one was used.

`scripts/mutation-check.sh` stays for the **single hand-picked mutation** against one named test (a one-line verdict, no dependency); use Muex when you want the whole set for a module.

## The end-of-work chain

Run once, after the suite is green, with the tools the project **already declares** (`mix.exs`, lockfile). What each tool adds, its moment, and the rules around aliases and CI: [quality-tools.md](quality-tools.md).

## Proposing a tool or dependency

Never add one silently, and do not re-ask what the project already answered.

1. **Check the project's recorded decisions** (classification.md, last section). Accepted → use it. Declined → do not ask again unless the situation changed.
2. **Ask once**, in at most four lines: what it is, the concrete gain here (tokens, time, defects caught), the cost (dependency scope such as `only: :test`, license, maintenance state, setup effort), and the alternative if declined.
3. **Record the answer** in the project docs with the date and the reason, whatever it is.

Example:

> Proposing `stream_data` (`only: :test`). The three conversion functions have round-trip invariants: one property covers what ~15 example tests would, for less reading and writing. Cost: one test dependency, Apache-2.0, actively maintained. If declined, I keep examples only.

## Scripts and templates in this skill

| File | Purpose |
|---|---|
| `scripts/flaky-sample.sh` | Run a target N times, count passes and failures, list failing seeds |
| `scripts/muex-survivors.sh` | Run Muex on named files and tests; print the score and the surviving mutants |
| `scripts/mutation-check.sh` | Mutate one file with a sed expression, run one target, restore, print a verdict |
| `scripts/test-log-extract.sh` | Print one test's log from a directory or a delimited file |
| `templates/test_log_files.ex` | Per-test log files kept only on failure (async-safe) |

Improve a script when it misleads you in real use, and add the matching entry to the skill's Don'ts.

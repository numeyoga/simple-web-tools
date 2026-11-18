# Quality tools: what each one adds, and when to run it

Rule: **the right tool at the right moment.** A fast tool belongs in the inner loop; a slow one runs once, at the end of the work. Running a slow tool every cycle burns time for no extra signal; skipping it before a push lets CI find what you could have found.

Commands are Elixir's (the only documented stack). Each row names a **role** first, so another stack can map its own tool onto it. Versions come from the project's lockfile, never from this file. Use only what the project **already declares**; adding a tool follows the proposal protocol in [tooling.md](tooling.md).

## By moment

### Inner loop: every red-green cycle

| Role | Elixir | Adds | Cost |
|---|---|---|---|
| One test | `mix test path:line` | The smallest feedback loop | Seconds |
| Failures only | `mix test --failed` | Skips the green part | Seconds |
| Tests touching changed code | `mix test --stale` | A targeted suite without choosing files by hand | Seconds |
| Stop at the first failure | `mix test --max-failures 1` | One failure to act on, not fifty | Seconds |
| Replay an order | `mix test --seed N` | Reproduces an order-dependent failure | Seconds |

Nothing else here: no linter, no type checker, no full suite.

### Before each commit

| Role | Elixir | Adds | Cost |
|---|---|---|---|
| Formatting | `mix format` (then `--check-formatted` in CI) | No style diff in review, no CI failure on whitespace | Seconds |
| Compiler as a checker | `mix compile --warnings-as-errors` | Unused variables, unreachable clauses, type warnings of the compiler | Seconds to a minute |
| Full suite | `mix test` | Regressions outside the slice you worked on | The suite's duration |
| Project's fast alias | often `mix precommit` | The project's chosen subset, in one command | Same as its parts |

### Before a push or a pull request: once, after the suite is green

| Role | Elixir | Adds | Cost |
|---|---|---|---|
| Style and smell linter | `mix credo --strict` | Weak assertions (`assert is_binary(x)`), nesting, complexity, readability rules the compiler ignores; with the project's extra check packs, hollow tests and silently swallowed errors | Seconds |
| Type checker | `mix dialyzer` (dialyxir) | Contradictions with specs, impossible patterns, dropped return values (`unmatched_return`), dead branches. Analyses `lib/` **and** compiled test support (`test/support/*.ex`), not `*_test.exs` | Minutes the first time (PLT build), then tens of seconds |
| Web security scan | `mix sobelow --config` (Phoenix) | XSS, SQL injection, unsafe redirects, missing CSRF or headers | Seconds |
| Dependency vulnerabilities | `mix deps.audit` (mix_audit) **and** `mix hex.audit` | Known CVEs, retired packages. Run **both**: one can miss what the other reports | Seconds |
| Unused lock entries | `mix deps.unlock --check-unused` | A lockfile that lies about what the project uses | Seconds |
| Documentation coverage | `mix doctor` | Public functions without `@doc` or `@spec` | Seconds |
| Compile-time coupling | `mix xref graph --label compile-connected --fail-above N` | A new dependency that makes one change recompile many files | Seconds |
| Coverage of changed code | `mix coveralls` (excoveralls) | Branches no test enters. A finding, never a target | The suite's duration |
| Secrets | the project's secret scan (gitleaks or similar) | A token or key about to be pushed | Seconds |

### Targeted: chosen by criticality, not run everywhere

| Role | Elixir | Adds | When |
|---|---|---|---|
| Mutation testing of a module | Muex through `scripts/muex-survivors.sh` | Behaviors no test pins: boundaries, swapped arguments, accumulations | High criticality, or the rules of medium criticality, once green. Details: [tooling.md](tooling.md) |
| One hand-picked mutation | `scripts/mutation-check.sh` | Proof that one named test fails for the right reason | A test green on first run |
| Property tests | `stream_data` | Many inputs for invariants (round trips, monotonicity, conservation) | Pure functions with invariants |
| Flakiness sample | `scripts/flaky-sample.sh` | A pass/fail count over N runs, failing seeds | Any intermittent failure, before and after a fix (20 runs a side) |

### On demand

| Role | Elixir | Adds | When |
|---|---|---|---|
| Benchmark | `benchee` (dev only) | Time, memory, reductions of a computation | A computation that may be slow or grow with its input. A measurement, not a test |

### Periodically, outside a change

| Role | Elixir | Adds |
|---|---|---|
| Outdated dependencies | `mix hex.outdated` | Drift before it becomes a large upgrade |
| Type-checker cache | rebuild the PLT after a dependency or Erlang/Elixir upgrade | A stale PLT gives false errors, or misses real ones |

## Rules that hold for every moment

- **An alias is not the CI.** Read the definition of `precommit` / `quality` / `ci` and compare it with the CI workflow: a local alias often runs less. A tool the CI runs and the alias does not will turn a pull request red with a green local run. When you find the gap, propose adding the tool to the alias.
- **Several projects in one repository:** run the chain in **each** project the change touched; each usually has its own CI job.
- **A chained alias stops at the first failure.** When the type checker is last, a linter remark hides it. Check that its summary line is in the output (dialyzer prints `Total errors: N`): absent means it did not run, not that it passed.
- **Capture the exit code.** Never judge a run through `| tail` or `| head` alone: the pipe returns the last command's status.
- **Read the finding, then fix the cause.** Do not silence a linter or type warning with an ignore file or a lowered level without saying why in the report.

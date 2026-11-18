# Recommended test libraries

Goal: uniform choices across projects. **One library per role.** Prefer what the project already declares; adding one follows the proposal protocol in tooling.md.

Hex facts below were read from hex.pm on **2026-10-10** (latest stable version, last update). Re-check before relying on a version.

## Elixir

| Role | Recommended | Hex | Notes |
|---|---|---|---|
| Runner, assertions, capture | ExUnit | built in | `start_supervised!`, `capture_log`, `assert_receive` |
| Property tests | `stream_data` | 1.4.0, 2026-07 | Pure-function invariants; `property`/`check all` |
| Mocks of behaviours | `mox` | 1.3.2, 2026-09 | Only for a declared `@behaviour`; explicit expectations; `verify_on_exit!` |
| Mocks + typespec checking | `hammox` | 1.0.0, 2026-07 | Optional layer on Mox: checks calls and returns against `@spec` |
| LiveView / controller acceptance | `phoenix_test` | 0.12.1, 2026-08 | One API over `conn` and LiveView; asserts through the UI |
| LiveView driver (built in) | `Phoenix.LiveViewTest` + `lazy_html` | `lazy_html` 0.1.13, 2026-09 | Lower level; needed for what the unified API does not expose |
| Real-browser end to end | `phoenix_test_playwright` | 0.18.0, 2026-09 | Few tests; heavy runtime (browser, often a container) |
| Real services in tests | `testcontainers` | 2.4.0, 2026-07 | A real database or broker instead of a mock |
| HTTP boundary stubs | `Req.Test` (part of `req`) | — | When the HTTP client is Req; no extra dependency |
| HTTP stub server (other clients) | `bypass` | 2.1.0, 2020-11 | Unmaintained (last release 2.1.0, 2020-11) though widely used; prefer `Req.Test` when possible |
| Data builders | plain `build_*` functions | — | Use the validating constructor (`new!/1`) when one exists |
| Data factories | `ex_machina` | 2.8.2, 2026-08 | Optional, when many Ecto schemas make hand-written builders repetitive |
| Coverage | `excoveralls` | 0.18.5, 2025-01 | Find untested branches in changed files; not a target |
| Snapshot tests | `mneme` | 0.10.2, 2025-01 | Optional; only for stable rendered output |
| Mutation testing | `muex` | 0.11.3, 2026-10 | MIT; scoped runs via `scripts/muex-survivors.sh`; see tooling.md. Not recommended: `muzak` (2022, CC-BY-NC-ND-4.0), `exavier` (2020) |

Quality tools (`credo`, `dialyxir`, `sobelow`, `mix_audit` and `mix hex.audit`, `doctor`, `excoveralls`, `benchee`): what each adds and when to run it, in [quality-tools.md](quality-tools.md).

### Use with caution

| Library | Why |
|---|---|
| `mimic` 2.4.2 | Replaces functions of any module globally; contradicts "mock only declared behaviours". Acceptable only for a third-party module that cannot be wrapped behind a behaviour |
| `meck`-based `mock` | Global replacement that forces serial tests; same objection |

### TUI

| Library | When | Hex | Testing reference |
|---|---|---|---|
| `ex_ratatui` | Linux and Windows both required | 0.17.0, 2026-10, MIT | [tui-ex-ratatui.md](stacks/tui-ex-ratatui.md) |
| `term_ui` | Linux only | 2.0.0-rc.2 (pre-release) 2026-10, MIT; latest stable 1.0.0 with a different API | [tui-term-ui.md](stacks/tui-term-ui.md) |

Selection facts and caveats: [stacks/tui.md](stacks/tui.md).

## Other stacks

No reference yet. Apply the same roles (runner, property tests, behaviour doubles, UI driver, real services, coverage, mutation) and propose the idiomatic library of the stack through the proposal protocol.

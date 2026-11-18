# Quiet runs and logs

Every line the suite prints is read on every run. The target: a green run prints a summary; a red run prints the failure and a pointer to its logs.

## Principles

- **Fix noise at the source** before hiding it: a warning that fires on every run is a defect (deprecated call, unused variable, supervisor restart, missing config).
- **A log a test expects is part of its behavior**: capture it inside that test and assert on it.
- **A log nobody asserts on** is shown only when its test fails.
- **Never lower the level globally to "make it quiet"** without reading what it was saying.

## Two modes

### Mode A (default): the test framework's capture

```elixir
# test_helper.exs
ExUnit.start(capture_log: true)            # keep and print on failure, all levels
# ExUnit.start(capture_log: [level: :warning])   # keep only warning and above
```

- Logs of a passing test are discarded; logs of a failing test are printed with the failure.
- Override per test or module with `@tag capture_log: false`.
- Not captured: logs from `setup_all`, between tests, and from `on_exit`. Silence those at the source or with a local capture.
- Keep the application's test log level at `:warning` in the test config unless debug logs are needed.

Cost: every failing test prints its log in the run output. Fine for a few failures; heavy when many tests fail at once.

### Mode B: one log file per test, kept only on failure

Use when logs are voluminous, many processes log, or an async suite fails several tests at once. The failure output stays short and the agent reads one file.

Template: [`../templates/test_log_files.ex`](../templates/test_log_files.ex). Copy it into the project's test support (compiled only in `:test`), then:

```elixir
# test_helper.exs — before ExUnit.start/1; leave ExUnit's capture_log OFF
TestLogFiles.install()
ExUnit.start(formatters: [ExUnit.CLIFormatter, TestLogFiles.Formatter])

# the project's case template
setup context do
  TestLogFiles.attach(context)
  :ok
end
```

Behavior (validated in a throwaway project, 2026-10-10, Elixir 1.20; not yet in a large suite):

- Works with `async: true`: a record is attributed to its test through the logging process's `$callers` and `$ancestors`, so children of `start_supervised!/1` and `Task`s land in the right file.
- A passing test leaves no file. A failing test leaves `_build/test/logs/<Module>__<test>.log`; the formatter prints the list at the end of the run.
- Records that cannot be attributed (a process unrelated to the test) are dropped from the files.
- The console handler is raised to `:error` (option `:console_level`, use `:none` to silence errors too), so a test that deliberately logs an error should capture it locally.
- Debug calls purged at compile time (`compile_time_purge_matching`) never reach the files.

File layout (separator template, searchable by the `test:` line):

```
=== TEST START ===
module: Orders.PlaceTest
test: test rejects an order above the limit
seed: 901627
at: 2026-10-10T16:50:35.944034Z
tags: %{async: true}
===
info worker alpha working
warning limit check failed
=== TEST END result=failed ===
```

### Reading protocol (mode B)

1. Read the failure first; open a log only if the failure does not explain itself.
2. Read the one file of the failing test: path printed at the end of the run, or `scripts/test-log-extract.sh <dir> "<part of the test name>"`.
3. Never `cat` the whole directory.

## Expected logs inside a test

```elixir
log = ExUnit.CaptureLog.capture_log(fn -> Orders.place(order_with_unknown_sku) end)
assert log =~ "unknown sku #{sku}"
```

The capture is global to the node: under `async: true` it may also receive records from other tests. Assert on a marker unique to the test (an identifier in the message) and never assert that *nothing else* was logged.

## Application and compile noise

- Warnings at compile time or application start belong to the build, not to a test: fix them; CI runs `mix compile --warnings-as-errors`.
- Start-up logs of supervised trees in the test environment: configure the test config (quiet children, no periodic jobs) rather than capturing in every test.

## Keeping the command's own output small

- `mix test --max-failures 1` in the inner loop; one failure is usually enough to act.
- To inspect a long run, redirect to a file and read the tail, **and capture the exit code** (`mix test > out.txt 2>&1; echo $?`). A pipe into `tail` or `head` masks the failure.
- Prefer a targeted target (`file:line`) over `-v` or `--trace` output.

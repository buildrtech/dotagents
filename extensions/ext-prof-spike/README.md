# ext-prof-spike

Extension profiler prototype with production-v1 behavior:

- opt-in profiling (`/ext-prof on`)
- extension attribution for events, commands, and tools
- verbose summary output
- manual JSONL snapshot save

## Commands

- `/ext-prof on`
- `/ext-prof`
- `/ext-prof status`
- `/ext-prof save [path]`
- `/ext-prof off`
- `/ext-prof reset`

## Coverage

The profiler wraps and attributes:

- event handlers
- command handlers
- tool execute handlers

`/ext-prof status` reports explicit surface coverage:

- `events: instrumented|missing`
- `commands: instrumented|missing`
- `tools: instrumented|missing`

## Snapshot format

`/ext-prof save` writes JSONL records:

- `session_meta` (includes `schemaVersion: 1`)
- `aggregate` rows (extension + surface + handler metrics)

Default save path:

```text
~/.pi/profiles/<project>/<timestamp>.jsonl
```

## Manual runbook

Load profiler first, then fixture extensions:

```bash
pi \
  -e ./extensions/ext-prof-spike/index.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-a.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-b.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-command.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-tool.ts
```

Then in session:

1. `/ext-prof on`
2. `hello`
3. `/slow-cmd`
4. Trigger `slow-tool` via prompt/tool call
5. `/ext-prof`
6. `/ext-prof save`
7. `/ext-prof status`

## Expected report shape

```text
patch: patched
overhead goal<=1% observed=unknown
./extensions/ext-prof-spike/fixtures/slow-a.ts total=150.0ms calls=1 avg=150.0ms max=150.0ms errors=0
  event:turn_start total=150.0ms calls=1 max=150.0ms errors=0
./extensions/ext-prof-spike/fixtures/slow-b.ts total=40.0ms calls=1 avg=40.0ms max=40.0ms errors=0
  event:turn_start total=40.0ms calls=1 max=40.0ms errors=0
./extensions/ext-prof-spike/fixtures/slow-command.ts total=80.0ms calls=1 avg=80.0ms max=80.0ms errors=0
  command:slow-cmd total=80.0ms calls=1 max=80.0ms errors=0
./extensions/ext-prof-spike/fixtures/slow-tool.ts total=60.0ms calls=1 avg=60.0ms max=60.0ms errors=0
  tool:slow-tool total=60.0ms calls=1 max=60.0ms errors=0
```

## Verification notes

- Automated: `cd extensions/ext-prof-spike && npm test` passes.
- Runtime patch resolution keeps fallback discovery logic for `dist/core/extensions/runner.js`.
- Manual CLI check (non-interactive stdin run) produced:

  ```text
  enabled: on
  patch: patched
  events: instrumented
  commands: instrumented
  tools: instrumented
  ```

- Save-path behavior is covered by `commands.test.ts` and matches `~/.pi/profiles/<project>/<timestamp>.jsonl`.
- Overhead warning text behavior is covered by `formatter.test.ts` (`OVERHEAD WARNING` when observed > goal).
- Overhead policy is warning-only for v1 goal breaches.

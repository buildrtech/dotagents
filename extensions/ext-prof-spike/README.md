# ext-prof-spike

Minimal spike to prove extension-level runtime attribution without modifying existing extensions.

## Scope

- Patches Pi internal `ExtensionRunner` once
- Wraps extension event handlers with timing probes
- Aggregates totals by extension path only
- Exposes `/ext-prof`

Out of scope in this spike:
- per-event breakdown
- persistence
- turn share / percentiles
- tool/command attribution

## Manual runbook

Load profiler first, then fixture extensions:

```bash
pi \
  -e ./extensions/ext-prof-spike/index.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-a.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-b.ts
```

Then:

1. Send one prompt (for example: `hello`)
2. Run `/ext-prof`
3. Confirm `slow-a.ts` shows higher `total=...ms` than `slow-b.ts`

Expected shape:

```text
./extensions/ext-prof-spike/fixtures/slow-a.ts  total=150.xms  calls=1
./extensions/ext-prof-spike/fixtures/slow-b.ts  total=40.xms   calls=1
patch: patched
```

## Verification notes

- Automated: `cd extensions/ext-prof-spike && npm test` passes.
- Runtime patching path resolution was hardened to resolve from `@mariozechner/pi-coding-agent` package entry, then import `dist/core/extensions/runner.js` via file URL.
- Known limitation: this spike wraps event handlers only and keeps metrics in-memory for the current process.

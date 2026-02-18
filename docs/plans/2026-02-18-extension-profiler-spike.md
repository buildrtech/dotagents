# Extension Profiler Spike Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans skill to implement this plan task-by-task.

**Goal:** Prove we can attribute extension runtime cost (extension path -> total milliseconds) without changing existing extensions.

**Architecture:** Build a standalone spike extension that monkey-patches Pi’s internal `ExtensionRunner` once, wraps existing extension event handlers with timing probes, and records in-memory totals keyed by extension path. Keep scope intentionally minimal: event handlers only, one `/ext-prof` command, no persistence, no UI widgets, no per-event breakdown.

**Tech Stack:** TypeScript, Pi extension API, dynamic internal import (`dist/core/extensions/runner.js`), node:test via tsx

---

### Task 1: Scaffold the spike package and write RED tests for aggregation

**Files:**
- Create: `extensions/ext-prof-spike/package.json`
- Create: `extensions/ext-prof-spike/lib.ts`
- Create: `extensions/ext-prof-spike/lib.test.ts`

**Step 1: Create package scaffold**

```json
{
  "name": "ext-prof-spike",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "tsx --test lib.test.ts"
  },
  "devDependencies": {
    "tsx": "^4.20.0"
  }
}
```

**Step 2: Write failing tests for extension total-ms aggregation**

```ts
test("summarizeByExtension aggregates ms by extension path", () => {
  const state = createProfilerState();
  recordSample(state, { extensionPath: "a.ts", eventType: "turn_start", ms: 10, ok: true });
  recordSample(state, { extensionPath: "a.ts", eventType: "turn_end", ms: 15, ok: true });
  recordSample(state, { extensionPath: "b.ts", eventType: "turn_start", ms: 5, ok: true });

  assert.deepEqual(summarizeByExtension(state), [
    { extensionPath: "a.ts", totalMs: 25, calls: 2 },
    { extensionPath: "b.ts", totalMs: 5, calls: 1 },
  ]);
});
```

**Step 3: Run test to verify it fails**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: FAIL with missing exports/functions (`createProfilerState` / `recordSample` / `summarizeByExtension`).

**Step 4: Commit RED test scaffold**

```bash
git add extensions/ext-prof-spike/package.json extensions/ext-prof-spike/lib.test.ts
git commit -m "test(ext-prof-spike): add red aggregation tests"
```

---

### Task 2: Implement minimal aggregation core and verify GREEN

**Files:**
- Modify: `extensions/ext-prof-spike/lib.ts`
- Modify: `extensions/ext-prof-spike/lib.test.ts` (only if test fixture tuning is needed)

**Step 1: Implement minimal in-memory profiler state and record function**

```ts
export type Sample = {
  extensionPath: string;
  eventType: string;
  ms: number;
  ok: boolean;
};

export type ProfilerState = {
  samples: Sample[];
};

export function createProfilerState(): ProfilerState {
  return { samples: [] };
}

export function recordSample(state: ProfilerState, sample: Sample): void {
  state.samples.push(sample);
}
```

**Step 2: Implement total-ms summarizer (sorted descending)**

```ts
export function summarizeByExtension(state: ProfilerState) {
  const bucket = new Map<string, { totalMs: number; calls: number }>();
  for (const s of state.samples) {
    const row = bucket.get(s.extensionPath) ?? { totalMs: 0, calls: 0 };
    row.totalMs += s.ms;
    row.calls += 1;
    bucket.set(s.extensionPath, row);
  }

  return [...bucket.entries()]
    .map(([extensionPath, row]) => ({ extensionPath, totalMs: row.totalMs, calls: row.calls }))
    .sort((a, b) => b.totalMs - a.totalMs);
}
```

**Step 3: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: PASS.

**Step 4: Commit aggregation implementation**

```bash
git add extensions/ext-prof-spike/lib.ts extensions/ext-prof-spike/lib.test.ts
git commit -m "feat(ext-prof-spike): implement extension total-ms aggregation"
```

---

### Task 3: Add RED tests for wrapper behavior (timing + idempotence)

**Files:**
- Modify: `extensions/ext-prof-spike/lib.ts`
- Modify: `extensions/ext-prof-spike/lib.test.ts`

**Step 1: Write failing tests for handler wrapping**

```ts
test("wrapHandler records duration and success", async () => {
  const state = createProfilerState();
  const wrapped = wrapHandler({
    extensionPath: "slow-a.ts",
    eventType: "turn_start",
    handler: async () => {
      await sleep(20);
    },
    state,
    now: fakeNow,
  });

  await wrapped({ type: "turn_start" }, {} as any);
  const rows = summarizeByExtension(state);
  assert.equal(rows[0]?.extensionPath, "slow-a.ts");
  assert.equal(rows[0]?.calls, 1);
});

test("wrapHandler is idempotent (already wrapped handler is returned)", () => {
  const h = async () => {};
  const once = wrapHandler({ extensionPath: "a.ts", eventType: "x", handler: h, state, now });
  const twice = wrapHandler({ extensionPath: "a.ts", eventType: "x", handler: once, state, now });
  assert.equal(once, twice);
});
```

**Step 2: Run test to verify RED**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: FAIL due to missing `wrapHandler` and idempotence marker.

**Step 3: Commit RED wrapper tests**

```bash
git add extensions/ext-prof-spike/lib.test.ts
git commit -m "test(ext-prof-spike): add red wrapper timing tests"
```

---

### Task 4: Implement wrapper utility and runner patch helper

**Files:**
- Modify: `extensions/ext-prof-spike/lib.ts`
- Create: `extensions/ext-prof-spike/index.ts`

**Step 1: Implement generic handler wrapper + marker symbol**

```ts
const WRAPPED = Symbol.for("ext-prof-spike.wrapped");

export function wrapHandler(args: {
  extensionPath: string;
  eventType: string;
  handler: (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
  state: ProfilerState;
  now?: () => number;
}) {
  const now = args.now ?? (() => performance.now());
  const existing = args.handler as any;
  if (existing?.[WRAPPED]) return args.handler;

  const wrapped = async (event: unknown, ctx: unknown) => {
    const start = now();
    try {
      return await args.handler(event, ctx);
    } finally {
      recordSample(args.state, {
        extensionPath: args.extensionPath,
        eventType: args.eventType,
        ms: Math.max(0, now() - start),
        ok: true,
      });
    }
  };

  (wrapped as any)[WRAPPED] = true;
  return wrapped;
}
```

**Step 2: Implement `patchRunnerPrototypeOnce` helper in `index.ts`**

```ts
// dynamic import internal runner, patch bindCore once
// after original bindCore, wrap ext.handlers[eventType][] in-place
```

Patch rules for this spike:
- Patch only once (global symbol guard).
- Wrap only event handlers (`ext.handlers`), not tools/commands.
- Do not change handler behavior or return values.
- If internal import fails, emit a clear warning and keep extension operational.

**Step 3: Register `/ext-prof` command in `index.ts`**

```ts
pi.registerCommand("ext-prof", {
  description: "Show extension total handler runtime (ms)",
  handler: async (_args, ctx) => {
    const rows = summarizeByExtension(state);
    const text = rows.length
      ? rows.map(r => `${r.extensionPath}  total=${r.totalMs.toFixed(1)}ms  calls=${r.calls}`).join("\n")
      : "No extension samples recorded yet.";
    if (ctx.hasUI) ctx.ui.notify(text, "info");
    else process.stdout.write(text + "\n");
  },
});
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: PASS.

**Step 5: Commit patch implementation**

```bash
git add extensions/ext-prof-spike/lib.ts extensions/ext-prof-spike/index.ts extensions/ext-prof-spike/lib.test.ts
git commit -m "feat(ext-prof-spike): patch extension runner to collect per-extension totals"
```

---

### Task 5: Add two synthetic slow extensions for manual proof

**Files:**
- Create: `extensions/ext-prof-spike/fixtures/slow-a.ts`
- Create: `extensions/ext-prof-spike/fixtures/slow-b.ts`
- Create: `extensions/ext-prof-spike/README.md`

**Step 1: Create `slow-a.ts` fixture (150ms on `turn_start`)**

```ts
pi.on("turn_start", async () => {
  await new Promise((r) => setTimeout(r, 150));
});
```

**Step 2: Create `slow-b.ts` fixture (40ms on `turn_start`)**

```ts
pi.on("turn_start", async () => {
  await new Promise((r) => setTimeout(r, 40));
});
```

**Step 3: Document manual runbook in README**

Include exact command order (profiler first):

```bash
pi \
  -e ./extensions/ext-prof-spike/index.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-a.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-b.ts
```

Manual interaction:
1. Send one prompt: `hello`
2. Run `/ext-prof`
3. Confirm `slow-a.ts` shows larger total ms than `slow-b.ts`.

**Step 4: Commit fixture docs**

```bash
git add extensions/ext-prof-spike/fixtures/slow-a.ts extensions/ext-prof-spike/fixtures/slow-b.ts extensions/ext-prof-spike/README.md
git commit -m "test(ext-prof-spike): add synthetic slow extension fixtures"
```

---

### Task 6: Verification pass and spike acceptance gate

**Files:**
- Modify (if needed): `extensions/ext-prof-spike/README.md`

**Step 1: Run full test verification**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: all tests PASS.

**Step 2: Run manual spike verification in Pi**

Run interactive command from Task 5 and execute `/ext-prof` after at least one turn.
Expected output pattern:
- line for `slow-a.ts` with higher `total=...ms`
- line for `slow-b.ts` with lower `total=...ms`
- no runtime crashes when patch is active.

**Step 3: Capture acceptance notes in README**
- Record observed totals from one run.
- Note known limitations (internal API dependency, event-handlers only, in-memory state).

**Step 4: Final commit**

```bash
git add extensions/ext-prof-spike/README.md
git commit -m "docs(ext-prof-spike): capture spike verification and limits"
```

---

## Success Criteria (Spike)

- `/ext-prof` prints extension-path totals with non-zero milliseconds.
- At least two third-party fixture extensions are attributed correctly.
- No modifications to target extensions are required.
- Scope stays minimal (no persistence, no per-event reporting, no UI widgets).

## Out of Scope (for this spike)

- Tool/command-level attribution
- Percentiles or per-turn share
- Persistent storage / historical trend views
- Hardening for all future Pi internals changes

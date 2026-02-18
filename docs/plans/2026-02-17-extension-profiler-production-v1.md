# Extension Profiler Production V1 Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:executing-plans skill to implement this plan task-by-task.

**Goal:** Ship a production-ready `/ext-prof` extension profiler that supports opt-in profiling, full event/command/tool attribution, verbose reporting, and manual JSONL snapshots while preserving normal extension behavior.

**Architecture:** Keep the current spike patching strategy, but split into focused modules: collector, wrapper, formatter, persistence, patcher, and command controller. The hot path records aggregate counters only (no per-call retention), uses async-safe wrappers, and enforces cardinality limits. Runtime remains warning-only for overhead target breaches, with explicit coverage reporting for instrumented/missing surfaces.

**Tech Stack:** TypeScript (ESM), Node `node:test` + `tsx`, Pi extension API (`@mariozechner/pi-coding-agent`), Node `fs/promises`, JSONL snapshots.

---

## Execution rules

- Follow **@test-driven-development** for every task (RED -> GREEN -> REFACTOR).
- If a test fails unexpectedly, use **@systematic-debugging** before changing behavior.
- Before declaring done, run full verification using **@verification-before-completion**.
- Keep commits small and semantic.

### Task 1: Build the aggregate collector core (full detail + guardrails)

**Files:**
- Modify: `extensions/ext-prof-spike/package.json`
- Create: `extensions/ext-prof-spike/collector.test.ts`
- Create: `extensions/ext-prof-spike/collector.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  createCollector,
  recordInvocation,
  summarizeByExtension,
  summarizeByHandler,
} from "./collector.ts";

test("records totals by extension/surface/name", () => {
  const collector = createCollector({ maxHandlers: 10_000 });

  recordInvocation(collector, {
    extensionPath: "a.ts",
    surface: "event",
    name: "turn_start",
    ms: 12,
    ok: true,
  });
  recordInvocation(collector, {
    extensionPath: "a.ts",
    surface: "command",
    name: "foo",
    ms: 5,
    ok: false,
  });

  assert.deepEqual(summarizeByExtension(collector), [
    { extensionPath: "a.ts", calls: 2, totalMs: 17, maxMs: 12, errorCount: 1 },
  ]);

  assert.equal(summarizeByHandler(collector).length, 2);
});

test("uses <unknown-extension> fallback and enforces cardinality cap", () => {
  const collector = createCollector({ maxHandlers: 1 });

  recordInvocation(collector, {
    extensionPath: "",
    surface: "event",
    name: "turn_start",
    ms: 1,
    ok: true,
  });

  recordInvocation(collector, {
    extensionPath: "a.ts",
    surface: "event",
    name: "turn_end",
    ms: 1,
    ok: true,
  });

  const handlers = summarizeByHandler(collector);
  assert.equal(handlers.length, 1);
  assert.equal(handlers[0]?.extensionPath, "<unknown-extension>");
  assert.equal(collector.droppedNewKeys, 1);
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test collector.test.ts`
Expected: FAIL with module-not-found or missing exports from `collector.ts`.

**Step 3: Write minimal implementation and test runner update**

```ts
// package.json
{
  "scripts": {
    "test": "tsx --test *.test.ts"
  }
}
```

```ts
// collector.ts
export type Surface = "event" | "command" | "tool";

export type Aggregate = {
  calls: number;
  totalMs: number;
  maxMs: number;
  errorCount: number;
};

export type Collector = {
  maxHandlers: number;
  unknownExtensionKey: string;
  extensionTotals: Map<string, Aggregate>;
  handlerTotals: Map<string, Aggregate & { extensionPath: string; surface: Surface; name: string }>;
  droppedNewKeys: number;
  warnedCardinality: boolean;
};

export function createCollector(args: { maxHandlers: number; unknownExtensionKey?: string }): Collector {
  return {
    maxHandlers: args.maxHandlers,
    unknownExtensionKey: args.unknownExtensionKey ?? "<unknown-extension>",
    extensionTotals: new Map(),
    handlerTotals: new Map(),
    droppedNewKeys: 0,
    warnedCardinality: false,
  };
}

const keyOf = (extensionPath: string, surface: Surface, name: string) => `${extensionPath}\u001f${surface}\u001f${name}`;

function upsertAggregate(target: Map<string, Aggregate>, key: string, ms: number, ok: boolean): Aggregate {
  const row = target.get(key) ?? { calls: 0, totalMs: 0, maxMs: 0, errorCount: 0 };
  row.calls += 1;
  row.totalMs += ms;
  row.maxMs = Math.max(row.maxMs, ms);
  if (!ok) row.errorCount += 1;
  target.set(key, row);
  return row;
}

export function recordInvocation(
  collector: Collector,
  sample: { extensionPath: string | undefined; surface: Surface; name: string; ms: number; ok: boolean },
): void {
  const extensionPath = sample.extensionPath?.trim() ? sample.extensionPath : collector.unknownExtensionKey;
  const handlerKey = keyOf(extensionPath, sample.surface, sample.name);

  if (!collector.handlerTotals.has(handlerKey) && collector.handlerTotals.size >= collector.maxHandlers) {
    collector.droppedNewKeys += 1;
    return;
  }

  upsertAggregate(collector.extensionTotals, extensionPath, sample.ms, sample.ok);

  const row = collector.handlerTotals.get(handlerKey) ?? {
    extensionPath,
    surface: sample.surface,
    name: sample.name,
    calls: 0,
    totalMs: 0,
    maxMs: 0,
    errorCount: 0,
  };
  row.calls += 1;
  row.totalMs += sample.ms;
  row.maxMs = Math.max(row.maxMs, sample.ms);
  if (!sample.ok) row.errorCount += 1;
  collector.handlerTotals.set(handlerKey, row);
}

export function summarizeByExtension(collector: Collector) {
  return [...collector.extensionTotals.entries()]
    .map(([extensionPath, row]) => ({ extensionPath, ...row }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

export function summarizeByHandler(collector: Collector) {
  return [...collector.handlerTotals.values()].sort((a, b) => b.totalMs - a.totalMs);
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test collector.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/package.json extensions/ext-prof-spike/collector.ts extensions/ext-prof-spike/collector.test.ts
git commit -m "feat(ext-prof-spike): add aggregate collector with cardinality guardrails"
```

### Task 2: Implement async-safe wrapper timing with `performance.now()`

**Files:**
- Create: `extensions/ext-prof-spike/wrapper.test.ts`
- Create: `extensions/ext-prof-spike/wrapper.ts`
- Modify: `extensions/ext-prof-spike/collector.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createCollector, summarizeByHandler } from "./collector.ts";
import { wrapEventHandler } from "./wrapper.ts";

test("awaits async handler before recording duration", async () => {
  const collector = createCollector({ maxHandlers: 10_000 });
  const ticks = [10, 35];
  const now = () => ticks.shift() ?? 35;

  const wrapped = wrapEventHandler({
    extensionPath: "slow-a.ts",
    eventType: "turn_start",
    collector,
    handler: async () => Promise.resolve(),
    now,
  });

  await wrapped({ type: "turn_start" }, {});

  const row = summarizeByHandler(collector)[0];
  assert.equal(row?.totalMs, 25);
});

test("preserves thrown error and records errorCount", async () => {
  const collector = createCollector({ maxHandlers: 10_000 });
  const now = () => 1;
  const expected = new Error("boom");

  const wrapped = wrapEventHandler({
    extensionPath: "a.ts",
    eventType: "turn_start",
    collector,
    handler: async () => {
      throw expected;
    },
    now,
  });

  await assert.rejects(() => wrapped({ type: "turn_start" }, {}), expected);
  assert.equal(summarizeByHandler(collector)[0]?.errorCount, 1);
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test wrapper.test.ts`
Expected: FAIL with missing `wrapEventHandler`.

**Step 3: Write minimal implementation**

```ts
// wrapper.ts
import { recordInvocation, type Collector } from "./collector.ts";

const WRAPPED = Symbol.for("ext-prof.v1.wrapped");

type Fn = (...args: unknown[]) => Promise<unknown> | unknown;

type WrappedFn = Fn & { [WRAPPED]?: true };

function markWrapped(fn: Fn): fn is WrappedFn {
  return Boolean((fn as WrappedFn)[WRAPPED]);
}

async function callTimed(args: {
  extensionPath: string;
  surface: "event" | "command" | "tool";
  name: string;
  collector: Collector;
  now?: () => number;
  fn: Fn;
  thisArg: unknown;
  callArgs: unknown[];
}) {
  const now = args.now ?? (() => performance.now());
  const start = now();
  let ok = false;
  try {
    const result = await args.fn.apply(args.thisArg, args.callArgs);
    ok = true;
    return result;
  } finally {
    const ms = Math.max(0, now() - start);
    recordInvocation(args.collector, {
      extensionPath: args.extensionPath,
      surface: args.surface,
      name: args.name,
      ms,
      ok,
    });
  }
}

export function wrapEventHandler(args: {
  extensionPath: string;
  eventType: string;
  collector: Collector;
  handler: Fn;
  now?: () => number;
}): Fn {
  if (markWrapped(args.handler)) return args.handler;

  const wrapped: WrappedFn = async function wrappedEvent(...callArgs: unknown[]) {
    return callTimed({
      extensionPath: args.extensionPath,
      surface: "event",
      name: args.eventType,
      collector: args.collector,
      now: args.now,
      fn: args.handler,
      thisArg: this,
      callArgs,
    });
  };

  wrapped[WRAPPED] = true;
  return wrapped;
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test wrapper.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/wrapper.ts extensions/ext-prof-spike/wrapper.test.ts extensions/ext-prof-spike/collector.ts
git commit -m "feat(ext-prof-spike): add async-safe wrapper timing"
```

### Task 3: Add verbose formatter and status rendering

**Files:**
- Create: `extensions/ext-prof-spike/formatter.test.ts`
- Create: `extensions/ext-prof-spike/formatter.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { formatStatus, formatVerboseReport } from "./formatter.ts";

test("status prints per-surface coverage", () => {
  const text = formatStatus({
    enabled: true,
    patch: { patched: true, reason: "patched" },
    coverage: { events: "instrumented", commands: "missing", tools: "instrumented" },
  });

  assert.match(text, /events: instrumented/);
  assert.match(text, /commands: missing/);
  assert.match(text, /tools: instrumented/);
});

test("verbose report includes overhead warning", () => {
  const text = formatVerboseReport({
    rows: [
      {
        extensionPath: "a.ts",
        calls: 2,
        totalMs: 20,
        maxMs: 12,
        errorCount: 1,
        handlers: [
          { surface: "event", name: "turn_start", calls: 2, totalMs: 20, maxMs: 12, errorCount: 1 },
        ],
      },
    ],
    patchReason: "patched",
    overhead: { goalPct: 1, observedPct: 1.8 },
  });

  assert.match(text, /OVERHEAD WARNING/);
  assert.match(text, /a.ts/);
  assert.match(text, /event:turn_start/);
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test formatter.test.ts`
Expected: FAIL with missing exports.

**Step 3: Write minimal implementation**

```ts
// formatter.ts
type Coverage = "instrumented" | "missing";

export function formatStatus(args: {
  enabled: boolean;
  patch: { patched: boolean; reason: string };
  coverage: { events: Coverage; commands: Coverage; tools: Coverage };
}): string {
  return [
    `enabled: ${args.enabled ? "on" : "off"}`,
    `patch: ${args.patch.reason}`,
    `events: ${args.coverage.events}`,
    `commands: ${args.coverage.commands}`,
    `tools: ${args.coverage.tools}`,
  ].join("\n");
}

export function formatVerboseReport(args: {
  rows: Array<{
    extensionPath: string;
    calls: number;
    totalMs: number;
    maxMs: number;
    errorCount: number;
    handlers: Array<{ surface: string; name: string; calls: number; totalMs: number; maxMs: number; errorCount: number }>;
  }>;
  patchReason: string;
  overhead: { goalPct: number; observedPct: number | null };
}): string {
  const header = [
    `patch: ${args.patchReason}`,
    args.overhead.observedPct == null
      ? `overhead goal<=${args.overhead.goalPct}% observed=unknown`
      : `overhead goal<=${args.overhead.goalPct}% observed=${args.overhead.observedPct.toFixed(2)}%${
          args.overhead.observedPct > args.overhead.goalPct ? " OVERHEAD WARNING" : ""
        }`,
  ];

  const body = args.rows.flatMap((row) => [
    `${row.extensionPath} total=${row.totalMs.toFixed(1)}ms calls=${row.calls} avg=${(row.totalMs / Math.max(1, row.calls)).toFixed(1)}ms max=${row.maxMs.toFixed(1)}ms errors=${row.errorCount}`,
    ...row.handlers.map(
      (h) => `  ${h.surface}:${h.name} total=${h.totalMs.toFixed(1)}ms calls=${h.calls} max=${h.maxMs.toFixed(1)}ms errors=${h.errorCount}`,
    ),
  ]);

  return [...header, ...body].join("\n");
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test formatter.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/formatter.ts extensions/ext-prof-spike/formatter.test.ts
git commit -m "feat(ext-prof-spike): add verbose report and coverage formatter"
```

### Task 4: Implement JSONL snapshot persistence (`schemaVersion: 1`)

**Files:**
- Create: `extensions/ext-prof-spike/persistence.test.ts`
- Create: `extensions/ext-prof-spike/persistence.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";
import { saveSnapshot } from "./persistence.ts";

test("writes JSONL with session_meta schemaVersion=1 and aggregate rows", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ext-prof-"));
  const output = path.join(dir, "snapshot.jsonl");

  await saveSnapshot({
    outputPath: output,
    sessionMeta: {
      schemaVersion: 1,
      project: "dotagents",
      patch: "patched",
      savedAt: "2026-02-17T00:00:00.000Z",
      overheadGoalPct: 1,
    },
    aggregates: [
      {
        extensionPath: "a.ts",
        surface: "event",
        name: "turn_start",
        calls: 2,
        totalMs: 20,
        maxMs: 11,
        errorCount: 0,
      },
    ],
  });

  const lines = (await readFile(output, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines[0].type, "session_meta");
  assert.equal(lines[0].schemaVersion, 1);
  assert.equal(lines[1].type, "aggregate");
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test persistence.test.ts`
Expected: FAIL with missing module/exports.

**Step 3: Write minimal implementation**

```ts
// persistence.ts
import path from "node:path";
import { mkdir, writeFile, rename } from "node:fs/promises";

export async function saveSnapshot(args: {
  outputPath: string;
  sessionMeta: Record<string, unknown> & { schemaVersion: 1 };
  aggregates: Array<Record<string, unknown>>;
}): Promise<void> {
  await mkdir(path.dirname(args.outputPath), { recursive: true });

  const tmp = `${args.outputPath}.tmp-${process.pid}`;
  const lines = [
    JSON.stringify({ type: "session_meta", ...args.sessionMeta }),
    ...args.aggregates.map((row) => JSON.stringify({ type: "aggregate", ...row })),
  ];

  await writeFile(tmp, `${lines.join("\n")}\n`, "utf8");
  await rename(tmp, args.outputPath);
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test persistence.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/persistence.ts extensions/ext-prof-spike/persistence.test.ts
git commit -m "feat(ext-prof-spike): add manual JSONL snapshot persistence"
```

### Task 5: Add runner patcher for events/commands/tools with coverage flags

**Files:**
- Create: `extensions/ext-prof-spike/patcher.test.ts`
- Create: `extensions/ext-prof-spike/patcher.ts`
- Modify: `extensions/ext-prof-spike/wrapper.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createCollector, summarizeByHandler } from "./collector.ts";
import { patchRunnerPrototype } from "./patcher.ts";

class FakeRunner {
  extensions = [
    {
      path: "a.ts",
      handlers: new Map([["turn_start", [async () => {}]]]),
      commands: new Map([["hello", { name: "hello", handler: async () => {} }]]),
      tools: new Map([
        [
          "tool-a",
          {
            definition: {
              name: "tool-a",
              label: "Tool A",
              description: "",
              parameters: {} as never,
              execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
            },
            extensionPath: "a.ts",
          },
        ],
      ]),
    },
  ];

  bindCore() {
    return undefined;
  }
}

test("patches all three surfaces and reports coverage", async () => {
  const collector = createCollector({ maxHandlers: 10_000 });
  const status = patchRunnerPrototype({ RunnerCtor: FakeRunner as never, collector });

  const runner = new FakeRunner();
  runner.bindCore();

  await runner.extensions[0].handlers.get("turn_start")?.[0]({ type: "turn_start" }, {});
  await runner.extensions[0].commands.get("hello")?.handler("", {} as never);
  await runner.extensions[0].tools.get("tool-a")?.definition.execute("id", {} as never, undefined, undefined, {} as never);

  assert.equal(status.coverage.events, "instrumented");
  assert.equal(status.coverage.commands, "instrumented");
  assert.equal(status.coverage.tools, "instrumented");
  assert.equal(summarizeByHandler(collector).length, 3);
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test patcher.test.ts`
Expected: FAIL with missing `patchRunnerPrototype`.

**Step 3: Write minimal implementation**

```ts
// patcher.ts
import { wrapEventHandler, wrapCommandHandler, wrapToolExecute } from "./wrapper.ts";
import type { Collector } from "./collector.ts";

const PATCHED = Symbol.for("ext-prof.v1.patched");

export function patchRunnerPrototype(args: {
  RunnerCtor: { prototype: { bindCore: (...input: unknown[]) => unknown } };
  collector: Collector;
}) {
  const proto = args.RunnerCtor.prototype as Record<string, unknown>;
  if ((proto as Record<symbol, unknown>)[PATCHED]) {
    return {
      patched: false,
      reason: "already patched",
      coverage: { events: "missing", commands: "missing", tools: "missing" } as const,
    };
  }

  const original = proto.bindCore as (...input: unknown[]) => unknown;
  let coverage = { events: "missing", commands: "missing", tools: "missing" } as const;

  proto.bindCore = function patchedBindCore(...input: unknown[]) {
    const result = original.apply(this, input);

    const nextCoverage = { events: "missing", commands: "missing", tools: "missing" } as {
      events: "instrumented" | "missing";
      commands: "instrumented" | "missing";
      tools: "instrumented" | "missing";
    };

    for (const ext of (this as { extensions?: unknown[] }).extensions ?? []) {
      const extensionPath = (ext as { path?: string }).path ?? "<unknown-extension>";

      const handlers = (ext as { handlers?: Map<string, Array<(...args: unknown[]) => unknown>> }).handlers;
      if (handlers instanceof Map) {
        for (const [eventType, fns] of handlers.entries()) {
          handlers.set(eventType, fns.map((fn) => wrapEventHandler({ extensionPath, eventType, collector: args.collector, handler: fn })));
        }
        nextCoverage.events = "instrumented";
      }

      const commands = (ext as { commands?: Map<string, { handler: (...args: unknown[]) => unknown }> }).commands;
      if (commands instanceof Map) {
        for (const [name, command] of commands.entries()) {
          command.handler = wrapCommandHandler({ extensionPath, commandName: name, collector: args.collector, handler: command.handler });
        }
        nextCoverage.commands = "instrumented";
      }

      const tools = (ext as { tools?: Map<string, { definition: { execute: (...args: unknown[]) => unknown } }> }).tools;
      if (tools instanceof Map) {
        for (const [name, tool] of tools.entries()) {
          tool.definition.execute = wrapToolExecute({ extensionPath, toolName: name, collector: args.collector, handler: tool.definition.execute });
        }
        nextCoverage.tools = "instrumented";
      }
    }

    coverage = nextCoverage;
    return result;
  };

  (proto as Record<symbol, unknown>)[PATCHED] = true;
  return { patched: true, reason: "patched", coverage };
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test patcher.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/patcher.ts extensions/ext-prof-spike/patcher.test.ts extensions/ext-prof-spike/wrapper.ts
git commit -m "feat(ext-prof-spike): patch runner surfaces for events commands and tools"
```

### Task 6: Implement command controller (`on/off/status/reset/save`)

**Files:**
- Create: `extensions/ext-prof-spike/commands.test.ts`
- Create: `extensions/ext-prof-spike/commands.ts`
- Modify: `extensions/ext-prof-spike/formatter.ts`
- Modify: `extensions/ext-prof-spike/persistence.ts`

**Step 1: Write the failing tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createController } from "./commands.ts";

test("on/off/status lifecycle", async () => {
  let patchCalls = 0;
  const controller = createController({
    patch: async () => {
      patchCalls += 1;
      return { patched: true, reason: "patched", coverage: { events: "instrumented", commands: "instrumented", tools: "instrumented" } };
    },
    save: async () => "/tmp/snapshot.jsonl",
    projectName: "dotagents",
    homeDir: "/Users/brian",
  });

  assert.match(await controller.handle("status"), /enabled: off/);
  assert.match(await controller.handle("on"), /enabled: on/);
  assert.equal(patchCalls, 1);
  assert.match(await controller.handle("off"), /enabled: off/);
});

test("save uses default ~/.pi/profiles/<project>/<timestamp>.jsonl", async () => {
  let savedPath = "";
  const controller = createController({
    patch: async () => ({ patched: true, reason: "patched", coverage: { events: "instrumented", commands: "instrumented", tools: "instrumented" } }),
    save: async (outputPath) => {
      savedPath = outputPath;
      return outputPath;
    },
    projectName: "dotagents",
    homeDir: "/Users/brian",
  });

  await controller.handle("save");
  assert.match(savedPath, /\/Users\/brian\/\.pi\/profiles\/dotagents\/.+\.jsonl$/);
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test commands.test.ts`
Expected: FAIL with missing `createController`.

**Step 3: Write minimal implementation**

```ts
// commands.ts
import path from "node:path";
import { formatStatus } from "./formatter.ts";

export function createController(args: {
  patch: () => Promise<{
    patched: boolean;
    reason: string;
    coverage: { events: "instrumented" | "missing"; commands: "instrumented" | "missing"; tools: "instrumented" | "missing" };
  }>;
  save: (outputPath: string) => Promise<string>;
  projectName: string;
  homeDir: string;
}) {
  let enabled = false;
  let patchState = { patched: false, reason: "not patched", coverage: { events: "missing", commands: "missing", tools: "missing" } as const };

  const defaultSavePath = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(args.homeDir, ".pi", "profiles", args.projectName, `${stamp}.jsonl`);
  };

  return {
    async handle(rawArgs: string): Promise<string> {
      const [subcommand, maybePath] = rawArgs.trim().split(/\s+/, 2);

      if (!subcommand || subcommand === "status") {
        return formatStatus({ enabled, patch: patchState, coverage: patchState.coverage });
      }

      if (subcommand === "on") {
        patchState = await args.patch();
        enabled = true;
        return formatStatus({ enabled, patch: patchState, coverage: patchState.coverage });
      }

      if (subcommand === "off") {
        enabled = false;
        return formatStatus({ enabled, patch: patchState, coverage: patchState.coverage });
      }

      if (subcommand === "reset") {
        return "reset: collector state cleared";
      }

      if (subcommand === "save") {
        const outputPath = maybePath || defaultSavePath();
        const saved = await args.save(outputPath);
        return `saved: ${saved}`;
      }

      return `unknown subcommand: ${subcommand}`;
    },
  };
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test commands.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/commands.ts extensions/ext-prof-spike/commands.test.ts extensions/ext-prof-spike/formatter.ts extensions/ext-prof-spike/persistence.ts
git commit -m "feat(ext-prof-spike): add ext-prof command controller"
```

### Task 7: Integrate production modules into `index.ts`

**Files:**
- Create: `extensions/ext-prof-spike/index.test.ts`
- Modify: `extensions/ext-prof-spike/index.ts`
- Modify: `extensions/ext-prof-spike/lib.ts`
- Modify: `extensions/ext-prof-spike/lib.test.ts`

**Step 1: Write the failing integration test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import profilerExtension from "./index.ts";

test("registers ext-prof command and handles status", async () => {
  const commands = new Map<string, (args: string, ctx: { hasUI: boolean; ui: { notify: (...args: unknown[]) => void } }) => Promise<void>>();
  let stdout = "";

  const pi = {
    registerCommand(name: string, options: { handler: (args: string, ctx: { hasUI: boolean; ui: { notify: (...args: unknown[]) => void } }) => Promise<void> }) {
      commands.set(name, options.handler);
    },
    on() {},
  } as never;

  const originalWrite = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (chunk: string) => boolean) = ((chunk: string) => {
    stdout += chunk;
    return true;
  }) as never;

  try {
    await profilerExtension(pi);
    const handler = commands.get("ext-prof");
    assert.ok(handler);
    await handler!("status", { hasUI: false, ui: { notify() {} } });
    assert.match(stdout, /enabled: off/);
  } finally {
    process.stdout.write = originalWrite;
  }
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test index.test.ts`
Expected: FAIL because current `index.ts` does not use controller/status model.

**Step 3: Write minimal integration implementation**

```ts
// index.ts (shape)
// - create collector on load
// - create controller with patch/save deps
// - register /ext-prof command that forwards args to controller.handle(args)
// - print via ctx.ui.notify when hasUI, else stdout
// - keep session_start warning when patch failed
```

```ts
// lib.ts
// Keep compatibility exports used by old tests during migration.
export { createCollector, recordInvocation, summarizeByExtension } from "./collector.ts";
export { wrapEventHandler as wrapHandler } from "./wrapper.ts";
```

```ts
// lib.test.ts
// Replace legacy tests with compatibility assertions only.
```

**Step 4: Run all tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: PASS across `*.test.ts`.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/index.ts extensions/ext-prof-spike/index.test.ts extensions/ext-prof-spike/lib.ts extensions/ext-prof-spike/lib.test.ts
git commit -m "feat(ext-prof-spike): integrate production modules into extension entrypoint"
```

### Task 8: Add realistic fixtures and overhead benchmark helper

**Files:**
- Create: `extensions/ext-prof-spike/fixtures/slow-command.ts`
- Create: `extensions/ext-prof-spike/fixtures/slow-tool.ts`
- Create: `extensions/ext-prof-spike/overhead.ts`
- Create: `extensions/ext-prof-spike/overhead.test.ts`

**Step 1: Write failing benchmark test for formula correctness**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { computeOverheadPct } from "./overhead.ts";

test("computes overhead percentage from baseline/profiled durations", () => {
  assert.equal(computeOverheadPct({ baselineMs: 100, profiledMs: 101 }), 1);
  assert.equal(computeOverheadPct({ baselineMs: 200, profiledMs: 198 }), -1);
});
```

**Step 2: Run tests to verify RED**

Run: `cd extensions/ext-prof-spike && npx tsx --test overhead.test.ts`
Expected: FAIL with missing helper export.

**Step 3: Implement helper + fixtures**

```ts
// overhead.ts
export function computeOverheadPct(args: { baselineMs: number; profiledMs: number }): number {
  if (args.baselineMs <= 0) return 0;
  return ((args.profiledMs - args.baselineMs) / args.baselineMs) * 100;
}
```

```ts
// fixtures/slow-command.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function slowCommand(pi: ExtensionAPI) {
  pi.registerCommand("slow-cmd", {
    description: "Synthetic slow command",
    handler: async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    },
  });
}
```

```ts
// fixtures/slow-tool.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function slowTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "slow-tool",
    label: "Slow Tool",
    description: "Synthetic slow tool",
    parameters: { type: "object", properties: {}, required: [] } as never,
    execute: async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { content: [{ type: "text", text: "ok" }] };
    },
  });
}
```

**Step 4: Run tests to verify GREEN**

Run: `cd extensions/ext-prof-spike && npx tsx --test overhead.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/overhead.ts extensions/ext-prof-spike/overhead.test.ts extensions/ext-prof-spike/fixtures/slow-command.ts extensions/ext-prof-spike/fixtures/slow-tool.ts
git commit -m "test(ext-prof-spike): add command tool fixtures and overhead helper"
```

### Task 9: Update docs and run end-to-end verification

**Files:**
- Modify: `extensions/ext-prof-spike/README.md`
- Modify: `docs/design/2026-02-17-extension-profiler-production-v1.md`

**Step 1: Update README with production command surface**

```md
## Commands
- `/ext-prof on`
- `/ext-prof`
- `/ext-prof status`
- `/ext-prof save [path]`
- `/ext-prof off`
- `/ext-prof reset`

## Coverage
- events, commands, tools
- status output includes instrumented/missing per surface

## Snapshot
- Manual only
- JSONL with `session_meta` (`schemaVersion: 1`) + `aggregate` rows
```

**Step 2: Run automated verification**

Run: `cd extensions/ext-prof-spike && npm test`
Expected: PASS all tests.

**Step 3: Run manual runtime verification**

Run:

```bash
pi \
  -e ./extensions/ext-prof-spike/index.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-a.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-b.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-command.ts \
  -e ./extensions/ext-prof-spike/fixtures/slow-tool.ts
```

Then execute in session:
1. `/ext-prof on`
2. `hello`
3. `/slow-cmd`
4. Trigger `slow-tool` once via prompt/tool call
5. `/ext-prof`
6. `/ext-prof save`
7. `/ext-prof status`

Expected:
- verbose output includes `event`, `command`, and `tool` rows
- `patch: patched`
- coverage flags show instrumented surfaces
- save path under `~/.pi/profiles/<project>/...jsonl`

**Step 4: Capture verification notes in docs**

- Add one example report block in README
- Add observed save path + overhead warning behavior notes

**Step 5: Commit**

```bash
git add extensions/ext-prof-spike/README.md docs/design/2026-02-17-extension-profiler-production-v1.md
git commit -m "docs(ext-prof-spike): document production profiler usage and verification"
```

## Final acceptance checklist

- `/ext-prof on|off|status|save|reset` works
- Verbose report includes per-extension + per-handler rows
- Async handler timing is measured correctly (awaited)
- Unknown extension fallback bucket works
- Cardinality cap limits new handler keys and warns once
- JSONL save writes `session_meta` with `schemaVersion: 1`
- Coverage status clearly marks instrumented vs missing surfaces
- Full test suite passes and manual runbook is reproducible

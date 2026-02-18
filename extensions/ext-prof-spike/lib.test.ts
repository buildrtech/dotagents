import test from "node:test";
import assert from "node:assert/strict";
import {
  createProfilerState,
  recordSample,
  summarizeByExtension,
  wrapHandler,
} from "./lib.ts";

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

test("wrapHandler records duration and success", async () => {
  const state = createProfilerState();
  const ticks = [100, 140];
  const now = () => ticks.shift() ?? 140;

  const wrapped = wrapHandler({
    extensionPath: "slow-a.ts",
    eventType: "turn_start",
    handler: async () => {
      // noop
    },
    state,
    now,
  });

  await wrapped({ type: "turn_start" }, {});

  const rows = summarizeByExtension(state);
  assert.equal(rows[0]?.extensionPath, "slow-a.ts");
  assert.equal(rows[0]?.calls, 1);
  assert.equal(rows[0]?.totalMs, 40);
});

test("wrapHandler is idempotent for already wrapped handler", () => {
  const state = createProfilerState();
  const now = () => 0;

  const original = async () => {};

  const once = wrapHandler({
    extensionPath: "a.ts",
    eventType: "turn_start",
    handler: original,
    state,
    now,
  });

  const twice = wrapHandler({
    extensionPath: "a.ts",
    eventType: "turn_start",
    handler: once,
    state,
    now,
  });

  assert.equal(once, twice);
});

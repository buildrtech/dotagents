import test from "node:test";
import assert from "node:assert/strict";
import { createProfilerState, recordSample, summarizeByExtension } from "./lib.ts";

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

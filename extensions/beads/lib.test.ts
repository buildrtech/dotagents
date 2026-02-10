import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBrInfoJson,
  parseBrReadyJson,
  detectTrackingMode,
  isBrCloseCommand,
  shouldShowContextReminder,
  buildBeadsPrimeMessage,
  formatIssueLabel,
} from "./lib.ts";

test("parseBrInfoJson parses mode and issue_count", () => {
  const parsed = parseBrInfoJson('{"mode":"sqlite","issue_count":4}');
  assert.deepEqual(parsed, { mode: "sqlite", issueCount: 4 });
});

test("parseBrInfoJson returns null on invalid json", () => {
  assert.equal(parseBrInfoJson("not-json"), null);
});

test("parseBrReadyJson handles br list payload", () => {
  const issues = parseBrReadyJson('[{"id":"abc","title":"Do thing","type":"task","priority":1,"status":"open"}]');
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.id, "abc");
});

test("detectTrackingMode maps check-ignore codes", () => {
  assert.equal(detectTrackingMode(0), "stealth");
  assert.equal(detectTrackingMode(1), "git-tracked");
});

test("isBrCloseCommand only matches literal br close invocation", () => {
  assert.equal(isBrCloseCommand("br close abc"), true);
  assert.equal(isBrCloseCommand("echo br close"), false);
  assert.equal(isBrCloseCommand("bash -lc 'br close abc'"), false);
});

test("shouldShowContextReminder enforces one-time threshold", () => {
  assert.equal(
    shouldShowContextReminder({ tokens: 150000, contextLimit: 200000, thresholdPct: 0.7, alreadyShown: false }),
    true,
  );
  assert.equal(
    shouldShowContextReminder({ tokens: 120000, contextLimit: 200000, thresholdPct: 0.7, alreadyShown: false }),
    false,
  );
  assert.equal(
    shouldShowContextReminder({ tokens: 150000, contextLimit: 200000, thresholdPct: 0.7, alreadyShown: true }),
    false,
  );
});

test("buildBeadsPrimeMessage contains anti-TodoWrite guardrail", () => {
  const text = buildBeadsPrimeMessage();
  assert.match(text, /Use beads for ALL task tracking/);
  assert.match(text, /Do NOT use TodoWrite/);
});

test("formatIssueLabel includes id, priority, and title", () => {
  const label = formatIssueLabel({ id: "abc", title: "Do thing", priority: 1, type: "task", status: "open" });
  assert.match(label, /abc/);
  assert.match(label, /P1/);
  assert.match(label, /Do thing/);
});

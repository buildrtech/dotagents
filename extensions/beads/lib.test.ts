import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBrInfoJson,
  parseBrReadyJson,
  parseBrShowJson,
  detectTrackingMode,
  isBrCloseCommand,
  shouldShowContextReminder,
  buildBeadsPrimeMessage,
  buildResumeContext,
  formatIssueLabel,
  summarizeInProgressIssue,
  formatBeadsModeStatus,
  DIRTY_TREE_CLOSE_WARNING,
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

test("parseBrReadyJson handles issue_type payload from br list --json", () => {
  const issues = parseBrReadyJson('[{"id":"bd-123","title":"Do thing","issue_type":"feature","priority":1,"status":"in_progress"}]');
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.id, "bd-123");
  assert.equal(issues[0]?.type, "feature");
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

test("summarizeInProgressIssue reports first id with title and overflow count", () => {
  assert.equal(summarizeInProgressIssue([]), "none");
  assert.equal(summarizeInProgressIssue([{ id: "bd-1", title: "One" }]), "bd-1 — One");
  assert.equal(
    summarizeInProgressIssue([
      { id: "bd-1", title: "One" },
      { id: "bd-2", title: "Two" },
      { id: "bd-3", title: "Three" },
    ]),
    "bd-1 — One +2",
  );
});

test("formatBeadsModeStatus includes in-progress summary", () => {
  const status = formatBeadsModeStatus({
    modeText: "stealth (sqlite)",
    issueCount: 12,
    inProgressIssues: [{ id: "bd-1", title: "One" }],
  });
  assert.equal(status, "beads: stealth (sqlite) · 12 issue(s) · in-progress: bd-1 — One");
});

test("parseBrShowJson extracts issue with comments", () => {
  const json = JSON.stringify([{
    id: "bd-1",
    title: "Do thing",
    status: "in_progress",
    issue_type: "task",
    priority: 2,
    comments: [
      { id: 1, issue_id: "bd-1", author: "alice", text: "Started work", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, issue_id: "bd-1", author: "alice", text: "Tests passing", created_at: "2026-01-01T01:00:00Z" },
    ],
  }]);
  const issue = parseBrShowJson(json);
  assert.equal(issue?.id, "bd-1");
  assert.equal(issue?.comments?.length, 2);
  assert.equal(issue?.comments?.[1]?.text, "Tests passing");
});

test("parseBrShowJson handles issue with no comments", () => {
  const json = JSON.stringify([{ id: "bd-2", title: "No comments" }]);
  const issue = parseBrShowJson(json);
  assert.equal(issue?.id, "bd-2");
  assert.equal(issue?.comments, undefined);
});

test("parseBrShowJson returns null on bad input", () => {
  assert.equal(parseBrShowJson("nope"), null);
  assert.equal(parseBrShowJson("[]"), null);
});

test("buildResumeContext includes id, title, and last comment", () => {
  const ctx = buildResumeContext({
    id: "bd-1",
    title: "Fix parser",
    comments: [
      { id: 1, issue_id: "bd-1", author: "a", text: "Started", created_at: "2026-01-01T00:00:00Z" },
      { id: 2, issue_id: "bd-1", author: "a", text: "Tests green", created_at: "2026-01-01T01:00:00Z" },
    ],
  });
  assert.match(ctx, /bd-1/);
  assert.match(ctx, /Fix parser/);
  assert.match(ctx, /Tests green/);
  assert.ok(!ctx.includes("Started"));
});

test("buildResumeContext works without comments", () => {
  const ctx = buildResumeContext({ id: "bd-2", title: "No comments" });
  assert.match(ctx, /bd-2/);
  assert.match(ctx, /No comments/);
  assert.ok(!ctx.includes("checkpoint"));
});

test("buildBeadsPrimeMessage appends resume context when provided", () => {
  const withResume = buildBeadsPrimeMessage("## Resuming: bd-1 — Fix parser\nLast checkpoint: Tests green");
  assert.match(withResume, /Resuming: bd-1/);
  assert.match(withResume, /Tests green/);

  const without = buildBeadsPrimeMessage();
  assert.ok(!without.includes("Resuming"));
});

test("dirty tree close warning text includes semantic-commit guidance", () => {
  assert.match(DIRTY_TREE_CLOSE_WARNING, /semantic-commit/);
});

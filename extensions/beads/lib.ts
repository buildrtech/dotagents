export type TrackingMode = "stealth" | "git-tracked";

export type BrIssueSummary = {
  id: string;
  title: string;
  type?: string;
  priority?: number;
  status?: string;
};

export const DIRTY_TREE_CLOSE_WARNING =
  "Warning: Issue closed. You still have uncommitted changes — run @semantic-commit before continuing.";

export function parseBrInfoJson(json: string): { mode: string; issueCount: number } | null {
  try {
    const parsed = JSON.parse(json) as { mode?: unknown; issue_count?: unknown };
    const mode = typeof parsed.mode === "string" && parsed.mode.trim() ? parsed.mode : "unknown";
    const issueCount = typeof parsed.issue_count === "number" ? parsed.issue_count : 0;
    return { mode, issueCount };
  } catch {
    return null;
  }
}

export function parseBrReadyJson(json: string): BrIssueSummary[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { issues?: unknown }).issues)
        ? (parsed as { issues: unknown[] }).issues
        : [];

    return rows
      .map((row) => normalizeIssueRow(row))
      .filter((issue): issue is BrIssueSummary => issue !== null);
  } catch {
    return [];
  }
}

export function detectTrackingMode(gitCheckIgnoreExitCode: number): TrackingMode {
  return gitCheckIgnoreExitCode === 0 ? "stealth" : "git-tracked";
}

export function isBrCloseCommand(command: string): boolean {
  return /^\s*br\s+close\b/.test(command);
}

export function shouldShowContextReminder(args: {
  tokens: number;
  contextLimit: number;
  thresholdPct: number;
  alreadyShown: boolean;
}): boolean {
  if (args.alreadyShown) return false;
  const threshold = Math.floor(args.contextLimit * args.thresholdPct);
  return args.tokens > threshold;
}

export function buildBeadsPrimeMessage(): string {
  return [
    "# Beads Workflow Context",
    "",
    "## Core Rules",
    "- Use beads for ALL task tracking (`br create`, `br ready`, `br close`)",
    "- Do NOT use TodoWrite, TaskCreate, or markdown task files for tracking",
    "- Create beads issue BEFORE writing code",
    "- Mark issue in_progress when starting work",
    "",
    "## Essential Commands",
    "- br ready",
    "- br list --status in_progress",
    "- br show <id>",
    '- br close <id> --reason "Verified: ..."',
  ].join("\n");
}

export function formatIssueLabel(issue: BrIssueSummary): string {
  const priority = typeof issue.priority === "number" ? `P${issue.priority}` : "P?";
  const type = issue.type ?? "issue";
  return `[${priority}] ${issue.id} (${type}) ${issue.title}`;
}

export function summarizeInProgressIssue(issues: BrIssueSummary[]): string {
  if (!issues.length) return "none";
  if (issues.length === 1) return issues[0]!.id;
  return `${issues[0]!.id} +${issues.length - 1}`;
}

export function formatBeadsModeStatus(args: {
  modeText: string;
  issueCount: number;
  inProgressIssues: BrIssueSummary[];
}): string {
  return `beads: ${args.modeText} · ${args.issueCount} issue(s) · in-progress: ${summarizeInProgressIssue(args.inProgressIssues)}`;
}

function normalizeIssueRow(row: unknown): BrIssueSummary | null {
  if (!row || typeof row !== "object") return null;
  const data = row as {
    id?: unknown;
    title?: unknown;
    type?: unknown;
    issue_type?: unknown;
    priority?: unknown;
    status?: unknown;
  };

  if (typeof data.id !== "string" || !data.id.trim()) return null;
  const title = typeof data.title === "string" && data.title.trim() ? data.title : "(untitled issue)";

  return {
    id: data.id,
    title,
    type: typeof data.type === "string" ? data.type : typeof data.issue_type === "string" ? data.issue_type : undefined,
    priority: typeof data.priority === "number" ? data.priority : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
  };
}

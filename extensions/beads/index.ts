import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import {
  buildBeadsPrimeMessage,
  buildResumeContext,
  detectTrackingMode,
  DIRTY_TREE_CLOSE_WARNING,
  formatBeadsModeStatus,
  formatIssueCard,
  formatIssueLabel,
  getBeadsModeOffMessage,
  isBrCloseCommand,
  parseBrInfoJson,
  parseBeadsSessionMode,
  parseBrReadyJson,
  parseBrShowJson,
  shouldShowContextReminder,
} from "./lib.ts";
import type { BrShowIssue } from "./lib.ts";

type BeadsAction = "ready" | "show" | "claim" | "close" | "comment" | "create" | "status";

type BeadsToolInput = {
  action: BeadsAction;
  id?: string;
  title?: string;
  description?: string;
  type?: string;
  priority?: number;
  comment?: string;
  reason?: string;
};

type ExecResult = {
  stdout: string;
  stderr: string;
  code: number;
  killed: boolean;
};

function extractErrorSummary(output: unknown): string | null {
  if (typeof output !== "string") return null;
  const trimmed = output.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as { error?: { message?: unknown; hint?: unknown } };
    if (parsed?.error && typeof parsed.error === "object") {
      const message = typeof parsed.error.message === "string" ? parsed.error.message.trim() : "";
      const hint = typeof parsed.error.hint === "string" ? parsed.error.hint.trim() : "";

      if (message && hint) return `${message} (${hint})`;
      if (message) return message;
      if (hint) return hint;
    }
  } catch {
    // fall through to first non-empty line
  }

  const firstLine = trimmed
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? null;
}

function toExecError(error: unknown): ExecResult {
  return {
    stdout: "",
    stderr: error instanceof Error ? error.message : String(error),
    code: 1,
    killed: false,
  };
}

function summarizeExecFailure(result: ExecResult): string {
  return (
    extractErrorSummary(result.stderr) ??
    extractErrorSummary(result.stdout) ??
    `Command failed with exit code ${result.code}`
  );
}

function summarizeActionResult(action: string, stdout: string): string {
  const firstLine = stdout.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";

  switch (action) {
    case "create": {
      // "✓ Created bd-oe1: test rendering"
      const match = firstLine.match(/Created\s+(\S+):\s+(.+)/);
      if (match) return `Created ${match[1]} — ${match[2]}`;
      return firstLine || "created";
    }

    case "claim": {
      // "Updated bd-oe1: test rendering\n  status: open → in_progress"
      const idMatch = firstLine.match(/Updated\s+(\S+):\s+(.+)/);
      if (idMatch) return `Claimed ${idMatch[1]} — ${idMatch[2]}`;
      return firstLine || "claimed";
    }

    case "close": {
      // "Closed bd-oe1: test rendering"
      const match = firstLine.match(/Closed\s+(\S+):\s+(.+)/);
      if (match) return `Closed ${match[1]} — ${match[2]}`;
      return firstLine || "closed";
    }

    case "comment": {
      // "Comment added to bd-oe1"
      const match = firstLine.match(/Comment added to\s+(\S+)/);
      if (match) return `Comment added to ${match[1]}`;
      return firstLine || "comment added";
    }

    case "ready": {
      const lines = stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length || /no\s+(open|ready)/i.test(firstLine)) return "No ready issues";
      return `${lines.length} ready issue(s)`;
    }

    case "show": {
      // "○ bd-oe1 · test rendering   [● P3 · OPEN]"
      const match = firstLine.match(/[○●✓✗]\s+(\S+)\s+·\s+(.+?)\s+\[/);
      if (match) return `${match[1]} — ${match[2].trim()}`;
      return firstLine || "shown";
    }

    case "status": {
      // Extract key counts from br stats output
      const total = stdout.match(/Total Issues:\s+(\d+)/);
      const open = stdout.match(/Open:\s+(\d+)/);
      const inProgress = stdout.match(/In Progress:\s+(\d+)/);
      const closed = stdout.match(/Closed:\s+(\d+)/);
      if (total) {
        const parts = [`${total[1]} total`];
        if (open && open[1] !== "0") parts.push(`${open[1]} open`);
        if (inProgress && inProgress[1] !== "0") parts.push(`${inProgress[1]} in-progress`);
        if (closed && closed[1] !== "0") parts.push(`${closed[1]} closed`);
        return parts.join(", ");
      }
      return firstLine || "status";
    }

    default:
      return firstLine || `${action} complete`;
  }
}

async function runBr(pi: ExtensionAPI, args: string[], timeout = 15000): Promise<ExecResult> {
  return pi.exec("br", args, { timeout }).catch(toExecError);
}

async function runGit(pi: ExtensionAPI, args: string[], timeout = 5000): Promise<ExecResult> {
  return pi.exec("git", args, { timeout }).catch(toExecError);
}

function commandOut(
  ctx: { hasUI: boolean; ui: { notify: (message: string, level: "info" | "warning" | "error") => void } },
  message: string,
  level: "info" | "warning" | "error" = "info",
) {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  } else {
    process.stdout.write(`${message}\n`);
  }
}

export default function beadsExtension(pi: ExtensionAPI) {
  type UiContext = { ui: { setStatus: (key: string, value?: string) => void } };

  let isBeadsProject = false;
  let beadsEnabled = false;
  let shouldPrime = false;
  let contextReminderShown = false;
  let cachedModeText = "";

  const clearBeadsModeUi = (ctx: UiContext) => {
    ctx.ui.setStatus("beads-mode", undefined);
  };

  const setBeadsModeUiStatus = (ctx: UiContext) => {
    ctx.ui.setStatus(
      "beads-mode",
      formatBeadsModeStatus({
        beadsEnabled,
        isBeadsProject,
        modeText: cachedModeText,
        issueCount: 0,
        inProgressIssues: [],
      }),
    );
  };

  const refreshBeadsStatus = async (ctx: UiContext) => {
    if (!beadsEnabled || !isBeadsProject) {
      setBeadsModeUiStatus(ctx);
      return;
    }

    const [info, listResult, inProgressResult] = await Promise.all([
      runBr(pi, ["info", "--json"]),
      runBr(pi, ["list", "--json"]),
      runBr(pi, ["list", "--status", "in_progress", "--sort", "updated_at", "--json"]),
    ]);

    if (info.code !== 0) {
      clearBeadsModeUi(ctx);
      return;
    }

    const parsedInfo = parseBrInfoJson(info.stdout);

    // br info issue_count includes tombstones; use br list for live count
    const liveIssues = listResult.code === 0 ? parseBrReadyJson(listResult.stdout) : [];
    const issueCount = liveIssues.length;
    const inProgressIssues = inProgressResult.code === 0 ? parseBrReadyJson(inProgressResult.stdout) : [];

    if (!cachedModeText) {
      const checkIgnore = await runGit(pi, ["check-ignore", ".beads/"]);
      const mode = detectTrackingMode(checkIgnore.code);
      const modeLabel = mode === "stealth" ? "stealth" : "git-tracked";
      const backendMode = parsedInfo?.mode ?? "unknown";
      cachedModeText = `${modeLabel} (${backendMode})`;
    }

    ctx.ui.setStatus(
      "beads-mode",
      formatBeadsModeStatus({
        beadsEnabled,
        isBeadsProject,
        modeText: cachedModeText,
        issueCount,
        inProgressIssues,
      }),
    );
  };

  const maybeNudgeCommitAfterClose = async (ctx: {
    hasUI: boolean;
    ui: { notify: (message: string, level: "info" | "warning" | "error") => void };
  }): Promise<string | null> => {
    const status = await runGit(pi, ["status", "--porcelain"]);
    if (status.code !== 0) {
      return null;
    }

    if (!status.stdout.trim()) {
      return null;
    }

    commandOut(ctx, DIRTY_TREE_CLOSE_WARNING, "warning");

    // Deliver to model context so the agent acts on it.
    // Tool-path callers also embed this in tool content, but command-path
    // callers (/beads-close, /beads picker) have no tool result — this
    // ensures the model always sees the warning.
    pi.sendMessage(
      {
        customType: "beads-dirty-tree-warning",
        content: DIRTY_TREE_CLOSE_WARNING,
        display: false,
      },
      { deliverAs: "nextTurn" },
    );

    return DIRTY_TREE_CLOSE_WARNING;
  };

  pi.registerTool({
    name: "beads",
    label: "Beads",
    description:
      "Run deterministic beads operations (ready, show, claim, close, comment, create, status) through br CLI.",
    parameters: Type.Object({
      action: StringEnum(["ready", "show", "claim", "close", "comment", "create", "status"] as const),
      id: Type.Optional(Type.String({ description: "Issue id (e.g. br-abc)" })),
      title: Type.Optional(Type.String({ description: "Issue title for create" })),
      description: Type.Optional(Type.String({ description: "Issue description for create" })),
      type: Type.Optional(Type.String({ description: "Issue type for create (task/feature/bug/epic)" })),
      priority: Type.Optional(Type.Number({ description: "Issue priority for create (0-4)" })),
      comment: Type.Optional(Type.String({ description: "Comment text for comment action" })),
      reason: Type.Optional(Type.String({ description: "Close reason for close action" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const input = params as BeadsToolInput;

      if (!beadsEnabled) {
        return {
          content: [{ type: "text" as const, text: getBeadsModeOffMessage() }],
          details: {
            action: input.action,
            beadsEnabled,
          },
        };
      }

      const fail = (message: string, details: Record<string, unknown>) => {
        const summary = extractErrorSummary(details.stderr) ?? extractErrorSummary(details.stdout);
        const text = summary ? `${message}: ${summary}` : message;

        return {
          content: [{ type: "text" as const, text }],
          isError: true,
          details,
        };
      };

      const mutatingActions = new Set(["create", "claim", "close"]);

      const runBrForTool = async (args: string[]) => {
        const result = await runBr(pi, args);

        if (result.code !== 0) {
          return fail(`beads ${input.action} failed`, {
            action: input.action,
            command: `br ${args.join(" ")}`,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.code,
          });
        }

        if (mutatingActions.has(input.action)) {
          refreshBeadsStatus(ctx).catch(() => {});
        }

        let closeWarning: string | null = null;
        if (input.action === "close") {
          closeWarning = await maybeNudgeCommitAfterClose(ctx);
        }

        const outputText = closeWarning
          ? `${result.stdout || "OK"}\n\n${closeWarning}`
          : result.stdout || "OK";

        return {
          content: [{ type: "text" as const, text: outputText }],
          details: {
            action: input.action,
            command: `br ${args.join(" ")}`,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.code,
            closeWarning,
          },
        };
      };

      switch (input.action) {
        case "ready": {
          const result = await runBr(pi, ["ready", "--sort", "priority", "--json"]);

          if (result.code !== 0) {
            return fail("beads ready failed", {
              action: input.action,
              command: "br ready --sort priority --json",
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.code,
            });
          }

          const issues = parseBrReadyJson(result.stdout);
          const text = issues.length
            ? issues.map((issue) => formatIssueLabel(issue)).join("\n")
            : "No ready issues.";

          return {
            content: [{ type: "text" as const, text }],
            details: {
              action: input.action,
              command: "br ready --sort priority --json",
              issues,
              issueCount: issues.length,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.code,
            },
          };
        }

        case "show": {
          if (!input.id) {
            return fail("beads show requires id", { action: input.action, missing: "id" });
          }
          const showArgs = ["show", input.id, "--json"];
          const showResult = await runBr(pi, showArgs);
          if (showResult.code !== 0) {
            return fail("beads show failed", {
              action: input.action,
              command: `br ${showArgs.join(" ")}`,
              stdout: showResult.stdout,
              stderr: showResult.stderr,
              exitCode: showResult.code,
            });
          }
          const showIssue = parseBrShowJson(showResult.stdout);
          return {
            content: [{ type: "text" as const, text: showResult.stdout || "OK" }],
            details: {
              action: input.action,
              command: `br ${showArgs.join(" ")}`,
              stdout: showResult.stdout,
              stderr: showResult.stderr,
              exitCode: showResult.code,
              issueCard: showIssue,
            },
          };
        }

        case "claim": {
          if (!input.id) {
            return fail("beads claim requires id", { action: input.action, missing: "id" });
          }
          return runBrForTool(["update", input.id, "--status", "in_progress"]);
        }

        case "close": {
          if (!input.id) {
            return fail("beads close requires id", { action: input.action, missing: "id" });
          }
          const reason = input.reason?.trim() || "Verified: completed";
          return runBrForTool(["close", input.id, "--reason", reason]);
        }

        case "comment": {
          if (!input.id) {
            return fail("beads comment requires id", { action: input.action, missing: "id" });
          }
          if (!input.comment?.trim()) {
            return fail("beads comment requires comment text", { action: input.action, missing: "comment" });
          }
          const commentArgs = ["comments", "add", input.id, input.comment];
          const commentResult = await runBr(pi, commentArgs);
          if (commentResult.code !== 0) {
            return fail("beads comment failed", {
              action: input.action,
              command: `br ${commentArgs.join(" ")}`,
              stdout: commentResult.stdout,
              stderr: commentResult.stderr,
              exitCode: commentResult.code,
            });
          }
          return {
            content: [{ type: "text" as const, text: commentResult.stdout || "OK" }],
            details: {
              action: input.action,
              command: `br ${commentArgs.join(" ")}`,
              stdout: commentResult.stdout,
              stderr: commentResult.stderr,
              exitCode: commentResult.code,
              commentText: input.comment,
            },
          };
        }

        case "create": {
          if (!input.title?.trim()) {
            return fail("beads create requires title", { action: input.action, missing: "title" });
          }

          const createArgs = [
            "create",
            input.title,
            "--type",
            input.type?.trim() || "task",
            "--priority",
            String(typeof input.priority === "number" ? input.priority : 2),
          ];

          if (input.description?.trim()) {
            createArgs.push("--description", input.description);
          }

          const createResult = await runBr(pi, createArgs);
          if (createResult.code !== 0) {
            return fail("beads create failed", {
              action: input.action,
              command: `br ${createArgs.join(" ")}`,
              stdout: createResult.stdout,
              stderr: createResult.stderr,
              exitCode: createResult.code,
            });
          }

          refreshBeadsStatus(ctx).catch(() => {});

          const createdCard: BrShowIssue = {
            id: createResult.stdout.match(/Created\s+(\S+)/)?.[1] ?? "???",
            title: input.title,
            type: input.type?.trim() || "task",
            priority: typeof input.priority === "number" ? input.priority : 2,
            status: "open",
            description: input.description?.trim() || undefined,
          };

          return {
            content: [{ type: "text" as const, text: createResult.stdout || "OK" }],
            details: {
              action: input.action,
              command: `br ${createArgs.join(" ")}`,
              stdout: createResult.stdout,
              stderr: createResult.stderr,
              exitCode: createResult.code,
              issueCard: createdCard,
            },
          };
        }

        case "status": {
          return runBrForTool(["stats"]);
        }
      }
    },

    renderCall(args, theme) {
      const action = typeof args.action === "string" ? args.action : "unknown";
      const id = typeof args.id === "string" ? ` ${args.id}` : "";
      let text = theme.fg("toolTitle", theme.bold("beads ")) + theme.fg("muted", action) + theme.fg("accent", id);

      if (action === "comment" && typeof args.comment === "string" && args.comment.trim()) {
        const preview = args.comment.length > 80 ? args.comment.slice(0, 77) + "..." : args.comment;
        text += theme.fg("dim", ` — ${preview}`);
      }

      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Processing..."), 0, 0);
      }

      if (result.isError) {
        const details = (result.details ?? {}) as { stderr?: string; stdout?: string; command?: string };
        const summary = extractErrorSummary(details.stderr) ?? extractErrorSummary(details.stdout);

        let text = theme.fg("error", "✖ beads action failed");
        if (summary) {
          text += theme.fg("muted", ` — ${summary}`);
        }

        if (expanded) {
          if (details.command) {
            text += `\n${theme.fg("dim", details.command)}`;
          }
          if (details.stderr?.trim()) {
            text += `\n${theme.fg("dim", details.stderr)}`;
          }
          if (details.stdout?.trim()) {
            text += `\n${theme.fg("dim", details.stdout)}`;
          }
        }

        return new Text(text, 0, 0);
      }

      const details = (result.details ?? {}) as {
        action?: string;
        issueCount?: number;
        stdout?: string;
        commentText?: string;
        issueCard?: BrShowIssue;
      };
      const action = details.action ?? "action";
      const stdout = details.stdout ?? "";

      // Mini card for show/create
      if ((action === "show" || action === "create") && details.issueCard) {
        const prefix = action === "create" ? "Created " : "";
        const cardLines = formatIssueCard(details.issueCard);
        let text = theme.fg("success", "✓ ") + theme.fg("muted", `${prefix}${cardLines[0]}`);
        for (let i = 1; i < cardLines.length; i++) {
          text += "\n" + theme.fg("dim", `  ${cardLines[i]}`);
        }
        if (expanded) {
          const block = result.content.find((item) => item.type === "text");
          if (block && block.type === "text" && block.text.trim()) {
            text += `\n${theme.fg("dim", block.text)}`;
          }
        }
        return new Text(text, 0, 0);
      }

      let summary: string;
      if (action === "ready" && typeof details.issueCount === "number") {
        summary = details.issueCount === 0 ? "No ready issues" : `${details.issueCount} ready issue(s)`;
      } else {
        summary = summarizeActionResult(action, stdout);
      }

      let text = theme.fg("success", "✓ ") + theme.fg("muted", summary);

      if (action === "comment" && details.commentText) {
        const lines = details.commentText.split("\n");
        const preview = lines[0]!.length > 80 ? lines[0]!.slice(0, 77) + "..." : lines[0]!;
        text += "\n" + theme.fg("dim", `  "${preview}"${lines.length > 1 ? ` (+${lines.length - 1} lines)` : ""}`);
      }

      if (expanded) {
        const block = result.content.find((item) => item.type === "text");
        if (block && block.type === "text" && block.text.trim()) {
          text += `\n${theme.fg("dim", block.text)}`;
        }
      }

      return new Text(text, 0, 0);
    },
  });

  pi.registerCommand("beads", {
    description: "Interactive beads picker with quick issue actions",
    handler: async (args, ctx) => {
      const readyResult = await runBr(pi, ["ready", "--sort", "priority", "--json"]);
      if (readyResult.code !== 0) {
        commandOut(ctx, `beads ready failed: ${summarizeExecFailure(readyResult)}`, "error");
        return;
      }

      let issues = parseBrReadyJson(readyResult.stdout);
      const filter = args.trim().toLowerCase();
      if (filter) {
        issues = issues.filter((issue) => `${issue.id} ${issue.title}`.toLowerCase().includes(filter));
      }

      if (!ctx.hasUI) {
        if (!issues.length) {
          process.stdout.write("No ready issues.\n");
          return;
        }
        process.stdout.write(`${issues.map((issue) => `${issue.id} ${issue.title}`).join("\n")}\n`);
        return;
      }

      if (!issues.length) {
        ctx.ui.notify(filter ? `No ready issues match \"${filter}\".` : "No ready issues.", "info");
        return;
      }

      const labels = issues.map((issue) => formatIssueLabel(issue));
      const pickedLabel = await ctx.ui.select("Choose beads issue", labels);
      if (!pickedLabel) {
        return;
      }

      const index = labels.indexOf(pickedLabel);
      if (index < 0) {
        ctx.ui.notify("Issue selection failed.", "error");
        return;
      }
      const issue = issues[index];

      while (true) {
        const action = await ctx.ui.select(`Issue ${issue.id}: ${issue.title}`, [
          "Work on this issue",
          "Show details",
          "Add checkpoint comment",
          "Close issue",
          "Back",
        ]);

        if (!action || action === "Back") {
          return;
        }

        if (action === "Work on this issue") {
          const claim = await runBr(pi, ["update", issue.id, "--status", "in_progress"]);
          if (claim.code !== 0) {
            ctx.ui.notify(`Failed to claim ${issue.id}: ${summarizeExecFailure(claim)}`, "error");
            continue;
          }

          await refreshBeadsStatus(ctx);

          ctx.ui.setEditorText(
            [
              `Work on beads issue ${issue.id}: ${issue.title}`,
              "- Follow @test-driven-development",
              "- Verify with @verification-before-completion",
            ].join("\n"),
          );
          ctx.ui.notify(`Claimed ${issue.id}; prompt prefilled in editor.`, "info");
          return;
        }

        if (action === "Show details") {
          const details = await runBr(pi, ["show", issue.id]);
          if (details.code !== 0) {
            ctx.ui.notify(`Failed to show ${issue.id}: ${summarizeExecFailure(details)}`, "error");
            continue;
          }

          const keyLines = details.stdout
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 10)
            .join("\n");

          ctx.ui.notify(keyLines || `No details available for ${issue.id}.`, "info");
          continue;
        }

        if (action === "Add checkpoint comment") {
          const comment = await ctx.ui.editor(
            `Checkpoint comment for ${issue.id}`,
            "Progress update:\n-\n\nNext:\n-",
          );

          if (!comment?.trim()) {
            ctx.ui.notify("No comment added.", "warning");
            continue;
          }

          const commentResult = await runBr(pi, ["comments", "add", issue.id, comment]);
          if (commentResult.code !== 0) {
            ctx.ui.notify(`Failed to add comment: ${summarizeExecFailure(commentResult)}`, "error");
            continue;
          }

          ctx.ui.notify(`Added checkpoint comment to ${issue.id}.`, "info");
          continue;
        }

        if (action === "Close issue") {
          const reason = await ctx.ui.input(`Close reason for ${issue.id}`, "Verified: completed and tested");
          if (!reason?.trim()) {
            ctx.ui.notify("Close cancelled: reason is required.", "warning");
            continue;
          }

          const closeResult = await runBr(pi, ["close", issue.id, "--reason", reason]);
          if (closeResult.code !== 0) {
            ctx.ui.notify(`Failed to close ${issue.id}: ${summarizeExecFailure(closeResult)}`, "error");
            continue;
          }

          await refreshBeadsStatus(ctx);
          await maybeNudgeCommitAfterClose(ctx);

          ctx.ui.notify(`Closed ${issue.id}.`, "info");
          return;
        }
      }
    },
  });

  pi.registerCommand("beads-ready", {
    description: "Run br ready --sort priority",
    handler: async (_args, ctx) => {
      const result = await runBr(pi, ["ready", "--sort", "priority"]);
      if (result.code !== 0) {
        commandOut(ctx, `beads-ready failed: ${summarizeExecFailure(result)}`, "error");
        return;
      }

      commandOut(ctx, result.stdout.trim() || "No ready issues.", "info");
    },
  });

  pi.registerCommand("beads-status", {
    description: "Show beads stats, blocked issues, and in-progress issues",
    handler: async (_args, ctx) => {
      const stats = await runBr(pi, ["stats"]);
      const blocked = await runBr(pi, ["blocked"]);
      const inProgress = await runBr(pi, ["list", "--status", "in_progress"]);

      const lines: string[] = [];

      if (stats.code === 0) {
        lines.push("=== br stats ===", stats.stdout.trim() || "(empty)");
      } else {
        lines.push(`=== br stats (failed) ===`, summarizeExecFailure(stats));
      }

      if (blocked.code === 0) {
        lines.push("", "=== br blocked ===", blocked.stdout.trim() || "(none)");
      } else {
        lines.push("", "=== br blocked (failed) ===", summarizeExecFailure(blocked));
      }

      if (inProgress.code === 0) {
        lines.push("", "=== br list --status in_progress ===", inProgress.stdout.trim() || "(none)");
      } else {
        lines.push("", "=== br list --status in_progress (failed) ===", summarizeExecFailure(inProgress));
      }

      const hasError = stats.code !== 0 || blocked.code !== 0 || inProgress.code !== 0;
      commandOut(ctx, lines.join("\n"), hasError ? "warning" : "info");
    },
  });

  pi.registerCommand("beads-claim", {
    description: "Mark issue in_progress: /beads-claim <id>",
    handler: async (args, ctx) => {
      const id = args.trim();
      if (!id) {
        commandOut(ctx, "Usage: /beads-claim <id>", "warning");
        return;
      }

      const result = await runBr(pi, ["update", id, "--status", "in_progress"]);
      if (result.code !== 0) {
        commandOut(ctx, `Failed to claim ${id}: ${summarizeExecFailure(result)}`, "error");
        return;
      }

      await refreshBeadsStatus(ctx);
      commandOut(ctx, `Claimed ${id} (in_progress).`, "info");
    },
  });

  pi.registerCommand("beads-close", {
    description: "Close issue: /beads-close <id>",
    handler: async (args, ctx) => {
      const id = args.trim();
      if (!id) {
        commandOut(ctx, "Usage: /beads-close <id>", "warning");
        return;
      }

      let reason = "Verified: completed";
      if (ctx.hasUI) {
        const input = await ctx.ui.input(`Close reason for ${id}`, reason);
        if (!input?.trim()) {
          ctx.ui.notify("Close cancelled: reason is required.", "warning");
          return;
        }
        reason = input;
      }

      const result = await runBr(pi, ["close", id, "--reason", reason]);
      if (result.code !== 0) {
        commandOut(ctx, `Failed to close ${id}: ${summarizeExecFailure(result)}`, "error");
        return;
      }

      await refreshBeadsStatus(ctx);
      await maybeNudgeCommitAfterClose(ctx);
      commandOut(ctx, `Closed ${id}.`, "info");
    },
  });

  pi.registerCommand("beads-reset-reminder", {
    description: "Reset one-time beads context reminder",
    handler: async (_args, ctx) => {
      contextReminderShown = false;
      commandOut(ctx, "Beads context reminder reset.", "info");
    },
  });

  pi.registerShortcut("ctrl+b", {
    description: "Toggle beads mode on/off",
    handler: async (ctx) => {
      beadsEnabled = !beadsEnabled;
      shouldPrime = beadsEnabled;
      contextReminderShown = false;

      if (beadsEnabled && isBeadsProject) {
        cachedModeText = "";
      }

      await refreshBeadsStatus(ctx);
      ctx.ui.notify(`Beads mode ${beadsEnabled ? "enabled" : "disabled"}.`, "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const info = await runBr(pi, ["info", "--json"]);
    const sessionMode = parseBeadsSessionMode({ brInfoExitCode: info.code });

    isBeadsProject = sessionMode.isBeadsProject;
    beadsEnabled = sessionMode.beadsEnabled;
    shouldPrime = beadsEnabled;
    cachedModeText = "";

    if (!beadsEnabled) {
      setBeadsModeUiStatus(ctx);
      return;
    }

    await refreshBeadsStatus(ctx);
  });

  pi.on("session_before_compact", async () => {
    if (beadsEnabled) {
      shouldPrime = true;
    }
  });

  pi.on("before_agent_start", async () => {
    if (!beadsEnabled || !shouldPrime) {
      return;
    }

    shouldPrime = false;

    let resumeContext: string | undefined;
    const inProgress = await runBr(pi, ["list", "--status", "in_progress", "--sort", "updated_at", "--json"]);
    if (inProgress.code === 0) {
      const issues = parseBrReadyJson(inProgress.stdout);
      if (issues.length) {
        const showResult = await runBr(pi, ["show", issues[0]!.id, "--json"]);
        if (showResult.code === 0) {
          const detail = parseBrShowJson(showResult.stdout);
          if (detail) {
            resumeContext = buildResumeContext(detail);
          }
        }
      }
    }

    return {
      message: {
        customType: "beads-prime",
        content: buildBeadsPrimeMessage(resumeContext),
        display: false,
      },
    };
  });

  pi.on("tool_call", async (event) => {
    if (!beadsEnabled) {
      return;
    }

    if (event.toolName !== "bash") {
      return;
    }

    const input = event.input as { command?: unknown };
    const command = typeof input.command === "string" ? input.command : "";
    if (!isBrCloseCommand(command)) {
      return;
    }

    const status = await runGit(pi, ["status", "--porcelain"]);
    if (status.code !== 0) {
      return;
    }

    if (status.stdout.trim()) {
      return {
        block: true,
        reason: "Cannot run `br close` with uncommitted changes. Commit/stash first, then close the issue.",
      };
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (!beadsEnabled) {
      return;
    }

    const usage = ctx.getContextUsage();
    if (!usage) {
      return;
    }

    if (
      shouldShowContextReminder({
        usagePercent: usage.percent,
        thresholdPercent: 85,
        alreadyShown: contextReminderShown,
      })
    ) {
      contextReminderShown = true;

      const reminderText =
        `Context is at ${Math.round(usage.percent)}%. Checkpoint your current progress to the beads issue now, then run /compact.`;

      // Human sees it immediately
      ctx.ui.notify(reminderText, "warning");

      // Model sees it on the next turn so it can act
      pi.sendMessage(
        {
          customType: "beads-context-warning",
          content: reminderText,
          display: false,
        },
        { deliverAs: "followUp", triggerTurn: true },
      );
    }
  });
}

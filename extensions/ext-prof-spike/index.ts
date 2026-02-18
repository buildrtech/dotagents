import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  createProfilerState,
  summarizeByExtension,
  type ExtensionHandler,
  type ProfilerState,
  wrapHandler,
} from "./lib.ts";

type ExtensionLike = {
  path: string;
  handlers: Map<string, ExtensionHandler[]>;
};

type RunnerLike = {
  extensions: ExtensionLike[];
};

type PatchStatus = {
  patched: boolean;
  reason: string;
};

const GLOBAL_STATE_KEY = Symbol.for("ext-prof-spike.state");
const GLOBAL_PATCHED_KEY = Symbol.for("ext-prof-spike.patched");

type GlobalProfiler = typeof globalThis & {
  [GLOBAL_STATE_KEY]?: ProfilerState;
  [GLOBAL_PATCHED_KEY]?: boolean;
};

function globals(): GlobalProfiler {
  return globalThis as GlobalProfiler;
}

function setCurrentState(state: ProfilerState): void {
  globals()[GLOBAL_STATE_KEY] = state;
}

function getCurrentState(): ProfilerState | undefined {
  return globals()[GLOBAL_STATE_KEY];
}

function formatSummary(state: ProfilerState): string {
  const rows = summarizeByExtension(state);

  if (!rows.length) {
    return "No extension samples recorded yet.";
  }

  return rows
    .map((row) => `${row.extensionPath}  total=${row.totalMs.toFixed(1)}ms  calls=${row.calls}`)
    .join("\n");
}

function wrapRunnerHandlers(runner: RunnerLike): void {
  const state = getCurrentState();
  if (!state) return;

  for (const ext of runner.extensions) {
    for (const [eventType, handlers] of ext.handlers.entries()) {
      const wrapped = handlers.map((handler) =>
        wrapHandler({
          extensionPath: ext.path,
          eventType,
          handler,
          state,
        })
      );

      ext.handlers.set(eventType, wrapped);
    }
  }
}

async function patchRunnerPrototypeOnce(): Promise<PatchStatus> {
  const g = globals();
  if (g[GLOBAL_PATCHED_KEY]) {
    return { patched: false, reason: "already patched" };
  }

  let runnerModule: unknown;

  try {
    runnerModule = await import("@mariozechner/pi-coding-agent/dist/core/extensions/runner.js");
  } catch (error) {
    return {
      patched: false,
      reason: `runner import failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const ExtensionRunner = (runnerModule as { ExtensionRunner?: { prototype?: { bindCore?: unknown } } }).ExtensionRunner;
  if (!ExtensionRunner?.prototype || typeof ExtensionRunner.prototype.bindCore !== "function") {
    return { patched: false, reason: "ExtensionRunner.bindCore not found" };
  }

  const originalBindCore = ExtensionRunner.prototype.bindCore;

  ExtensionRunner.prototype.bindCore = function patchedBindCore(...args: unknown[]) {
    const result = originalBindCore.apply(this, args);

    try {
      wrapRunnerHandlers(this as unknown as RunnerLike);
    } catch {
      // Spike: swallow wrapper errors to avoid breaking normal extension flow.
    }

    return result;
  };

  g[GLOBAL_PATCHED_KEY] = true;
  return { patched: true, reason: "patched" };
}

export default async function extProfilerSpike(pi: ExtensionAPI) {
  const state = createProfilerState();
  setCurrentState(state);

  const patchStatus = await patchRunnerPrototypeOnce();

  pi.registerCommand("ext-prof", {
    description: "Show extension total handler runtime (ms)",
    handler: async (_args, ctx) => {
      const currentState = getCurrentState() ?? state;
      const text = [formatSummary(currentState), `patch: ${patchStatus.reason}`].join("\n");

      if (ctx.hasUI) {
        ctx.ui.notify(text, "info");
        return;
      }

      process.stdout.write(`${text}\n`);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!patchStatus.patched) {
      const warning = `ext-prof-spike inactive: ${patchStatus.reason}`;
      if (ctx.hasUI) {
        ctx.ui.notify(warning, "warning");
      } else {
        process.stdout.write(`${warning}\n`);
      }
    }
  });
}

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

const require = createRequire(import.meta.url);

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

function* walkUpDirectories(startDir: string): Generator<string> {
  let current = path.resolve(startDir);
  while (true) {
    yield current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function toPath(value: string): string {
  if (value.startsWith("file://")) {
    return fileURLToPath(value);
  }
  return value;
}

function resolveRunnerModuleUrl(): string {
  const candidates: string[] = [];

  const addCandidate = (candidatePath: string): string | undefined => {
    const normalized = path.resolve(candidatePath);
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
    if (existsSync(normalized)) {
      return normalized;
    }
    return undefined;
  };

  try {
    const pkgEntry = require.resolve("@mariozechner/pi-coding-agent");
    const found = addCandidate(path.join(path.dirname(pkgEntry), "core", "extensions", "runner.js"));
    if (found) return pathToFileURL(found).href;
  } catch {
    // fall through to additional discovery strategies
  }

  try {
    if (typeof import.meta.resolve === "function") {
      const resolved = import.meta.resolve("@mariozechner/pi-coding-agent");
      const pkgPath = toPath(resolved);
      const found = addCandidate(path.join(path.dirname(pkgPath), "core", "extensions", "runner.js"));
      if (found) return pathToFileURL(found).href;
    }
  } catch {
    // fall through to filesystem search
  }

  const seedDirs = [
    process.cwd(),
    process.argv[1] ? path.dirname(process.argv[1]) : undefined,
    path.dirname(process.execPath),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  for (const seed of seedDirs) {
    for (const dir of walkUpDirectories(seed)) {
      const found =
        addCandidate(path.join(dir, "node_modules", "@mariozechner", "pi-coding-agent", "dist", "core", "extensions", "runner.js")) ??
        addCandidate(path.join(dir, "lib", "node_modules", "@mariozechner", "pi-coding-agent", "dist", "core", "extensions", "runner.js")) ??
        addCandidate(path.join(dir, "dist", "core", "extensions", "runner.js"));

      if (found) {
        return pathToFileURL(found).href;
      }
    }
  }

  const scanned = candidates.length > 0 ? ` Scanned: ${candidates.join(", ")}` : "";
  throw new Error(`unable to locate core/extensions/runner.js.${scanned}`);
}

async function patchRunnerPrototypeOnce(): Promise<PatchStatus> {
  const g = globals();
  if (g[GLOBAL_PATCHED_KEY]) {
    return { patched: false, reason: "already patched" };
  }

  let runnerModule: unknown;

  try {
    runnerModule = await import(resolveRunnerModuleUrl());
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

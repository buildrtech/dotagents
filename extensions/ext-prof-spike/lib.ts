export type Sample = {
  extensionPath: string;
  eventType: string;
  ms: number;
  ok: boolean;
};

export type ProfilerState = {
  samples: Sample[];
};

export type ExtensionTotal = {
  extensionPath: string;
  totalMs: number;
  calls: number;
};

export type ExtensionHandler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;

const WRAPPED_HANDLER = Symbol.for("ext-prof-spike.wrapped-handler");

type WrappedHandler = ExtensionHandler & { [WRAPPED_HANDLER]?: true };

export function createProfilerState(): ProfilerState {
  return { samples: [] };
}

export function recordSample(state: ProfilerState, sample: Sample): void {
  state.samples.push(sample);
}

export function summarizeByExtension(state: ProfilerState): ExtensionTotal[] {
  const bucket = new Map<string, { totalMs: number; calls: number }>();

  for (const sample of state.samples) {
    const row = bucket.get(sample.extensionPath) ?? { totalMs: 0, calls: 0 };
    row.totalMs += sample.ms;
    row.calls += 1;
    bucket.set(sample.extensionPath, row);
  }

  return [...bucket.entries()]
    .map(([extensionPath, row]) => ({
      extensionPath,
      totalMs: row.totalMs,
      calls: row.calls,
    }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

export function wrapHandler(args: {
  extensionPath: string;
  eventType: string;
  handler: ExtensionHandler;
  state: ProfilerState;
  now?: () => number;
}): ExtensionHandler {
  const existing = args.handler as WrappedHandler;
  if (existing[WRAPPED_HANDLER]) {
    return args.handler;
  }

  const now = args.now ?? (() => performance.now());

  const wrapped: WrappedHandler = async function wrapped(event: unknown, ctx: unknown) {
    const start = now();
    let ok = false;

    try {
      const result = await args.handler.call(this, event, ctx);
      ok = true;
      return result;
    } finally {
      recordSample(args.state, {
        extensionPath: args.extensionPath,
        eventType: args.eventType,
        ms: Math.max(0, now() - start),
        ok,
      });
    }
  };

  wrapped[WRAPPED_HANDLER] = true;
  return wrapped;
}

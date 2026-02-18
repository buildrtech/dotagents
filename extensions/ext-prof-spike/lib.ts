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

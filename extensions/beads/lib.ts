export type TrackingMode = "stealth" | "git-tracked";

export type BrIssueSummary = {
  id: string;
  title: string;
  type?: string;
  priority?: number;
  status?: string;
};

export function parseBrInfoJson(_json: string): { mode: string; issueCount: number } | null {
  throw new Error("TODO");
}

export function parseBrReadyJson(_json: string): BrIssueSummary[] {
  throw new Error("TODO");
}

export function detectTrackingMode(_gitCheckIgnoreExitCode: number): TrackingMode {
  throw new Error("TODO");
}

export function isBrCloseCommand(_command: string): boolean {
  throw new Error("TODO");
}

export function shouldShowContextReminder(_args: {
  tokens: number;
  contextLimit: number;
  thresholdPct: number;
  alreadyShown: boolean;
}): boolean {
  throw new Error("TODO");
}

export function buildBeadsPrimeMessage(): string {
  throw new Error("TODO");
}

export function formatIssueLabel(_issue: BrIssueSummary): string {
  throw new Error("TODO");
}

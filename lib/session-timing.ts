interface TimingEntry {
  type: string;
  timestamp: string;
  message?: { role?: string };
}

export interface TurnTiming {
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

export function getTurnTiming(
  startedAt: number | null | undefined,
  endedAt: number | null | undefined,
): TurnTiming | undefined {
  if (
    typeof startedAt !== "number"
    || typeof endedAt !== "number"
    || !Number.isFinite(startedAt)
    || !Number.isFinite(endedAt)
    || endedAt < startedAt
  ) return undefined;

  return { startedAt, endedAt, durationMs: endedAt - startedAt };
}

export function getCompletedTurnTiming(
  entryTimestamps: ReadonlyArray<number | null | undefined>,
  startIndex: number,
  endExclusiveIndex: number,
  isLiveTail = false,
): TurnTiming | undefined {
  if (isLiveTail || endExclusiveIndex <= startIndex + 1) return undefined;
  return getTurnTiming(
    entryTimestamps[startIndex],
    entryTimestamps[endExclusiveIndex - 1],
  );
}

export function formatTurnDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "";
  if (durationMs < 1_000) return "<1s";

  const totalSeconds = Math.floor(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Estimate active wall-clock time from the append-only session log.
 *
 * Raw entries preserve compacted history and every executed branch exactly
 * once. Gaps ending at user messages are treated as human idle. User-initiated
 * bash entries are also boundaries because the log records only their finish
 * time, so counting the incoming gap could include arbitrary human idle.
 */
export function computeSessionTotalActiveMs(entries: readonly TimingEntry[]): number {
  let totalActiveMs = 0;
  let previousTimestamp: number | undefined;

  for (const entry of entries) {
    if (!isTimingEntry(entry.type)) continue;

    const timestamp = Date.parse(entry.timestamp);
    if (!Number.isFinite(timestamp)) continue;

    const role = entry.type === "message" ? entry.message?.role : undefined;
    if (role === "user" || role === "bashExecution") {
      previousTimestamp = timestamp;
      continue;
    }

    if (previousTimestamp !== undefined && timestamp > previousTimestamp) {
      totalActiveMs += timestamp - previousTimestamp;
    }
    previousTimestamp = timestamp;
  }

  return totalActiveMs;
}

function isTimingEntry(type: string): boolean {
  return type === "message"
    || type === "compaction"
    || type === "branch_summary"
    || type === "custom_message";
}

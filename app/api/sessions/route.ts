import { NextResponse } from "next/server";
import {
  attachSessionProjectInfo,
  listAllSessionsWithTimings,
  mergeSessionLists,
  type SessionListTimings,
} from "@/lib/session-reader";
import { getRpcSessionInfos, getRunningRpcSessionIds } from "@/lib/rpc-manager";

export const dynamic = "force-dynamic";

function formatDuration(durationMs: number): string {
  return Number.isFinite(durationMs) ? Math.max(0, durationMs).toFixed(1) : "0.0";
}

function sessionListServerTiming(timings: SessionListTimings, serializeMs: number): string {
  return [
    `catalogue;dur=${formatDuration(timings.catalogueMs)}`,
    `projects;dur=${formatDuration(timings.projectsMs)}`,
    `serialize;dur=${formatDuration(serializeMs)}`,
    `cache;desc="${timings.cache}"`,
  ].join(", ");
}

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("force") === "1";
    const persistedResult = await listAllSessionsWithTimings({ force });
    // Take runtime snapshots after any invalidation-triggered disk retry so the
    // response cannot combine a fresh catalogue with pre-retry live state.
    const runtimeSessions = await attachSessionProjectInfo(getRpcSessionInfos());
    const sessions = mergeSessionLists(persistedResult.sessions, runtimeSessions);
    const serializeStartedAt = performance.now();
    const response = NextResponse.json(
      { sessions, runningSessionIds: getRunningRpcSessionIds() },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (process.env.PI_WEB_SERVER_TIMING === "1") {
      response.headers.set(
        "Server-Timing",
        sessionListServerTiming(persistedResult.timings, performance.now() - serializeStartedAt),
      );
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

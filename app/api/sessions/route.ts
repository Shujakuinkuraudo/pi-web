import { NextResponse } from "next/server";
import { jsonResponse } from "@/lib/json-response";
import {
  attachSessionProjectInfo,
  getSessionListVersion,
  listAllSessionsWithTimings,
  listSessionSummariesWithTimings,
  mergeSessionLists,
  type SessionListTimings,
} from "@/lib/session-reader";
import {
  getCompletionNotificationSuppressedRpcSessionIds,
  getRpcSessionInfos,
  getRunningRpcSessionIds,
} from "@/lib/rpc-manager";
import { startServerPerf } from "@/lib/perf";

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
  const perf = startServerPerf("GET /api/sessions");
  try {
    const searchParams = new URL(req.url).searchParams;
    const force = searchParams.get("force") === "1";
    // `summary=1` serves header/stat metadata so the sidebar can paint without
    // waiting for every session transcript to be parsed.
    const summary = searchParams.get("summary") === "1";
    perf?.span("start");
    const persistedSessionsPromise = summary
      ? listSessionSummariesWithTimings()
      : listAllSessionsWithTimings({ force });
    // Capture before awaiting: mutations during the scan still require a later refresh.
    const sessionListVersion = getSessionListVersion();
    const [persistedResult, runtimeSessions] = await Promise.all([
      persistedSessionsPromise,
      attachSessionProjectInfo(getRpcSessionInfos()),
    ]);
    const sessions = mergeSessionLists(persistedResult.sessions, runtimeSessions);
    perf?.span("scan+projects");
    const serializeStartedAt = performance.now();
    const response = jsonResponse(
      req,
      {
        sessions,
        sessionListVersion,
        runningSessionIds: getRunningRpcSessionIds(),
        completionNotificationSuppressedSessionIds: getCompletionNotificationSuppressedRpcSessionIds(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    perf?.attach(response);
    if (process.env.PI_WEB_SERVER_TIMING === "1") {
      response.headers.append(
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

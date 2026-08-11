import { NextRequest, NextResponse } from "next/server";
import { getControllers } from "@/backend/controllers";
import { getServices } from "@/backend/services";
import { parseAuthFromRequest, viewerResponse } from "@/backend/api/route-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/live-channels
 *
 * Proxies the external live-stream system's channel list through the server so
 * the browser never talks to the foreign origin directly (avoids CORS) and the
 * upstream address stays server-only. When `viewer_access_mode` is "protected"
 * a valid session is required, mirroring the viewer layout's protection rules.
 *
 * @param request - The incoming GET request (used for session verification).
 * @returns `{ success: true, data: LiveChannel[] }`, or 401 in protected mode
 *          without a valid session.
 */
export async function GET(request: NextRequest) {
  const services = getServices();
  const settings = (await services.settings.getAllSettings()) as Record<string, unknown>;
  const mode = settings["viewer_access_mode"] ?? "public";
  if (mode === "protected" && !parseAuthFromRequest(request)) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  const { liveStream } = getControllers();
  const result = await liveStream.getChannels();
  return viewerResponse(result);
}

import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

/**
 * POST /api/search/rebuild
 *
 * Admin-only endpoint that triggers a full rebuild of the FTS5 search index.
 * Clears all existing entries and re-populates from `media_items`, including
 * denormalized genres and cast names.
 *
 * Requires admin authentication via `session_token` cookie or `Authorization: Bearer` header.
 */
export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    return toNextResponse(await c.search.rebuildIndex());
  } catch (error) {
    return handleRouteError(error);
  }
}

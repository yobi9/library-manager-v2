import { NextRequest } from "next/server";
import {
  requireAdmin,
  getQueryNumber,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

/**
 * Serves the persisted security events from the `security_events` table
 * (login failures, block/unblock actions) — the data source for the
 * "أحداث الأمان" box on the admin events page.
 *
 * GET returns the newest `limit` rows (default 50) joined with the acting
 * user's username, plus the total row count for pagination.
 *
 * Auth: requireAdmin — security events are only readable by admins.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const limit = getQueryNumber(request, "limit", 50) ?? 50;
    const offset = getQueryNumber(request, "offset", 0) ?? 0;

    const { events } = getControllers();
    return toNextResponse(await events.getSecurityEvents(limit, offset));
  } catch (error) {
    return handleRouteError(error);
  }
}

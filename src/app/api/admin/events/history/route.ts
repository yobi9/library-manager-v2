import { NextRequest } from "next/server";
import {
  requireAdmin,
  getQueryParam,
  getQueryNumber,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

/**
 * Serves the persisted admin events history from the `activities` table.
 *
 * GET returns the stored events (system + user/visitor) split into two groups
 * with per-group totals, so the events page can render the "أحداث النظام" and
 * "أحداث المستخدمين" sections without a second round-trip.
 *
 * DELETE permanently removes every row from `activities`.
 *
 * Auth: requireAdmin — only admins may read or clear the events history.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const type = getQueryParam(request, "type");
    const limit = getQueryNumber(request, "limit", 50) ?? 50;
    const offset = getQueryNumber(request, "offset", 0) ?? 0;

    const { events } = getControllers();
    return toNextResponse(await events.getHistory({ type, limit, offset }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);
    const { events } = getControllers();
    return toNextResponse(await events.clearHistory());
  } catch (error) {
    return handleRouteError(error);
  }
}

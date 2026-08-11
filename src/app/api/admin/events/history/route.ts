import { NextRequest } from "next/server";
import { getServices } from "@/backend/services";
import {
  requireAdmin,
  getQueryParam,
  getQueryNumber,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

const ENTITY_TYPES = new Set(["user", "visitor", "system"]);

type EntityType = "user" | "visitor" | "system";

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

    const services = getServices();
    const requestedType = type && ENTITY_TYPES.has(type) ? (type as EntityType) : undefined;

    // تجميع صريح: فلتر `type` يحدد محتوى الصندوقين بدقة (فارغ بدل `undefined`
    // الذي كان يُرجع كل الصفوف عند تمرير type=user أو type=visitor):
    // - بدون type     → system: [system]     ، user: [user, visitor]
    // - type=system   → system: [system]     ، user: [] (فارغ)
    // - type=user     → system: [] (فارغ)    ، user: [user, visitor]
    // - type=visitor  → system: [] (فارغ)    ، user: [visitor]
    const systemType: EntityType | undefined =
      requestedType === undefined || requestedType === "system" ? "system" : undefined;
    const userTypes: EntityType[] =
      requestedType === undefined || requestedType === "user"
        ? ["user", "visitor"]
        : requestedType === "visitor"
          ? ["visitor"]
          : [];

    const [systemRows, systemTotal, userRows, userTotal] = await Promise.all([
      systemType ? services.activity.getEvents(limit, offset, systemType) : Promise.resolve([]),
      systemType ? services.activity.countEvents(systemType) : Promise.resolve(0),
      userTypes.length > 0
        ? services.activity.getEvents(limit, offset, userTypes)
        : Promise.resolve([]),
      userTypes.length > 0 ? services.activity.countEvents(userTypes) : Promise.resolve(0),
    ]);

    return toNextResponse({
      success: true,
      status: 200,
      data: {
        system: systemRows,
        user: userRows,
        totals: { system: systemTotal, user: userTotal },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);
    const services = getServices();
    await services.activity.deleteAllEvents();
    return toNextResponse({ success: true, status: 200, data: { success: true } });
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  parseBody,
  buildContext,
  getQueryParam,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const c = getControllers();
    return toNextResponse(
      await c.report.getFiltered({
        reportType: getQueryParam(request, "reportType") ?? "",
        status: getQueryParam(request, "status") ?? "",
        libraryId: getQueryParam(request, "libraryId") ?? "",
        limit: getQueryParam(request, "limit") ?? "",
        offset: getQueryParam(request, "offset") ?? "",
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const context = buildContext(request);
    const c = getControllers();
    return toNextResponse(
      await c.report.create(body, {
        ip: context.ip,
        userAgent: context.userAgent,
      }),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  parseAuthFromRequest,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";
import type { ViewerContext } from "@/backend/services/view-service";

/**
 * يسجّل مشاهدة عنصر وسائط (من الزائر أو المستخدم المسجّل) من الملف `video-player`.
 *
 * @remarks يبني `ViewerContext` من الطلب: المستخدم عبر `parseAuthFromRequest`،
 * ومعرّف جلسة الزائر عبر هيدر `x-visitor-session-id` الذي يضعه الـ proxy
 * (مع سقوط على كعكة `visitor_session_id`). الرد يبقى `{ success: true }` حتى لو
 * فشل التسجيل — لا نكسر التشغيل بسبب فشل سجل المشاهدات.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const c = getControllers();
    const auth = parseAuthFromRequest(request);
    const viewer: ViewerContext = {
      headers: Object.fromEntries(request.headers) as Record<string, string | undefined>,
      user: auth ? { user_id: auth.userId, username: auth.username } : null,
      visitor_session_id:
        request.headers.get("x-visitor-session-id") ??
        request.cookies.get("visitor_session_id")?.value ??
        undefined,
    };
    return toNextResponse(await c.media.incrementView(viewer, id));
  } catch (error) {
    return handleRouteError(error);
  }
}

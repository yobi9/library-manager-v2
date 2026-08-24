import { NextRequest } from "next/server";
import {
  buildContext,
  parseBody,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

/**
 * POST /api/setup/admin — إنشاء أول حساب مدير (عام بلا مصادقة، لمرة واحدة).
 *
 * - الأمان: الخدمة ترفض النداء بـ 409 بعد وجود أي مستخدم (إعادة فحص داخل
 *   المعاملة)، لذا كون المسار عاماً لا يفتح باباً لتجاوز الصلاحيات.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await buildContext(request);
    const body = await parseBody(request);
    const result = await getControllers().setup.createFirstAdmin(body, ctx);
    return toNextResponse(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

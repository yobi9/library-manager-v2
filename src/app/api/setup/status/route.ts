import { NextRequest } from "next/server";
import {
  buildContext,
  toNextResponse,
  handleRouteError,
} from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

/**
 * GET /api/setup/status — حالة التهيئة الأولى (عام بلا مصادقة).
 *
 * - السبب: الصفحة يجب أن تعمل على تثبيت نظيف لا يوجد فيه أي مستخدم يمكن
 *   المصادقة عليه؛ الحالة نفسها غير حساسة (true/false مشتقة من عدد المستخدمين).
 */
export async function GET(request: NextRequest) {
  try {
    await buildContext(request);
    const result = await getControllers().setup.getStatus();
    return toNextResponse(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

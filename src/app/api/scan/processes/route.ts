import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { getControllers } from "@/backend/controllers";

/**
 * GET /api/scan/processes — قائمة حالات المسح لكل المكتبات النشطة.
 *
 * يستخدمه أدمن صفحة «العمليات الخلفية» لعرض حالة كل مكتبة (جارٍ المسح/متوقف/مكتمل...)
 * مع أزرار البدء/الإيقاف/الاستئناف، بقراءة `ScanState` الحية من `ScanOrchestrator`.
 *
 * @returns `{ rows, total }` بصيغة `ScanProcessRow`، أو خطأ 401/500.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const { scan } = getControllers();
    return toNextResponse(await scan.getProcesses());
  } catch (error) {
    return handleRouteError(error);
  }
}

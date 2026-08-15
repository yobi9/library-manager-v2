import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  toNextResponse,
  handleRouteError,
  parseBody,
} from "@/backend/api/route-helpers";

/**
 * POST /api/enrich/metadata/:id
 *
 * نقطة وصول مسؤولة تتلقى حمل نموذج التحرير اليدوي (يرسل العميل POST عبر
 * `use-admin-media.ts`) وتفوض إلى `updateMetadataManually`. أُضيفت بجانب PATCH
 * لأن واجهة الإدارة تستدعي `apiPost` — وبدونها يفشل الحفظ بـ 405 Method Not Allowed.
 *
 * يتطلب صلاحية مسؤول عبر كوكي `session_token` أو ترويسة `Authorization: Bearer`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    return toNextResponse(
      await getControllers().enrichment.updateMetadataManually(Number(id), body),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    return toNextResponse(
      await getControllers().enrichment.updateMetadataManually(Number(id), body),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

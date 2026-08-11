import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { requireAdmin, toNextResponse, handleRouteError, parseBody } from "@/backend/api/route-helpers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ approvalId: string }> }) {
  try {
    requireAdmin(request);
    const { approvalId } = await params;
    const body = await parseBody(request);
    return toNextResponse(await getControllers().enrichment.approveEnrichment(Number(approvalId), body));
  } catch (error) {
    return handleRouteError(error);
  }
}

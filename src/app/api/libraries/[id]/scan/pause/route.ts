import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { ScanController } from "@/backend/controllers/scan-controller";
import { getServices } from "@/backend/services";
import type { ScanOrchestrator } from "@/backend/scanner/scan-orchestrator";
import type { LibraryService } from "@/backend/services/library-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const s = getServices() as { scanner: ScanOrchestrator; library: LibraryService };
    const controller = new ScanController(s.scanner, s.library);
    return toNextResponse(await controller.pauseScan(id));
  } catch (error) {
    return handleRouteError(error);
  }
}

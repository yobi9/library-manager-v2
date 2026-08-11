import { NextRequest } from "next/server";
import { toNextResponse, requireAdmin, parseBody, handleRouteError } from "@/backend/api/route-helpers";
import { getServices } from "@/backend/services";
import type { LibraryMonitor } from "@/backend/scanner/LibraryMonitor";
import type { LibraryService } from "@/backend/services/library-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const body = await parseBody(request);
    const s = getServices() as { LibraryMonitor: LibraryMonitor; library: LibraryService };
    const libraryId = Number(id);
    const active = body["active"] as boolean;

    if (active) {
      await s.LibraryMonitor.watchLibrary(libraryId);
      await s.library.updateLibrary(libraryId, { is_watched: true } as Record<string, unknown>);
    } else {
      await s.LibraryMonitor.unwatchLibrary(libraryId);
      await s.library.updateLibrary(libraryId, { is_watched: false } as Record<string, unknown>);
    }

    return toNextResponse({
      success: true,
      message: active ? "Watcher enabled" : "Watcher disabled",
      status: 200,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

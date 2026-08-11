import { NextRequest } from "next/server";
import { requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { getServices } from "@/backend/services";
import { getEventBus } from "@/backend/services/event-bus";

const EVENTS = [
  "scan_started",
  "scan_completed",
  "scan_failed",
  "scan_paused",
  "scan_resumed",
  "scan_stopped",
  "scan_item",
  "scan_error",
] as const;

/** أحداث lifecycle تُبث فوراً؛ أما `scan_item` فيُثخّن لأن حالة التقدم لا تتغير لكل عنصر. */
const IMMEDIATE_EVENTS = new Set(["scan_started", "scan_completed", "scan_failed", "scan_paused", "scan_resumed", "scan_stopped", "scan_error"]);

/** الحد الأدنى للفاصل الزمني بين بثين متتاليين من أحداث العناصر. */
const PROGRESS_THROTTLE_MS = 500;

/**
 * SSE endpoint for real-time scan progress updates.
 * Subscribes to EventBus scan events and pushes full ScanProgress state
 * to the client as Server-Sent Events.
 *
 * @param query.libraryId - Optional: filter events for a specific library.
 * @returns Streaming response with Content-Type: text/event-stream.
 *
 * Events emitted:
 *   "progress"  — Full ScanProgress object from ScanOrchestrator.getProgress()
 *   "error"     — Error message string
 *   "connected" — Initial handshake on connection open
 *
 * Auth: requireAdmin — only admins can monitor scan progress.
 * Cleanup: Removes all EventBus subscriptions on client disconnect or close.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);

    const libraryIdParam = request.nextUrl.searchParams.get("libraryId");
    const libraryId = libraryIdParam ? Number(libraryIdParam) : null;

    const bus = getEventBus();
    const services = getServices();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const handlers: Array<() => void> = [];

        let lastSentAt = 0;
        let pendingTimer: NodeJS.Timeout | null = null;

        const clearPending = () => {
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            pendingTimer = null;
          }
        };

        const sendProgress = () => {
          try {
            let progress;
            if (libraryId) {
              progress = services.scanner.getProgress(libraryId);
            } else {
              // بدون libraryId نعرض تقدم الفحص الجاري الفعلي (أي مكتبة) حتى
              // يكتشف تحديثُ الصفحة مسحاً ما زال يعمل ولو بعد إعادة تحميل.
              progress = services.scanner.getActiveProgress() ?? {
                status: "idle" as const,
                libraryId: null,
              };
            }
            const msg = `event: progress\ndata: ${JSON.stringify(progress)}\n\n`;
            controller.enqueue(encoder.encode(msg));
          } catch {
            // scanner not available
          }
        };

        const onEvent = (eventName: string) => {
          // أحداث lifecycle تُبث فوراً؛ أحداث العناصر تُدمج في بث واحد على الأقل
          // كل 500ms حتى لا نغرق العميل بعشرات الرسائل لكل عنصر.
          if (!IMMEDIATE_EVENTS.has(eventName)) {
            const now = Date.now();
            const elapsed = now - lastSentAt;
            if (elapsed >= PROGRESS_THROTTLE_MS) {
              clearPending();
              lastSentAt = now;
              sendProgress();
              return;
            }
            if (!pendingTimer) {
              pendingTimer = setTimeout(() => {
                pendingTimer = null;
                lastSentAt = Date.now();
                sendProgress();
              }, PROGRESS_THROTTLE_MS - elapsed);
            }
            return;
          }
          clearPending();
          lastSentAt = Date.now();
          sendProgress();
        };

        sendProgress();

        for (const event of EVENTS) {
          const unsub = bus.on(event, () => onEvent(event));
          handlers.push(unsub);
        }

        const connectedMsg = `event: connected\ndata: {}\n\n`;
        controller.enqueue(encoder.encode(connectedMsg));

        request.signal.addEventListener("abort", () => {
          clearPending();
          for (const unsub of handlers) {
            unsub();
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

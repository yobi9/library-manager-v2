import { NextRequest } from "next/server";
import { requireAdmin, handleRouteError } from "@/backend/api/route-helpers";
import { getEventBus } from "@/backend/services/event-bus";

const EVENTS = [
  "enrichment_progress",
  "metadata_started",
  "metadata_completed",
  "media:changed",
  "media_updated",
  "media_deleted",
  "translation_progress",
  "system_alert",
  "user_view",
  "visitor_view",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "scan_paused",
  "scan_resumed",
  "scan_stopped",
  "scan_error",
] as const;

/**
 * SSE endpoint for real-time admin background-job events.
 *
 * Subscribes to the EventBus and pushes enrichment/translation progress and
 * media-change events to the admin client, so pages like /admin/items-control
 * can refresh lists automatically and show live progress without polling.
 *
 * @param query.none - No query params; stream is global to all admin sessions.
 * @returns Streaming response with Content-Type: text/event-stream.
 *
 * Events pushed (one SSE named-event per EventBus event):
 *   "enrichment_progress" — { sessionId, processed, percentage, successful, failed, ... }
 *   "metadata_started"    — { id, type, options }
 *   "metadata_completed"  — { id, success, ... } or { sessionId, ids, total, successful, failed }
 *   "media:changed"       — { id, libraryId? }
 *   "media_updated"       — { id, updates }
 *   "translation_progress" — { sessionId, processed, total, percentage, successful, failed }
 *   "system_alert"        — { type: "critical"|"warning"|"success", message } (ذاكرة/قاعدة بيانات)
 *   "user_view"           — { itemId, itemTitle, userId, username, entityType }
 *   "visitor_view"        — { itemId, itemTitle, deviceId, entityType }
 *   "connected"           — initial handshake
 *
 * Auth: requireAdmin — only admins can stream admin events.
 * Cleanup: all EventBus subscriptions are removed on client disconnect/close.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);

    const bus = getEventBus();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const handlers: Array<() => void> = [];

        for (const event of EVENTS) {
          const handler = (data?: unknown) => {
            try {
              const msg = `event: ${event}\ndata: ${JSON.stringify(data ?? {})}\n\n`;
              controller.enqueue(encoder.encode(msg));
            } catch {
              // client may have disconnected
            }
          };
          const unsub = bus.on(event, handler);
          handlers.push(unsub);
        }

        const connectedMsg = `event: connected\ndata: {}\n\n`;
        controller.enqueue(encoder.encode(connectedMsg));

        request.signal.addEventListener("abort", () => {
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

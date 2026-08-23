import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { parseAuthFromRequest, handleRouteError } from "@/backend/api/route-helpers";
import { resolveBlockedCertifications, shouldBlockMedia } from "@/backend/services/content-access-policy";
import { getServices } from "@/backend/services";

/** The image payload returned by the controller (raw bytes + MIME type). */
interface ImageData {
  buffer: Buffer;
  contentType: string;
}

/**
 * Builds a strong ETag from the exact bytes being served so browsers can
 * revalidate the image after a short `max-age` instead of caching a stale
 * placeholder for 24 hours.
 *
 * @param buffer - The image bytes to hash.
 * @returns A quoted SHA-1 ETag string (e.g. `"a1b2c3d4..."`).
 */
function buildEtag(buffer: Buffer): string {
  return `"${createHash("sha1").update(buffer).digest("hex")}"`;
}

/**
 * Determines whether an `If-None-Match` header indicates the client already
 * holds the current representation, in which case `304 Not Modified` is due.
 *
 * @param header - The raw `If-None-Match` header value, or null when absent.
 * @param etag - The current strong ETag.
 * @returns True when the conditional request should be answered with 304.
 */
function isNotModified(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header
    .split(",")
    .map((tag) => tag.trim())
    .some((tag) => tag === etag || tag.replace(/^W\//, "") === etag);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const typeParam = url.searchParams.get("type") ?? "poster";

    if (typeParam !== "person" && typeParam !== "library") {
      const auth = parseAuthFromRequest(request);
      const services = getServices();
      const settings = await services.settings.getAllSettings();
      const certFilter = resolveBlockedCertifications(auth, settings);
      if (certFilter.enabled) {
        const media = (await services.media.getMediaById(Number(id), auth ?? undefined)) as Record<string, unknown> | null;
        if (media && shouldBlockMedia(media["certification"] as string | null | undefined, certFilter)) {
          return new Response("Image not found", { status: 404 });
        }
      }
    }

    const opts: Record<string, string | null> = {
      w: url.searchParams.get("w"),
      h: url.searchParams.get("h"),
      q: url.searchParams.get("q"),
    };
    const c = getControllers();
    const result = await c.image.getImage(id, typeParam, opts);
    if (!result.success) {
      return new Response("Image not found", { status: 404 });
    }
    const image = result.data as ImageData;
    const etag = buildEtag(image.buffer);
    if (isNotModified(request.headers.get("if-none-match"), etag)) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag },
      });
    }
    const bytes = new Uint8Array(image.buffer);
    return new Response(bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=300",
        ETag: etag,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

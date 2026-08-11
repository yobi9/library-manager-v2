import { NextRequest } from "next/server";
import fs from "node:fs";
import { getControllers } from "@/backend/controllers";
import { toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

/**
 * File metadata produced by MediaController.getStreamTarget for the video player.
 * The route resolves the file path server-side from the database — never from
 * client input — so path traversal is not possible.
 */
interface StreamTarget {
  media_id: number;
  file_path: string;
  file_size: number;
  mime_type: string;
  duration: number | null;
  title: string;
}

/**
 * Builds a 416 Range Not Satisfiable response advertising the total file size.
 *
 * @param fileSize - Total size in bytes advertised in the Content-Range header.
 * @returns A 416 response with no body.
 */
function rangeNotSatisfiable(fileSize: number): Response {
  return new Response(null, {
    status: 416,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes */${fileSize}`,
    },
  });
}

/**
 * Converts a Node fs.ReadStream into a Web ReadableStream with backpressure and
 * abort handling.
 *
 * Unlike Node's Readable.toWeb(), this helper never closes the stream controller
 * after it has already been closed/errored by the consumer. The native adapter
 * closes the controller again from its internal `close` listener, throwing an
 * un-catchable ERR_INVALID_STATE ("Controller is already closed") whenever the
 * video player aborts a partially-consumed range request (nodejs/node#54205,
 * vercel/next.js#56286). This implementation prevents that by guarding every
 * controller call behind a `cancelled` flag and destroying the underlying source
 * on client cancel.
 *
 * @param source - The fs.ReadStream created by fs.createReadStream(path, { start, end }).
 * @returns A Web ReadableStream consuming `source` with pause/resume backpressure.
 */
function toWebReadable(source: fs.ReadStream): ReadableStream<Uint8Array> {
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      source.on("data", (chunk: string | Buffer) => {
        if (cancelled) return;
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          source.pause();
        }
      });
      source.on("end", () => {
        if (!cancelled) controller.close();
      });
      source.on("error", (err) => {
        if (!cancelled) controller.error(err);
      });
    },
    pull(controller) {
      if (cancelled) return;
      if (controller.desiredSize === null || controller.desiredSize > 0) {
        source.resume();
      }
    },
    cancel() {
      cancelled = true;
      source.destroy();
    },
  });
}

/**
 * Serves the media file referenced by `{ id }` with HTTP Range support so the
 * HTML5 `<video>` element can seek through the file.
 *
 * @param req - Incoming request; may carry a `Range: bytes=...` header.
 * @param params - Route params containing the numeric media id.
 * @returns 200 (full file) or 206 (partial) streaming response; 404 when the
 *          media/file is missing; 416 for malformed or out-of-bounds ranges.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await getControllers().media.getStreamTarget(id);
    if (!result.success || !result.data) return toNextResponse(result);

    const target = result.data as StreamTarget;
    const fileSize = target.file_size;
    const baseHeaders: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "Content-Type": target.mime_type,
      "Content-Length": String(fileSize),
    };

    const rangeHeader = req.headers.get("range");
    if (!rangeHeader) {
      const body = toWebReadable(fs.createReadStream(target.file_path));
      return new Response(body, { status: 200, headers: baseHeaders });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match) return rangeNotSatisfiable(fileSize);

    const [, rawStart, rawEnd] = match;
    const startText = rawStart ?? "";
    const endText = rawEnd ?? "";

    let start: number;
    let end: number;

    if (startText === "" && endText === "") return rangeNotSatisfiable(fileSize);

    if (startText === "") {
      // Suffix range: request the last N bytes of the file.
      const suffix = Number(endText);
      if (!Number.isFinite(suffix) || suffix <= 0) return rangeNotSatisfiable(fileSize);
      start = Math.max(fileSize - suffix, 0);
      end = fileSize - 1;
    } else {
      start = Number(startText);
      end = endText === "" ? fileSize - 1 : Number(endText);
      if (!Number.isFinite(start) || start >= fileSize || start > end) {
        return rangeNotSatisfiable(fileSize);
      }
      end = Math.min(end, fileSize - 1);
    }

    const contentLength = end - start + 1;
    const body = toWebReadable(fs.createReadStream(target.file_path, { start, end }));

    return new Response(body, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(contentLength),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

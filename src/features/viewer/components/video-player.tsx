//src\features\viewer\components\video-player.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Spinner } from "@/shared/components/ui/spinner";
import { useWatchProgress } from "@/features/viewer/hooks/use-watch-progress";

/**
 * MIME types browsers decode natively without plugins. Anything outside this
 * list (e.g. mkv/avi/wmv/flv) is treated as "not supported in the browser" and
 * offered as a download instead.
 */
const BROWSER_PLAYABLE = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/mp2t",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
]);

/** Maps a mime type to the file extension used for the download filename. */
const MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/mp2t": "ts",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/flac": "flac",
};

/** Internal playback state machine for the <video> element. */
type PlayerState = "loading" | "ready" | "error";

export interface VideoPlayerProps {
  id: string;
  title: string;
  mimeType?: string;
  fileSize?: number;
}

/** Formats seconds into an `m:ss` duration label. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/** Formats a byte count into a human-readable size label. */
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/**
 * Renders the HTML5 video player for a single media item, backed by the
 * range-capable `/api/media/:id/stream` endpoint, with fully client-side watch
 * progress resume stored in localStorage only (never sent to the server).
 *
 * @param id - Media id that maps to the stream endpoint.
 * @param title - Media title shown in the player footer.
 * @param mimeType - Detected file mime; drives the unsupported-format branch.
 * @param fileSize - Optional file size for the footer label.
 */
export function VideoPlayer({ id, title, mimeType, fileSize }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const positionRef = useRef({ time: 0, duration: 0 });
  const hasResumedRef = useRef(false);
  const endedRef = useRef(false);
  const viewSentRef = useRef(false);
  const [state, setState] = useState<PlayerState>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [showResume, setShowResume] = useState(false);

  const { resumeTime, savePosition, flushPosition, clearPosition } = useWatchProgress(id);

  const streamUrl = `/api/media/${id}/stream`;
  const unsupported =
    !!mimeType &&
    (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) &&
    !BROWSER_PLAYABLE.has(mimeType);
  const ext = (mimeType && MIME_TO_EXT[mimeType]) || "mp4";

  // Persist the final position when the component unmounts.
  useEffect(() => {
    return () => {
      if (!endedRef.current && positionRef.current.duration > 0) {
        flushPosition(positionRef.current.time, positionRef.current.duration);
      }
    };
  }, [flushPosition]);

  // Auto-seek to the saved resume position once metadata is loaded.
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const duration = video.duration;
    if (
      !hasResumedRef.current &&
      resumeTime > 0 &&
      Number.isFinite(duration) &&
      resumeTime < duration - 15
    ) {
      video.currentTime = resumeTime;
      setShowResume(true);
      window.setTimeout(() => setShowResume(false), 4000);
    }
    hasResumedRef.current = true;
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    const duration = video.duration;
    positionRef.current = { time, duration };
    if (Number.isFinite(duration) && duration > 0) savePosition(time, duration);
  };

  const handlePause = () => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    const duration = video.duration;
    positionRef.current = { time, duration };
    if (Number.isFinite(duration) && duration > 0) flushPosition(time, duration);
  };

  const handleEnded = () => {
    endedRef.current = true;
    clearPosition();
  };

  const retry = () => {
    setState("loading");
    setRetryKey((key) => key + 1);
  };

  /**
   * يُطلق نداء `POST /api/media/:id/view` مرة واحدة فقط لكل تركيب للمشغّل عند
   * بدء التشغيل الفعلي. السيرفر يضاعف الحماية عبر سقف 10 دقائق لكل مشاهد+عنصر،
   * لذا المحاولات/إعادة التركيب لا تسبب تسجيلاً مكرراً.
   *
   * @remarks `keepalive: true` يضمن وصول النداء حتى لو أُغلق المستخدم الصفحة،
   * والفشل صامت (catch) حتى لا يؤثر على التشغيل.
   */
  const sendView = () => {
    if (viewSentRef.current) return;
    viewSentRef.current = true;
    fetch(`/api/media/${id}/view`, { method: "POST", keepalive: true }).catch(() => {
      /* لا نكسر التشغيل لو فشل تسجيل المشاهدة */
    });
  };

  if (unsupported) {
    return (
      <div className="border-border/50 w-full overflow-hidden rounded-xl border bg-black">
        <div className="relative flex aspect-video items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-400" />
            <p className="text-base font-medium text-white">الصيغة غير مدعومة من المتصفح</p>
            <p className="text-sm text-white/60">
              {title} · {ext.toUpperCase()} {fileSize ? `· ${formatFileSize(fileSize)}` : ""}
            </p>
            <a
              href={streamUrl}
              download
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              <Download size={16} />
              تحميل الملف
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border/50 w-full overflow-hidden rounded-xl border bg-black">
      <div className="relative aspect-video">
        <video
          key={retryKey}
          ref={videoRef}
          src={streamUrl}
          controls
          autoPlay
          playsInline
          preload="metadata"
          className="h-full w-full"
          onLoadStart={() => setState("loading")}
          onCanPlay={() => {
            setState("ready");
            sendView();
          }}
          onError={() => setState("error")}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onEnded={handleEnded}
        />
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner />
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
            <p className="text-white">تعذّر تشغيل الفيديو</p>
            <Button variant="secondary" size="sm" onClick={retry}>
              <RefreshCw size={16} />
              إعادة المحاولة
            </Button>
            <a
              href={streamUrl}
              download
              className="text-sm text-white/60 underline-offset-4 hover:underline"
            >
              أو تحميل الملف
            </a>
          </div>
        )}
        {showResume && state === "ready" && (
          <div className="absolute right-3 bottom-16 rounded-full bg-black/75 px-3 py-1 text-xs text-white">
            استُئنفت المشاهدة من {formatTime(resumeTime)}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5">
        <span className="truncate text-sm text-white/70">{title}</span>
        <a
          href={streamUrl}
          download
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <Download size={15} />
          تحميل
        </a>
      </div>
    </div>
  );
}

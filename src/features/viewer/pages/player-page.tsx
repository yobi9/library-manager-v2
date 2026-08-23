"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useMediaById, useVideoCheck } from "@/lib/frontend/media-queries";
import { Spinner } from "@/shared/components/ui/spinner";
import { Button } from "@/shared/components/ui/button";
import { VideoPlayer } from "@/features/viewer/components/video-player";

interface Props {
  id: string;
}

/**
 * Player page for a single media item: orchestrates the media lookup, the
 * playability check, and renders the range-capable video player or the
 * appropriate empty/error state.
 *
 * @param id - Media id from the route params.
 */
export default function PlayerPage({ id }: Props) {
  const router = useRouter();
  const { data: media, isLoading } = useMediaById(id);
  const {
    data: videoCheck,
    isLoading: checkLoading,
    error: checkError,
    refetch,
  } = useVideoCheck(id);

  const title = media?.display_title ?? media?.title ?? media?.name ?? "";

  if (isLoading || checkLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Spinner />
      </div>
    );
  }

  if (checkError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center text-white">
          <AlertCircle className="h-12 w-12" />
          <p>تعذر التحقق من الفيديو</p>
          <p className="text-sm text-white/60">
            {checkError instanceof Error ? checkError.message : "خطأ غير معروف"}
          </p>
          <Button variant="default" onClick={() => void refetch()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (!videoCheck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-10 h-8 gap-1.5 px-2 text-white/70 hover:bg-white/10 hover:text-white"
      >
        <ArrowRight />
        رجوع
      </Button>

      {videoCheck.playable ? (
        <div className="w-full max-w-4xl">
          <VideoPlayer
            id={id}
            title={title}
            mimeType={videoCheck.mime_type}
            fileSize={videoCheck.file_size}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center text-white">
          <AlertCircle className="h-12 w-12" />
          <p>الفيديو غير متاح حالياً</p>
        </div>
      )}
    </div>
  );
}

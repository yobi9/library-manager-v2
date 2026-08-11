// src/features/viewer/pages/album-player-page.tsx

"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, ListMusic, Play } from "lucide-react";
import { useMediaById } from "@/lib/frontend/media-queries";
import type { MediaItem } from "@/lib/frontend/api-media";
import { getPosterUrl } from "@/lib/frontend/image-helpers";
import { translateMediaType } from "@/lib/frontend/translate";
import { AudioPlayer } from "@/features/viewer/components/audio-player/audio-player";
import type { AudioTrack } from "@/features/viewer/components/audio-player/types";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/shared/constants";

type AlbumMedia = MediaItem & { children?: MediaItem[] };

/**
 * يستخرج مقاطع الألبوم (`song`/`track`) من `children` كقائمة `AudioTrack`.
 *
 * - الهدف: تحويل استجابة `/api/media/{id}` (مع `children`) إلى قائمة تشغيل
 *   يفهمها `AudioPlayer` وصفوف قائمة المقاطع.
 * - الاستخدام: يُستدعى فقط داخل صفحة مشغّل الألبوم.
 *
 * @param album - الألبوم القادم من `useMediaById` (قد يكون غير محمّل بعد).
 * @returns مصفوفة مقاطع جاهزة للتشغيل (فارغة إذا غاب الألبوم أو لم يكن له أبناء).
 */
function toAudioTracks(album: AlbumMedia | undefined): AudioTrack[] {
  if (!album) return [];
  return (album.children ?? [])
    .filter((c) => c.type === "song" || c.type === "track")
    .map((c) => ({
      id: c.media_id ?? c.id ?? 0,
      title: c.display_title ?? c.title ?? c.name ?? "مقطع",
      type: c.type,
      year: c.year,
      rating: c.rating,
      duration: c.duration ?? c.runtime ?? undefined,
    }));
}

/**
 * تنسيق مدة مقطع (بالثواني) إلى صيغة `د:ث` (مثال: 4:05).
 *
 * @param seconds - مدة المقطع بالثواني.
 * @returns نص التنسيق، أو سلسلة فارغة عند غياب/عدم صلاحية المدة.
 */
function formatTrackTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TrackRowProps {
  index: number;
  track: AudioTrack;
  isActive: boolean;
  onSelect: (index: number) => void;
}

/**
 * صف مقطع في قائمة تشغيل الألبوم: رقم المقطع + العنوان + المدة.
 * المقطع النشط يُبرز بلون primary ويعرض أيقونة تشغيل بدل الرقم.
 *
 * @param index - ترتيب المقطع داخل القائمة.
 * @param track - بيانات المقطع.
 * @param isActive - هل هذا هو المقطع الجاري تشغيله حالياً.
 * @param onSelect - معرّف اختيار مقطع بالنقر.
 * @returns زر صف قابل للنقر.
 */
function TrackRow({ index, track, isActive, onSelect }: TrackRowProps) {
  const durationLabel = formatTrackTime(track.duration);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors",
        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
      )}
    >
      <span className="text-muted-foreground flex w-6 shrink-0 items-center justify-center text-sm tabular-nums">
        {isActive ? <Play size={14} className="text-primary" /> : index + 1}
      </span>
      <span className="line-clamp-1 flex-1 text-sm font-medium">{track.title}</span>
      {durationLabel && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{durationLabel}</span>
      )}
    </button>
  );
}

interface AlbumPlayerContentProps {
  album: AlbumMedia | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * محتوى صفحة مشغّل الألبوم بعد جاهزية البيانات.
 *
 * - الهدف: حمل حالة الفهرس النشط فقط، ويُعاد تركيب المكوّن بالكامل عند تغيير
 *   `key` من الأب (أي عند فتح ألبوم آخر) لإعادة ضبط الفهرس على أول مقطع
 *   بدون أي effect.
 * - يقدّم: ترويسة (غلاف/عنوان/نوع/سنة/عدد المقاطع) + قائمة مسارات +
 *   `AudioPlayer` مدمج يتحكم بالفهرس النشط.
 *
 * @param album - الألبوم القادم من `useMediaById`.
 * @param isLoading - حالة تحميل البيانات.
 * @param error - خطأ الجلب (إن وُجد).
 * @returns محتوى الصفحة (تحميل/خطأ/عرض كامل).
 */
function AlbumPlayerContent({ album, isLoading, error }: AlbumPlayerContentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const tracks = useMemo(() => toAudioTracks(album), [album]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="bg-muted h-112.5 w-75 animate-pulse rounded-2xl" />
        <div className="flex-1 space-y-4">
          <div className="bg-muted h-8 w-64 animate-pulse rounded" />
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
          <div className="bg-muted h-20 w-full animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <AlertCircle className="text-destructive h-12 w-12" />
        <p className="text-destructive">{error?.message ?? "غير موجود"}</p>
      </div>
    );
  }

  const title = album.display_title ?? album.title ?? album.name ?? "";
  const mediaId = album.media_id ?? album.id ?? 0;
  const posterUrl = getPosterUrl(mediaId);
  const libraryName = album.library_name;
  const libraryId = album.library_id ?? album.libraryId;
  const typeLabel = translateMediaType(album.type);

  return (
    <>
      <Breadcrumbs
        items={[
          ...(libraryName && libraryId
            ? [{ label: libraryName, href: `${ROUTES.ITEMS}/${String(libraryId)}` }]
            : [{ label: "الرئيسية", href: ROUTES.HOME }]),
          { label: title },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr] md:gap-8 lg:gap-12">
        <div className="mx-auto w-50 shrink-0 md:mx-0 md:w-65 lg:w-75">
          <div className="relative aspect-2/3 overflow-hidden rounded-2xl">
            {posterUrl ? (
              <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="bg-muted flex h-full w-full items-center justify-center">
                <ListMusic className="text-muted-foreground h-12 w-12" />
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
            {album.year != null && <Badge variant="outline">{album.year}</Badge>}
            {tracks.length > 0 && <Badge variant="outline">{tracks.length} مقطع</Badge>}
          </div>

          {tracks.length > 0 && (
            <>
              <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg">
                {tracks.map((track, index) => (
                  <TrackRow
                    key={String(track.id)}
                    index={index}
                    track={track}
                    isActive={index === currentIndex}
                    onSelect={setCurrentIndex}
                  />
                ))}
              </div>
              <AudioPlayer
                tracks={tracks}
                currentIndex={currentIndex}
                onTrackChange={setCurrentIndex}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * صفحة مشغّل الألبوم (Album Player) — Pattern C.
 *
 * - المسار: `/itemView/singer/{albumId}` عبر `ROUTES.ALBUM_PLAYER`.
 * - الهدف: عرض الألبوم كقائمة تشغيل (Playlist) مع مشغّل صوت مدمج داخل
 *   الصفحة. البيانات تُجلب عبر `useMediaById` دون أي API/نموذج جديد؛ الأغاني
 *   تُقرأ من `children` الخاصة بالألبوم.
 * - إعادة الضبط: يُمرَّر `key={albumId}` للمكوّن الداخلي فيُعاد تركيب
 *   حالته (الفهرس النشط) عند فتح ألبوم مختلف تلقائياً.
 *
 * @returns صفحة مشغّل الألبوم كاملة.
 */
export function AlbumPlayerPage() {
  const params = useParams<{ id: string | string[] }>();
  const albumId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: album, isLoading, error } = useMediaById(albumId);

  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
      <AlbumPlayerContent
        key={albumId}
        album={album as AlbumMedia | undefined}
        isLoading={isLoading}
        error={error ?? null}
      />
    </div>
  );
}

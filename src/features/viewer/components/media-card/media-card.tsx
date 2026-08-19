"use client";

import Link from "next/link";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildMediaUrl } from "@/lib/frontend/media-helpers";
import { translateMediaType, formatViews } from "@/lib/frontend/translate";
import { Clock, Eye } from "lucide-react";

interface MediaCardProps {
  id: string;
  type: string;
  title: string;
  posterUrl?: string | null;
  posterId?: string | number | null;
  rating?: number | null;
  year?: string | null;
  className?: string;
  certification?: string | null;
  duration?: number | null;
  views?: number | null;
  seasonsCount?: number | null;
  episodesCount?: number | null;
  genres?: string[];
  isNew?: boolean;
}

function getPosterUrl(id?: string | number | null): string | undefined {
  if (id === undefined || id === null || id === "") return undefined;
  return `/api/images/${id}?type=poster&w=300&h=450`;
}

/**
 * بطاقة وسائط تُستخدم في صفحة قائمة الأيتمات داخل المكتبة.
 *
 * - عند عدم التمرير: تُعرض شارة «جديد» (أو أول تصنيف) أعلى اليسار، والتقييم أعلى اليمين.
 * - عند التمرير: تُستبدل شارة «جديد»/أول تصنيف بشارة النوع أعلى اليسار، ويبقى التقييم
 *   ظاهراً أعلى اليمين، بينما تظهر التصنيفات والتفاصيل في منتصف الطبقة.
 *
 * @param props - خصائص البطاقة (المعرف، النوع، العنوان، الصورة، التقييم، السنة، التصنيفات...).
 * @returns رابط للعنصر يحوي الصورة والشارات وطبقة معلومات التمرير.
 */
export function MediaCard({
  id,
  type,
  title,
  posterUrl,
  posterId,
  rating,
  year,
  className,
  certification,
  duration,
  views,
  seasonsCount,
  episodesCount,
  genres = [],
  isNew,
}: MediaCardProps) {
  const resolvedPosterUrl = posterUrl ?? getPosterUrl(posterId ?? id);
  const typeLabel = translateMediaType(type) || type;

  return (
    <Link
      href={buildMediaUrl({ id, type }) as import("next").Route}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg transition-transform hover:scale-105",
        className,
      )}
    >
      {/* <div className="bg-muted border-border/60 shadow-card group-hover:border-primary/40 group-hover:shadow-hover relative aspect-2/3 overflow-hidden rounded-lg border transition-all duration-300"> */}
      <div className="bg-muted border-border/60 shadow-card group-hover:border-purple-500 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] dark:group-hover:border-purple-700 dark:group-hover:shadow-purple-500/30 relative aspect-2/3 overflow-hidden rounded-lg border transition-all duration-300">
        {resolvedPosterUrl ? (
          <img
            src={resolvedPosterUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
        )}

        {/* التقييم (أعلى اليمين) — يبقى ظاهراً عند التمرير */}
        {rating != null && rating > 0 && (
          <div className="absolute top-1 right-2 z-30">
            <Badge variant="default" className="bg-black/70 text-yellow-400 backdrop-blur-sm">
              ★ {rating.toFixed(1)}
            </Badge>
          </div>
        )}

        {/* الشارة العلوية (جديد أو أول تصنيف) أعلى اليسار — تُستبدل بشارة النوع عند التمرير */}
        <div className="absolute top-1 left-2 z-30 transition-opacity duration-300 group-hover:opacity-0">
          {isNew ? (
            <Badge className="bg-green-600 text-[10px] text-white">جديد</Badge>
          ) : (
            genres.length > 0 && (
              <Badge
                variant="outline"
                className="border-white/30 bg-black/60 text-[10px] text-white backdrop-blur-sm"
              >
                {genres[0]}
              </Badge>
            )
          )}
        </div>

        {/* طبقة معلومات إضافية تظهر عند التمرير */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-3 opacity-0 transition-opacity group-hover:opacity-100">
          {/* عرض التصنيفات (genres) */}
          {genres && genres.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {genres.slice(0, 4).map((genre) => (
                <span key={genre} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white">
                  {genre}
                </span>
              ))}
              {genres.length > 4 && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  +{genres.length - 4}
                </span>
              )}
            </div>
          )}

          {/* شارة النوع (تظهر عند التمرير فقط) أعلى اليسار */}
          {type && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-sm">
                {typeLabel}
              </Badge>
            </div>
          )}

          {/* تفاصيل إضافية */}
          <div className="flex flex-wrap justify-center gap-1 text-xs text-white/80">
            {certification && <span>{certification}</span>}
            {duration && duration > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock size={12} /> {duration}د
              </span>
            )}
            {seasonsCount && seasonsCount > 0 && <span>{seasonsCount} موسم</span>}
            {episodesCount && episodesCount > 0 && <span>{episodesCount} حلقة</span>}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1 px-1">
        <h3
          className="mt-3.75 line-clamp-1 text-sm leading-tight font-medium"
          style={{
            textShadow: "0 4px 3px rgba(0, 0, 0, 0.349)",
            marginTop: "15px",
          }}
        >
          {title}
        </h3>
        <div className="text-muted-foreground/45 mt-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-light">
            <Eye size={12} className="font-light text-red-500" /> {views ? formatViews(views) : "0"}
          </span>
          <span>{year || "[السنة]"}</span>
        </div>
      </div>
    </Link>
  );
}

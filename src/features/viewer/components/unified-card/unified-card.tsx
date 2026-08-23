"use client";

import React, { useMemo, useCallback } from "react";
import Link from "next/link";
import { Play, LinkIcon, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { buildMediaUrl } from "@/lib/frontend/media-helpers";
import { translateMediaType, formatDuration, formatViews } from "@/lib/frontend/translate";

export interface UnifiedCardProps {
  id: string;
  title: string;

  imageUrl?: string | null;
  year?: number | string | null;
  rating?: number | string | null;
  genres?: string[];
  isNew?: boolean;
  href?: string;
  mediaType?: string;
  mediaId?: number | string;
  views?: number;
  votes?: number;
  certification?: string;
  duration?: number | string;
  iconVariant?: "play" | "link";
  priority?: boolean;
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * بطاقة الوسائط الموحدة المستخدمة في معظم صفحات العارض (الصفحة الرئيسية، الجديد، المتابعة، التوصيات...).
 *
 * - عند عدم التمرير: شارة «جديد» (أو أول تصنيف إن لم تكن جديدة) أعلى اليسار، والتقييم أعلى اليمين.
 * - عند التمرير: تظهر طبقة داكنة تعرض زر التشغيل وشارة النوع والشهادة والتصنيفات في الشريط السفلي،
 *   بينما تبقى الشارات العلوية ظاهرة.
 *
 * @param props - خصائص البطاقة الموحدة (المعرف، العنوان، الصورة، السنة، التقييم، التصنيفات، نوع الوسائط...).
 * @returns عنصر رابط أو حاوية بسيطة وفق توفر `href`.
 */
export function UnifiedCard({
  id,
  title,
  imageUrl,
  year,
  rating,
  genres = [],
  isNew,
  href,
  mediaType,
  views,
  votes,
  certification: ageRating,
  duration,
  iconVariant = "link",
  priority = false,
  isSelected,
  className,
  onClick,
}: UnifiedCardProps) {
  const genresList = useMemo(() => {
    if (!Array.isArray(genres)) return [];
    return genres
      .map((g) => {
        if (typeof g === "string") return g;
        return "";
      })
      .filter((g) => g && g.trim() !== "");
  }, [genres]);

  const formattedRating = useMemo(() => {
    if (!rating || rating === 0 || rating === "0" || rating === "N/A") return null;
    return Number(rating).toFixed(1);
  }, [rating]);

  const formattedCert = useMemo(() => {
    if (!ageRating) return undefined;
    const str = String(ageRating).trim();
    return /^\d+$/.test(str) ? `${str}+` : str;
  }, [ageRating]);

  const typeLabel = translateMediaType(mediaType);
  const resolvedHref = href ?? (mediaType ? buildMediaUrl({ id, type: mediaType }) : undefined);

  const handlePlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onClick) onClick();
      else if (resolvedHref) window.location.href = resolvedHref;
    },
    [onClick, resolvedHref],
  );

  const cardContent = (
    <>
      {imageUrl ? (
        <div className="bg-muted border-border/60 shadow-card group-hover:shadow-hover group-hover:border-border-hover group-hover:border-2 relative aspect-2/3 overflow-hidden rounded-lg border transition-all duration-500 ease-in-out">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading={priority ? "eager" : "lazy"}
          />

          {/* لمعة سينمائية فوق البوستر — تظهر عند التحويم */}
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{ backgroundImage: "var(--poster-sheen)" }}
            aria-hidden="true"
          />

          <div className="absolute inset-e-1.5 top-1.5 z-40">
            {isNew ? (
              <Badge variant="new" className="text-[12px]">جديد</Badge>
            ) : (
              genresList.length > 0 && (
                <Badge variant="genre" className="text-[10px]">

                  {genresList[0]}
                </Badge>
              )
            )}
          </div>

          {formattedRating && (
            <Badge variant="rating" className="absolute inset-s-1.5 top-1.5 z-40 border-0 px-1.5  text-[10px] shadow-sm">
             
                {/* text-xs للهواتف، وتكبر إلى sm:text-sm للشاشات الأكبر */}
             <span className="text-rating-star text-xs sm:text-sm leading-none">★</span> {formattedRating}
  
            </Badge>
          )}

          <div className="from-overlay-scrim/80 via-overlay-scrim/50 to-overlay-scrim/85 absolute inset-0 z-30 flex flex-col items-center justify-center bg-linear-to-b p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-4">
            <Button
              variant="glass-play"
              size="icon"
              className="hover:scale-110"
              onClick={handlePlayClick}
              aria-label={iconVariant === "link" ? "فتح الرابط" : "تشغيل"}
            >
              {iconVariant === "link" ? (
                <LinkIcon size={14} />
              ) : (
                <Play size={14} className="fill-current" />
              )}
            </Button>

            <div className="border-overlay-chip/10 bg-overlay-scrim/60 absolute right-0 bottom-1 left-0 flex flex-col items-center gap-0.5 border-t px-1.5 py-1 backdrop-blur-sm sm:px-2 sm:py-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {typeLabel && (
                  <span className="border-chip-border bg-chip-bg text-chip-fg rounded-sm border px-1.5 py-0.5 text-[9px] font-bold shadow-md backdrop-blur-sm sm:px-2 sm:text-[10px]">
                    {typeLabel}
                  </span>
                )}
                {formattedCert && (
                  <span className="border-chip-border bg-chip-bg text-chip-fg rounded-sm border px-1.5 py-0.5 text-[9px] font-bold shadow-md backdrop-blur-sm sm:px-2 sm:text-[10px]">
                    {formattedCert}
                  </span>
                )}
              </div>

              {genresList.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 sm:gap-1">
                  {genresList.slice(0, 2).map((genre, idx) => (
                    <span
                      key={idx}
                      className="border-chip-border bg-chip-bg text-chip-fg rounded-sm border px-1 py-0.5 text-[8px] font-bold backdrop-blur-sm sm:px-1.5 sm:text-[10px]"
                    >
                      {genre}
                    </span>
                  ))}
                  {genresList.length > 2 && (
                    <span className="border-chip-border bg-chip-bg text-chip-fg/80 self-center rounded-sm border px-1 py-0.5 text-[8px] font-bold backdrop-blur-sm sm:px-1.5 sm:text-[10px]">
                      +{genresList.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="from-card to-card/50 border-border/60 shadow-card group-hover:shadow-hover group-hover:border-border-hover group-hover:border-2 relative flex aspect-2/3 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border bg-linear-to-br transition-all duration-500 ease-in-out sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            className="border-primary/40 bg-primary/20 rounded-xl hover:bg-primary/30 sm:h-12 sm:w-12"
            aria-label={iconVariant === "link" ? "فتح الرابط" : "تشغيل"}
          >
            {iconVariant === "link" ? (
              <LinkIcon size={16} className="text-foreground" />
            ) : (
              <Play size={16} className="text-foreground translate-x-0.5 fill-current" />
            )}
          </Button>
          <span className="text-foreground/50 line-clamp-1 px-1.5 text-center text-[9px] font-bold sm:px-2 sm:text-[10px]">
            {title}
          </span>
        </div>
      )}

      <div className="pt-1 sm:pt-1.5 mt-1.5  ">
        <h3 className="text-foreground group-hover:text-foreground line-clamp-1 text-[10px] font-bold transition-colors sm:text-xs"   dir="auto">
          {title}
        </h3>
    
<div className="text-muted-foreground mt-1.5 flex items-center justify-between text-[10px] font-bold sm:text-xs">
    {views !== undefined && views > 0 && (
      <span className="flex items-center gap-0.5 text-icon-subtle">
        <Eye size={8} className="sm:h-2.5 sm:w-2.5" /> {formatViews(views)}
     </span>
    )}
 <span className="text-text-subtle">{year || "[السنة]"}</span>
  </div>
     
      
      </div>
    </>
  );

  const wrapperClasses = cn(
    "group relative w-full mx-auto max-w-full ", 
    onClick && "cursor-pointer",
    className,
  );

  const cardClasses = cn(
    "bg-transparent border border-transparent rounded-lg transition-all duration-300 overflow-hidden",
    isSelected &&
      "ring-4 ring-ring ring-offset-2 ring-offset-background shadow-lg shadow-ring/25 scale-[1.02]",
  );
  if (resolvedHref) {
    return (
      <div className={wrapperClasses}>
        <Link href={resolvedHref as import("next").Route} className={cn(cardClasses, "block")}>
          {cardContent}
        </Link>
      </div>
    );
  }

  return (
    <div className={wrapperClasses} onClick={onClick}>
      <div className={cardClasses}>{cardContent}</div>
    </div>
  );
}

"use client";

import React, { useMemo, useCallback } from "react";
import Link from "next/link";
import { Play, LinkIcon, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
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
  certification?: string;
  duration?: number | string;
  iconVariant?: "play" | "link";
  priority?: boolean;
  isSelected?: boolean;
  className?: string;
  onClick?: () => void;
}

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
        <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-lg">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-110"
            loading={priority ? "eager" : "lazy"}
          />

          <div className="absolute inset-e-1.5 top-1.5 z-40">
            {isNew && <Badge className="bg-green-600 text-[10px] text-white">جديد</Badge>}
          </div>

          {formattedRating && (
            <Badge className="absolute inset-s-1.5 top-1.5 z-40 bg-yellow-500 text-[10px] text-white shadow-sm">
              ★ {formattedRating}
            </Badge>
          )}

          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-linear-to-b from-black/80 via-black/50 to-black/85 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-4">
            <div
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 border-yellow-500/50 bg-yellow-500/20 shadow-lg transition-all duration-300 hover:scale-110 hover:border-yellow-500 hover:bg-yellow-500/60 sm:h-10 sm:w-10"
              onClick={handlePlayClick}
              role="button"
              tabIndex={0}
              aria-label={iconVariant === "link" ? "فتح الرابط" : "تشغيل"}
            >
              {iconVariant === "link" ? (
                <LinkIcon size={14} className="text-white" />
              ) : (
                <Play size={14} className="fill-current text-white" />
              )}
            </div>

            <div className="absolute right-0 bottom-1 left-0 flex flex-col items-center gap-0.5 border-t border-white/10 bg-black/60 px-1.5 py-1 backdrop-blur-sm sm:px-2 sm:py-1.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {typeLabel && (
                  <span className="rounded-sm border border-white/20 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md backdrop-blur-sm sm:px-2 sm:text-[10px]">
                    {typeLabel}
                  </span>
                )}
                {formattedCert && (
                  <span className="rounded-sm border border-white/20 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md backdrop-blur-sm sm:px-2 sm:text-[10px]">
                    {formattedCert}
                  </span>
                )}
              </div>

              {genresList.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 sm:gap-1">
                  {genresList.slice(0, 2).map((genre, idx) => (
                    <span
                      key={idx}
                      className="rounded-sm border border-white/20 bg-black/70 px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm sm:px-1.5 sm:text-[10px]"
                    >
                      {genre}
                    </span>
                  ))}
                  {genresList.length > 2 && (
                    <span className="self-center rounded-sm border border-white/20 bg-black/70 px-1 py-0.5 text-[8px] font-bold text-white/80 backdrop-blur-sm sm:px-1.5 sm:text-[10px]">
                      +{genresList.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="from-card to-card/50 group-hover:border-primary/50 relative flex aspect-2/3 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-transparent bg-linear-to-br transition-all duration-300 sm:gap-2">
          <div
            className="bg-primary/20 border-primary/40 flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 sm:h-12 sm:w-12"
            role="button"
            tabIndex={0}
            aria-label={iconVariant === "link" ? "فتح الرابط" : "تشغيل"}
          >
            {iconVariant === "link" ? (
              <LinkIcon size={16} className="text-white" />
            ) : (
              <Play size={16} className="translate-x-0.5 fill-current text-white" />
            )}
          </div>
          <span className="text-foreground/50 line-clamp-1 px-1.5 text-center text-[9px] font-bold sm:px-2 sm:text-[10px]">
            {title}
          </span>
        </div>
      )}

      <div className="pt-1 sm:pt-1.5">
        <h3 className="text-foreground group-hover:text-foreground line-clamp-1 text-[10px] font-bold transition-colors sm:text-xs">
          {title}
        </h3>
        <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10px] font-bold sm:text-xs">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {year && <span>{year}</span>}
            {duration && (
              <span className="border-border/20 flex items-center gap-0.5 border-s ps-1 sm:gap-1 sm:ps-1.5">
                <Clock size={8} className="sm:h-2.5 sm:w-2.5" />{" "}
                {typeof duration === "number" ? formatDuration(duration) : duration}
              </span>
            )}
          </div>
          {views !== undefined && views > 0 && (
            <span className="flex items-center gap-0.5">
              <Eye size={8} className="sm:h-2.5 sm:w-2.5" /> {formatViews(views)}
            </span>
          )}
        </div>
      </div>
    </>
  );

  const wrapperClasses = cn(
    "group relative w-full mx-auto max-w-full",
    onClick && "cursor-pointer",
    className,
  );

  const cardClasses = cn(
    "bg-transparent border border-transparent",
    isSelected && "ring-2 ring-primary",
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

//src\features\viewer\components\episode-card.tsx
"use client";

import { Play } from "lucide-react";
import { getEpisodeStillUrl } from "@/lib/frontend/image-helpers";

interface EpisodeCardProps {
  title: string;
  episodeNumber: number;
  seasonNumber?: number;
  mediaId?: string | number;
  duration?: number;
  overview?: string;
  isActive?: boolean;
  priority?: boolean;
  onClick?: () => void;
}

export function EpisodeCard({
  title,
  episodeNumber,
  seasonNumber,
  mediaId,
  duration,
  overview,
  isActive,
  priority = false,
  onClick,
}: EpisodeCardProps) {
  const imageUrl = mediaId ? getEpisodeStillUrl(mediaId) : undefined;

  return (
    <div
      className={`group border-border bg-card hover:border-primary/20 relative flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg ${
        isActive ? "ring-primary/40 shadow-lg ring-1" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center">
            <Play className="h-8 w-8" />
          </div>
        )}

        <div className="bg-background/60 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          {onClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-full shadow-lg hover:scale-110"
              aria-label="تشغيل الحلقة"
            >
              <Play size={22} fill="currentColor" />
            </button>
          )}
        </div>

        <div className="absolute top-2 right-2">
          <span className="bg-primary text-primary-foreground rounded-md px-2 py-0.5 text-xs font-bold">
            {episodeNumber}
          </span>
        </div>

        {duration != null && duration > 0 && (
          <div className="bg-background/80 text-muted-foreground absolute bottom-2 left-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs backdrop-blur-sm">
            {duration} دقيقة
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-sm font-bold">{title}</h3>
        {seasonNumber != null && (
          <p className="text-muted-foreground text-xs">الموسم {seasonNumber}</p>
        )}
        {overview && <p className="text-muted-foreground line-clamp-2 text-xs">{overview}</p>}
      </div>
    </div>
  );
}

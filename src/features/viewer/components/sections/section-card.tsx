"use client";

import { useState } from "react";
import Link from "next/link";
import { LinkIcon, Folder } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { DEFAULT_IMAGES } from "@/shared/constants";
import { isItemNew } from "@/lib/frontend/media-helpers";
import { getArabicTypeName } from "@/lib/frontend/translate";
import {
  buildSectionLink,
  getSectionImageUrl,
  getSectionDisplayTitle,
} from "@/lib/frontend/section-helpers";
import type { Library } from "@/lib/frontend/api-media";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  section: Library;
  isSelected?: boolean;
}

export function SectionCard({ section, isSelected }: SectionCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = getSectionImageUrl(section);
  const src = imageUrl && !imgFailed ? imageUrl : DEFAULT_IMAGES.LIBRARY;
  const isNew = isItemNew(section.created_at ?? undefined);
  const displayTitle = getSectionDisplayTitle(section);

  return (
    <Link
      href={buildSectionLink(section) as import("next").Route}
      className={cn(
        "group block overflow-hidden rounded-lg border border-transparent bg-transparent transition-all duration-300 hover:scale-[1.02]",
        isSelected &&
          "ring-2 ring-ring ring-offset-2 ring-offset-background shadow-lg scale-[1.02]"
      )}
    >
      <div className="border-border/60 bg-muted shadow-card group-hover:border-ring/30 group-hover:shadow-hover relative aspect-2/3 overflow-hidden rounded-lg border transition-all duration-300">
        {src ? (
          <img
            src={src}
            alt={displayTitle}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => {
              if (imageUrl) setImgFailed(true);
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-linear-to-br from-muted to-muted/50 p-4 text-center">
            <Folder className="h-12 w-12 text-muted-foreground/40" />
            <span className="mt-2 text-xs font-medium text-muted-foreground/60 line-clamp-2">
              {displayTitle}
            </span>
          </div>
        )}

        {/* لمعة سينمائية فوق البوستر — تظهر عند التحويم */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ backgroundImage: "var(--poster-sheen)" }}
          aria-hidden="true"
        />

        {/* شارة العدد – محسّنة بظل وحد خفيف */}
        {section.media_count !== undefined && section.media_count > 0 && (
          <div className="bg-badge-count-bg text-badge-count-fg absolute inset-s-2 top-2 z-40 rounded-sm px-1.5 py-0.5 text-xs font-bold shadow-sm backdrop-blur-[2px]">
            {section.media_count}
          </div>
        )}

        {/* شارة جديد */}
        {isNew && (
          <div className="absolute top-1 left-2 z-40">
            <Badge variant="new" className="px-2 py-0.5 text-xs sm:text-sm font-bold shadow-sm">
              جديد
            </Badge>
          </div>
        )}

        {/* ======= الطبقة المظلمة المحسّنة – متطابقة مع UnifiedCard ======= */}
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-linear-to-b from-transparent via-overlay-scrim/40 to-overlay-scrim/80 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:p-4">
          
          {/* زر الرابط – بتقنية الزجاج (Glassmorphism) */}
          <Button
            variant="glass-play"
            size="icon"
            className="hover:scale-110"
            aria-label="فتح الرابط"
          >
            <LinkIcon size={18} />
          </Button>

          {/* شريط سفلي أنيق – مثل UnifiedCard */}
          <div className="border-overlay-chip/10 bg-overlay-scrim/50 absolute right-0 bottom-1 left-0 flex flex-col items-center gap-0.5 border-t px-1.5 py-1 backdrop-blur-sm sm:px-2 sm:py-1.5">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
              
              {/* شارة العدد */}
              <Badge
                variant="chip"
                className="border-chip-border rounded-full px-2 py-0.5 text-[9px] font-bold shadow-md sm:px-2.5 sm:text-[10px]"
              >
                {section.media_count || 0} عنصر
              </Badge>

              {/* شارة النوع (مترجمة) */}
              {section.type && (
                <Badge
                  variant="chip"
                  className="border-chip-border rounded-full px-2 py-0.5 text-[9px] font-bold shadow-md sm:px-2.5 sm:text-[10px]"
                >
                  {getArabicTypeName(section.type)}
                </Badge>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* العنوان – سطر واحد مع علامة حذف و hover كامل */}
      <div className="pt-1 sm:pt-1.5">
        <h3
          className="text-foreground group-hover:text-foreground/80 line-clamp-1 text-xs font-bold leading-tight transition-colors sm:text-sm overflow-hidden text-ellipsis"
          title={displayTitle}
        >
          {displayTitle}
        </h3>
      </div>
    </Link>
  );
}

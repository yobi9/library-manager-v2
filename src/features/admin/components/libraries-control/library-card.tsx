//src\features\admin\components\libraries-control\library-card.tsx

"use client";

import React, { useState } from "react";
import { Edit3, Trash2, RefreshCw, Star, EyeOff } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { DEFAULT_IMAGES } from "@/shared/constants";
import type { Library } from "@/lib/frontend/api-media";

export interface LibraryCardProps {
  library: Library;
  isContainer: boolean;
  isScanning: boolean;
  onCardClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onScan: () => void;
  onStopScan: () => void;
  onTogglePin: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  main: "حاوية رئيسية",
  linked: "اختصار",
  movie: "فيلم",
  series: "مسلسل",
  series_anime: "أنمي",
  series_sports: "رياضة",
  series_ramadan: "رمضان",
  series_tv: "برنامج تلفزيوني",
  series_deen: "ديني",
  series_kids: "أطفال",
  series_learn: "تعليمي",
  series_doc: "وثائقي",
  audio_deen: "صوتيات دينية", // أو "مكتبة دينية"
  theater: "مسرحية",
  Music: "صوتيات",
  photo: "صورة",
  book: "كتاب",
  app: "تطبيق",
  vidsSameFolder: "فيديوهات (مجلد)",
  audioSameFolder: "صوتيات (مجلد)",
  appsSameFolder: "تطبيقات (مجلد)",
  imagesSameFolder: "صور (مجلد)",
  booksSameFolder: "كتب (مجلد)",
};

export const LibraryCard = React.memo(function LibraryCard({
  library,
  isContainer,
  isScanning,
  onCardClick,
  onEdit,
  onDelete,
  onScan,
  onStopScan,
  onTogglePin,
}: LibraryCardProps) {
  const count = isContainer ? library.children_count : library.media_count;
  const pathCount = library.paths?.length ?? 0;
  const imageUrl = library.image || library.image_path || null;
  const typeLabel = TYPE_LABELS[library.type] ?? library.type;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className="group focus-visible:ring-ring from-bg-deep to-background relative h-44 w-full cursor-pointer overflow-hidden rounded-xl bg-linear-to-br opacity-80 transition-all duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:outline-none"
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
    >
      <img
        src={imageUrl && !imgFailed ? imageUrl : DEFAULT_IMAGES.LIBRARY}
        alt={library.name}
        className="absolute inset-0 h-full w-full object-cover opacity-45 transition-opacity group-hover:opacity-55"
        onError={() => {
          if (imageUrl) setImgFailed(true);
        }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-black/30" />

      {isScanning && (
        <div className="bg-info-bg absolute inset-x-0 top-0 z-10 h-1">
          <div className="bg-info h-full w-full animate-pulse rounded-full" />
        </div>
      )}

      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="bg-danger/80 text-danger-foreground hover:bg-danger flex h-7 w-7 items-center justify-center rounded-full shadow transition-transform hover:scale-110"
          aria-label="حذف"
        >
          <Trash2 size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="bg-success/80 text-success-foreground hover:bg-success flex h-7 w-7 items-center justify-center rounded-full shadow transition-transform hover:scale-110"
          aria-label="تعديل"
        >
          <Edit3 size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`flex h-7 w-7 items-center justify-center rounded-full shadow transition-transform hover:scale-110 ${
            library.is_pinned
              ? "bg-rating-star text-rating-star-foreground"
              : "bg-muted text-muted-foreground hover:bg-rating-star/20 hover:text-rating-star"
          }`}
          aria-label={library.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
        >
          <Star size={13} className={library.is_pinned ? "fill-current" : ""} />
        </button>
        {library.type !== "linked" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isScanning) onStopScan();
              else onScan();
            }}
            className="bg-info/80 text-info-foreground hover:bg-info flex h-7 w-7 items-center justify-center rounded-full shadow transition-transform hover:scale-110"
            aria-label={isScanning ? "إيقاف المسح" : "مسح"}
          >
            <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {pathCount > 0 && !isContainer && (
        <div className="text-text-on-media absolute top-2 right-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
          {pathCount} مسار
        </div>
      )}

      {/* حاوية واحدة موحدة تضم الاسم والشارات معاً في الجهة اليمنى السفلى */}
      <div className="absolute right-4 bottom-3 z-10 flex flex-col items-start gap-1.5">
        {/* 1. اسم المكتبة يظهر في الأعلى */}
        <h3 className="text-text-on-media text-base leading-tight font-bold drop-shadow-lg md:text-lg">
          {library.name}
          {count !== undefined && count > 0 && (
            <span className="text-rating-star me-1 text-sm font-normal">
              ({count.toLocaleString("ar-EG")})
            </span>
          )}
        </h3>

        {/* 2. شارات النوع تظهر تحته مباشرة */}
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          {isContainer && (
            <Badge
              variant="destructive"
              className="border-none px-3 py-0.5 text-[10px] font-extrabold"
            >
              رئيسي
            </Badge>
          )}
          <Badge variant="default" className="border-none px-3 py-0.5 text-[10px] font-extrabold">
            {typeLabel}
          </Badge>
          {library.hideSection && (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 border-none bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm"
            >
              <EyeOff size={10} /> مخفي
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
});

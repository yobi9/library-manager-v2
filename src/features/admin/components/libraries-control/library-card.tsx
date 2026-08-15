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
      className="group focus-visible:ring-ring relative h-44 w-full cursor-pointer overflow-hidden 
      rounded-xl bg-linear-to-br from-slate-800 to-slate-950  opacity-80
       transition-all duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:outline-none"
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

      <div className="absolute top-2 left-2   z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-danger/80 text-danger-foreground shadow transition-transform hover:scale-110 hover:bg-danger"
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
          className="flex h-7 w-7 items-center justify-center rounded-full bg-success/80 text-success-foreground shadow transition-transform hover:scale-110 hover:bg-success"
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
              ? "bg-rating-star text-white hover:bg-rating-star"
              : "bg-slate-500/60 text-white hover:bg-rating-star/70"
          }`}
          aria-label={library.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
        >
          <Star size={13} className={library.is_pinned ? "fill-white" : ""} />
        </button>
        {library.type !== "linked" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isScanning) onStopScan();
              else onScan();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-info/80 text-info-foreground shadow transition-transform hover:scale-110 hover:bg-info"
            aria-label={isScanning ? "إيقاف المسح" : "مسح"}
          >
            <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {pathCount > 0 && !isContainer && (
        <div className="absolute top-2 right-2  z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-text-on-media backdrop-blur-sm">
          {pathCount} مسار
        </div>
      )}

     {/* <div className="absolute bottom-4 right-4 z-10 flex flex-col items-start gap-2">
       <h3 className="text-base leading-tight font-bold text-white drop-shadow-lg md:text-lg">
          {library.name}
          {count !== undefined && count > 0 && (
            <span className="me-1 text-sm font-normal text-rating-star">
              ({count.toLocaleString("ar-EG")})
            </span>
          )}
        </h3>
      </div>

      <div className="absolute inset-x-0 bottom-2 z-10 flex flex-wrap items-center  justify-start gap-1.5 px-2">
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
    </div> */}


{/* حاوية واحدة موحدة تضم الاسم والشارات معاً في الجهة اليمنى السفلى */}
      <div className="absolute bottom-3 right-4 z-10 flex flex-col items-start gap-1.5">
        {/* 1. اسم المكتبة يظهر في الأعلى */}
        <h3 className="text-base leading-tight font-bold text-text-on-media drop-shadow-lg md:text-lg">
          {library.name}
          {count !== undefined && count > 0 && (
            <span className="me-1 text-sm font-normal text-rating-star">
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

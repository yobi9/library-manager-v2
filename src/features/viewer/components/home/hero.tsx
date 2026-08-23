//src\features\viewer\components\home\hero.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useMediaById } from "@/lib/frontend/media-queries";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { extractGenres } from "@/lib/frontend/media-helpers";
import { translateMediaType } from "@/lib/frontend/translate";
import { APP_NAME } from "@/shared/constants";
import { Play } from "lucide-react";
import type { PublicSettings } from "@/lib/frontend/api-media";

/**
 * قسم البطل في الصفحة الرئيسية: يعرض عناصر «الحصريات» بالتناوب تلقائياً
 * مع خلفية وبيانات الوسائط وزر تشغيل، واسم الموقع من الإعدادات أو `APP_NAME`.
 *
 * @param settings - إعدادات الموقع العامة (تتضمن قائمة الحصريات واسم الموقع).
 */
export function HomeHero({ settings }: { settings: PublicSettings }) {
  const exclusiveItems = Array.isArray(settings.exclusive_items) ? settings.exclusive_items : [];
  const [displayIdx, setDisplayIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const current = exclusiveItems[displayIdx];
  const mediaId = current?.media_id;

  const { data: details } = useMediaById(mediaId != null ? String(mediaId) : undefined);

  const backdropUrl = mediaId ? `/api/images/${mediaId}?type=backdrop&w=1920&h=1080` : null;

  const goTo = useCallback((index: number) => {
    setDisplayIdx(index);
  }, []);

  // مؤقّت ذاتي التعاقب: يعيد الجدولة عند كل تغيّر للمعروض (تشغيل تلقائي أو تنقل يدوي)،
  // ويتوقف عند عنصر واحد فقط دون أي استدعاء ذاتي داخل تعريف الدالة.
  useEffect(() => {
    if (exclusiveItems.length <= 1) return;
    timerRef.current = setTimeout(() => {
      setDisplayIdx((prev) => (prev + 1) % exclusiveItems.length);
    }, 7000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [displayIdx, exclusiveItems.length]);

  if (!current) {
    return (
      <section className="bg-background relative flex h-[60vh] min-h-100 items-center justify-center overflow-hidden">
        <img
          src="/assets/images/bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/40 to-transparent" />
        <div className="relative z-10 text-center">
          <h1 className="text-foreground mb-4 text-3xl font-bold md:text-5xl">
            {settings.site_title ?? APP_NAME}
          </h1>
          <p className="text-foreground/50 text-lg">
            {settings.site_description ?? "بوابتك لعالم الترفيه"}
          </p>
        </div>
      </section>
    );
  }

  const typeLabel = details?.type ?? current?.type ?? "عمل فني";
  const year = details?.year ?? "";
  const rating = Number(details?.rating ?? details?.imdb_rating ?? 0) || 0;
  const overview = details?.overview ?? current?.desc ?? current?.desc_ar ?? "";
  const isSeries = typeLabel.startsWith("series") || typeLabel === "season";
  const seasonsCount = details?.seasons_count ?? details?.seasonsCount ?? 0;
  const episodesCount = details?.episodes_count ?? details?.episodesCount ?? 0;
  const href = current?.href ?? `/itemView/${typeLabel}/${mediaId}`;

  const genres: string[] = extractGenres(details ?? {});

  return (
    <section
      className="bg-background relative flex h-[70vh] min-h-112.5 items-end overflow-hidden"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight")
          goTo((displayIdx - 1 + exclusiveItems.length) % exclusiveItems.length);
        if (e.key === "ArrowLeft") goTo((displayIdx + 1) % exclusiveItems.length);
      }}
    >
      <img
        src="/assets/images/bg.png"
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover opacity-30"
      />

      {backdropUrl && (
        <div
          key={String(mediaId)}
          className="absolute inset-0 z-10 transition-opacity duration-1000"
        >
          <img src={backdropUrl} alt="" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-r from-black/60 to-transparent" />
        </div>
      )}

      <div className="relative z-10 container mx-auto px-3 pb-28 sm:px-4 sm:pb-24 md:px-6 md:pb-20 lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="glass">{translateMediaType(typeLabel)}</Badge>
            {year && <Badge variant="glass">{year}</Badge>}
            {rating > 0 && (
              <Badge variant="rating">
                ★ {Number(rating).toFixed(1)}
              </Badge>
            )}
            {isSeries && seasonsCount > 0 && (
              <Badge variant="glass">{seasonsCount} مواسم</Badge>
            )}
            {isSeries && episodesCount > 0 && (
              <Badge variant="glass">{episodesCount} حلقات</Badge>
            )}
          </div>

          <h1
            className="text-foreground mb-4 text-4xl leading-tight font-bold sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ textShadow: "var(--hero-text-shadow)" }}
          >
            {current.title}
          </h1>

          {genres.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {genres.slice(0, 4).map((g) => (
                <Badge key={g} variant="genre" className="rounded-full px-3 py-1">
                  {g}
                </Badge>
              ))}
            </div>
          )}

          {overview && (
            <p className="text-foreground/60 mb-6 line-clamp-3 max-w-2xl text-sm leading-relaxed sm:text-base">
              {overview}
            </p>
          )}

          <div className="flex flex-wrap gap-4">
            <Button asChild variant="default" size="lg" className="rounded-full px-8 font-bold shadow-lg transition-all hover:scale-105 active:scale-95">
              <Link href={href as import("next").Route}>
                <Play size={18} />
                شاهد الآن
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {exclusiveItems.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-6">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goTo((displayIdx - 1 + exclusiveItems.length) % exclusiveItems.length)}
            className="text-foreground/40 hover:text-foreground/80 text-lg"
            aria-label="السابق"
          >
            ›
          </Button>
          <div className="flex gap-2">
            {exclusiveItems.map((_, i) => (
              <Button
                key={i}
                variant="ghost"
                onClick={() => goTo(i)}
                aria-label={`العنصر ${i + 1}`}
                className={`rounded-full p-0 transition-all duration-500 hover:bg-transparent ${
                  i === displayIdx
                    ? "h-1.5 w-8 bg-white"
                    : "h-1.5 w-1.5 bg-white/30 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => goTo((displayIdx + 1) % exclusiveItems.length)}
            className="text-foreground/40 hover:text-foreground/80 text-lg"
            aria-label="التالي"
          >
            ‹
          </Button>
        </div>
      )}

      <div className="from-background pointer-events-none absolute right-0 bottom-0 left-0 h-40 bg-linear-to-t to-transparent" />
    </section>
  );
}

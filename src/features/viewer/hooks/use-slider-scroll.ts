"use client";

import { useRef, useState, useCallback, useEffect, useSyncExternalStore } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

/**
 * يشتغل على تغيّر استعلام الوسائط `(pointer: coarse)` (شاشات اللمس).
 *
 * @param onStoreChange - مُنادٍ يُستدعى عند تغيّر نتيجة الاستعلام.
 * @returns دالة تنظيف تُزيل المستمع.
 */
function subscribeCoarsePointer(onStoreChange: () => void) {
  const mql = window.matchMedia(COARSE_POINTER_QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

/**
 * يقرأ اللقطة الحالية لاستعلام `(pointer: coarse)`.
 *
 * @returns `true` إذا كان الجهاز بشاشة لمس (coarse pointer).
 */
function getCoarsePointerSnapshot() {
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/**
 * Hook لإدارة تمرير شريط/شبكة العناصر:
 * يوفّر مرجع المسار، حالات إمكانية التمرير للخلف/للأمام، حالة التمرير بالفأرة،
 * وحالة الجهاز (لمس/غير لمس) للتحكم في إظهار الأسهم.
 *
 * @param mode - نمط العرض: `grid` أو `slider`.
 * @param itemCount - عدد العناصر (إعادة تقييم حالة التمرير عند تغيّره).
 * @returns كائن يحتوي على مرجع المسار وحالات التمرير ودوال التنقل.
 */
export function useSliderScroll(mode: "grid" | "slider", itemCount: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    () => false,
  );

  const getScrollDistance = useCallback(() => {
    const firstChild = trackRef.current?.querySelector<HTMLElement>("[class*='shrink-0']");
    if (!firstChild) return 300;
    const cardWidth = firstChild.offsetWidth;
    const gap = 8;
    return cardWidth + gap;
  }, []);

  const checkScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    if (maxScroll <= 2) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    const absScroll = Math.abs(scrollLeft);
    const absMax = Math.abs(maxScroll);

    const isAtStart = absScroll <= 2;
    const isAtEnd = absScroll >= absMax - 2;

    // في الـ RTL: السابق يظهر إن لم نكن في أقصى اليمين (البداية)، والتالي إن لم نكن في أقصى اليسار (النهاية)
    setCanScrollPrev(!isAtStart);
    setCanScrollNext(!isAtEnd);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || mode !== "slider") return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [mode, checkScroll, itemCount]);

  useEffect(() => {
    if (mode !== "slider") return;
    const timeout = setTimeout(checkScroll, 50);
    return () => clearTimeout(timeout);
  }, [mode, checkScroll, itemCount]);

  const scrollPrev = useCallback(() => {
    const distance = getScrollDistance();
    trackRef.current?.scrollBy({ left: distance, behavior: "smooth" });
  }, [getScrollDistance]);

  const scrollNext = useCallback(() => {
    const distance = getScrollDistance();
    trackRef.current?.scrollBy({ left: -distance, behavior: "smooth" });
  }, [getScrollDistance]);

  return {
    trackRef,
    canScrollPrev,
    canScrollNext,
    isHovered,
    setIsHovered,
    isMobile,
    scrollPrev,
    scrollNext,
  };
}

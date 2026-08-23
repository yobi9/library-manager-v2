 
//src\features\viewer\components\unified-media\unified-media.tsx
 "use client";

import React, { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/features/viewer/components/section-header";
import { UnifiedCard, type UnifiedCardProps } from "@/features/viewer/components/unified-card/unified-card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import type { MediaItem } from "@/lib/frontend/api-media";
import { useSliderScroll } from "../../hooks/use-slider-scroll";
 // استدعاء الهوك هنا (عدل المسار حسب مشروعك)

type UnifiedMediaSize = "xs" | "sm" | "md" | "lg" | "xl";

 // قبل
//const GRID_GAP = "gap-2 sm:gap-3";           // أفقي + عمودي = 8px/12px
const GRID_GAP = "gap-x-2 sm:gap-x-3 gap-y-4 sm:gap-y-6";

const GRID_RESPONSIVE = "grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))]";
const SLIDER_RESPONSIVE = "w-[clamp(120px,20vw,160px)]";

interface UnifiedMediaProps<T = MediaItem> {
  mode: "grid" | "slider";
  items?: T[];
  children?: React.ReactNode;
  title?: string | React.ReactNode;
  icon?: React.ReactNode;
  size?: UnifiedMediaSize;
  isLoading?: boolean;
  skeletonCount?: number;
  className?: string;
  fullWidth?: boolean;
  ariaLabel?: string;
  onItemClick?: (item: T) => void;
  renderItem?: (item: T, index: number) => React.ReactNode;
  mapItemToProps?: (item: T, mode: "grid" | "slider") => UnifiedCardProps;
}

function SliderSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      <div className={cn("flex", GRID_GAP, "overflow-hidden")}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function UnifiedMedia<T extends MediaItem = MediaItem>({
  mode,
  items,
  children,
  title,
  icon,
  size = "md",
  isLoading = false,
  skeletonCount = 8,
  className,
  fullWidth = false,
  ariaLabel,
  onItemClick,
  renderItem,
  mapItemToProps,
}: UnifiedMediaProps<T>) {
  const router = useRouter();

  const itemCount = useMemo(() => {
    if (children) return React.Children.toArray(children).length;
    return items?.length || 0;
  }, [children, items]);

  // استخدام الهوك المنفصل لإدارة التمرير والأسهم
  const {
    trackRef,
    canScrollPrev,
    canScrollNext,
    isHovered,
    setIsHovered,
    isMobile,
    scrollPrev,
    scrollNext,
  } = useSliderScroll(mode, itemCount);

  const defaultNavigate = useCallback(
    (item: T) => {
      const cardData = mapItemToProps?.(item, mode);
      if (cardData?.href) {
        router.push(cardData.href as import("next").Route);
      }
    },
    [router, mode, mapItemToProps]
  );

  const handleItemClick = useCallback(
    (item: T) => {
      if (onItemClick) onItemClick(item);
      else defaultNavigate(item);
    },
    [onItemClick, defaultNavigate]
  );

  const gridItems = useMemo(() => {
    if (!items || items.length === 0) return null;
    return items
      .map((item, idx) => {
        if (renderItem) {
          return <React.Fragment key={idx}>{renderItem(item, idx)}</React.Fragment>;
        }
        const cardData = mapItemToProps?.(item, "grid");
        if (!cardData?.id) return null;
        return (
          <UnifiedCard
            key={cardData.id}
            {...cardData}
            priority={idx < 4}
            iconVariant="link"
            onClick={() => handleItemClick(item)}
          />
        );
      })
      .filter(Boolean);
  }, [items, handleItemClick, renderItem, mapItemToProps]);

  const sliderItems = useMemo(() => {
    if (!items || items.length === 0) return null;
    return items
      .map((item, idx) => {
        if (renderItem) {
          return (
            <div key={idx} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
              <div className="py-1">{renderItem(item, idx)}</div>
            </div>
          );
        }
        const cardData = mapItemToProps?.(item, "slider");
        if (!cardData?.id) return null;
        return (
          <div key={cardData.id} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
            <div className="py-1">
              <UnifiedCard
                key={cardData.id}
                {...cardData}
                priority={idx < 3}
                iconVariant="link"
                onClick={() => handleItemClick(item)}
              />
            </div>
          </div>
        );
      })
      .filter(Boolean);
  }, [items, handleItemClick, renderItem, mapItemToProps]);

  const sliderChildren = useMemo(() => {
    if (!children) return null;
    return React.Children.map(children, (child, idx) => (
      <div key={idx} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
        {child}
      </div>
    ));
  }, [children]);

  if (isLoading) {
    if (mode === "slider") {
      return <SliderSkeleton count={skeletonCount} className={className} />;
    }
    return <GridSkeleton count={skeletonCount} className={className} />;
  }

  if (mode === "grid") {
    const content = gridItems || children;
    if (!content) return null;
    return (
      <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
        {gridItems}
        {children}
      </div>
    );
  }

  const sliderContent = sliderItems || sliderChildren;
  if (!sliderContent || (Array.isArray(sliderContent) && sliderContent.length === 0))
    return null;

  const breakoutCls = fullWidth ? "-mx-4 sm:-mx-8 md:-mx-12" : "";

  return (
    <div
      className={cn("group/slider relative mb-2", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {title && typeof title === "string" ? (
        <SectionHeader title={title} icon={icon} count={itemCount} />
      ) : (
        title
      )}
      <div className={cn("relative", breakoutCls)}>
        <div
          ref={trackRef}
          dir="rtl"
          role="region"
          aria-roledescription="carousel"
          aria-label={ariaLabel || (typeof title === "string" ? title : "محتوى متحرك")}
          className={cn(
            "scroll-snap-x flex snap-mandatory scrollbar-none overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden",
            GRID_GAP,
          )}
        >
          {sliderItems}
          {sliderChildren}
          <div className="h-px min-w-5 shrink-0 sm:min-w-10" />
        </div>

        {/* زر السابق (يمين) */}
        {canScrollPrev && (
          <Button
            variant="ghost"
            onClick={scrollPrev}
            className={cn(
              "absolute top-0 right-0 bottom-2 z-40 h-auto w-12 items-center justify-center rounded-none px-0 sm:w-14 md:w-16",
              "from-background via-background/80 bg-linear-to-l to-transparent",
              "text-primary transition-opacity duration-300 focus-visible:opacity-100 hover:bg-transparent",
              // الزر موجود دائماً، لكن نتحكم في الرؤية والتفاعل
              canScrollPrev
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none invisible",
              // إذا كان hover أو موبايل، نجعله ظاهراً (بشرط أن canScrollPrev == true)
              isHovered || isMobile ? "opacity-100" : "opacity-0",
            )}
            aria-label="السابق"
          >
            <span className="group/btn flex h-11 w-11 items-center justify-center rounded-full border-2 border-border/85 bg-background shadow-xl transition-all duration-300 hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground md:h-13 md:w-13">
              <ChevronRight size={26} className="transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </span>
          </Button>
        )}

        {/* زر التالي (يسار) */}
        {canScrollNext && (
          <Button
            variant="ghost"
            onClick={scrollNext}
            className={cn(
              "absolute top-0 bottom-2 left-0 z-40 h-auto w-12 items-center justify-center rounded-none px-0 sm:w-14 md:w-16",
              "from-background via-background/80 bg-linear-to-r to-transparent",
              "text-primary transition-opacity duration-300 focus-visible:opacity-100 hover:bg-transparent",
              isHovered || isMobile ? "opacity-100" : "opacity-0",
            )}
            aria-label="التالي"
          >
            <span className="group/btn flex h-11 w-11 items-center justify-center rounded-full border-2 border-border/85 bg-background shadow-xl transition-all duration-300 hover:scale-110 hover:border-primary hover:bg-primary hover:text-primary-foreground md:h-13 md:w-13">
              <ChevronLeft size={26} className="transition-transform duration-300 group-hover/btn:-translate-x-0.5" />
            </span>
          </Button>
        )}
      </div>
    </div>
  );
}
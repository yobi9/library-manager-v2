// "use client";

// import React, {
//   useMemo,
//   useCallback,
//   useRef,
//   useState,
//   useEffect,
//   useSyncExternalStore,
// } from "react";
// import { useRouter } from "next/navigation";
// import { ChevronRight, ChevronLeft } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { SectionHeader } from "@/shared/components/ui/section-header";
// import { UnifiedCard, type UnifiedCardProps } from "@/shared/components/ui/unified-card";
// import type { MediaItem } from "@/lib/frontend/api-media";

// type UnifiedMediaSize = "xs" | "sm" | "md" | "lg" | "xl";

// const COARSE_POINTER_QUERY = "(pointer: coarse)";

// /** اشتراك تحديثات الـ media query (لون يتغير عند انعكاس الشرط). */
// function subscribeToCoarsePointer(onChange: () => void): () => void {
//   const mql = window.matchMedia(COARSE_POINTER_QUERY);
//   mql.addEventListener("change", onChange);
//   return () => mql.removeEventListener("change", onChange);
// }

// /** قراءة الحالة الحالية لشرط المؤشر الخشن (تُستدعى في العميل فقط). */
// function getCoarsePointerSnapshot(): boolean {
//   return window.matchMedia(COARSE_POINTER_QUERY).matches;
// }

 

// const GRID_GAP = "gap-2 sm:gap-3";
// const GRID_RESPONSIVE = "grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))]";
// const SLIDER_RESPONSIVE = "w-[clamp(120px,20vw,160px)]";

// interface UnifiedMediaProps<T = MediaItem> {
//   mode: "grid" | "slider";
//   items?: T[];
//   children?: React.ReactNode;
//   title?: string | React.ReactNode;
//   icon?: React.ReactNode;
//   size?: UnifiedMediaSize;
//   isLoading?: boolean;
//   skeletonCount?: number;
//   className?: string;
//   fullWidth?: boolean;
//   onItemClick?: (item: T) => void;
//   renderItem?: (item: T, index: number) => React.ReactNode;
//   mapItemToProps?: (item: T, mode: "grid" | "slider") => UnifiedCardProps;
// }

// // function SliderSkeleton({ count, className }: { count: number; className?: string }) {
// //   return (
// //     <div className={cn("mb-6 sm:mb-8", className)}>
// //       <div className={cn("flex", GRID_GAP, "overflow-hidden")}>
// //         {Array.from({ length: count }).map((_, i) => (
// //           <div key={i} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
// //             <div className="bg-muted h-48 animate-pulse rounded-lg sm:h-56" />
// //           </div>
// //         ))}
// //       </div>
// //     </div>
// //   );
// // }
// import { Skeleton } from "@/shared/components/ui/skeleton"; // استيراد المكون

// function SliderSkeleton({ count, className }: { count: number; className?: string }) {
//   return (
//     <div className={cn("mb-6 sm:mb-8", className)}>
//       <div className={cn("flex", GRID_GAP, "overflow-hidden")}>
//         {Array.from({ length: count }).map((_, i) => (
//           <div key={i} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
//             <Skeleton className="aspect-2/3 w-full rounded-lg" />
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// // function GridSkeleton({ count, className }: { count: number; className?: string }) {
// //   return (
// //     <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
// //       {Array.from({ length: count }).map((_, i) => (
// //         <div key={i} className="bg-muted aspect-2/3 animate-pulse rounded-lg" />
// //       ))}
// //     </div>
// //   );
// // }
// function GridSkeleton({ count, className }: { count: number; className?: string }) {
//   return (
//     <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
//       {Array.from({ length: count }).map((_, i) => (
//         <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
//       ))}
//     </div>
//   );
// }
// export function UnifiedMedia<T extends MediaItem = MediaItem>({
//   mode,
//   items,
//   children,
//   title,
//   icon,
 
//   isLoading = false,
//   skeletonCount = 10,
//   className,
//   fullWidth = false,
//   onItemClick,
//   renderItem,
//   mapItemToProps,
// }: UnifiedMediaProps<T>) {
//   const router = useRouter();
//   const trackRef = useRef<HTMLDivElement>(null);
//   const [canScrollPrev, setCanScrollPrev] = useState(false);
//   const [canScrollNext, setCanScrollNext] = useState(false);
//   const [isHovered, setIsHovered] = useState(false);
//   const isMobile = useSyncExternalStore(
//     subscribeToCoarsePointer,
//     getCoarsePointerSnapshot,
//     () => false,
//   );

//   const itemCount = useMemo(() => {
//     if (children) return React.Children.count(children);
//     return items?.length || 0;
//   }, [children, items]);

//   const defaultNavigate = useCallback(
//     (item: T) => {
//       const cardData = mapItemToProps?.(item, mode);
//       if (cardData?.href) router.push(cardData.href as import("next").Route);
//     },
//     [router, mode, mapItemToProps],
//   );

//   const handleItemClick = useCallback(
//     (item: T) => {
//       if (onItemClick) onItemClick(item);
//       else defaultNavigate(item);
//     },
//     [onItemClick, defaultNavigate],
//   );

//   const checkScroll = useCallback(() => {
//     const el = trackRef.current;
//     if (!el) return;
//     const maxScroll = el.scrollWidth - el.clientWidth;
//     if (el.dir === "rtl") {
//       // في RTL: scrollLeft يبدأ من 0 (البداية) ويزيد سالباً نحو -maxScroll (النهاية).
//       setCanScrollPrev(el.scrollLeft < -1);
//       setCanScrollNext(el.scrollLeft > -maxScroll + 1);
//     } else {
//       // في LTR: scrollLeft من 0 نحو +maxScroll.
//       setCanScrollPrev(el.scrollLeft > 1);
//       setCanScrollNext(el.scrollLeft < maxScroll - 1);
//     }
//   }, []);

//   useEffect(() => {
//     const el = trackRef.current;
//     if (!el || mode !== "slider") return;
//     checkScroll();
//     el.addEventListener("scroll", checkScroll, { passive: true });
//     const ro = new ResizeObserver(checkScroll);
//     ro.observe(el);
//     return () => {
//       el.removeEventListener("scroll", checkScroll);
//       ro.disconnect();
//     };
//   }, [mode, checkScroll, items, children]);

//   const scrollPrev = useCallback(() => {
//     // في RTL (المسار مجبور dir="rtl"): للخلف يعني الاقتراب من البداية (scrollLeft نحو 0).
//     trackRef.current?.scrollBy({ left: 300, behavior: "smooth" });
//   }, []);

//   const scrollNext = useCallback(() => {
//     // في RTL: للأمام يعني الابتعاد عن البداية (scrollLeft سالب أكثر).
//     trackRef.current?.scrollBy({ left: -300, behavior: "smooth" });
//   }, []);

//   const gridItems = useMemo(() => {
//     if (!items || items.length === 0) return null;
//     return items
//       .map((item, idx) => {
//         if (renderItem) {
//           return <React.Fragment key={idx}>{renderItem(item, idx)}</React.Fragment>;
//         }
//         const cardData = mapItemToProps?.(item, "grid");
//         if (!cardData?.id) return null;
//         return (
//           <UnifiedCard
//             key={cardData.id}
//             {...cardData}
//             priority={idx < 4}
//             iconVariant="link"
//             onClick={() => handleItemClick(item)}
//           />
//         );
//       })
//       .filter(Boolean);
//   }, [items, handleItemClick, renderItem, mapItemToProps]);

//   const sliderItems = useMemo(() => {
//     if (!items || items.length === 0) return null;
//     return items
//       .map((item, idx) => {
//         if (renderItem) {
//           return (
//             <div key={idx} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
//               <div className="py-1">{renderItem(item, idx)}</div>
//             </div>
//           );
//         }
//         const cardData = mapItemToProps?.(item, "slider");
//         if (!cardData?.id) return null;
//         return (
//           <div key={cardData.id} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
//             <div className="py-1">
//               <UnifiedCard
//                 {...cardData}
//                 priority={idx < 3}
//                 iconVariant="link"
//                 onClick={() => handleItemClick(item)}
//               />
//             </div>
//           </div>
//         );
//       })
//       .filter(Boolean);
//   }, [items, handleItemClick, renderItem, mapItemToProps]);

//   const sliderChildren = useMemo(() => {
//     if (!children) return null;
//     return React.Children.map(children, (child, idx) => (
//       <div key={idx} className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}>
//         {child}
//       </div>
//     ));
//   }, [children]);

//   if (isLoading) {
//     if (mode === "slider") return <SliderSkeleton count={skeletonCount} className={className} />;
//     return <GridSkeleton count={skeletonCount} className={className} />;
//   }

//   if (mode === "grid") {
//     const content = gridItems || children;
//     if (!content) return null;
//     return (
//       <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
//         {gridItems}
//         {children}
//       </div>
//     );
//   }

//   // Slider mode
//   const sliderContent = sliderItems || sliderChildren;
//   if (!sliderContent || (Array.isArray(sliderContent) && sliderContent.length === 0)) return null;

//   const breakoutCls = fullWidth ? "-mx-4 sm:-mx-8 md:-mx-12" : "";

//   return (
//     <div
//       className={cn("group/slider relative mb-2", className)}
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={() => setIsHovered(false)}
//     >
//       {title && typeof title === "string" ? (
//         <SectionHeader title={title} icon={icon} count={itemCount} />
//       ) : (
//         title
//       )}
//       <div className={cn("relative", breakoutCls)}>
//         <div
//           ref={trackRef}
//           dir="rtl"
//           role="region"
//           aria-roledescription="carousel"
//           aria-label={typeof title === "string" ? title : "محتوى متحرك"}
//           className={cn(
//             "scroll-snap-x flex snap-mandatory scrollbar-none overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden",
//             GRID_GAP,
//           )}
//         >
//           {sliderItems}
//           {sliderChildren}
//           <div className="h-px min-w-5 shrink-0 sm:min-w-10" />
//         </div>

//         {canScrollPrev && (
//           <button
//             onClick={scrollPrev}
//             className={cn(
//               "absolute top-4 right-0 bottom-4 z-40 h-auto w-8 items-center justify-center rounded-none sm:w-12 md:w-16",
//               "from-background via-background/60 bg-linear-to-l to-transparent",
//               "text-primary transition-opacity duration-300 focus-visible:opacity-100",
//               isHovered || isMobile ? "opacity-100" : "opacity-0",
//             )}
//             aria-label="السابق"
//           >
//             <ChevronRight
//               size={20}
//               className="transition-transform hover:scale-125 sm:h-6 sm:w-6"
//             />
//           </button>
//         )}

//         {canScrollNext && (
//           <button
//             onClick={scrollNext}
//             className={cn(
//               "absolute top-4 bottom-4 left-0 z-40 h-auto w-8 items-center justify-center rounded-none sm:w-12 md:w-16",
//               "from-background via-background/60 bg-linear-to-r to-transparent",
//               "text-primary transition-opacity duration-300 focus-visible:opacity-100",
//               isHovered || isMobile ? "opacity-100" : "opacity-0",
//             )}
//             aria-label="التالي"
//           >
//             <ChevronLeft size={20} className="transition-transform hover:scale-125 sm:h-6 sm:w-6" />
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }

//  "use client";

// import React, {
//   useMemo,
//   useCallback,
//   useRef,
//   useState,
//   useEffect,
// } from "react";
// import { useRouter } from "next/navigation";
// import { ChevronRight, ChevronLeft } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { SectionHeader } from "@/shared/components/ui/section-header";
// import { UnifiedCard, type UnifiedCardProps } from "@/shared/components/ui/unified-card";
// import { Skeleton } from "@/shared/components/ui/skeleton";
// import type { MediaItem } from "@/lib/frontend/api-media";

// type UnifiedMediaSize = "xs" | "sm" | "md" | "lg" | "xl";

// const COARSE_POINTER_QUERY = "(pointer: coarse)";

// const GRID_GAP = "gap-2 sm:gap-3";
// const GRID_RESPONSIVE = "grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))]";
// // ✅ استعادة المرونة الأصلية
// const SLIDER_RESPONSIVE = "w-[clamp(120px,20vw,160px)]";

// interface UnifiedMediaProps<T = MediaItem> {
//   mode: "grid" | "slider";
//   items?: T[];
//   children?: React.ReactNode;
//   title?: string | React.ReactNode;
//   icon?: React.ReactNode;
//   size?: UnifiedMediaSize; // تُستخدم فقط في المستقبل، لكن لا تؤثر حالياً
//   isLoading?: boolean;
//   skeletonCount?: number;
//   className?: string;
//   fullWidth?: boolean;
//   ariaLabel?: string;
//   onItemClick?: (item: T) => void;
//   renderItem?: (item: T, index: number) => React.ReactNode;
//   mapItemToProps?: (item: T, mode: "grid" | "slider") => UnifiedCardProps;
// }

// function SliderSkeleton({
//   count,
//   className,
// }: {
//   count: number;
//   className?: string;
// }) {
//   return (
//     <div className={cn("mb-6 sm:mb-8", className)}>
//       <div className={cn("flex", GRID_GAP, "overflow-hidden")}>
//         {Array.from({ length: count }).map((_, i) => (
//           <div
//             key={i}
//             className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}
//           >
//             <Skeleton className="aspect-2/3 w-full rounded-lg" />
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// function GridSkeleton({
//   count,
//   className,
// }: {
//   count: number;
//   className?: string;
// }) {
//   return (
//     <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
//       {Array.from({ length: count }).map((_, i) => (
//         <Skeleton key={i} className="aspect-2/3 w-full rounded-lg" />
//       ))}
//     </div>
//   );
// }

// export function UnifiedMedia<T extends MediaItem = MediaItem>({
//   mode,
//   items,
//   children,
//   title,
//   icon,
//   size = "md",
//   isLoading = false,
//   skeletonCount = 8,
//   className,
//   fullWidth = false,
//   ariaLabel,
//   onItemClick,
//   renderItem,
//   mapItemToProps,
// }: UnifiedMediaProps<T>) {
//   const router = useRouter();
//   const trackRef = useRef<HTMLDivElement>(null);
//   const [canScrollPrev, setCanScrollPrev] = useState(false);
//   const [canScrollNext, setCanScrollNext] = useState(false);
//   const [isHovered, setIsHovered] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);

//   useEffect(() => {
//     const mql = window.matchMedia(COARSE_POINTER_QUERY);
//     const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
//     setIsMobile(mql.matches);
//     mql.addEventListener("change", handler);
//     return () => mql.removeEventListener("change", handler);
//   }, []);

//   const itemCount = useMemo(() => {
//     if (children) return React.Children.toArray(children).length;
//     return items?.length || 0;
//   }, [children, items]);

//   const defaultNavigate = useCallback(
//     (item: T) => {
//       const cardData = mapItemToProps?.(item, mode);
//       if (cardData?.href) {
//         router.push(cardData.href as import("next").Route);
//       }
//     },
//     [router, mode, mapItemToProps],
//   );

//   const handleItemClick = useCallback(
//     (item: T) => {
//       if (onItemClick) onItemClick(item);
//       else defaultNavigate(item);
//     },
//     [onItemClick, defaultNavigate],
//   );

//   const getScrollDistance = useCallback(() => {
//     const firstChild = trackRef.current?.querySelector<HTMLElement>("[class*='shrink-0']");
//     if (!firstChild) return 300;
//     const cardWidth = firstChild.offsetWidth;
//     const gap = 8;
//     return cardWidth + gap;
//   }, []);

//   const checkScroll = useCallback(() => {
//     const el = trackRef.current;
//     if (!el) return;

//     const isRTL = getComputedStyle(el).direction === "rtl";
//     const maxScroll = el.scrollWidth - el.clientWidth;

//     if (isRTL) {
//       const currentScroll = Math.abs(el.scrollLeft);
//       setCanScrollPrev(currentScroll > 1);
//       setCanScrollNext(currentScroll < maxScroll - 1);
//     } else {
//       setCanScrollPrev(el.scrollLeft > 1);
//       setCanScrollNext(el.scrollLeft < maxScroll - 1);
//     }
//   }, []);

//   useEffect(() => {
//     const el = trackRef.current;
//     if (!el || mode !== "slider") return;
//     checkScroll();
//     el.addEventListener("scroll", checkScroll, { passive: true });
//     const ro = new ResizeObserver(checkScroll);
//     ro.observe(el);
//     return () => {
//       el.removeEventListener("scroll", checkScroll);
//       ro.disconnect();
//     };
//   }, [mode, checkScroll]);

//   useEffect(() => {
//     if (mode !== "slider") return;
//     const timeout = setTimeout(checkScroll, 50);
//     return () => clearTimeout(timeout);
//   }, [items, children, mode, checkScroll]);

//   const scrollPrev = useCallback(() => {
//     const distance = getScrollDistance();
//     trackRef.current?.scrollBy({ left: distance, behavior: "smooth" });
//   }, [getScrollDistance]);

//   const scrollNext = useCallback(() => {
//     const distance = getScrollDistance();
//     trackRef.current?.scrollBy({ left: -distance, behavior: "smooth" });
//   }, [getScrollDistance]);

//   const gridItems = useMemo(() => {
//     if (!items || items.length === 0) return null;
//     return items
//       .map((item, idx) => {
//         if (renderItem) {
//           return <React.Fragment key={idx}>{renderItem(item, idx)}</React.Fragment>;
//         }
//         const cardData = mapItemToProps?.(item, "grid");
//         if (!cardData?.id) return null;
//         return (
//           <UnifiedCard
//             key={cardData.id}
//             {...cardData}
//             // ❌ لا تمرر size
//             priority={idx < 4}
//             iconVariant="link"
//             onClick={() => handleItemClick(item)}
//           />
//         );
//       })
//       .filter(Boolean);
//   }, [items, handleItemClick, renderItem, mapItemToProps]);

//   const sliderItems = useMemo(() => {
//     if (!items || items.length === 0) return null;
//     return items
//       .map((item, idx) => {
//         if (renderItem) {
//           return (
//             <div
//               key={idx}
//               className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}
//             >
//               <div className="py-1">{renderItem(item, idx)}</div>
//             </div>
//           );
//         }
//         const cardData = mapItemToProps?.(item, "slider");
//         if (!cardData?.id) return null;
//         return (
//           <div
//             key={cardData.id}
//             className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}
//           >
//             <div className="py-1">
//               <UnifiedCard
//                 {...cardData}
//                 // ❌ لا تمرر size
//                 priority={idx < 3}
//                 iconVariant="link"
//                 onClick={() => handleItemClick(item)}
//               />
//             </div>
//           </div>
//         );
//       })
//       .filter(Boolean);
//   }, [items, handleItemClick, renderItem, mapItemToProps]);

//   const sliderChildren = useMemo(() => {
//     if (!children) return null;
//     return React.Children.map(children, (child, idx) => (
//       <div
//         key={idx}
//         className={cn(SLIDER_RESPONSIVE, "shrink-0 snap-start")}
//       >
//         {child}
//       </div>
//     ));
//   }, [children]);

//   if (isLoading) {
//     if (mode === "slider") {
//       return <SliderSkeleton count={skeletonCount} className={className} />;
//     }
//     return <GridSkeleton count={skeletonCount} className={className} />;
//   }

//   if (mode === "grid") {
//     const content = gridItems || children;
//     if (!content) return null;
//     return (
//       <div className={cn("grid", GRID_RESPONSIVE, GRID_GAP, className)}>
//         {gridItems}
//         {children}
//       </div>
//     );
//   }

//   const sliderContent = sliderItems || sliderChildren;
//   if (!sliderContent || (Array.isArray(sliderContent) && sliderContent.length === 0))
//     return null;

//   const breakoutCls = fullWidth ? "-mx-4 sm:-mx-8 md:-mx-12" : "";

//   return (
//     <div
//       className={cn("group/slider relative mb-2", className)}
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={() => setIsHovered(false)}
//     >
//       {title && typeof title === "string" ? (
//         <SectionHeader title={title} icon={icon} count={itemCount} />
//       ) : (
//         title
//       )}
//       <div className={cn("relative", breakoutCls)}>
//         <div
//           ref={trackRef}
//           dir="rtl"
//           role="region"
//           aria-roledescription="carousel"
//           aria-label={ariaLabel || (typeof title === "string" ? title : "محتوى متحرك")}
//           className={cn(
//             "scroll-snap-x flex snap-mandatory scrollbar-none overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden",
//             GRID_GAP,
//           )}
//         >
//           {sliderItems}
//           {sliderChildren}
//           <div className="h-px min-w-5 shrink-0 sm:min-w-10" />
//         </div>

//         {canScrollPrev && (
//           <button
//             onClick={scrollPrev}
//             className={cn(
//               "absolute top-4 right-0 bottom-4 z-40 h-auto w-8 items-center justify-center rounded-none sm:w-12 md:w-16",
//               "from-background via-background/60 bg-linear-to-l to-transparent",
//               "text-primary transition-opacity duration-300 focus-visible:opacity-100",
//               isHovered || isMobile ? "opacity-100" : "opacity-0",
//             )}
//             aria-label="السابق"
//           >
//             {/* <ChevronRight size={28} className="transition-transform hover:scale-125 sm:h-6 sm:w-6" /> */}
//              {/* تم تكبير الدائرة إلى w-14 h-14 وزيادة سماكة الحدود وظلها */}
//           <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-background shadow-xl border-2 border-border/80 text-foreground group-hover/btn:scale-110 group-hover/btn:bg-primary group-hover/btn:text-primary-foreground group-hover/btn:border-primary transition-all duration-300">
//             <ChevronRight size={28} className="transition-transform duration-300 group-hover/btn:translate-x-0.5" />
//           </div>
//           </button>
//         )}

//         {canScrollNext && (
//           <button
//             onClick={scrollNext}
//             className={cn(
//               "absolute top-4 bottom-4 left-0 z-40 h-auto w-8 items-center justify-center rounded-none sm:w-12 md:w-16",
//               "from-background via-background/60 bg-linear-to-r to-transparent",
//               "text-primary transition-opacity duration-300 focus-visible:opacity-100",
//               isHovered || isMobile ? "opacity-100" : "opacity-0",
//             )}
//             aria-label="التالي"
//           >
//             {/* <ChevronLeft size={20} className="transition-transform hover:scale-125 sm:h-6 sm:w-6" /> */}
//              {/* تم تكبير الدائرة إلى w-14 h-14 وزيادة سماكة الحدود وظلها */}
//           <div className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-background shadow-xl border-2 border-border/80 text-foreground group-hover/btn:scale-110 group-hover/btn:bg-primary group-hover/btn:text-primary-foreground group-hover/btn:border-primary transition-all duration-300">
//             <ChevronLeft size={28} className="transition-transform duration-300 group-hover/btn:-translate-x-0.5" />
//           </div>
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }

 "use client";

import React, { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/features/viewer/components/section-header";
import { UnifiedCard, type UnifiedCardProps } from "@/features/viewer/components/unified-card/unified-card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { MediaItem } from "@/lib/frontend/api-media";
import { useSliderScroll } from "../../hooks/use-slider-scroll";
 // استدعاء الهوك هنا (عدل المسار حسب مشروعك)

type UnifiedMediaSize = "xs" | "sm" | "md" | "lg" | "xl";

const GRID_GAP = "gap-2 sm:gap-3";
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
          <button
            onClick={scrollPrev}
            className={cn(
              "absolute top-0 right-0 bottom-2 z-40 w-12 items-center justify-center sm:w-14 md:w-16 flex",
              "from-background via-background/80 bg-linear-to-l to-transparent",
              "text-primary transition-opacity duration-300 focus-visible:opacity-100",
                // الزر موجود دائماً، لكن نتحكم في الرؤية والتفاعل
    canScrollPrev ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none invisible",
    // إذا كان hover أو موبايل، نجعله ظاهراً (بشرط أن canScrollPrev == true)
              isHovered || isMobile ? "opacity-100" : "opacity-0",
            )}
            aria-label="السابق"
          >
            <div className="group/btn flex items-center justify-center w-11 h-11 md:w-13 md:h-13 rounded-full bg-background shadow-xl border-2 border-border/85 text-foreground hover:scale-110 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300">
              <ChevronRight size={26} className="transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </div>
          </button>
        )}

        {/* زر التالي (يسار) */}
        {canScrollNext && (
          <button
            onClick={scrollNext}
            className={cn(
              "absolute top-0 bottom-2 left-0 z-40 w-12 items-center justify-center sm:w-14 md:w-16 flex",
              "from-background via-background/80 bg-linear-to-r to-transparent",
              "text-primary transition-opacity duration-300 focus-visible:opacity-100",
              
              isHovered || isMobile ? "opacity-100" : "opacity-0",
            )}
            aria-label="التالي"
          >
            <div className="group/btn flex items-center justify-center w-11 h-11 md:w-13 md:h-13 rounded-full bg-background shadow-xl border-2 border-border/85 text-foreground hover:scale-110 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300">
              <ChevronLeft size={26} className="transition-transform duration-300 group-hover/btn:-translate-x-0.5" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
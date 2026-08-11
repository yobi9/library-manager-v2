// // // "use client";

// // // import React from "react";
// // // import { cn } from "@/lib/utils";
// // // import { ChevronLeft } from "lucide-react";

// // // interface SectionHeaderProps {
// // //   title?: string;
// // //   icon?: React.ReactNode;
// // //   count?: number;
// // //   action?: { label: string; onClick: () => void };
// // //   variant?: "default" | "hero" | "compact";
// // //   className?: string;
// // //   isLoading?: boolean;
// // // }

// // // export function SectionHeader({
// // //   title,
// // //   icon,
// // //   count,
// // //   action,
// // //   variant = "default",
// // //   className,
// // //   isLoading = false,
// // // }: SectionHeaderProps) {
// // //   if (isLoading) {
// // //     return (
// // //       <div className={cn("mb-1 w-full", className)}>
// // //         <div className="flex items-center gap-3 pb-2">
// // //           <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
// // //         </div>
// // //         <div className="bg-muted/30 h-px w-full" />
// // //       </div>
// // //     );
// // //   }

// // //   return (
// // //     <div className={cn("mb-3.75 w-full", className)}>
// // //       <div className="flex items-center justify-between gap-3 pb-2">
// // //         <div className="flex items-center gap-2">
// // //           {icon && <div className="flex items-center">{icon}</div>}

// // //           <h2
// // //             className={cn(
// // //               "text-foreground inline-flex items-end font-bold tracking-tight",
// // //               variant === "hero"
// // //                 ? "text-xl sm:text-2xl md:text-3xl"
// // //                 : "text-sm sm:text-lg md:text-xl",
// // //             )}
// // //           >
// // //             {title}
// // //           </h2>
// // //           <span className="text-destructive ms-2 text-xl leading-none sm:text-2xl md:text-3xl">
// // //             •
// // //           </span>
// // //         </div>

// // //         <div className="flex items-center gap-2">
// // //           {count !== undefined && count > 0 && (
// // //             <span className="text-muted-foreground bg-card border-border rounded-full border px-2 py-0.5 text-xs font-bold">
// // //               {count}
// // //             </span>
// // //           )}

// // //           {action && (
// // //             <button
// // //               onClick={action.onClick}
// // //               className="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-xs transition-all hover:gap-1"
// // //             >
// // //               {action.label}
// // //               <ChevronLeft size={14} />
// // //             </button>
// // //           )}
// // //         </div>
// // //       </div>

// // //       <div className="bg-border/10 mx-auto h-0.75 w-[100%]" />
// // //     </div>
// // //   );
// // // }


// // // src/shared/components/ui/section-header.tsx

// // // "use client";

// // // import React from "react";
// // // import { cn } from "@/lib/utils";
// // // import { ChevronLeft } from "lucide-react";

// // // interface SectionHeaderProps {
// // //   title?: string;
// // //   icon?: React.ReactNode;
// // //   count?: number;
// // //   action?: { label: string; onClick: () => void };
// // //   variant?: "default" | "hero" | "compact";
// // //   className?: string;
// // //   isLoading?: boolean;
// // //   /** إضافة خلفية للمكون لحمايته من الخلفيات الشفافة */
// // //   withBackground?: boolean;
// // // }

// // // export function SectionHeader({
// // //   title,
// // //   icon,
// // //   count,
// // //   action,
// // //   variant = "default",
// // //   className,
// // //   isLoading = false,
// // //   withBackground = false,
// // // }: SectionHeaderProps) {
// // //   if (isLoading) {
// // //     return (
// // //       <div className={cn("mb-1 w-full", className)}>
// // //         <div className="flex items-center gap-3 pb-2">
// // //           <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
// // //         </div>
// // //         <div className="bg-muted/30 h-px w-full" />
// // //       </div>
// // //     );
// // //   }

// // //   return (
// // //     <div
// // //       className={cn(
// // //         "w-full",
// // //         withBackground && "bg-background/60 backdrop-blur-sm rounded-xl border border-border p-3",
// // //         className
// // //       )}
// // //     >
// // //       <div className="flex items-center justify-between gap-3 pb-2">
// // //         <div className="flex items-center gap-2 min-w-0">
// // //           {icon && <div className="flex items-center shrink-0">{icon}</div>}
// // //           <h2
// // //             className={cn(
// // //               "text-foreground inline-flex items-end font-bold tracking-tight truncate",
// // //               variant === "hero"
// // //                 ? "text-xl sm:text-2xl md:text-3xl"
// // //                 : "text-sm sm:text-lg md:text-xl"
// // //             )}
// // //           >
// // //             {title}
// // //           </h2>
// // //           <span className="text-destructive ms-2 text-xl leading-none sm:text-2xl md:text-3xl shrink-0">
// // //             •
// // //           </span>
// // //         </div>

// // //         <div className="flex items-center gap-2 shrink-0">
// // //           {count !== undefined && count > 0 && (
// // //             <span className="text-muted-foreground bg-card border-border rounded-full border px-2 py-0.5 text-xs font-bold">
// // //               {count}
// // //             </span>
// // //           )}
// // //           {action && (
// // //             <button
// // //               onClick={action.onClick}
// // //               className="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-xs transition-all hover:gap-1"
// // //             >
// // //               {action.label}
// // //               <ChevronLeft size={14} />
// // //             </button>
// // //           )}
// // //         </div>
// // //       </div>

// // //       {/* ✅ الخط الفاصل المحسّن */}
// // //       <div className="relative w-full">
// // //         <div className="absolute inset-0 flex items-center">
// // //           <div className="w-full border-t border-border/30" />
// // //         </div>
// // //         <div className="relative flex justify-center">
// // //           <span className="bg-background px-2 text-xs text-muted-foreground">
// // //             {/* يمكنك إضافة أيقونة أو نص هنا إذا أردت */}
// // //           </span>
// // //         </div>
// // //       </div>
// // //     </div>
// // //   );
// // // }



// // // src/shared/components/ui/section-header.tsx

// // "use client";

// // import React from "react";
// // import { cn } from "@/lib/utils";
// // import { ChevronLeft } from "lucide-react";
 
// // type SectionVariant = 
// //   | "default"      // النمط العادي (بدون زخرفة)
// //   | "glass"        // الزجاجي (للخلفيات المزدحمة)
// //   | "card"         // البطاقة (للوحة التحكم)
// //   | "minimal"      // خط سفلي بسيط
// //   | "headline";    // ✅ النمط الجديد (المستوحى من الموقع الآخر)
// //   | "lined"      // ← جديد: خط سفلي مع تباعد (مستوحى من الموقع الآخر)
// //   | "gradient"   // ← جديد: خلفية متدرجة
// //   | "pill"       // ← جديد: خلفية دائرية (بيل)
// //   | "underline"  // ← جديد: خط تحت النص فقط
// //   | "clean";     // ← جديد: بدون أي زخرفة، فقط نص مع مسافة
// // interface SectionHeaderProps {
// //   title?: string;
// //   icon?: React.ReactNode;
// //   count?: number;
// //   action?: { label: string; onClick: () => void };
// //   variant?: SectionVariant;
// //   className?: string;
// //   isLoading?: boolean;
// // }

// // const variantStyles: Record<SectionVariant, string> = {
// //   default: "", // لا غلاف، نص عادي
// //   glass:
// //     "bg-background/60 backdrop-blur-sm rounded-xl border border-border p-3",
// //   card: "bg-card rounded-lg shadow-sm border border-border p-4",
// //   minimal: "border-b border-border pb-2",
// //   // ✅ النمط الجديد
// //   headline: "border-b-[3px] border-white/10 w-[100%] mx-auto text-right",
// //   // الأنماط الجديدة:
// //   lined: "border-b-2 border-border/10 pb-4 w-[100%] mx-auto text-right", // مستوحى من مثال الموقع
// //   gradient:
// //     "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-4 border-l-4 border-primary",
// //   pill: "bg-secondary/30 backdrop-blur-sm rounded-full px-6 py-2 border border-border/50 inline-block w-auto",
// //   underline:
// //     "border-b-2 border-primary/40 pb-1 inline-block w-auto", // الخط يظهر تحت النص فقط
// //   clean: "py-2", // مسافة بسيطة بدون أي خلفية أو حدود
// // };
// // export function SectionHeader({
// //   title,
// //   icon,
// //   count,
// //   action,
// //   variant = "default",
// //   className,
// //   isLoading = false,
// // }: SectionHeaderProps) {
// //   if (isLoading) {
// //     return (
// //       <div className={cn("mb-1 w-full", className)}>
// //         <div className="flex items-center gap-3 pb-2">
// //           <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
// //         </div>
// //         <div className="bg-muted/30 h-px w-full" />
// //       </div>
// //     );
// //   }

// //   return (
// //     <div
// //       className={cn(
// //         "w-full",
// //         variantStyles[variant],
// //         className
// //       )}
// //     >
// //       <div className="flex items-center justify-between gap-3 pb-2">
// //         <div className="flex items-center gap-2 min-w-0">
// //           {icon && <div className="flex items-center shrink-0">{icon}</div>}
// //           <h2
// //             className={cn(
// //               "text-foreground inline-flex items-end font-bold tracking-tight truncate",
// //               variant === "glass" || variant === "card"
// //                 ? "text-sm sm:text-lg md:text-xl"
// //                 : "text-sm sm:text-lg md:text-xl" // يمكن تعديل حجم الخط حسب الرغبة
// //             )}
// //           >
// //             {title}
// //           </h2>
// //           <span className="text-destructive ms-2 text-xl leading-none sm:text-2xl md:text-3xl shrink-0">
// //             •
// //           </span>
// //         </div>

// //         <div className="flex items-center gap-2 shrink-0">
// //           {count !== undefined && count > 0 && (
// //             <span className="text-muted-foreground bg-card border-border rounded-full border px-2 py-0.5 text-xs font-bold">
// //               {count}
// //             </span>
// //           )}
// //           {action && (
// //             <button
// //               onClick={action.onClick}
// //               className="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-xs transition-all hover:gap-1"
// //             >
// //               {action.label}
// //               <ChevronLeft size={14} />
// //             </button>
// //           )}
// //         </div>
// //       </div>

// //       {/* خط فاصل خفيف */}
// //       <div className="relative w-full">
// //         <div className="absolute inset-0 flex items-center">
// //           <div className="w-full border-t border-border/30" />
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }




// // src/shared/components/ui/section-header.tsx

// "use client";

// import React from "react";
// import { cn } from "@/lib/utils";
// import { ChevronLeft } from "lucide-react";

// type SectionVariant =
//   | "default"
//   | "glass"
//   | "card"
//   | "minimal"
//   | "lined"      // ← جديد: خط سفلي مع تباعد (مستوحى من الموقع الآخر)
//   | "gradient"   // ← جديد: خلفية متدرجة
//   | "pill"       // ← جديد: خلفية دائرية (بيل)
//   | "underline"  // ← جديد: خط تحت النص فقط
//   | "clean";     // ← جديد: بدون أي زخرفة، فقط نص مع مسافة

// interface SectionHeaderProps {
//   title?: string;
//   icon?: React.ReactNode;
//   count?: number;
//   action?: { label: string; onClick: () => void };
//   variant?: SectionVariant;
//   className?: string;
//   isLoading?: boolean;
// }

// const variantStyles: Record<SectionVariant, string> = {
//   default: "",
//   glass:
//     "bg-background/60 backdrop-blur-sm rounded-xl border border-border p-3",
//   card: "bg-card rounded-lg shadow-sm border border-border p-4",
//   minimal: "border-b border-border pb-2",
  
//   // الأنماط الجديدة:
//   lined: "border-b-2 border-border/10 pb-4 w-[100%] mx-auto text-right", // مستوحى من مثال الموقع
//   gradient:
//     "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-4 border-l-4 border-primary",
//   pill: "bg-secondary/30 backdrop-blur-sm rounded-full px-6 py-2 border border-border/50 inline-block w-auto",
//   underline:
//     "border-b-2 border-primary/40 pb-1 inline-block w-auto", // الخط يظهر تحت النص فقط
//   clean: "py-2", // مسافة بسيطة بدون أي خلفية أو حدود
// };

// export function SectionHeader({
//   title,
//   icon,
//   count,
//   action,
//   variant = "default",
//   className,
//   isLoading = false,
// }: SectionHeaderProps) {
//   if (isLoading) {
//     return (
//       <div className={cn("mb-1 w-full", className)}>
//         <div className="flex items-center gap-3 pb-2">
//           <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
//         </div>
//         <div className="bg-muted/30 h-px w-full" />
//       </div>
//     );
//   }

//   // استثناء بعض الأنماط من تطبيق "w-full" لأنها تحتاج إلى أن تكون بعرض المحتوى
//   const isInline = variant === "pill" || variant === "underline" || variant === "gradient";
  
//   return (
//     <div
//       className={cn(
//         isInline ? "inline-block" : "w-full",
//         variantStyles[variant],
//         className
//       )}
//     >
//       <div className={cn(
//         "flex items-center justify-between gap-3",
//         // الأنماط التي تحتاج محاذاة خاصة
//         variant === "lined" ? "justify-end" : "justify-between",
//         variant === "pill" ? "justify-center" : "",
//       )}>
//         <div className="flex items-center gap-2 min-w-0">
//           {icon && <div className="flex items-center shrink-0">{icon}</div>}
//           <h2
//             className={cn(
//               "text-foreground inline-flex items-end font-bold tracking-tight truncate",
//               // حجم الخط يتناسب مع النمط
//               variant === "lined" || variant === "gradient" || variant === "pill"
//                 ? "text-xl sm:text-2xl"
//                 : variant === "underline" || variant === "clean"
//                 ? "text-base sm:text-lg"
//                 : "text-sm sm:text-lg md:text-xl"
//             )}
//           >
//             {title}
//           </h2>
//           <span className="text-destructive ms-2 text-xl leading-none sm:text-2xl md:text-3xl shrink-0">
//             •
//           </span>
//         </div>

//         <div className="flex items-center gap-2 shrink-0">
//           {count !== undefined && count > 0 && (
//             <span className={cn(
//               "text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-bold",
//               variant === "lined" ? "bg-background/50 border-border/30" : "bg-card border-border",
//               variant === "pill" ? "bg-background/50 border-border/30" : "",
//               variant === "gradient" ? "bg-background/50 border-primary/20" : "",
//             )}>
//               {count}
//             </span>
//           )}
//           {action && (
//             <button
//               onClick={action.onClick}
//               className="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-xs transition-all hover:gap-1"
//             >
//               {action.label}
//               <ChevronLeft size={14} />
//             </button>
//           )}
//         </div>
//       </div>

//       {/* خط فاصل خفيف (يظهر فقط في بعض الأنماط) */}
//       {variant === "default" || variant === "card" || variant === "minimal" ? (
//         <div className="relative w-full mt-1">
//           <div className="absolute inset-0 flex items-center">
//             <div className="w-full border-t border-border/30" />
//           </div>
//         </div>
//       ) : null}
//     </div>
//   );
// }

 // src/shared/components/ui/section-header.tsx

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

type SectionVariant =
  | "default" // النمط الأساسي الأنيق
  | "glass" // خلفية زجاجية (فوق الصور)
  | "card" // بطاقة صلبة (لوحة التحكم)
  | "minimal" // خط سفلي بسيط
  | "lined" // تصميم مميز مع نقطة حمراء وخط سفلي عريض (مثل الموقع الآخر)
  | "premium"; // تصميم فاخر مع تدرج وظل

interface SectionHeaderProps {
  title?: string;
  icon?: React.ReactNode;
  count?: number;
  action?: { label: string; onClick: () => void };
  variant?: SectionVariant;
  className?: string;
  isLoading?: boolean;
}

const variantStyles: Record<SectionVariant, string> = {
  default: "pb-3 border-b-2 border-border/30", // تحسين النمط الافتراضي

  glass:
    "bg-background/60 backdrop-blur-sm rounded-xl border border-border p-4 shadow-sm",

  card: "bg-card rounded-xl border border-border p-4 shadow-sm",

  minimal: "border-b border-border pb-2",

  lined:
    "border-b-2 border-primary/20 pb-3 w-[100%] mx-auto text-right", // مستوحى من تصميمك

  premium:
    "relative bg-gradient-to-r from-primary/5 via-background to-primary/5 rounded-xl border border-primary/10 p-4 shadow-md overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-primary/5 before:to-transparent before:animate-pulse",
};

export function SectionHeader({
  title,
  icon,
  count,
  action,
  variant = "default",
  className,
  isLoading = false,
}: SectionHeaderProps) {
  if (isLoading) {
    return (
      <div className={cn("mb-1 w-full", className)}>
        <div className="flex items-center gap-3 pb-2">
          <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
        </div>
        <div className="bg-muted/30 h-px w-full" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full transition-all duration-300",
        variantStyles[variant],
        className
      )}
      dir="rtl" // دعم RTL
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <div className="flex items-center shrink-0">{icon}</div>}

          {/* <h2
            className={cn(
              "text-foreground inline-flex items-end font-bold tracking-tight",
              variant === "default" && "text-lg sm:text-xl md:text-2xl",
              variant === "glass" && "text-base sm:text-lg md:text-xl",
              variant === "card" && "text-base sm:text-lg md:text-xl",
              variant === "minimal" && "text-sm sm:text-base md:text-lg",
              variant === "lined" && "text-2xl sm:text-3xl md:text-4xl font-extrabold",
              variant === "premium" && "text-xl sm:text-2xl md:text-3xl"
            )}
          >
            {title}
          </h2> */}
<h2
  className={cn(
    "text-foreground inline-flex items-end font-bold tracking-tight",
    variant === "minimal" && "text-xs sm:text-sm md:text-base",
    variant === "default" && "text-sm sm:text-base md:text-lg",
    variant === "glass" && "text-sm sm:text-base md:text-lg",
    variant === "card" && "text-sm sm:text-base md:text-lg",
    variant === "lined" && "text-base sm:text-lg md:text-xl font-extrabold",
    variant === "premium" && "text-base sm:text-lg md:text-xl"
  )}
>
  {title}
</h2>
          {/* النقطة الحمراء في نمط lined */}
          {variant === "lined" && (
            <span className="text-red-500 text-3xl sm:text-2xl md:text-5xl leading-none me-2">
              •
            </span>
          )}

          {/* النقطة الحمراء في باقي الأنماط (اختيارية) */}
          {variant !== "lined" && (
            <span className="text-destructive ms-2 text-xl leading-none sm:text-2xl md:text-3xl shrink-0">
              •
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {count !== undefined && count > 0 && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs  font-bold transition-all",
                variant === "lined" &&
                  "bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1",
                variant === "premium" &&
                  "bg-linear-to-r from-primary/20 to-primary/5 text-primary border-primary/20",
                variant === "default" &&
                  "bg-muted/50 text-muted-foreground border-border/50",
                variant === "glass" &&
                  "bg-background/40 text-foreground border-border/30 backdrop-blur-sm",
                variant === "card" &&
                  "bg-card text-muted-foreground border-border",
                variant === "minimal" &&
                  "bg-muted/30 text-muted-foreground border-border/30"
              )}
            >
              {count}
            </span>
          )}

          {action && (
            <button
              onClick={action.onClick}
              className="text-muted-foreground hover:text-primary flex items-center gap-0.5 text-xs transition-all hover:gap-1"
            >
              {action.label}
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      </div>

      {/* خط فاصل خفيف جداً (لن يكسر التصميم) */}
      {variant !== "lined" && variant !== "premium" && (
        <div className="relative w-full mt-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/10" />
          </div>
        </div>
      )}
    </div>
  );
}
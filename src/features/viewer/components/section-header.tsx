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

  glass: "bg-background/60 backdrop-blur-sm rounded-xl border border-border p-4 shadow-sm",

  card: "bg-card rounded-xl border border-border p-4 shadow-sm",

  minimal: "border-b border-border pb-2",

  lined: "border-b-2 border-primary/20 pb-3 mx-auto text-right", // مستوحى من تصميمك

  premium:
    "relative bg-linear-to-r from-primary/5 via-background to-primary/5 rounded-xl border border-primary/10 p-4 shadow-md",
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
      className={cn("w-full transition-all duration-300", variantStyles[variant], className)}
      dir="rtl" // دعم RTL
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon && <div className="flex shrink-0 items-center">{icon}</div>}

          <h2
            className={cn(
              "text-foreground inline-flex items-end font-bold tracking-tight",
              variant === "minimal" && "text-xs sm:text-sm md:text-base",
              variant === "default" && "text-sm sm:text-base md:text-lg",
              variant === "glass" && "text-sm sm:text-base md:text-lg",
              variant === "card" && "text-sm sm:text-base md:text-lg",
              variant === "lined" && "text-base font-extrabold sm:text-lg md:text-xl",
              variant === "premium" && "text-base sm:text-lg md:text-xl",
            )}
          >
            {title}
          </h2>
          {/* النقطة الحمراء في نمط lined */}
          {variant === "lined" && (
            <span className="text-destructive me-2 text-3xl leading-none sm:text-2xl md:text-5xl">
              •
            </span>
          )}

          {/* النقطة الحمراء في باقي الأنماط (اختيارية) */}
          {variant !== "lined" && (
            <span className="text-destructive ms-2 shrink-0 text-xl leading-none sm:text-2xl md:text-3xl">
              •
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {count !== undefined && count > 0 && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-bold transition-all",
                variant === "lined" &&
                  "bg-primary/10 text-primary border-primary/20 px-3 py-1 text-sm",
                variant === "premium" &&
                  "from-primary/20 to-primary/5 text-primary border-primary/20 bg-linear-to-r",
                variant === "default" && "bg-muted/50 text-muted-foreground border-border/50",
                variant === "glass" &&
                  "bg-background/40 text-foreground border-border/30 backdrop-blur-sm",
                variant === "card" && "bg-card text-muted-foreground border-border",
                variant === "minimal" && "bg-muted/30 text-muted-foreground border-border/30",
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
        <div className="relative mt-1 w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="border-border/10 w-full border-t" />
          </div>
        </div>
      )}
    </div>
  );
}

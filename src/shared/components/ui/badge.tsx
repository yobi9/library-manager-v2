import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * تعريفات أشكال الشارة (Badge Variants) — مصدر الحقيقة لتنسيقاتها البصرية.
 *
 * الاعتماد كله على توكنز النظام الدلالية المخصصة في globals.css
 * بحيث تتكيف الشارة تلقائياً مع السياقات الأربعة (:root، .dark، admin-dark، admin-light)
 * دون أي ألوان صلبة.
 *
 * - `new`      : شارة "جديد" — bg-badge-new-bg / text-badge-new-fg
 * - `rating`   : شارة التقييم (النجمة) — bg-badge-rating-bg / text-badge-rating-fg
 * - `count`    : شارة العدد — bg-badge-count-bg / text-badge-count-fg
 * - `glass`    : شارة زجاجية فوق العمل الفني — bg-overlay-scrim / text-overlay-chip
 * - `live`     : شارة البث المباشر — bg-destructive / text-destructive-foreground
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        new: "border-transparent bg-badge-new-bg text-badge-new-fg font-bold [a&]:hover:bg-badge-new-bg/80",
        live: "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 dark:bg-destructive/60",
        rating: "border-transparent bg-badge-rating-bg text-badge-rating-fg backdrop-blur-sm [a&]:hover:bg-badge-rating-bg/80",
        count: "border-transparent bg-badge-count-bg text-badge-count-fg font-bold backdrop-blur-[2px] [a&]:hover:bg-badge-count-bg/80",
        glass: "border-overlay-chip/30 bg-overlay-scrim/60 text-overlay-chip backdrop-blur-sm [a&]:hover:bg-overlay-scrim/70",
        chip: "border-transparent bg-chip-bg text-chip-fg backdrop-blur-sm [a&]:hover:bg-chip-bg/80",
        genre: "border-0 bg-chip-bg text-chip-fg backdrop-blur-sm [a&]:hover:bg-chip-bg/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * يعرض شارة صغيرة (حالة، تصنيف، عدّاد) فوق المحتوى.
 *
 * @param className - أصناف إضافية لتخصيص الموضع أو الحجم (تُدمج عبر cn).
 * @param variant - شكل الشارة: default | secondary | destructive | outline | new | live | count.
 * @param asChild - عند true تُصيَّر الشارة كعنصر الطفل الأول (عبر Radix Slot)
 *   بدل <span> — مفيد لتحويل روابط إلى شارات.
 * @param props - بقية خصائص <span> القياسية.
 * @returns عنصر <span> (أو العنصر الفرعي عند asChild) بتنسيق الشارة المطلوب.
 */
function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

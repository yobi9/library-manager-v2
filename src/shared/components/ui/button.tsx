import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * تعريفات أشكال الزر (Button Variants) — مصدر الحقيقة لتنسيقاته البصرية.
 *
 * الاعتماد كله على توكنز النظام في globals.css:
 *
 * - `default`        : زر أساسي — bg-primary / text-primary-foreground
 * - `destructive`    : زر حذف/تدميري — bg-destructive / text-destructive-foreground
 * - `outline`        : زر حدودي — border-input / bg-background
 * - `secondary`      : زر ثانوي — bg-secondary / text-secondary-foreground
 * - `ghost`          : زر شبحي — hover:bg-accent
 * - `link`           : زر رابط — text-primary
 * - `glass-play`     : زر تشغيل زجاجي فوق العمل الفني — bg-overlay-scrim/20 / text-icon-overlay-fg
 * - `glass-link`     : زر رابط زجاجي فوق العمل الفني — bg-overlay-scrim/20 / text-icon-overlay-fg
 * - `solid-overlay`  : زر صلب فوق العمل الفني — bg-play-btn-bg / text-play-btn-text
 *
 * الأحجام: default (h-10) | sm (h-9) | lg (h-11) | icon (h-10 w-10 rounded-lg) | icon-sm (h-8 w-8 rounded-lg)
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        "glass-play":
          "bg-overlay-scrim/20 border-2 border-overlay-chip/30 text-icon-overlay-fg hover:border-overlay-chip/50 hover:bg-overlay-scrim/30 shadow-lg backdrop-blur-sm cursor-pointer",
        "glass-link":
          "bg-overlay-scrim/20 border-2 border-overlay-chip/30 text-icon-overlay-fg hover:border-overlay-chip/50 hover:bg-overlay-scrim/30 shadow-lg backdrop-blur-sm cursor-pointer",
        "solid-overlay":
          "bg-play-btn-bg text-play-btn-text hover:opacity-90 shadow-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

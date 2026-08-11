// import { cn } from "@/lib/utils";

// interface SpinnerProps {
//   className?: string;
//   size?: "sm" | "md" | "lg";
// }

// const sizeClasses = {
//   sm: "h-4 w-4 border-2",
//   md: "h-8 w-8 border-3",
//   lg: "h-12 w-12 border-4",
// } as const;

// export function Spinner({ className, size = "md" }: SpinnerProps) {
//   return (
//     <div
//       className={cn(
//         "animate-spin rounded-full border-primary border-t-transparent",
//         sizeClasses[size],
//         className,
//       )}
//     />
//   );
// }
// src/shared/components/ui/spinner.tsx
 // src/shared/components/ui/spinner.tsx

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const spinnerVariants = cva(
  "animate-spin rounded-full border-2 border-solid border-current border-t-transparent",
  {
    variants: {
      size: {
        xs: "h-3 w-3 border-[1.5px]",
        sm: "h-5 w-5 border-2",
        md: "h-8 w-8 border-3",
        lg: "h-12 w-12 border-4",
        xl: "h-16 w-16 border-[5px]",
      },
      color: {
        default: "text-primary",
        muted: "text-muted-foreground",
        white: "text-white",
        destructive: "text-destructive",
        success: "text-success",
      },
    },
    defaultVariants: {
      size: "md",
      color: "default",
    },
  }
);

// ✅ الحل: نستثني 'color' من HTMLAttributes لتجنب التعارض
export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "color">,
    VariantProps<typeof spinnerVariants> {
  label?: string;
  labelPosition?: "right" | "left" | "bottom";
  hideLabelOnMobile?: boolean;
}

export function Spinner({
  className,
  size = "md",
  color = "default",
  label,
  labelPosition = "bottom",
  hideLabelOnMobile = false,
  ...props
}: SpinnerProps) {
  const isHorizontal = labelPosition === "right" || labelPosition === "left";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-2",
        isHorizontal ? "flex-row" : "flex-col",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          spinnerVariants({ size, color }),
          "shrink-0"
        )}
        role="status"
        aria-label="جارٍ التحميل"
      >
        <span className="sr-only">جارٍ التحميل...</span>
      </div>

      {label && (
        <span
          className={cn(
            "text-sm font-medium text-muted-foreground",
            hideLabelOnMobile && "hidden sm:inline"
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
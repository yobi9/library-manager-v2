import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: "default" | "success" | "warning";
}

const variantClasses = {
  default: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = "default", ...props }, ref) => {
    const percent = Math.min(Math.max(0, (value / max) * 100), 100);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 transition-all duration-300",
            variantClasses[variant],
          )}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };

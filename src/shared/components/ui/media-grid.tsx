import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MediaGridProps {
  children: ReactNode;
  className?: string;
}

export function MediaGrid({ children, className }: MediaGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

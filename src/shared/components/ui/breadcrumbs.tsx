import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="التنقل" className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronLeft className="h-4 w-4 text-muted-foreground/50" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href as import("next").Route}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="transition-colors hover:text-foreground cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn(isLast && "text-foreground font-medium")}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

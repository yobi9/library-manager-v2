"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
}

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

const TooltipContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
  delayDuration: number;
} | null>(null);

let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

function TooltipProvider({
  children,
  delayDuration = 300,
}: TooltipProviderProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration }}>
      {children}
    </TooltipContext.Provider>
  );
}

function Tooltip({ children }: TooltipProps) {
  return <div className="relative inline-flex">{children}</div>;
}

function TooltipTrigger({
  children,
  className,
  ...props
}: TooltipTriggerProps) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error("TooltipTrigger must be used within TooltipProvider");

  const handleMouseEnter = () => {
    tooltipTimer = setTimeout(() => ctx.setOpen(true), ctx.delayDuration);
  };
  const handleMouseLeave = () => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    ctx.setOpen(false);
  };

  return (
    <span
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className={cn("inline-flex", className)}
      {...props}
    >
      {children}
    </span>
  );
}

function TooltipContent({
  children,
  className,
  side = "top",
}: TooltipContentProps) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error("TooltipContent must be used within TooltipProvider");

  if (!ctx.open) return null;

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 ml-2",
    right: "left-full top-1/2 -translate-y-1/2 mr-2",
  };

  return (
    <div
      role="tooltip"
      className={cn(
        "absolute z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        "pointer-events-none",
        sideClasses[side],
        className,
      )}
    >
      {children}
    </div>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };

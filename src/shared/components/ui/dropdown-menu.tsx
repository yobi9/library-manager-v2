// "use client";

// import * as React from "react";
// import { cn } from "@/lib/utils";

// interface DropdownMenuProps {
//   children: React.ReactNode;
// }

// interface DropdownMenuTriggerProps {
//   children: React.ReactNode;
//   asChild?: boolean;
//   className?: string;
// }

// interface DropdownMenuContentProps {
//   children: React.ReactNode;
//   className?: string;
//   align?: "start" | "end";
// }

// interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
//   inset?: boolean;
//   disabled?: boolean;
// }

// interface DropdownMenuSeparatorProps {
//   className?: string;
// }

// interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
//   inset?: boolean;
// }

// const DropdownMenuContext = React.createContext<{
//   open: boolean;
//   setOpen: (v: boolean) => void;
// } | null>(null);

// function DropdownMenu({ children }: DropdownMenuProps) {
//   const [open, setOpen] = React.useState(false);

//   return (
//     <DropdownMenuContext.Provider value={{ open, setOpen }}>
//       <div className="relative inline-flex">{children}</div>
//     </DropdownMenuContext.Provider>
//   );
// }

// function DropdownMenuTrigger({
//   children,
//   className,
//   ...props
// }: DropdownMenuTriggerProps) {
//   const ctx = React.useContext(DropdownMenuContext);
//   if (!ctx) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

//   return (
//     <button
//       type="button"
//       onClick={() => ctx.setOpen(!ctx.open)}
//       onMouseDown={(e) => e.preventDefault()}
//       className={cn("inline-flex items-center", className)}
//       aria-expanded={ctx.open}
//       {...props}
//     >
//       {children}
//     </button>
//   );
// }

// function DropdownMenuContent({
//   children,
//   className,
//   align = "start",
// }: DropdownMenuContentProps) {
//   const ctx = React.useContext(DropdownMenuContext);
//   if (!ctx) throw new Error("DropdownMenuContent must be used within DropdownMenu");

//   React.useEffect(() => {
//     if (!ctx.open) return;
//     const handler = (e: MouseEvent | TouchEvent) => {
//       const target = e.target as HTMLElement;
//       if (!target.closest("[data-dropdown]")) ctx.setOpen(false);
//     };
//     const escapeHandler = (e: KeyboardEvent) => {
//       if (e.key === "Escape") ctx.setOpen(false);
//     };
//     document.addEventListener("mousedown", handler);
//     document.addEventListener("touchstart", handler);
//     document.addEventListener("keydown", escapeHandler);
//     return () => {
//       document.removeEventListener("mousedown", handler);
//       document.removeEventListener("touchstart", handler);
//       document.removeEventListener("keydown", escapeHandler);
//     };
//   }, [ctx.open, ctx]);

//   if (!ctx.open) return null;

//   return (
//     <div
//       data-dropdown
//       className={cn(
//         "absolute z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
//         align === "end" ? "left-0" : "right-0",
//         "top-full mt-1",
//         className,
//       )}
//     >
//       {children}
//     </div>
//   );
// }

// function DropdownMenuItem({
//   className,
//   inset,
//   disabled,
//   children,
//   ...props
// }: DropdownMenuItemProps) {
//   const ctx = React.useContext(DropdownMenuContext);

//   return (
//     <div
//       role="menuitem"
//       onClick={(e) => {
//         if (disabled) return;
//         ctx?.setOpen(false);
//         props.onClick?.(e);
//       }}
//       className={cn(
//         "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
//         "hover:bg-accent hover:text-accent-foreground",
//         "focus-visible:bg-accent focus-visible:text-accent-foreground",
//         disabled && "pointer-events-none opacity-50",
//         inset && "pr-8",
//         className,
//       )}
//       {...props}
//     >
//       {children}
//     </div>
//   );
// }

// function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
//   return (
//     <div className={cn("-mx-1 my-1 h-px bg-border", className)} />
//   );
// }

// function DropdownMenuLabel({
//   className,
//   inset,
//   ...props
// }: DropdownMenuLabelProps) {
//   return (
//     <div
//       className={cn(
//         "px-2 py-1.5 text-sm font-semibold",
//         inset && "pr-8",
//         className,
//       )}
//       {...props}
//     />
//   );
// }

// export {
//   DropdownMenu,
//   DropdownMenuTrigger,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuSeparator,
//   DropdownMenuLabel,
// };
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  children: React.ReactNode;
}

interface DropdownMenuTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

interface DropdownMenuContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  disabled?: boolean;
}

interface DropdownMenuSeparatorProps {
  className?: string;
}

interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
} | null>(null);

function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  className,
  asChild = false,
  onClick,
  onMouseDown,
  ...props
}: DropdownMenuTriggerProps) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      type={asChild ? undefined : "button"}
      onClick={(e) => {
        ctx.setOpen(!ctx.open);
        onClick?.(e);
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.(e);
      }}
      className={cn("inline-flex items-center", className)}
      aria-expanded={ctx.open}
      {...props}
    >
      {children}
    </Comp>
  );
}

function DropdownMenuContent({
  children,
  className,
  align = "start",
}: DropdownMenuContentProps) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenuContent must be used within DropdownMenu");

  React.useEffect(() => {
    if (!ctx.open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dropdown]")) ctx.setOpen(false);
    };
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") ctx.setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", escapeHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", escapeHandler);
    };
  }, [ctx.open, ctx]);

  if (!ctx.open) return null;

  return (
    <div
      data-dropdown
      className={cn(
        "absolute z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        align === "end" ? "left-0" : "right-0",
        "top-full mt-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

function DropdownMenuItem({
  className,
  inset,
  disabled,
  children,
  ...props
}: DropdownMenuItemProps) {
  const ctx = React.useContext(DropdownMenuContext);

  return (
    <div
      role="menuitem"
      onClick={(e) => {
        if (disabled) return;
        ctx?.setOpen(false);
        props.onClick?.(e);
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:bg-accent focus-visible:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
        inset && "pr-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DropdownMenuSeparator({ className }: DropdownMenuSeparatorProps) {
  return (
    <div className={cn("-mx-1 my-1 h-px bg-border", className)} />
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: DropdownMenuLabelProps) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-sm font-semibold",
        inset && "pr-8",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
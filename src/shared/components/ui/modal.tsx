"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Modal = DialogPrimitive.Root;
const ModalTrigger = DialogPrimitive.Trigger;
const ModalClose = DialogPrimitive.Close;
const ModalPortal = DialogPrimitive.Portal;

const ModalOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * خصائص ModalContent الموسّعة بخصائص Radix Dialog الأصلية.
 */
type ModalContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /**
   * تعطيل كل وسائل الإغلاق التفاعلي: زر X، مفتاح ESC، والنقر خارج النافذة.
   * مخصص للنوافذ التي يجب أن تبقى ظاهرة طالما العملية الجارية لم تنتهِ
   * (مثل نافذة تقدم المسح أثناء عمل الماسح فعلياً).
   *
   * @default false — السلوك الافتراضي قابل للإغلاق بجميع الوسائل.
   */
  disableClose?: boolean;
};

/**
 * حاوية محتوى النافذة الحوارية (Radix Dialog) مع زر إغلاق X مدمج افتراضياً،
 * وقابلية قفل الإغلاق بالكامل عبر `disableClose` لحالات العمليات الجارية.
 *
 * @param props - خصائص Radix Dialog Content القياسية.
 * @param props.disableClose - عند true تُحجب ESC والنقر خارجاً ويُخفى زر X.
 * @returns عنصر محتوى النافذة داخل Portal مع طبقة تعتيم.
 */
const ModalContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  ModalContentProps
>(
  (
    { className, children, disableClose = false, onEscapeKeyDown, onInteractOutside, ...props },
    ref,
  ) => (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4",
          "bg-background p-6",
          "shadow-[var(--shadow-card)]",
          "duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "sm:rounded-lg",
          className,
        )}
        onEscapeKeyDown={
          disableClose
            ? (event) => {
                event.preventDefault();
                onEscapeKeyDown?.(event);
              }
            : onEscapeKeyDown
        }
        onInteractOutside={
          disableClose
            ? (event) => {
                event.preventDefault();
                onInteractOutside?.(event);
              }
            : onInteractOutside
        }
        {...props}
      >
        {children}
        {!disableClose && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 left-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">إغلاق</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  ),
);
ModalContent.displayName = DialogPrimitive.Content.displayName;

const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-right", className)}
    {...props}
  />
);
ModalHeader.displayName = "ModalHeader";

const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-start sm:space-x-2 sm:space-x-reverse",
      className,
    )}
    {...props}
  />
);
ModalFooter.displayName = "ModalFooter";

const ModalTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg leading-none font-semibold tracking-tight", className)}
    {...props}
  />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

const ModalDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Modal,
  ModalPortal,
  ModalOverlay,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
};

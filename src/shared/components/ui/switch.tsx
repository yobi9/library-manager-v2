"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

/**
 * مفتاح تبديل (Switch) مبنى فوق إدخال checkbox مخفي (sr-only) للحفاظ على
 * إمكانية الوصول، مع حالة بصرية تُشتق مباشرة من خاصية `checked` (وليس من
 * أقواس CSS `peer` التي تتطلب ترتيب أشقاء لا ينطبق هنا).
 *
 * الغرض: إظهار الحالة المفوّعة/المعطّلة بشكل حتمي ومتطابق مع قيمة React
 * `checked` — حتى تعكس الواجهة بيانات الخادم (بعد إعادة الجلب) فوراً.
 *
 * @param label - نص وصفي اختياري بجانب المفتاح.
 * @param checked - هل المفتاح مفعّل حالياً (قيمة مُتحكم بها).
 * @param disabled - هل المفتاح معطّل للتفاعل.
 * @param onChange - معالج تغيّر الإدخال (يستقبل حدث checkbox القياسي).
 * @returns عنصر Switch بواجهة HTML checkbox قياسية.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, checked, disabled, onChange, ...props }, ref) => {
    const generatedId = React.useId();
    const switchId = id ?? generatedId;

    return (
      <label
        htmlFor={switchId}
        className={cn("flex cursor-pointer items-center gap-3", disabled && "cursor-not-allowed")}
      >
        <div className="relative">
          <input
            type="checkbox"
            id={switchId}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only"
            ref={ref}
            {...props}
          />
          <div
            aria-hidden="true"
            className={cn(
              "flex h-6 w-11 items-center rounded-full border-2 transition-colors",
              checked ? "border-switch-bg bg-switch-bg" : "border-switch-off-bg bg-switch-off-bg",
              disabled && "opacity-50",
              className,
            )}
          >
            <div
              className={cn(
                "h-5 w-5 rounded-full shadow-sm transition-transform",
                checked
                  ? "bg-switch-thumb ltr:translate-x-5 rtl:-translate-x-5"
                  : "bg-switch-off-thumb translate-x-0",
              )}
            >
              {/* عرض الأيقونة بناءً على الحالة */}
              {checked ? (
                <Check size={12} className="text-switch-icon-on" strokeWidth={3} />
              ) : (
                <X size={12} className="text-switch-icon-off" strokeWidth={3} />
              )}
            </div>
          </div>
        </div>
        {label && <span className="text-sm leading-none font-medium">{label}</span>}
      </label>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };

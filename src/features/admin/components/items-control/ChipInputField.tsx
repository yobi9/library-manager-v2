"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { XCircle, PlusCircle, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

/** Default number of chips shown before the collapse/expand toggle appears. */
const DEFAULT_LIMIT = 8;

interface ChipInputFieldProps {
  /** تسمية الحقل المعروضة فوق صندوق الشرائح. */
  label: string;
  /** مصفوفة قيم الشرائح الحالية. */
  items: string[];
  /** القيمة النصية المدخلة حالياً داخل الصندوق. */
  inputValue: string;
  /** تحديث القيمة المدخلة. */
  onInputChange: (value: string) => void;
  /** إضافة القيمة المدخلة كشريحة جديدة. */
  onAdd: () => void;
  /** حذف شريحة معيّنة. */
  onDelete: (value: string) => void;
  /** أيقونة تظهر داخل كل شريحة (مثل User أو Hash). */
  icon?: ComponentType<{ className?: string }>;
  /** أقصى عدد شرائح ظاهرة قبل زر "باقي N". */
  limit?: number;
  /** نص توضيحي يُعرض كـ placeholder عندما يكون الصندوق فارغاً. */
  placeholder?: string;
}

/**
 * حقل إدخال الشرائح (chips) المستخدم في نافذة تعديل العنصر — مطابق لـ InsetChipField
 * في المشروع القديم: شرائح قابلة للحذف، إدخال نصي مع Enter أو زر إضافة، وطي/توسيع
 * عندما يتجاوز عدد الشرائح الحد المحدد.
 *
 * @param label - تسمية الحقل.
 * @param items - قيم الشرائح الحالية.
 * @param inputValue - النص الجاري كتابته.
 * @param onInputChange - تغيير النص المدخل.
 * @param onAdd - إضافة النص الحالي كشريحة.
 * @param onDelete - حذف شريحة.
 * @param icon - أيقونة الشرائح.
 * @param limit - حد الطي الافتراضي (8).
 * @param placeholder - نص placeholder للصندوق الفارغ.
 */
export function ChipInputField({
  label,
  items,
  inputValue,
  onInputChange,
  onAdd,
  onDelete,
  icon: Icon,
  limit = DEFAULT_LIMIT,
  placeholder,
}: ChipInputFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > limit;
  const displayedItems = expanded ? items : items.slice(0, limit);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAdd();
    }
  };

  return (
    <div className="mb-2.5 w-full">
      <label className="text-muted-foreground mb-0.5 block text-xs font-bold">{label}</label>
      <div className="border-border bg-card flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border p-1.5">
        {displayedItems.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold"
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{item}</span>
            <button
              type="button"
              className="text-primary hover:text-destructive opacity-70 transition-opacity hover:opacity-100"
              onClick={() => onDelete(item)}
              aria-label={`حذف ${item}`}
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}

        {hasMore && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-auto gap-0.5 px-1 py-0 text-xs"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "أقل" : `باقي ${items.length - limit}`}
          </Button>
        )}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={items.length === 0 ? (placeholder ?? `أضف ${label}...`) : ""}
          autoComplete="new-password"
          className={cn(
            "text-foreground h-7 min-w-24 flex-1 border-0 bg-transparent text-xs shadow-none outline-none",
            "placeholder:text-muted-foreground focus-visible:ring-0",
          )}
          dir="rtl"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-primary hover:text-primary/80 h-7 w-7 p-0.5"
          onClick={onAdd}
          title="إضافة"
          aria-label={`إضافة ${label}`}
        >
          <PlusCircle className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

"use client";

import { X, CloudUpload, Languages, RotateCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";

interface BulkActionsBarProps {
  selectedCount: number;
  isAllSelected: boolean;
  isEnriching: boolean;
  isTranslating: boolean;
  onToggleSelectAll: () => void;
  onEnrichSelected: () => void;
  onTranslateSelected: () => void;
  onResetSelected: () => void;
  onClearSelection: () => void;
}

/**
 * الشريط السفلي العائم الذي يظهر عند تحديد عنصر واحد أو أكثر.
 * يوفر: تحديد الكل، إثراء المحدد، ترجمة المحدد، تصفير المحدد، وإغلاق.
 *
 * @param selectedCount - عدد العناصر المحددة.
 * @param isAllSelected - هل كل عناصر الصفحة الحالية محددة.
 * @param isEnriching - جارٍ إثراء المحدد.
 * @param isTranslating - جارٍ ترجمة المحدد.
 * @param onToggleSelectAll - تبديل تحديد كل الصفحة.
 * @param onEnrichSelected - إثراء العناصر المحددة.
 * @param onTranslateSelected - ترجمة العناصر المحددة.
 * @param onResetSelected - تصفير إثراء العناصر المحددة.
 * @param onClearSelection - إلغاء كل التحديدات.
 */
export function BulkActionsBar({
  selectedCount,
  isAllSelected,
  isEnriching,
  isTranslating,
  onToggleSelectAll,
  onEnrichSelected,
  onTranslateSelected,
  onResetSelected,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-primary px-4 py-2 text-primary-foreground shadow-lg sm:flex-nowrap">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <Checkbox
          checked={isAllSelected}
          onChange={onToggleSelectAll}
          aria-label="تحديد الكل"
        />
        <span className="text-sm font-bold">{selectedCount} محدد</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={onEnrichSelected}
          disabled={isEnriching}
          aria-busy={isEnriching}
        >
          <CloudUpload className="h-4 w-4" />
          {isEnriching ? "جارٍ..." : "إثراء"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onTranslateSelected}
          disabled={isTranslating}
          aria-busy={isTranslating}
        >
          <Languages className="h-4 w-4" />
          {isTranslating ? "جارٍ..." : "ترجمة"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onResetSelected}>
          <RotateCcw className="h-4 w-4" />
          تصفير
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        onClick={onClearSelection}
        aria-label="إلغاء التحديد"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

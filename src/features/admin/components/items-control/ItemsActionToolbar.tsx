"use client";

import { CloudUpload, FileText, WandSparkles, Languages } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface ItemsActionToolbarProps {
  /** عدد العناصر في الصفحة الحالية (يعطّل إثراء/ترجمة الصفحة عند الصفر). */
  itemsCount: number;
  /** صحيح عندما تكون كل الفلاتر على "الكل" (تحذير قبل الترجمة الجماعية). */
  isFilterTooBroad: boolean;
  isEnrichAllPending: boolean;
  isEnrichPagePending: boolean;
  isEnrichEmptyPending: boolean;
  isTranslatePagePending: boolean;
  isTranslateAllPending: boolean;
  onEnrichAll: () => void;
  onEnrichCurrentPage: () => void;
  onEnrichEmptyOnly: () => void;
  onTranslatePage: () => void;
  onTranslateAll: () => void;
}

/**
 * شريط إجراءات الدفعة لصفحة التحكم بالعناصر.
 * أزرار: إثراء الكل (حسب الفلتر)، إثراء الصفحة الحالية، إثراء النواقص، وترجمة الصفحة.
 *
 * @param itemsCount - عدد عناصر الصفحة الحالية.
 * @param isFilterTooBroad - تحذير عندما تكون الفلاتر كلها على "الكل".
 * @param isEnrichAllPending - جارٍ إثراء الكل.
 * @param isEnrichPagePending - جارٍ إثراء الصفحة.
 * @param isEnrichEmptyPending - جارٍ إثراء النواقص.
 * @param isTranslatePagePending - جارٍ ترجمة الصفحة.
 * @param isTranslateAllPending - جارٍ ترجمة الكل حسب الفلتر.
 * @param onEnrichAll - استدعاء عند النقر على "إثراء الكل".
 * @param onEnrichCurrentPage - استدعاء عند النقر على "إثراء الصفحة".
 * @param onEnrichEmptyOnly - استدعاء عند النقر على "إثراء النواقص".
 * @param onTranslatePage - استدعاء عند النقر على "ترجمة الصفحة".
 * @param onTranslateAll - استدعاء عند النقر على "ترجمة الكل".
 */
export function ItemsActionToolbar({
  itemsCount,
  isFilterTooBroad,
  isEnrichAllPending,
  isEnrichPagePending,
  isEnrichEmptyPending,
  isTranslatePagePending,
  isTranslateAllPending,
  onEnrichAll,
  onEnrichCurrentPage,
  onEnrichEmptyOnly,
  onTranslatePage,
  onTranslateAll,
}: ItemsActionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        onClick={onEnrichAll}
        disabled={isEnrichAllPending}
        aria-busy={isEnrichAllPending}
      >
        <CloudUpload className="h-4 w-4" />
        {isEnrichAllPending ? "جارٍ الإثراء..." : "إثراء الكل"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onEnrichCurrentPage}
        disabled={isEnrichPagePending || itemsCount === 0}
        aria-busy={isEnrichPagePending}
      >
        <FileText className="h-4 w-4" />
        {isEnrichPagePending ? "جارٍ..." : "إثراء الصفحة"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onEnrichEmptyOnly}
        disabled={isEnrichEmptyPending}
        aria-busy={isEnrichEmptyPending}
      >
        <WandSparkles className="h-4 w-4" />
        {isEnrichEmptyPending ? "جارٍ..." : "النواقص"}
      </Button>
      <div className="bg-border mx-1 h-5 w-px" />
      <Button
        variant="ghost"
        size="sm"
        onClick={onTranslatePage}
        disabled={isTranslatePagePending || itemsCount === 0}
        title={
          isFilterTooBroad
            ? "نطاق البحث واسع جداً، قلل الفلاتر أولاً"
            : "ترجمة عناصر الصفحة إلى العربية"
        }
        aria-busy={isTranslatePagePending}
      >
        <Languages className="h-4 w-4" />
        {isTranslatePagePending ? "جارٍ الترجمة..." : "ترجمة الصفحة"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onTranslateAll}
        disabled={isTranslateAllPending || isFilterTooBroad}
        title={
          isFilterTooBroad
            ? "نطاق البحث واسع جداً، قلل الفلاتر أولاً"
            : "ترجمة كل العناصر المطابقة للفلتر"
        }
        aria-busy={isTranslateAllPending}
      >
        <Languages className="h-4 w-4" />
        {isTranslateAllPending ? "جارٍ الترجمة..." : "ترجمة الكل"}
      </Button>
    </div>
  );
}

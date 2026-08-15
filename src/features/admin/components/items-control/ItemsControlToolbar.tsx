"use client";

import { Layers, Folder, CircleAlert, Clock, PackageX } from "lucide-react";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import type { Library } from "@/lib/frontend/api-media";
import type { AdminMediaStats } from "@/features/admin/hooks/use-admin-media";
import { MEDIA_TYPE_OPTIONS } from "@/lib/frontend/translate";

/** Possible enrichment-status filters for the items-control list. */
export type ItemsFilterBy = "all" | "pinned" | "no-content" | "needs-review";

/**
 * Filter state of the items-control page.
 * `"all"` is the neutral value for library/type/status selects.
 */
export interface ItemsControlFilters {
  search: string;
  libraryId: string;
  type: string;
  filterBy: ItemsFilterBy;
}

interface ItemsControlToolbarProps {
  filters: ItemsControlFilters;
  onFilterChange: (patch: Partial<ItemsControlFilters>) => void;
  onResetFilters: () => void;
  libraries: Library[];
  totalItems: number;
  /** إحصائيات اللوحة (تُجلب مع القائمة عند admin=true). */
  stats?: AdminMediaStats;
}

const FILTER_BY_OPTIONS: { value: ItemsFilterBy; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "pinned", label: "المثبتة" },
  { value: "no-content", label: "بلا محتوى (لم تُثرَ)" },
  { value: "needs-review", label: "ناقص (يحتاج مراجعة)" },
];

/**
 * شريط الفلاتر العلوي لصفحة التحكم بالعناصر.
 * يحتوي على صف إحصائيات (إجمالي العناصر) و 4 مدخلات: بحث، مكتبة، نوع، حالة.
 *
 * @param filters - قيم الفلاتر الحالية (controlled).
 * @param onFilterChange - تحديث جزئي للفلاتر (يمرر patch فقط).
 * @param onResetFilters - إعادة ضبط كل الفلاتر لقيمها الافتراضية.
 * @param libraries - قائمة المكتبات لملء قائمة الاختيار.
 * @param totalItems - عدد النتائج الإجمالي (يظهر في صف الإحصائيات).
 */
export function ItemsControlToolbar({
  filters,
  onFilterChange,
  onResetFilters,
  libraries,
  totalItems,
  stats,
}: ItemsControlToolbarProps) {
  const libraryOptions = [
    { value: "all", label: "الكل" },
    ...libraries.map((lib) => ({
      value: String(lib.library_id ?? lib.id),
      label: lib.name,
    })),
  ];

  const statCards = [
    { label: "الإجمالي", value: totalItems, icon: <Layers className="h-4 w-4" /> },
    {
      label: "المكتبات",
      value: stats?.totalLibraries ?? "—",
      icon: <Folder className="h-4 w-4" />,
    },
    {
      label: "يحتاج مراجعة",
      value: stats?.needsAttention ?? "—",
      icon: <CircleAlert className="h-4 w-4 text-warning-text" />,
    },
    {
      label: "بلا محتوى",
      value: stats?.noContent ?? "—",
      icon: <PackageX className="text-muted-foreground h-4 w-4" />,
    },
    {
      label: "آخر تحديث",
      value: stats?.lastSync ? new Date(stats.lastSync).toLocaleDateString("ar-EG") : "—",
      icon: <Clock className="text-muted-foreground h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-3">
      {/* صف الإحصائيات */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="border-border bg-card flex items-center justify-between rounded-lg border p-3"
          >
            <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              {card.icon}
              <span>{card.label}</span>
            </div>
            <span className="text-2xl font-bold">{card.value}</span>
          </div>
        ))}
      </div>

      {/* صندوق الفلاتر */}
      <div className="border-border bg-card grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="بحث بالعنوان..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="pr-9"
            aria-label="بحث بالعنوان"
          />
        </div>
        <Select
          label="المكتبة"
          value={filters.libraryId}
          options={libraryOptions}
          onChange={(e) => onFilterChange({ libraryId: e.target.value })}
          aria-label="المكتبة"
        />
        <Select
          label="النوع"
          value={filters.type}
          options={[{ value: "all", label: "الكل" }, ...MEDIA_TYPE_OPTIONS]}
          onChange={(e) => onFilterChange({ type: e.target.value })}
          aria-label="النوع"
        />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label="الحالة"
              value={filters.filterBy}
              options={FILTER_BY_OPTIONS}
              onChange={(e) => onFilterChange({ filterBy: e.target.value as ItemsFilterBy })}
              aria-label="الحالة"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onResetFilters}
            title="إعادة ضبط الفلاتر"
            aria-label="إعادة ضبط الفلاتر"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

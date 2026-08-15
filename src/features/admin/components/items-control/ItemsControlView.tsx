"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Table as TableIcon,
  Pencil,
  RotateCw,
  Languages,
  Star,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Pagination } from "@/shared/components/ui/pagination";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { AdminTable } from "@/features/admin/components/admin-table";
import { ItemControlCard } from "@/features/admin/components/items-control/ItemControlCard";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/frontend/api-media";
import { translateMediaType } from "@/lib/frontend/translate";

export type ItemsControlViewMode = "grid" | "table";

/** إجراءات متاحة لكل عنصر (تمرر للبطاقة ولصف الجدول معاً). */
export interface ItemsControlItemActions {
  onEnrich: (item: MediaItem) => void;
  onTranslate: (item: MediaItem) => void;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onTogglePin: (item: MediaItem) => void;
  onReset: (item: MediaItem) => void;
}

interface ItemsControlViewProps {
  items: MediaItem[];
  isLoading: boolean;
  /** جلب بيانات جديدة بعد تغيير الفلاتر (تعتيم خفيف بدل إعادة التحميل). */
  isRefetching?: boolean;
  viewMode: ItemsControlViewMode;
  onViewModeChange: (mode: ItemsControlViewMode) => void;
  selectedIds: Set<number>;
  isAllSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemActions: ItemsControlItemActions;
  busyId?: number | null;
  busyAction?: "enrich" | "translate" | "pin" | "delete" | "reset";
}

/**
 * عرض عناصر صفحة التحكم: شبكة بطاقات أو جدول، مع ترقيم صفحات
 * وأزرار تحديد الكل / تبديل العرض.
 *
 * @param items - عناصر الصفحة الحالية.
 * @param isLoading - عرض هيكل تحميل بدلاً من البيانات.
 * @param viewMode - "grid" (بطاقات) أو "table" (جدول).
 * @param onViewModeChange - تبديل وضع العرض.
 * @param selectedIds - مجموعة معرّفات العناصر المحددة.
 * @param isAllSelected - هل كل عناصر الصفحة محددة.
 * @param onToggleSelect - تبديل تحديد عنصر.
 * @param onSelectAll - تحديد/إلغاء تحديد كل عناصر الصفحة.
 * @param currentPage - الصفحة الحالية.
 * @param totalPages - إجمالي الصفحات.
 * @param onPageChange - التنقل لصفحة أخرى.
 * @param itemActions - إجراءات العنصر الواحد.
 * @param busyId - معرّف العنصر الجاري عليه إجراء.
 * @param busyAction - نوع الإجراء الجاري (لتشغيل الأنيميشن المناسب).
 */
export function ItemsControlView({
  items,
  isLoading,
  isRefetching = false,
  viewMode,
  onViewModeChange,
  selectedIds,
  isAllSelected,
  onToggleSelect,
  onSelectAll,
  currentPage,
  totalPages,
  onPageChange,
  itemActions,
  busyId,
  busyAction,
}: ItemsControlViewProps) {
  /** عنصر ينتظر تأكيد الحذف من وضع الجدول. */
  const [deleteCandidate, setDeleteCandidate] = useState<MediaItem | null>(null);

  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-2/3 rounded-xl" />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={<TableIcon />}
          title="لا توجد عناصر"
          description="جرّب تغيير الفلاتر أو البحث"
        />
      );
    }

    return (
      <div
        className={cn(
          "grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 transition-opacity",
          isRefetching && !isLoading && "opacity-60",
        )}
      >
        {items.map((item) => (
          <ItemControlCard
            key={item.media_id}
            item={item}
            selected={selectedIds.has(item.media_id)}
            isEnriching={busyId === item.media_id && busyAction === "enrich"}
            isTranslating={busyId === item.media_id && busyAction === "translate"}
            isPinning={busyId === item.media_id && busyAction === "pin"}
            isDeleting={busyId === item.media_id && busyAction === "delete"}
            isResetting={busyId === item.media_id && busyAction === "reset"}
            onToggleSelect={() => onToggleSelect(item.media_id)}
            onEnrich={() => itemActions.onEnrich(item)}
            onTranslate={() => itemActions.onTranslate(item)}
            onEdit={() => itemActions.onEdit(item)}
            onDelete={() => itemActions.onDelete(item)}
            onTogglePin={() => itemActions.onTogglePin(item)}
            onReset={() => itemActions.onReset(item)}
          />
        ))}
      </div>
    );
  };

  const renderTable = () => (
    <AdminTable
      columns={[
        {
          key: "select",
          header: (
            <Checkbox
              checked={isAllSelected}
              onChange={onSelectAll}
              aria-label="تحديد الكل"
            />
          ),
          render: (item: MediaItem) => (
            <Checkbox
              checked={selectedIds.has(item.media_id)}
              onChange={() => onToggleSelect(item.media_id)}
              aria-label={`تحديد ${item.title}`}
            />
          ),
        },
        { key: "title", header: "العنوان" },
        {
          key: "type",
          header: "النوع",
          render: (item: MediaItem) => translateMediaType(item.type),
        },
        {
          key: "year",
          header: "السنة",
          render: (item: MediaItem) => item.year || "—",
        },
        {
          key: "is_pinned",
          header: "مثبت",
          render: (item: MediaItem) =>
            item.is_pinned ? <Badge variant="default">مثبت</Badge> : "—",
        },
      ]}
      data={items}
      keyExtractor={(item) => String(item.media_id)}
      emptyMessage="لا توجد عناصر مطابقة للفلاتر"
      actions={(item) => {
        const pinned = !!item.is_pinned;
        return (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => itemActions.onEdit(item)}
              title="تعديل"
              aria-label={`تعديل ${item.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => itemActions.onTogglePin(item)}
              disabled={busyId === item.media_id && busyAction === "pin"}
              title={pinned ? "إزالة التثبيت" : "تثبيت"}
              aria-label={pinned ? "إزالة التثبيت" : "تثبيت"}
            >
              <Star className={cn("h-4 w-4", pinned && "fill-rating-star text-rating-star")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => itemActions.onEnrich(item)}
              disabled={busyId === item.media_id && busyAction === "enrich"}
              title="إثراء"
              aria-label={`إثراء ${item.title}`}
            >
              <RotateCw
                className={cn("h-4 w-4", busyId === item.media_id && busyAction === "enrich" && "animate-spin")}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => itemActions.onTranslate(item)}
              disabled={busyId === item.media_id && busyAction === "translate"}
              title="ترجمة"
              aria-label={`ترجمة ${item.title}`}
            >
              <Languages
                className={cn(
                  "h-4 w-4",
                  busyId === item.media_id && busyAction === "translate" && "animate-pulse",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => itemActions.onReset(item)}
              disabled={busyId === item.media_id && busyAction === "reset"}
              title="تصفير الإثراء"
              aria-label={`تصفير إثراء ${item.title}`}
            >
              <RotateCcw
                className={cn(
                  "h-4 w-4",
                  busyId === item.media_id && busyAction === "reset" && "animate-spin",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteCandidate(item)}
              className="text-destructive hover:text-destructive"
              title="حذف"
              aria-label={`حذف ${item.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        );
      }}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onChange={onSelectAll}
            label={selectedIds.size > 0 ? `${selectedIds.size} محدد` : "تحديد الكل"}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("grid")}
            aria-label="عرض شبكة"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("table")}
            aria-label="عرض جدول"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? renderGrid() : renderTable()}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />

      <ConfirmDialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
        title="تأكيد الحذف"
        description={
          deleteCandidate
            ? `هل أنت متأكد من حذف "${deleteCandidate.title}"؟ لا يمكن التراجع عن هذا الإجراء.`
            : ""
        }
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={() => {
          if (deleteCandidate) {
            setDeleteCandidate(null);
            itemActions.onDelete(deleteCandidate);
          }
        }}
      />
    </div>
  );
}

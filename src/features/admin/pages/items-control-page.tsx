"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ItemsControlToolbar,
  type ItemsControlFilters,
} from "@/features/admin/components/items-control/ItemsControlToolbar";
import { ItemsActionToolbar } from "@/features/admin/components/items-control/ItemsActionToolbar";
import {
  ItemsControlView,
  type ItemsControlViewMode,
} from "@/features/admin/components/items-control/ItemsControlView";
import { ItemManagementDialog } from "@/features/admin/components/items-control/ItemManagementDialog";
import { BulkActionsBar } from "@/features/admin/components/items-control/BulkActionsBar";
import { BackgroundJobBanner } from "@/features/admin/components/items-control/BackgroundJobBanner";
import { EnrichmentOptionsPanel } from "@/features/admin/components/items-control/EnrichmentOptionsPanel";
import { PendingApprovalsPanel } from "@/features/admin/components/items-control/PendingApprovalsPanel";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { useAdminLibraries } from "@/features/admin/hooks/use-admin-libraries";
import {
  useAdminMedia,
  useEnrichItem,
  useEnrichBatch,
  useEnrichByFilter,
  useTranslateItem,
  useTranslateBatch,
  useDeleteMedia,
  useTogglePinMedia,
  useResetEnrichment,
  adminMediaKeys,
} from "@/features/admin/hooks/use-admin-media";
import { useTranslateByFilter } from "@/features/admin/hooks/use-admin-enrichment";
import { useAdminRealtimeEvents } from "@/features/admin/hooks/use-admin-realtime";
import { useAdminSettings } from "@/features/admin/hooks/use-admin-settings";
import type { MediaItem } from "@/lib/frontend/api-media";

const DEFAULT_FILTERS: ItemsControlFilters = {
  search: "",
  libraryId: "all",
  type: "all",
  filterBy: "all",
};

const PAGE_LIMIT = 50;

/** مهلة تجميع أحداث تحديث الوسائط قبل إبطال القائمة — تمنع عاصفة إعادة الجلب. */
const MEDIA_INVALIDATION_DEBOUNCE_MS = 1500;

/** حالة العنصر الجاري تنفيذ إجراء عليه (لتشغيل الأنيميشن في البطاقة). */
interface BusyState {
  id: number;
  action: "enrich" | "translate" | "pin" | "delete" | "reset";
}

/**
 * صفحة التحكم بالعناصر — الصفحة الرئيسية لإدارة الوسائط في لوحة الأدمن.
 *
 * تنسق ست مكونات: شريط الفلاتر، أزرار الإجراءات، عرض العناصر (بطاقات/جدول)،
 * نافذة التعديل، والشريط السفلي للاختيار الجماعي.
 * جميع إجراءات الإثراء/الترجمة تُشغَّل في الخلفية عبر الـ API الحالية.
 */
export function ItemsControlPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ItemsControlFilters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ItemsControlViewMode>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState<BusyState | null>(null);
  const [confirmTranslateAll, setConfirmTranslateAll] = useState(false);

  const realtime = useAdminRealtimeEvents();

  // تحديث القائمة تلقائياً عند تغيّر البيانات من أحداث الخلفية (إثراء/ترجمة/حفظ).
  // يُدمج الإبطال عبر تأخير قصير: الأحداث المتلاحقة من جلسة خلفية واحدة
  // (مثل `media:changed` لكل عنصر) تُجمَّع في إعادة جلب واحدة بدل استدعاءات
  // N متطابقة للـ API مع كل حدث.
  useEffect(() => {
    if (realtime.mediaVersion === 0) return;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: adminMediaKeys.all });
    }, MEDIA_INVALIDATION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [realtime.mediaVersion, queryClient]);

  // تأخير البحث 400ms حتى لا يُستدعى الـ API مع كل حرف.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 400);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const { data, isLoading, isFetching } = useAdminMedia({
    page,
    limit: PAGE_LIMIT,
    search: debouncedSearch || undefined,
    libraryId: filters.libraryId,
    type: filters.type,
    filterBy: filters.filterBy,
  });
  const { data: librariesData } = useAdminLibraries();
  const { data: settings } = useAdminSettings();

  const enrichmentOptions = useMemo(
    () => ({
      downloadImages: Boolean(settings?.download_images),
      downloadCastImages: Boolean(settings?.download_cast_images),
      storageMode: typeof settings?.storage_mode === "string" ? settings.storage_mode : "local",
    }),
    [settings],
  );

  const enrichItemMutation = useEnrichItem();
  const enrichBatchMutation = useEnrichBatch();
  const enrichAllMutation = useEnrichByFilter();
  const enrichEmptyMutation = useEnrichByFilter();
  const translateItemMutation = useTranslateItem();
  const translateBatchMutation = useTranslateBatch();
  const translateAllMutation = useTranslateByFilter();
  const deleteMutation = useDeleteMedia();
  const togglePinMutation = useTogglePinMedia();
  const resetMutation = useResetEnrichment();

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_LIMIT));
  const libraries = useMemo(() => librariesData ?? [], [librariesData]);

  const isFilterTooBroad =
    filters.libraryId === "all" && filters.type === "all" && filters.filterBy === "all";

  const currentPageIds = useMemo(() => items.map((i) => i.media_id), [items]);
  const isAllSelected = items.length > 0 && items.every((i) => selectedIds.has(i.media_id));

  const handleFilterChange = useCallback((patch: Partial<ItemsControlFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    setSelectedIds(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ===== إجراءات العنصر الواحد =====

  const runBusy = async (action: BusyState["action"], id: number, task: () => Promise<unknown>) => {
    setBusy({ id, action });
    try {
      await task();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشلت العملية");
    } finally {
      setBusy(null);
    }
  };

const handleEnrich = useCallback(
  (item: MediaItem) =>
    runBusy("enrich", item.media_id, async () => {
      await enrichItemMutation.mutateAsync({
        id: item.media_id,
        downloadImages: enrichmentOptions.downloadImages,
        downloadCastImages: enrichmentOptions.downloadCastImages,
        storageMode: enrichmentOptions.storageMode,
      });
      toast.success(`اكتمل إثراء "${item.title}"`);
    }),
  [enrichItemMutation, enrichmentOptions],
);

  const handleTranslate = useCallback(
    (item: MediaItem) =>
      runBusy("translate", item.media_id, async () => {
        await translateItemMutation.mutateAsync(item.media_id);
        toast.success(`تم بدء ترجمة "${item.title}" في الخلفية`);
      }),
    [translateItemMutation],
  );

  const handleTogglePin = useCallback(
    (item: MediaItem) =>
      runBusy("pin", item.media_id, async () => {
        const result = await togglePinMutation.mutateAsync(item.media_id);
        toast.success(result.pinned ? "تم تثبيت العنصر" : "تم إلغاء التثبيت");
      }),
    [togglePinMutation],
  );

  const handleDelete = useCallback(
    (item: MediaItem) =>
      runBusy("delete", item.media_id, async () => {
        await deleteMutation.mutateAsync(item.media_id);
        toast.success(`تم حذف "${item.title}"`);
      }),
    [deleteMutation],
  );

  const handleReset = useCallback(
    (item: MediaItem) =>
      runBusy("reset", item.media_id, async () => {
        await resetMutation.mutateAsync(item.media_id);
        toast.success(`تم تصفير إثراء "${item.title}"`);
      }),
    [resetMutation],
  );

  const handleEdit = useCallback((item: MediaItem) => setEditingItem(item), []);

  // ===== إجراءات الدفعة =====
  const handleEnrichAll = useCallback(() => {
    enrichAllMutation.mutate(
      {
        libraryId: filters.libraryId !== "all" ? filters.libraryId : undefined,
        type: filters.type !== "all" ? filters.type : undefined,
        onlyEmpty: filters.filterBy === "no-content",
        ...enrichmentOptions,
      },
      {
        onSuccess: () => toast.success("تم بدء إثراء الكل في الخلفية"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "فشل إثراء الكل"),
      },
    );
  }, [enrichAllMutation, filters, enrichmentOptions]);

  const handleEnrichCurrentPage = useCallback(() => {
    if (currentPageIds.length === 0) return;
    enrichBatchMutation.mutate(
      { ids: currentPageIds, options: enrichmentOptions },
      {
        onSuccess: () => toast.success(`تم بدء إثراء ${currentPageIds.length} عنصراً`),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "فشل إثراء الصفحة"),
      },
    );
  }, [enrichBatchMutation, currentPageIds, enrichmentOptions]);

  const handleEnrichEmptyOnly = useCallback(() => {
    enrichEmptyMutation.mutate(
      {
        libraryId: filters.libraryId !== "all" ? filters.libraryId : undefined,
        type: filters.type !== "all" ? filters.type : undefined,
        onlyEmpty: true,
        ...enrichmentOptions,
      },
      {
        onSuccess: () => toast.success("تم بدء إثراء النواقص في الخلفية"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "فشل إثراء النواقص"),
      },
    );
  }, [enrichEmptyMutation, filters, enrichmentOptions]);
  const handleTranslatePage = useCallback(() => {
    if (currentPageIds.length === 0) return;
    translateBatchMutation.mutate(currentPageIds, {
      onSuccess: () => toast.success(`تم بدء ترجمة ${currentPageIds.length} عنصراً`),
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل ترجمة الصفحة"),
    });
  }, [translateBatchMutation, currentPageIds]);

  const handleTranslateAll = useCallback(() => {
    translateAllMutation.mutate(
      {
        libraryId: filters.libraryId !== "all" ? filters.libraryId : undefined,
        type: filters.type !== "all" ? filters.type : undefined,
      },
      {
        onSuccess: () => toast.success("تم بدء ترجمة الكل في الخلفية"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "فشل ترجمة الكل"),
      },
    );
  }, [translateAllMutation, filters]);

  // ===== الاختيار الجماعي =====

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (items.every((i) => prev.has(i.media_id))) {
        return new Set([...prev].filter((id) => !currentPageIds.includes(id)));
      }
      return new Set([...prev, ...currentPageIds]);
    });
  }, [items, currentPageIds]);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleEnrichSelected = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    enrichBatchMutation.mutate(
      { ids, options: enrichmentOptions },
      {
        onSuccess: () => {
          toast.success(`تم بدء إثراء ${ids.length} عنصراً`);
          setSelectedIds(new Set());
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "فشل إثراء المحدد"),
      },
    );
  }, [enrichBatchMutation, selectedIds, enrichmentOptions]);

  const handleTranslateSelected = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    translateBatchMutation.mutate(ids, {
      onSuccess: () => {
        toast.success(`تم بدء ترجمة ${ids.length} عنصراً`);
        setSelectedIds(new Set());
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل ترجمة المحدد"),
    });
  }, [translateBatchMutation, selectedIds]);

  const handleResetSelected = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    Promise.allSettled(ids.map((id) => resetMutation.mutateAsync(id))).then((results) => {
      const ok = results.filter((r) => r.status === "fulfilled").length;
      toast.success(`تم تصفير ${ok} عنصراً من أصل ${ids.length}`);
      setSelectedIds(new Set());
    });
  }, [resetMutation, selectedIds]);

  const itemActions = useMemo(
    () => ({
      onEnrich: handleEnrich,
      onTranslate: handleTranslate,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onTogglePin: handleTogglePin,
      onReset: handleReset,
    }),
    [handleEnrich, handleTranslate, handleEdit, handleDelete, handleTogglePin, handleReset],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">التحكم بالعناصر</h1>
          <p className="text-muted-foreground text-sm">إدارة وفحص وإثراء وترجمة كل عناصر المكتبة</p>
        </div>
      </div>

      <ItemsControlToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        libraries={libraries}
        totalItems={totalItems}
        stats={data?.stats}
      />

      <EnrichmentOptionsPanel />

      <ItemsActionToolbar
        itemsCount={items.length}
        isFilterTooBroad={isFilterTooBroad}
        isEnrichAllPending={enrichAllMutation.isPending}
        isEnrichPagePending={enrichBatchMutation.isPending}
        isEnrichEmptyPending={enrichEmptyMutation.isPending}
        isTranslatePagePending={translateBatchMutation.isPending}
        isTranslateAllPending={translateAllMutation.isPending}
        onEnrichAll={handleEnrichAll}
        onEnrichCurrentPage={handleEnrichCurrentPage}
        onEnrichEmptyOnly={handleEnrichEmptyOnly}
        onTranslatePage={handleTranslatePage}
        onTranslateAll={() => setConfirmTranslateAll(true)}
      />

      <PendingApprovalsPanel />

      <ItemsControlView
        items={items}
        isLoading={isLoading}
        isRefetching={isFetching}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedIds={selectedIds}
        isAllSelected={isAllSelected}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        itemActions={itemActions}
        busyId={busy?.id}
        busyAction={busy?.action}
      />

      <BulkActionsBar
        selectedCount={selectedIds.size}
        isAllSelected={isAllSelected}
        isEnriching={enrichBatchMutation.isPending}
        isTranslating={translateBatchMutation.isPending}
        onToggleSelectAll={handleSelectAll}
        onEnrichSelected={handleEnrichSelected}
        onTranslateSelected={handleTranslateSelected}
        onResetSelected={handleResetSelected}
        onClearSelection={handleClearSelection}
      />

      <ItemManagementDialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSaved={() => setSelectedIds(new Set())}
      />

      <BackgroundJobBanner session={realtime.enrichmentSession} label="الإثراء" />
      <BackgroundJobBanner session={realtime.translationSession} label="الترجمة" />

      <ConfirmDialog
        open={confirmTranslateAll}
        onOpenChange={setConfirmTranslateAll}
        title="تأكيد ترجمة الكل"
        description="سيتم ترجمة جميع العناصر المطابقة للفلتر إلى العربية في الخلفية. هل أنت متأكد؟"
        confirmLabel="ترجمة الكل"
        loading={translateAllMutation.isPending}
        onConfirm={() => {
          setConfirmTranslateAll(false);
          handleTranslateAll();
        }}
      />
    </div>
  );
}

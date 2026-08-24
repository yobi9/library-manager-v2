//src\features\admin\pages\libraries-page.tsx         اداره المكتبات (ترتيب الاقسام)
"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumbs";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/shared/components/ui/modal";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { LibraryCard } from "@/features/admin/components/libraries-control/library-card";
import { LibraryForm } from "@/features/admin/components/libraries-control/library-form";
import type { LibraryFormValues } from "@/features/admin/components/libraries-control/library-form";
import { ScanProgressCard } from "@/features/admin/components/libraries-control/scan-progress";
import {
  useAdminLibraries,
  useCreateLibrary,
  useUpdateLibrary,
  useDeleteLibrary,
  useTogglePin,
  useStartScan,
  useStartScanAll,
  useStopScan,
  usePauseScan,
  useResumeScan,
} from "@/features/admin/hooks/use-admin-libraries";
import { useAdminSettings, useUpdateSettings } from "@/features/admin/hooks/use-admin-settings";
import { useAdminSummary } from "@/features/admin/hooks/use-admin-dashboard";
import { useScanEvents } from "@/features/admin/hooks/use-scan-events";
import type { Library } from "@/lib/frontend/api-media";
import { Plus, RefreshCw, ChevronDown, Library as LibraryIcon } from "lucide-react";
import { ApiError } from "@/lib/frontend/api-client";
/**
 * تطبيع قيمة setting من API إلى boolean صريح.
 * الـ API قد يعيد boolean (true/false) أو string ("true"/"false") أو number (1/0).
 */
function isSettingEnabled(val: unknown): boolean {
  return val === true || val === "true" || val === 1;
}

/**
 * تحويل سلسلة حجم مُنسّقة (من `formatBytes` في الباك) إلى عدد الجيجابايت.
 * يقبل الصيغ: "B" / "KB" / "MB" / "GB" ويعيد الرقم بالجيجابايت (0 عند التعذّر).
 */
function parseFormattedBytesToGb(formatted: string): number {
  const match = /^([\d.]+)\s*([A-Za-z]*)$/.exec(formatted.trim());
  if (!match) return 0;
  const value = Number.parseFloat(match[1] ?? "0");
  if (Number.isNaN(value)) return 0;
  const unit = (match[2] ?? "").toUpperCase();
  if (unit === "GB") return value;
  if (unit === "MB") return value / 1024;
  if (unit === "KB") return value / (1024 * 1024);
  if (unit === "B") return value / (1024 * 1024 * 1024);
  return value / (1024 * 1024 * 1024);
}

const HOME_SECTIONS = [
  { id: "show_movie", label: "أحدث الأفلام", type: "movie" },
  { id: "show_series", label: "أحدث المسلسلات", type: "series" },
  { id: "show_series_anime", label: "أحدث الأنمي", type: "series_anime" },
  { id: "show_series_kids", label: "أطفال", type: "series_kids" },
  { id: "show_series_sports", label: "رياضة", type: "series_sports" },
  { id: "show_series_tv", label: "برامج تلفزيونية", type: "series_tv" },
  { id: "show_series_ramadan", label: "رمضان", type: "series_ramadan" },
  { id: "show_series_doc", label: "وثائقيات", type: "series_doc" },
  { id: "show_series_learn", label: "تعليمية", type: "series_learn" },
  { id: "show_series_deen", label: "دينية", type: "series_deen" },
];

/**
 * صفحة إدارة المكتبات — لوحة تحكم كاملة.
 * تدعم العرض الهرمي (حاويات → مكتبات)، الفحص، التثبيت، الإضافة والتعديل والحذف.
 */
export function LibrariesPage() {
  const { data: librariesData, isLoading } = useAdminLibraries();
  const { data: settingsData, isLoading: isSettingsLoading } = useAdminSettings();
  const createMutation = useCreateLibrary();
  const updateMutation = useUpdateLibrary();
  const deleteMutation = useDeleteLibrary();
  const togglePinMutation = useTogglePin();
  const startScanMutation = useStartScan();
  const scanAllMutation = useStartScanAll();
  const stopScanMutation = useStopScan();
  const pauseScanMutation = usePauseScan();
  const resumeScanMutation = useResumeScan();
  const updateSettingMutation = useUpdateSettings();
  const { data: summaryData } = useAdminSummary();
  const storageGb = parseFormattedBytesToGb(summaryData?.totalStorage ?? "0 B");

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: number; name: string }[]>([]);
  const [formKey, setFormKey] = useState(0);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);

  /**
   * فتح نافذة إضافة/تعديل مكتبة. تزيد formKey لفرض remount للمكون.
   *
   * @param mode - "create" لمكتبة جديدة أو "edit" لتعديل موجودة.
   * @param library - كائن المكتبة (في وضع edit) أو null.
   */
  const openForm = useCallback(
    (mode: "create" | "edit", library?: Library | null) => {
      setFormMode(mode);
      setEditingLibrary(library ?? null);
      setFormKey((k) => k + 1);
    },
    [setFormMode, setEditingLibrary, setFormKey],
  );
  const [deleteTarget, setDeleteTarget] = useState<Library | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [activeScanId, setActiveScanId] = useState<number | null>(null);
  const [homeSectionsExpanded, setHomeSectionsExpanded] = useState(true);

  const { data: scanProgress, isLoading: isScanProgressLoading } = useScanEvents(activeScanId);

  /**
   * كائن التقدم الذي أُغلقَت عنده نافذة الفحص يدوياً (زر X أو زر الإغلاق).
   * ما دام الفحص جارياً تُعاد فتح النافذة تلقائياً عند وصول كائن تقدم جديد
   * (مختلف المرجع عبر SSE) — أي «تُغلق وتعود فوراً» بدل بقائها مغلقة حتى نهاية
   * الفحص. عند اكتمال الفحص (حالة غير نشطة) تبقى مغلقة. اشتقاق بيانات خالص.
   */
  const [dismissedProgress, setDismissedProgress] = useState<typeof scanProgress>(undefined);

  const isActiveScan = scanProgress?.status === "scanning" || scanProgress?.status === "paused";
  const modalOpen = scanModalOpen || (isActiveScan && dismissedProgress !== scanProgress);

  /**
   * المكتبة المستهدفة لأزرار التحكم (إيقاف/استئناف/إنهاء): تستخدم معرف الفحص
   * المفتوح، وتسقط على المكتبة النشطة من التقدم بعد إعادة تحميل الصفحة.
   */
  const scanTargetId = activeScanId ?? scanProgress?.libraryId ?? null;

  /**
   * إغلاق نافذة الفحص وتسجيل نقطة الرفض كي لا تعود قبل وصول حدث جديد.
   * أثناء فحص نشط تُتجاهل المحاولة تماماً: النافذة مقيّدة بـ`disableClose`
   * ولا تُغلق إلا بعد انتهاء المسح الجاري فعلياً (اكتمالاً أو إيقافاً أو فشلاً).
   */
  const handleScanModalClose = () => {
    if (isActiveScan) return;
    setScanModalOpen(false);
    setDismissedProgress(scanProgress);
  };

  const libraries = useMemo(() => librariesData ?? [], [librariesData]);
  const settings = useMemo(() => settingsData ?? {}, [settingsData]);
  const deepScanEnabled = isSettingEnabled(settings.deep_scan_enabled);
  const isScanAllInProgress = scanAllMutation.isPending;

  const displayedLibraries = useMemo(() => {
    if (currentFolderId === null) {
      return libraries.filter((lib) => !lib.parent_id && !lib.parentId);
    }
    return libraries.filter((lib) => {
      const parent = lib.parent_id ?? lib.parentId;
      return parent != null && Number(parent) === currentFolderId;
    });
  }, [libraries, currentFolderId]);

  const containers = useMemo(
    () => displayedLibraries.filter((lib) => lib.type === "main" || lib.isContainer),
    [displayedLibraries],
  );

  const regular = useMemo(
    () => displayedLibraries.filter((lib) => lib.type !== "main" && !lib.isContainer),
    [displayedLibraries],
  );

  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: "الأقسام الرئيسية",
      onClick: () => {
        setCurrentFolderId(null);
        setFolderHistory([]);
      },
    },
    ...folderHistory.map((folder, idx) => ({
      label: folder.name,
      onClick:
        idx < folderHistory.length - 1
          ? () => {
              setFolderHistory((prev) => prev.slice(0, idx + 1));
              setCurrentFolderId(folder.id);
            }
          : undefined,
    })),
  ];

  /**
   * تفعيل/إلغاء الفحص العميق عبر optimistic update.
   * السويتش يتغير فوراً (من غير انتظار السيرفر) والتوست يظهر بعد التأكيد فقط.
   *
   * @param value - القيمة الجديدة (true = مفعل، false = ملغي).
   */
  const handleToggleDeepScan = useCallback(
    async (value: boolean) => {
      try {
        await updateSettingMutation.mutateAsync({ deep_scan_enabled: value });
        toast.success(value ? "تم تفعيل الفحص العميق" : "تم إلغاء الفحص العميق");
      } catch {
        toast.error("فشل تحديث الإعداد");
      }
    },
    [updateSettingMutation],
  );

  /**
   * إظهار/إخفاء قسم في الواجهة الرئيسية عبر optimistic update.
   *
   * @param key - مفتاح الإعداد (مثلاً show_movie).
   * @param value - القيمة الجديدة.
   */
  const handleToggleHomeSection = useCallback(
    async (key: string, value: boolean) => {
      try {
        await updateSettingMutation.mutateAsync({ [key]: value });
        toast.success("تم تحديث القسم");
      } catch {
        toast.error("فشل تحديث القسم");
      }
    },
    [updateSettingMutation],
  );

  /**
   * التنقل داخل الحاوية عند النقر على بطاقة مكتبة من نوع container،
   * أو فتح نافذة التعديل للمكتبات العادية.
   *
   * @param library - كائن المكتبة التي تم النقر عليها.
   */
  const handleCardClick = useCallback(
    (library: Library) => {
      if (library.type === "main" || library.isContainer) {
        setCurrentFolderId(library.library_id);
        setFolderHistory((prev) => [...prev, { id: library.library_id, name: library.name }]);
      }
      // إزالة else التي تفتح نموذج التعديل
      // else {
      //   setEditingLibrary(library);
      //   setFormMode("edit");
      // }
    },
    [setCurrentFolderId, setFolderHistory, setEditingLibrary, setFormMode],
  );

  /**
   * معالجة فشل طلب بدء فحص (مكتبة واحدة أو فحص الكل).
   *
   * عند الرفض بسبب مسح جارٍ (HTTP 409) لا تُعَدّ المحاولة خطأً للمستخدم:
   * تُوجَّه النافذة إلى المسح الجاري فعلياً عبر تصفير `activeScanId`، فيشترك
   * SSE بدون `libraryId` ويعيد الخادم تقدم العملية النشطة عبر
   * `getActiveProgress()` — وتظل النافذة مقفولة حتى انتهائه.
   * أما بقية الإخفاقات فتُغلَق النافذة ويُعرض سبب الخادم الحقيقي من رسالة
   * `ApiError` بدل رسالة عامة.
   *
   * @param err - الخطأ الراجع من mutation (`ApiError` من عميل API عادةً).
   * @param fallbackMessage - رسالة التوست عند خطأ غير `ApiError` (يحفظ نصّ السياق).
   */
  const handleScanStartFailure = (err: unknown, fallbackMessage: string) => {
    if (err instanceof ApiError && err.statusCode === 409) {
      toast.info(err.message);
      setActiveScanId(null);
      setScanModalOpen(true);
      return;
    }
    setActiveScanId(null);
    setScanModalOpen(false);
    toast.error(err instanceof ApiError ? err.message : fallbackMessage);
  };

  /**
   * بدء فحص مكتبة محددة. يفتح نافذة تقدم الفحص ويستدعي API البدء؛ عند الفشل
   * يُدار الخطأ عبر `handleScanStartFailure` (إغلاق النافذة أو التوجيه للمسح الجاري).
   *
   * @param libraryId - رقم المكتبة.
   */
  const handleStartScan = useCallback(
    async (libraryId: number) => {
      setActiveScanId(libraryId);
      setScanModalOpen(true);
      try {
        await startScanMutation.mutateAsync({
          id: libraryId,
          deepScan: deepScanEnabled,
          forceRescan: deepScanEnabled,
        });
      } catch (err) {
        handleScanStartFailure(err, "فشل بدء الفحص");
      }
    },
    [setActiveScanId, setScanModalOpen, deepScanEnabled, startScanMutation],
  );

  /**
   * إيقاف فحص جارٍ لمكتبة محددة.
   *
   * @param libraryId - رقم المكتبة.
   */
  const handleStopScan = useCallback(
    async (libraryId: number) => {
      try {
        await stopScanMutation.mutateAsync(libraryId);
      } catch {
        toast.error("فشل إيقاف الفحص");
      }
    },
    [stopScanMutation],
  );

  /**
   * بدء فحص جميع المكتبات. يفتح نافذة التقدم ويستدعي scan-all API؛ عند الفشل
   * يُدار الخطأ عبر `handleScanStartFailure` (إغلاق النافذة أو التوجيه للمسح الجاري).
   */
  const handleScanAll = useCallback(async () => {
    setActiveScanId(null);
    setScanModalOpen(true);
    try {
      await scanAllMutation.mutateAsync({
        deepScan: deepScanEnabled,
        forceRescan: deepScanEnabled,
      });
    } catch (err) {
      handleScanStartFailure(err, "فشل فحص الكل");
    }
  }, [setActiveScanId, setScanModalOpen, deepScanEnabled, scanAllMutation]);

  /**
   * حفظ بيانات المكتبة (إضافة أو تعديل) عبر API mutation.
   *
   * @param values - قيم الفورم بعد التحقق.
   */
  const handleFormSubmit = useCallback(
    async (values: LibraryFormValues) => {
      if (formMode === "edit" && editingLibrary) {
        await updateMutation.mutateAsync({
          id: editingLibrary.library_id,
          name: values.name,
          type: values.type,
          parent_id: values.parentId ?? undefined,
          linked_library_id: values.linkedLibraryId ?? undefined,
          paths: values.paths,
          hideSection: values.hideSection,
          language: values.language || null,
          country: values.country || null,
          image: values.image,
        });
        setFormMode(null);
        setEditingLibrary(null);
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          type: values.type,
          parent_id: values.parentId ?? undefined,
          linked_library_id: values.linkedLibraryId ?? undefined,
          paths: values.paths,
          hideSection: values.hideSection,
          language: values.language || null,
          country: values.country || null,
          image: values.image,
        });
        setFormMode(null);
      }
    },
    [formMode, editingLibrary, createMutation, updateMutation, setFormMode, setEditingLibrary],
  );

  /**
   * تأكيد حذف المكتبة المحددة في ConfirmDialog.
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.library_id);
      toast.success(`تم حذف "${deleteTarget.name}" بنجاح`);
      setDeleteTarget(null);
    } catch (err) {
      // سيظهر لك السبب الحقيقي لرفض السيرفر
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("فشل حذف المكتبة، ربما تحتوي على وسائط مرتبطة");
      }
      // إغلاق النافذة حتى في حالة الفشل لكي لا تظل معلقة
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteMutation, setDeleteTarget]);

  /**
   * تثبيت/إلغاء تثبيت مكتبة من الواجهة الرئيسية.
   *
   * @param library - كائن المكتبة.
   */
  const handleTogglePin = useCallback(
    async (library: Library) => {
      togglePinMutation.mutate({ id: library.library_id, is_pinned: !library.is_pinned });
    },
    [togglePinMutation],
  );

  /**
   * التحقق مما إذا كانت المكتبة قيد الفحص حالياً.
   *
   * @param libraryId - رقم المكتبة.
   * @returns true إذا كانت المكتبة تُفحص أو الفحص الكلّي قيد التشغيل.
   */
  const isScanning = (libraryId: number) => {
    if (scanProgress && scanProgress.libraryId === libraryId) {
      return scanProgress.status === "scanning" || scanProgress.status === "paused";
    }
    if (isScanAllInProgress) return true;
    return false;
  };

  const skeletonGrid = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );

  /**
   * عرض شبكة البطاقات (الحاويات أولاً ثم المكتبات العادية).
   * يعرض Skeleton أثناء التحميل أو EmptyState عند عدم وجود مكتبات.
   *
   * @returns JSX لعنصر الشبكة.
   */
  const renderLibraryGrid = () => {
    if (isLoading) return skeletonGrid;

    if (containers.length === 0 && regular.length === 0) {
      return (
        <EmptyState
          icon={<LibraryIcon />}
          title="لا توجد مكتبات"
          description={
            currentFolderId === null
              ? "ابدأ بإنشاء مكتبة جديدة لإدارة محتواك"
              : "لا توجد مكتبات داخل هذا المجلد"
          }
          action={
            currentFolderId === null
              ? { label: "إنشاء مكتبة", onClick: () => openForm("create") }
              : undefined
          }
        />
      );
    }

    const gridClass =
      "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

    return (
      <div className="space-y-6">
        {containers.length > 0 && (
          <div className={gridClass}>
            {containers.map((lib) => (
              <LibraryCard
                key={lib.library_id}
                library={lib}
                isContainer={true}
                isScanning={isScanning(lib.library_id)}
                onCardClick={() => handleCardClick(lib)}
                onEdit={() => openForm("edit", lib)}
                onDelete={() => setDeleteTarget(lib)}
                onScan={() => handleStartScan(lib.library_id)}
                onStopScan={() => handleStopScan(lib.library_id)}
                onTogglePin={() => handleTogglePin(lib)}
              />
            ))}
          </div>
        )}

        {regular.length > 0 && (
          <div className={gridClass}>
            {regular.map((lib) => (
              <LibraryCard
                key={lib.library_id}
                library={lib}
                isContainer={false}
                isScanning={isScanning(lib.library_id)}
                onCardClick={() => handleCardClick(lib)}
                onEdit={() => openForm("edit", lib)}
                onDelete={() => setDeleteTarget(lib)}
                onScan={() => handleStartScan(lib.library_id)}
                onStopScan={() => handleStopScan(lib.library_id)}
                onTogglePin={() => handleTogglePin(lib)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-border bg-secondary rounded-lg border p-4">
        <h2 className="text-sm font-bold sm:text-base">إنشاء وترتيب الأقسام</h2>
        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
          تعمل Youbi بطريقة تقسيم المحتوى على شكل أقسام
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">حجم المكتبة</span>
          <span className="text-foreground text-sm font-bold">{storageGb.toFixed(2)} جيجابايت</span>
        </div>
      </div>

      <div className="border-border bg-secondary flex items-center justify-between rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-bold sm:text-base">الفحص العميق</h2>
          <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
            مزامنة عميقة للملفات (يستغرق وقتاً أطول)
          </p>
        </div>
        <Switch
          checked={deepScanEnabled}
          onChange={(e) => handleToggleDeepScan(e.target.checked)}
          disabled={isSettingsLoading}
        />
      </div>

      <div className="border-border bg-card rounded-lg border p-4">
        <button
          type="button"
          onClick={() => setHomeSectionsExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between text-start"
          aria-expanded={homeSectionsExpanded}
        >
          <div>
            <h2 className="text-sm font-bold sm:text-base">إعدادات الأقسام الرئيسية</h2>
            <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
              إظهار أو إخفاء الأقسام في الواجهة الرئيسية
            </p>
          </div>
          <ChevronDown
            size={20}
            className={`text-muted-foreground transition-transform duration-200 ${
              homeSectionsExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {homeSectionsExpanded && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HOME_SECTIONS.map((section) => {
              const enabled = isSettingEnabled(settings[section.id]);
              return (
                <label
                  key={section.id}
                  className="border-border bg-card flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-foreground text-sm font-bold">{section.label}</span>
                    <span className="text-muted-foreground text-xs">{section.type}</span>
                  </div>
                  <Switch
                    checked={enabled}
                    onChange={(e) => handleToggleHomeSection(section.id, e.target.checked)}
                    disabled={isSettingsLoading}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
      {/* ===== قسم إدارة المكتبات – تأثير طفو مع ظل ===== */}
      <div className="bg-secondary space-y-4 rounded-lg p-4">
        {/* شريط العنوان والأزرار */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-bold sm:text-xl">إدارة المكتبات</h1>
            <Breadcrumbs items={breadcrumbItems} />
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleScanAll}
              disabled={isScanAllInProgress}
            >
              <RefreshCw className={`h-4 w-4 ${isScanAllInProgress ? "animate-spin" : ""}`} />
              {isScanAllInProgress ? "جاري الفحص..." : "فحص الكل"}
            </Button>
            <Button size="sm" onClick={() => openForm("create")}>
              <Plus className="h-4 w-4" />
              مكتبة جديدة
            </Button>
          </div>
        </div>

        {renderLibraryGrid()}

        <LibraryForm
          key={formKey}
          open={formMode !== null}
          onOpenChange={(open) => {
            if (!open) {
              setFormMode(null);
              setEditingLibrary(null);
            }
          }}
          onSubmit={handleFormSubmit}
          defaultParentId={currentFolderId} // <--- تمرير رقم الحاوية الحالية هنا
          initialValues={
            formMode === "edit" && editingLibrary
              ? {
                  id: editingLibrary.library_id,
                  name: editingLibrary.name,
                  type: editingLibrary.type,
                  parentId:
                    (editingLibrary.parent_id as number | null) ??
                    (editingLibrary.parentId as number | null) ??
                    null,
                  linkedLibraryId:
                    (editingLibrary.linked_library_id as number | null) ??
                    (editingLibrary.linkedLibraryId as number | null) ??
                    null,
                  paths: editingLibrary.paths ?? [],
                  hideSection: editingLibrary.hideSection ?? editingLibrary.hide_section ?? false,
                  language: editingLibrary.language ?? "",
                  country: editingLibrary.country ?? "",
                }
              : undefined
          }
          allLibraries={libraries}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="حذف المكتبة"
          description={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmLabel="حذف"
          variant="destructive"
          onConfirm={handleDeleteConfirm}
          loading={deleteMutation.isPending}
        />

        <Modal
          open={modalOpen}
          onOpenChange={(open) => {
            if (open) {
              setScanModalOpen(true);
            } else {
              handleScanModalClose();
            }
          }}
        >
          <ModalContent disableClose={isActiveScan} className="sm:max-w-md">
            <ModalHeader>
              <ModalTitle>حالة الفحص</ModalTitle>
              <ModalDescription>
                {scanTargetId === null ? "جاري فحص جميع المكتبات..." : "تتبع تقدم فحص المكتبة"}
              </ModalDescription>
            </ModalHeader>
            <ScanProgressCard
              progress={scanProgress}
              isLoading={isScanProgressLoading || isScanAllInProgress}
              onPause={() => scanTargetId && pauseScanMutation.mutate(scanTargetId)}
              onResume={() => scanTargetId && resumeScanMutation.mutate(scanTargetId)}
              onStop={() => scanTargetId && handleStopScan(scanTargetId)}
              isPausing={pauseScanMutation.isPending}
              isResuming={resumeScanMutation.isPending}
              isStopping={stopScanMutation.isPending}
            />
            {!isActiveScan && (
              <ModalFooter>
                <Button variant="outline" onClick={handleScanModalClose}>
                  إغلاق
                </Button>
              </ModalFooter>
            )}
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}

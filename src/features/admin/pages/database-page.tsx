"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Save,
  Upload,
  RotateCcw,
  Download,
  Database,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import {
  useAdminDatabaseStats,
  useBackupsList,
  useBackupDatabase,
  useRestoreDatabase,
  useFactoryReset,
  useOptimizeDatabase,
  type BackupFileInfo,
} from "@/features/admin/hooks/use-admin-database";
import { useAdminSettings, useUpdateSettings } from "@/features/admin/hooks/use-admin-settings";

/** خيارات مدة النسخ التلقائي (بالساعات) المطابقة للقديم. */
const INTERVAL_OPTIONS = [
  { value: "1", label: "كل ساعة" },
  { value: "6", label: "كل 6 ساعات" },
  { value: "12", label: "كل 12 ساعة" },
  { value: "24", label: "كل 24 ساعة (يومياً)" },
  { value: "48", label: "كل 48 ساعة (يومين)" },
  { value: "168", label: "كل أسبوع" },
];

/**
 * صفحة "قاعدة البيانات والنسخ الاحتياطية".
 *
 * تتيح للمدير: إنشاء نسخة احتياطية فورية تُحفظ في `data/backups` وتظهر في
 * قائمة النسخ بزر تنزيل، استعادة نسخة من ملف `.db`، العودة إلى وضع المصنع
 * (تصفير البيانات)، تفعيل النسخ التلقائي مع تحديد المدة، وتنزيل أي نسخة
 * موجودة عبر الزر (الزر يقرأ الملف الموجود ولا يُنشئ ملفاً جديداً).
 * تُعرض إحصائيات قاعدة البيانات وزر تحسين كجزء مكمّل من نفس الشاشة.
 */
export function DatabasePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stats, isLoading: statsLoading } = useAdminDatabaseStats();
  const { data: backups = [], isLoading: backupsLoading } = useBackupsList();
  const createBackupMutation = useBackupDatabase();
  const restoreMutation = useRestoreDatabase();
  const factoryResetMutation = useFactoryReset();
  const optimizeMutation = useOptimizeDatabase();

  const { data: settings } = useAdminSettings();
  const updateSettings = useUpdateSettings();

  const autoBackupEnabled = settings?.auto_backup_enabled === true;
  const autoBackupInterval = Number(settings?.auto_backup_interval_hours ?? 24);

  const statsInfo = stats as {
    size?: { bytes: number; formatted: string };
    tables?: { name: string; rows: number; size: string }[];
    totalRecords?: number;
  };

  const handleCreateBackup = async () => {
    const tid = toast.loading("جاري إنشاء نسخة احتياطية...");
    try {
      await createBackupMutation.mutateAsync();
      toast.success("تم إنشاء نسخة احتياطية بنجاح", { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إنشاء النسخة", { id: tid });
    }
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const tid = toast.loading("جاري استعادة البيانات...");
    try {
      await restoreMutation.mutateAsync(file);
      toast.success("تمت الاستعادة بنجاح، سيتم تحديث الصفحة", { id: tid });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ أثناء الاستعادة", { id: tid });
    }
  };

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const handleFactoryReset = async () => {
    setResetConfirmOpen(false);
    const tid = toast.loading("جاري تصفير البيانات...");
    try {
      await factoryResetMutation.mutateAsync();
      toast.success("تم تصفير البيانات بنجاح", { id: tid });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تصفير البيانات", { id: tid });
    }
  };

  const handleDownload = (name: string) => {
    const a = document.createElement("a");
    a.href = `/api/database/download/${encodeURIComponent(name)}`;
    a.download = name;
    a.click();
  };

  const handleToggleAutoBackup = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({ auto_backup_enabled: enabled });
      toast.success(enabled ? "تم تفعيل النسخ التلقائي" : "تم إيقاف النسخ التلقائي");
    } catch {
      toast.error("فشل تحديث الإعدادات");
    }
  };

  const handleIntervalChange = async (hours: number) => {
    try {
      await updateSettings.mutateAsync({ auto_backup_interval_hours: hours });
      toast.success("تم تحديث مدة النسخ التلقائي");
    } catch {
      toast.error("فشل تحديث المدة");
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div>
        <h1 className="text-3xl font-bold">قاعدة البيانات والنسخ الاحتياطية</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          إنشاء نسخة احتياطية أو استعادة وضع المصنع
        </p>
      </div>

      {/* أزرار الإجراءات */}
      <Card>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleCreateBackup} disabled={createBackupMutation.isPending}>
            <Save className="h-4 w-4" />
            {createBackupMutation.isPending ? "جاري الإنشاء..." : "إنشاء نسخة الآن"}
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept=".db,.zip"
            onChange={handleFileRestore}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={restoreMutation.isPending}
          >
            <Upload className="h-4 w-4" />
            {restoreMutation.isPending ? "جاري الاستعادة..." : "استعادة نسخة احتياطية"}
          </Button>

          <Button
            variant="destructive"
            onClick={() => setResetConfirmOpen(true)}
            disabled={factoryResetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4" />
            {factoryResetMutation.isPending ? "جاري التصفير..." : "العودة إلى وضع المصنع"}
          </Button>

          <Button
            variant="outline"
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${optimizeMutation.isPending ? "animate-spin" : ""}`} />
            {optimizeMutation.isPending ? "جاري..." : "تحسين قاعدة البيانات"}
          </Button>
        </CardContent>
      </Card>

      {/* تنبيه */}
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          جميع النسخ المرفوعة إلى السحابة لا تحتوي على صور الأقسام
        </AlertDescription>
      </Alert>

      {/* قسم السحابة */}
      <div>
        <h2 className="text-lg font-bold">النسخ الاحتياطية في السحابة</h2>
        <p className="text-muted-foreground mt-2 text-sm italic">لا توجد نسخ احتياطية حالياً</p>
      </div>

      {/* النسخ التلقائية في الجهاز — الإعدادات + القائمة بزر التنزيل (تخطيط القديم) */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold">النسخ الاحتياطية التلقائية في الجهاز</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Switch
            label="تفعيل النسخ الاحتياطية؟"
            checked={autoBackupEnabled}
            onChange={(e) => handleToggleAutoBackup(e.target.checked)}
            disabled={updateSettings.isPending}
          />
          {autoBackupEnabled && (
            <Select
              value={String(autoBackupInterval)}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              options={INTERVAL_OPTIONS}
              className="w-60"
              disabled={updateSettings.isPending}
            />
          )}
        </div>

        {backupsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            لا توجد نسخ احتياطية محلية
          </p>
        ) : (
          <ul className="space-y-2">
            {backups.map((file: BackupFileInfo) => (
              <li key={file.name}>
                <Card className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="text-foreground truncate font-mono text-sm" dir="ltr">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-sm">- {file.size}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        ({file.timeLabel})
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleDownload(file.name)}
                    >
                      <Download className="h-4 w-4" />
                      اضغط للتنزيل
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* إحصائيات قاعدة البيانات */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>إحصائيات قاعدة البيانات</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="bg-muted h-28 animate-pulse rounded-lg" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border-border flex flex-col items-center gap-2 rounded-lg border p-6">
                <Database className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-sm">الحجم</p>
                <p className="text-2xl font-bold">{statsInfo.size?.formatted ?? "—"}</p>
              </div>
              <div className="border-border flex flex-col items-center gap-2 rounded-lg border p-6">
                <Database className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-sm">الجداول</p>
                <p className="text-2xl font-bold">{statsInfo.tables?.length ?? 0}</p>
              </div>
              <div className="border-border flex flex-col items-center gap-2 rounded-lg border p-6">
                <Database className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-sm">السجلات</p>
                <p className="text-2xl font-bold">{statsInfo.totalRecords ?? 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title="العودة إلى وضع المصنع"
        description="هل أنت متأكد؟ سيتم تصفير كافة البيانات ولا يمكن التراجع."
        confirmLabel="تصفير البيانات"
        variant="destructive"
        onConfirm={() => void handleFactoryReset()}
      />
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Key,
  RefreshCw,
  Trash2,
  CheckCircle,
  ShieldX,
  FileText,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import {
  useLicenseStatus,
  useActivateLicense,
  useActivateLicenseFile,
  useDeactivateLicense,
  useRefreshLicense,
} from "@/features/admin/hooks/use-admin-license";

/**
 * صفحة إدارة الترخيص في لوحة التحكم.
 * تعرض حالة الترخيص الحالية وتتيح التفعيل (لصق JSON أو رفع ملف .lic) والإلغاء.
 */
export function LicensePage() {
  const { data: status, isLoading } = useLicenseStatus();
  const activateMutation = useActivateLicense();
  const activateFileMutation = useActivateLicenseFile();
  const deactivateMutation = useDeactivateLicense();
  const refreshMutation = useRefreshLicense();

  const [licenseJson, setLicenseJson] = useState("");
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActivated = status?.activated === true;

  const handleActivatePaste = () => {
    const data = licenseJson.trim();
    if (!data) {
      toast.error("قم بلصق محتوى ملف الترخيص (.lic JSON) أولاً");
      return;
    }
    activateMutation.mutate(data, {
      onSuccess: () => {
        toast.success("تم تفعيل الترخيص بنجاح");
        setLicenseJson("");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل التفعيل"),
    });
  };

  const handleFileUpload = (file: File | undefined) => {
    if (!file) return;
    activateFileMutation.mutate(file, {
      onSuccess: () => {
        toast.success("تم تفعيل الترخيص من الملف بنجاح");
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "ملف ترخيص غير صالح"),
    });
  };

  const handleDeactivate = () => {
    setDeactivateConfirmOpen(false);
    deactivateMutation.mutate(undefined, {
      onSuccess: () => toast.success("تم إلغاء تفعيل الترخيص"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل إلغاء التفعيل"),
    });
  };

  const handleRefresh = () => {
    refreshMutation.mutate(undefined, {
      onSuccess: () => toast.success("تم تحديث الترخيص"),
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "الترخيص لا يزال غير صالح"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">الترخيص</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">الترخيص</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="gap-2"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            تحديث
          </Button>
          {isActivated && (
            <Button
              variant="destructive"
              onClick={() => setDeactivateConfirmOpen(true)}
              disabled={deactivateMutation.isPending}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              إلغاء التفعيل
            </Button>
          )}
        </div>
      </div>

      {/* نظرة عامة على الترخيص */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            {isActivated ? (
              <CheckCircle className="h-10 w-10 text-green-500" />
            ) : (
              <ShieldX className="text-destructive h-10 w-10" />
            )}
            <p className="text-muted-foreground text-sm">الحالة</p>
            <p className="text-lg font-bold">{isActivated ? "مفعل" : "غير مفعل"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <Key className="text-muted-foreground h-10 w-10" />
            <p className="text-muted-foreground text-sm">مفتاح الترخيص</p>
            <p className="font-mono text-lg font-bold" dir="ltr">
              {status?.licenseKey ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <FileText className="text-muted-foreground h-10 w-10" />
            <p className="text-muted-foreground text-sm">العميل</p>
            <p className="text-lg font-bold">{status?.clientName ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      {status?.expiryDate && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-muted-foreground text-sm">تاريخ الانتهاء</p>
            <p className="text-lg font-semibold">
              {new Date(status.expiryDate).toLocaleDateString("ar-SA")}
            </p>
          </CardContent>
        </Card>
      )}

      {status?.features && status.features.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 py-4">
            <p className="text-muted-foreground text-sm">الميزات:</p>
            {status.features.map((feature) => (
              <Badge key={feature} variant="secondary">
                {feature}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {isActivated ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">الترخيص نشط</h2>
            <p className="text-muted-foreground">البرنامج مرخص بشكل صحيح</p>
            {status?.clientName && (
              <p className="text-muted-foreground text-sm">مرخص لـ: {status.clientName}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-6 py-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Key className="h-5 w-5" />
              تفعيل الترخيص
            </h2>
            {status?.message && (
              <p className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                {status.message}
              </p>
            )}

            <div className="space-y-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".lic,.json"
                label="رفع ملف الترخيص .lic"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
                disabled={activateFileMutation.isPending}
                className="file:bg-primary/10 file:text-primary cursor-pointer file:me-3 file:rounded-md file:border-0 file:px-3 file:py-1 file:text-sm file:font-medium"
              />
            </div>

            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <div className="bg-border h-px flex-1" />
              أو لصق JSON
              <div className="bg-border h-px flex-1" />
            </div>

            <div className="space-y-2">
              <Textarea
                label="لصق محتوى ملف الترخيص"
                value={licenseJson}
                onChange={(e) => setLicenseJson(e.target.value)}
                placeholder='{"licenseKey":"LMC-XXXX-XXXX-XXXX","clientName":"...","signature":"..."}'
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleActivatePaste}
              disabled={activateMutation.isPending || !licenseJson.trim()}
              className="w-full gap-2"
            >
              {activateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التفعيل...
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  تفعيل الترخيص
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deactivateConfirmOpen}
        onOpenChange={setDeactivateConfirmOpen}
        title="إلغاء تفعيل الترخيص"
        description="سيتم إلغاء الترخيص الحالي، هل أنت متأكد؟"
        confirmLabel="إلغاء التفعيل"
        variant="destructive"
        onConfirm={() => void handleDeactivate()}
      />
    </div>
  );
}

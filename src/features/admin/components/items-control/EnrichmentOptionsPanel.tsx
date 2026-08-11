"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings2, ShieldCheck, Save } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Select } from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { useAdminSettings, useUpdateSettings } from "@/features/admin/hooks/use-admin-settings";
import {
  useUpdateEnrichmentApiKey,
  useTestEnrichmentConnection,
} from "@/features/admin/hooks/use-admin-enrichment";

const STORAGE_MODE_OPTIONS = [
  { value: "local", label: "المجلد العام" },
  { value: "s3", label: "التخزين السحابي (S3)" },
  { value: "both", label: "كليهما" },
];

/**
 * لوحة إعدادات الإثراء لصفحة التحكم بالعناصر.
 *
 * تسمح للمشرف بحفظ مفتاح TMDB واختبار الاتصال، وضبط خيارات التنزيل
 * (الصور، صور الممثلين) وطريقة التخزين عبر إعدادات النظام العامة.
 * جميع التغييرات تُحفظ مباشرة في الخلفية عبر الـ API المعنية.
 */
export function EnrichmentOptionsPanel() {
  const { data: settings } = useAdminSettings();
  const updateSettingsMutation = useUpdateSettings();
  const updateApiKeyMutation = useUpdateEnrichmentApiKey();
  const testConnectionMutation = useTestEnrichmentConnection();

  const [apiKey, setApiKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const downloadImages = Boolean(settings?.download_images);
  const downloadCastImages = Boolean(settings?.download_cast_images);
  const storageMode = typeof settings?.storage_mode === "string" ? settings.storage_mode : "local";

  const handleToggle = (key: "download_images" | "download_cast_images", value: boolean) => {
    updateSettingsMutation.mutate(
      { [key]: value },
      {
        onSuccess: () => toast.success("تم حفظ الإعداد"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "فشل حفظ الإعداد"),
      },
    );
  };

  const handleStorageMode = (value: string) => {
    updateSettingsMutation.mutate(
      { storage_mode: value },
      {
        onSuccess: () => toast.success("تم حفظ طريقة التخزين"),
        onError: (error) => toast.error(error instanceof Error ? error.message : "فشل حفظ الإعداد"),
      },
    );
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim().length < 10) {
      toast.error("مفتاح API يجب أن يكون 10 أحرف على الأقل");
      return;
    }
    updateApiKeyMutation.mutate(apiKey.trim(), {
      onSuccess: () => {
        toast.success("تم حفظ مفتاح TMDB");
        setApiKey("");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل حفظ المفتاح"),
    });
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate(apiKey.trim(), {
      onSuccess: (data) => {
        toast.success(`الاتصال ناجح — فيلم الاختبار: ${data.testMovie ?? "N/A"}`);
        setApiKey("");
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "فشل الاتصال مع TMDB"),
    });
  };

  return (
    <Card className="border-border/10">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-muted-foreground"
          >
            <Settings2 className="h-4 w-4" />
            خيارات الإثراء
          </Button>
          <p className="text-muted-foreground text-xs">مفتاح TMDB، تنزيل الصور، وطريقة التخزين</p>
        </div>

        {showAdvanced && (
          <div className="border-border/10 mt-3 space-y-4 border-t pt-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tmdb-api-key">مفتاح The Movie DB API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="tmdb-api-key"
                    type="password"
                    dir="rtl"
                    autoComplete="new-password"
                    placeholder="اتركه فارغاً لاستخدام السيرفر الافتراضي"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveApiKey}
                    disabled={updateApiKeyMutation.isPending}
                    aria-busy={updateApiKeyMutation.isPending}
                  >
                    <Save className="h-4 w-4" />
                    حفظ
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={testConnectionMutation.isPending}
                    aria-busy={testConnectionMutation.isPending}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    TMDB
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  سجّل حساباً على{" "}
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    themoviedb.org/settings/api
                  </a>{" "}
                  وانسخ API Key (v3 auth).
                </p>
              </div>

              <div className="space-y-3">
                <Switch
                  checked={downloadImages}
                  onChange={(e) => handleToggle("download_images", e.target.checked)}
                  label="تحميل الصور عند الإثراء"
                />
                <Switch
                  checked={downloadCastImages}
                  onChange={(e) => handleToggle("download_cast_images", e.target.checked)}
                  label="تحميل صور الممثلين"
                />
                <Select
                  label="طريقة تخزين الصور"
                  value={storageMode}
                  onChange={(e) => handleStorageMode(e.target.value)}
                  options={STORAGE_MODE_OPTIONS}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

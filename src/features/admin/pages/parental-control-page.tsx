/**
 * @file parental-control-page.tsx
 * @description صفحة التحكم بالوصول — إدارة قائمة الحظر العالمية للتصنيفات العمرية.
 *   تعمل على مفتاحين من سجل الإعدادات: `parental_control_enabled` (تفعيل) و
 *   `blocked_certifications` (القائمة). لا تدعم per-user أو per-library في المرحلة الأولى.
 */

"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, ShieldOff, X, Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import {
  useAdminSettings,
  useUpdateSettings,
} from "@/features/admin/hooks/use-admin-settings";
import { apiFetch } from "@/lib/frontend/api-client";

/**
 * شكل بيانات التصنيف المُرجعة من `/api/media/certifications`.
 */
interface CertificationItem {
  name: string;
  count: number;
}

/**
 * الحالة الأولية للنموذج.
 */
interface FormState {
  parental_control_enabled: boolean;
  blocked_certifications: string[];
}

const EMPTY_FORM: FormState = {
  parental_control_enabled: false,
  blocked_certifications: [],
};

/**
 * جلب قائمة التصنيفات العمرية المتاحة في المكتبة.
 *
 * @returns مصفوفة `{ name, count }` — الاسم وعدد العناصر لكل تصنيف.
 */
function useCertifications() {
  return useQuery({
    queryKey: ["admin", "certifications"],
    queryFn: async () => {
      const res = await apiFetch<CertificationItem[]>("/api/media/certifications");
      if (!res.success || !res.data) return [] as CertificationItem[];
      return res.data;
    },
    staleTime: 300_000,
  });
}

const inputClass =
  "w-full rounded-lg border-none bg-input py-2.5 pl-2.5 pr-4 text-foreground outline-hidden ring-1 ring-border transition-all focus:ring-1 focus:ring-accent placeholder:text-muted-foreground";

/**
 * صفحة التحكم بالوصول — Global Content Blocklist.
 *
 * تتضمن:
 * - مفتاح تفعيل/تعطيل (`parental_control_enabled`)
 * - قائمة مرشحة للتصنيفات المتاحة
 * - قائمة الحظر الحالية مع إمكانية الإضافة والإزالة
 * - شرح السلوك: المحتوى بدون تصنيف (null/empty) يُسمح دائماً
 *
 * @returns واجهة إدارة الحظر العالمي.
 */
export function ParentalControlPage(): React.ReactNode {
  const { data, isLoading } = useAdminSettings();
  const { data: certs, isLoading: certsLoading } = useCertifications();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [prevData, setPrevData] = useState(data);

  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setForm({
        parental_control_enabled: data.parental_control_enabled === true,
        blocked_certifications: Array.isArray(data.blocked_certifications)
          ? [...data.blocked_certifications]
          : [],
      });
    }
  }

  const [newCert, setNewCert] = useState("");

  /** التصنيفات المتاحة التي لم تُ добавَ بعد. */
  const availableCerts = useMemo(() => {
    const blocked = new Set(form.blocked_certifications);
    return (certs ?? []).filter((c) => !blocked.has(c.name));
  }, [certs, form.blocked_certifications]);

  /** إضافة تصنيف إلى القائمة. */
  const addCert = (name: string): void => {
    if (!name || form.blocked_certifications.includes(name)) return;
    setForm({ ...form, blocked_certifications: [...form.blocked_certifications, name] });
    setNewCert("");
  };

  /** إزالة تصنيف من القائمة. */
  const removeCert = (name: string): void => {
    setForm({
      ...form,
      blocked_certifications: form.blocked_certifications.filter((c) => c !== name),
    });
  };

  /** حفظ التغييرات. */
  const handleSave = async (): Promise<void> => {
    try {
      await updateMutation.mutateAsync({
        parental_control_enabled: form.parental_control_enabled,
        blocked_certifications: form.blocked_certifications,
      });
      toast.success("تم حفظ إعدادات التحكم بالوصول بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ أثناء الحفظ");
    }
  };

  if (isLoading || certsLoading) {
    return (
      <div className="text-foreground flex h-100 items-center justify-center p-20">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-xs font-bold tracking-widest uppercase opacity-50">
            Loading...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-8 p-6" dir="rtl">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground w-fit text-[26px] font-black">
            التحكم بالوصول
          </h1>
        </div>
        <p className="text-muted-foreground mt-1.75 font-medium">
          إدارة القائمة العالمية للمحتوى المحظور — يُطبَّق على جميع المستخدمين
          باستثناء المدير.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* --- بطاقة التفعيل --- */}
        <section className="bg-card shadow-card ring-border rounded-2xl p-6 ring-1">
          <div className="text-foreground mb-5 flex items-center gap-2 text-[18px] font-black">
            <span className="text-accent">
              {form.parental_control_enabled ? <Shield size={20} /> : <ShieldOff size={20} />}
            </span>
            التحكم بالوصول
          </div>
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <Label className="text-foreground block text-sm font-bold">
                تفعيل الحظر
              </Label>
              <p className="text-muted-foreground text-xs">
                عند التفعيل، يُمنع المحتوى ذو التصنيفات المحظورة من الظهور في جميع
                القوائم والبحث والصفحات التفصيلية والبث — للمدير فقط يبقى كل شيء
                مرئياً.
              </p>
              <Switch
                checked={form.parental_control_enabled}
                onChange={(e) =>
                  setForm({ ...form, parental_control_enabled: e.target.checked })
                }
              />
            </div>

            {form.parental_control_enabled && (
              <div className="bg-accent/5 rounded-xl p-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <strong className="text-foreground">ملاحظة:</strong> المحتوى بدون
                  تصنيف عمرية (null أو فارغ) يُسمح دائماً — حتى عند تفعيل الحظر.
                  المدير يرى كل شيء دائماً regardless من الإعدادات.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* --- بطاقة القائمة --- */}
        <section className="bg-card shadow-card ring-border rounded-2xl p-6 ring-1">
          <div className="text-foreground mb-5 flex items-center gap-2 text-[18px] font-black">
            <span className="text-accent">
              <Shield size={20} />
            </span>
            قائمة الحظر
          </div>
          <div className="space-y-5">
            {/* حقل الإضافة — قائمة جاهزة */}
            <div className="space-y-1.5">
              <Label className="text-foreground block text-sm font-bold">
                إضافة تصنيف
              </Label>
              <div className="flex gap-2">
                <select
                  className={`${inputClass} flex-1`}
                  value={newCert}
                  onChange={(e) => setNewCert(e.target.value)}
                >
                  <option value="">اختر تصنيفاً...</option>
                  {availableCerts.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count} عنصر)
                    </option>
                  ))}
                </select>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => addCert(newCert)}
                  disabled={!newCert}
                  className="shrink-0"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {/* القائمة الحالية */}
            <div className="space-y-1.5">
              <Label className="text-foreground block text-sm font-bold">
                التصنيفات المحظورة
                {form.blocked_certifications.length > 0 && (
                  <span className="text-muted-foreground ms-1 text-xs font-normal">
                    ({form.blocked_certifications.length})
                  </span>
                )}
              </Label>
              {form.blocked_certifications.length === 0 ? (
                <p className="text-muted-foreground rounded-lg bg-input/50 p-4 text-center text-xs">
                  لا توجد تصنيفات محظورة — جميع المحتويات مرئية.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {form.blocked_certifications.map((cert) => (
                    <span
                      key={cert}
                      className="bg-destructive/10 text-destructive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
                    >
                      {cert}
                      <button
                        type="button"
                        onClick={() => removeCert(cert)}
                        className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {form.parental_control_enabled && form.blocked_certifications.length === 0 && (
              <p className="text-muted-foreground rounded-lg bg-input/50 p-3 text-center text-xs">
                الحظر مفعّل لكن القائمة فارغة — لا يوجد محتوى محظور.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* زر الحفظ */}
      <div className="flex justify-end">
        <Button
          variant="default"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="min-w-32"
        >
          {updateMutation.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </div>
  );
}

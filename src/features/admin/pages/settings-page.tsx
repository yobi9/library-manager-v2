/**
 * @file settings-page.tsx
 * @description صفحة الإعدادات المركزية للوحة الأدمن — تعمل على مفاتيح السجل الموحد
 * (`src/backend/settings/settings-registry.ts`) وتُرسل الأنواع الصحيحة (boolean/number/string).
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { toast } from "sonner";
import { Save, Settings2, Users, LayoutDashboard, Wrench } from "lucide-react";
import { useAdminSettings, useUpdateSettings } from "@/features/admin/hooks/use-admin-settings";
 

/**
 * حالة نموذج الإعدادات — مفاتيح مطابقة لسجل الإعدادات في الباك-إند.
 *
 * @property site_title - اسم الشبكة الظاهر للمستخدمين.
 * @property site_description - وصف الخدمة.
 * @property site_owner - اسم مالك النظام.
 * @property contact_phone - رقم التواصل.
 * @property official_site_url - الموقع الرسمي.
 * @property copyright_text - نص الحقوق المحفوظة.
 * @property social_links_* - روابط التواصل الاجتماعي.
 * @property language - اللغة الافتراضية.
 * @property results_per_page - عدد النتائج في الصفحات العامة.
 * @property viewer_access_mode - نمط حماية الواجهة (public/protected).
 * @property enable_registration - تفعيل تسجيل الحسابات.
 * @property maintenance_mode - وضع الصيانة.
 */
interface SettingsFormState {
  site_title: string;
  site_description: string;
  site_owner: string;
  contact_phone: string;
  official_site_url: string;
  copyright_text: string;
  social_links_facebook: string;
  social_links_twitter: string;
  social_links_instagram: string;
  social_links_youtube: string;
  social_links_telegram: string;
  social_links_whatsapp: string;
  language: string;
  results_per_page: number;
  viewer_access_mode: "public" | "protected";
  enable_registration: boolean;
  maintenance_mode: boolean;
}

const EMPTY_FORM: SettingsFormState = {
  site_title: "",
  site_description: "",
  site_owner: "",
  contact_phone: "",
  official_site_url: "",
  copyright_text: "",
  social_links_facebook: "",
  social_links_twitter: "",
  social_links_instagram: "",
  social_links_youtube: "",
  social_links_telegram: "",
  social_links_whatsapp: "",
  language: "ar",
  results_per_page: 20,
  viewer_access_mode: "public",
  enable_registration: true,
  maintenance_mode: false,
};

const LANGUAGE_OPTIONS = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "de", label: "Deutsch" },
  { value: "tr", label: "Türkçe" },
];

const ACCESS_MODE_OPTIONS = [
  { value: "public", label: "عام (للكل)" },
  { value: "protected", label: "محمي (يتطلب تسجيل دخول)" },
];

const SOCIAL_FIELDS: Array<{ key: keyof SettingsFormState; label: string; placeholder: string }> = [
  { key: "social_links_facebook", label: "فيسبوك", placeholder: "https://facebook.com/..." },
  { key: "social_links_twitter", label: "تويتر / X", placeholder: "https://x.com/..." },
  { key: "social_links_instagram", label: "إنستغرام", placeholder: "https://instagram.com/..." },
  { key: "social_links_youtube", label: "يوتيوب", placeholder: "https://youtube.com/..." },
  { key: "social_links_telegram", label: "تيليغرام", placeholder: "https://t.me/..." },
  { key: "social_links_whatsapp", label: "واتساب", placeholder: "https://wa.me/..." },
];

const inputClass =
  "w-full rounded-lg border-none bg-input py-2.5 pl-2.5 pr-4 text-foreground outline-hidden ring-1 ring-border transition-all focus:ring-1 focus:ring-accent placeholder:text-muted-foreground";

/**
 * مكوّن حقل نصي موحّد داخل بطاقة إعدادات.
 */
function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground block text-sm font-bold">{label}</Label>
      <input
        type={type}
        className={inputClass}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * بطاقة إعدادات ذات عنوان وأيقونة.
 */
function SettingsCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card shadow-card ring-border rounded-2xl p-6 ring-1">
      <div className="text-foreground mb-5 flex items-center gap-2 text-[18px] font-black">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/**
 * صفحة الإعدادات الرئيسية — تجلب البيانات عبر `useAdminSettings` وتحدّثها عبر
 * `useUpdateSettings` بالأنواع الصحيحة.
 *
 * @returns واجهة التحكم بالإعدادات.
 */
export function SettingsPage(): React.ReactNode {
  const { data, isLoading } = useAdminSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState<SettingsFormState>(EMPTY_FORM);

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      setForm({
        site_title: String(data.site_title ?? ""),
        site_description: String(data.site_description ?? ""),
        site_owner: String(data.site_owner ?? ""),
        contact_phone: String(data.contact_phone ?? ""),
        official_site_url: String(data.official_site_url ?? ""),
        copyright_text: String(data.copyright_text ?? ""),
        social_links_facebook: String(data.social_links_facebook ?? ""),
        social_links_twitter: String(data.social_links_twitter ?? ""),
        social_links_instagram: String(data.social_links_instagram ?? ""),
        social_links_youtube: String(data.social_links_youtube ?? ""),
        social_links_telegram: String(data.social_links_telegram ?? ""),
        social_links_whatsapp: String(data.social_links_whatsapp ?? ""),
        language: String(data.language ?? "ar"),
        results_per_page: Number(data.results_per_page ?? 20),
        viewer_access_mode: data.viewer_access_mode === "protected" ? "protected" : "public",
        enable_registration: data.enable_registration !== false,
        maintenance_mode: data.maintenance_mode === true,
      });
    }
  }

  /**
   * معالج الحفظ — يبني الحمولة بالأنواع الصحيحة ويرسلها للباك-إند.
   */
  const handleSave = async (): Promise<void> => {
    try {
      const payload = {
        site_title: form.site_title,
        site_description: form.site_description,
        site_owner: form.site_owner,
        contact_phone: form.contact_phone,
        official_site_url: form.official_site_url,
        copyright_text: form.copyright_text,
        social_links_facebook: form.social_links_facebook,
        social_links_twitter: form.social_links_twitter,
        social_links_instagram: form.social_links_instagram,
        social_links_youtube: form.social_links_youtube,
        social_links_telegram: form.social_links_telegram,
        social_links_whatsapp: form.social_links_whatsapp,
        language: form.language,
        results_per_page: Number(form.results_per_page) || 20,
        viewer_access_mode: form.viewer_access_mode,
        enable_registration: form.enable_registration,
        maintenance_mode: form.maintenance_mode,
      };
      await updateMutation.mutateAsync(payload);
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات");
    }
  };

  if (isLoading) {
    return (
      <div className="text-foreground flex h-100 items-center justify-center p-20">
        <div className="flex flex-col items-center gap-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-xs font-bold tracking-widest uppercase opacity-50">
            Loading Settings...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-8 p-6" dir="rtl">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="text-foreground w-fit text-[26px] font-black">الاعدادات الرئيسية</h1>
          <span className="bg-accent text-accent-foreground shadow-accent/20 mt-1.25 rounded-[10px] px-2.5 py-1.25 text-[12px] font-bold shadow-lg">
            PRO ONLY
          </span>
        </div>
        <p className="text-muted-foreground mt-1.75 font-medium">تعديل الاعدادات الرئيسية للنظام</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SettingsCard title="معلومات عامة" icon={<Settings2 size={20} />}>
          <TextField
            label="اسم الشبكة"
            value={form.site_title}
            onChange={(v) => setForm({ ...form, site_title: v })}
            placeholder="اسم الشبكة الظاهر للمستخدمين"
          />
          <div className="space-y-1.5">
            <Label className="text-foreground block text-sm font-bold">وصف الشبكة</Label>
            <textarea
              className={`${inputClass} min-h-20 resize-y`}
              placeholder="وصف مختصر للخدمة..."
              value={form.site_description}
              onChange={(e) => setForm({ ...form, site_description: e.target.value })}
            />
          </div>
          <TextField
            label="مالك النظام"
            value={form.site_owner}
            onChange={(v) => setForm({ ...form, site_owner: v })}
          />
          <TextField
            label="نص الحقوق المحفوظة"
            value={form.copyright_text}
            onChange={(v) => setForm({ ...form, copyright_text: v })}
          />
        </SettingsCard>

        <SettingsCard title="التواصل" icon={<Users size={20} />}>
          <TextField
            label="رقم التواصل"
            value={form.contact_phone}
            onChange={(v) => setForm({ ...form, contact_phone: v })}
          />
          <TextField
            label="الموقع الرسمي"
            value={form.official_site_url}
            onChange={(v) => setForm({ ...form, official_site_url: v })}
            placeholder="https://..."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SOCIAL_FIELDS.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                value={form[field.key] as string}
                onChange={(v) => setForm({ ...form, [field.key]: v })}
                placeholder={field.placeholder}
              />
            ))}
          </div>
        </SettingsCard>

        <SettingsCard title="إعدادات الواجهة" icon={<LayoutDashboard size={20} />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="اللغة الافتراضية"
              options={LANGUAGE_OPTIONS}
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            />
            <Select
              label="نمط حماية الواجهة"
              options={ACCESS_MODE_OPTIONS}
              value={form.viewer_access_mode}
              onChange={(e) =>
                setForm({
                  ...form,
                  viewer_access_mode: e.target.value as "public" | "protected",
                })
              }
            />
          </div>
          <TextField
            label="عدد النتائج في الصفحة (1 - 100)"
            value={form.results_per_page}
            onChange={(v) => setForm({ ...form, results_per_page: Number(v) })}
            type="number"
          />
          <div className="flex flex-col gap-2">
            <Label className="text-foreground block text-sm font-bold">تفعيل تسجيل الحسابات</Label>
            <Switch
              checked={form.enable_registration}
              onChange={(e) => setForm({ ...form, enable_registration: e.target.checked })}
            />
          </div>
        </SettingsCard>

        <SettingsCard title="الصيانة والأمان" icon={<Wrench size={20} />}>
          <div className="flex flex-col gap-2">
            <Label className="text-foreground block text-sm font-bold">وضع الصيانة</Label>
            <p className="text-muted-foreground text-xs">
              عند التفعيل تُغلق الواجهة العامة أمام الزوار ويبقى الوصول للمدراء فقط.
            </p>
            <Switch
              checked={form.maintenance_mode}
              onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })}
            />
          </div>
        </SettingsCard>
 </div>
    </div>
  );
}

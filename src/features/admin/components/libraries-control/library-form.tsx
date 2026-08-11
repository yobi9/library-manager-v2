"use client";

import React, { useState } from "react";
import type { Library } from "@/lib/frontend/api-media";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useFolderPicker } from "@/features/admin/hooks/use-folder-picker";
import { X, Plus, Folder } from "lucide-react";

export interface LibraryFormValues {
  id?: number;
  name: string;
  type: string;
  parentId: number | null;
  linkedLibraryId?: number | null;
  paths: string[];
  image?: File;
  hideSection: boolean;
  language: string;
  country: string;
}

interface LibraryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LibraryFormValues) => Promise<void>;
  initialValues?: Partial<LibraryFormValues>;
  defaultParentId?: number | null; // <--- القيمة الافتراضية للحاوية الحالية
  allLibraries: Library[];
  isSubmitting?: boolean;
}

const LIBRARY_TYPES = [
  { value: "main", label: "حاوية رئيسية" },
  { value: "linked", label: "اختصار لقسم آخر" },
  { value: "movie", label: "أفلام" },
  { value: "series", label: "مسلسلات" },
  { value: "series_anime", label: "أنمي" },
  { value: "series_sports", label: "رياضة" },
  { value: "series_ramadan", label: "رمضان" },
  { value: "series_tv", label: "مسلسلات تلفزيونية" },
  { value: "series_deen", label: "دينية" },
  { value: "series_kids", label: "أطفال" },
  { value: "series_learn", label: "تعليمية" },
  { value: "theater", label: "مسرحيات" },
  { value: "series_doc", label: "وثائقية" },
  { value: "music", label: "صوتيات" },
  { value:"audio_deen", label: "صوتيات دينية" },
  { value: "photo", label: "صور" },
  { value: "book", label: "كتب" },
  { value: "app", label: "تطبيقات" },
  { value: "vidsSameFolder", label: "فيديوهات (مجلد مباشر)" },
  { value: "audioSameFolder", label: "صوتيات (مجلد مباشر)" },
  { value: "appsSameFolder", label: "تطبيقات (مجلد مباشر)" },
  { value: "imagesSameFolder", label: "صور (مجلد مباشر)" },
  { value: "booksSameFolder", label: "كتب (مجلد مباشر)" },
];

const LANGUAGES = [
  { value: "", label: "تلقائي" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "الإنجليزية" },
  { value: "fr", label: "الفرنسية" },
  { value: "de", label: "الألمانية" },
  { value: "es", label: "الإسبانية" },
  { value: "tr", label: "التركية" },
  { value: "it", label: "الإيطالية" },
  { value: "ru", label: "الروسية" },
  { value: "hi", label: "الهندية" },
  { value: "ja", label: "اليابانية" },
  { value: "ko", label: "الكورية" },
  { value: "zh", label: "الصينية" },
  { value: "pt", label: "البرتغالية" },
  { value: "fa", label: "الفارسية" },
];

const COUNTRIES = [
  { value: "", label: "تلقائي" },
  { value: "US", label: "أمريكا" },
  { value: "GB", label: "بريطانيا" },
  { value: "TR", label: "تركيا" },
  { value: "IR", label: "ايران" },
  { value: "IN", label: "الهند" },
  { value: "JP", label: "اليابان" },
  { value: "KR", label: "كوريا" },
  { value: "FR", label: "فرنسا" },
  { value: "DE", label: "ألمانيا" },
  { value: "IT", label: "إيطاليا" },
  { value: "ES", label: "إسبانيا" },
  { value: "RU", label: "روسيا" },
  { value: "CN", label: "الصين" },
  { value: "EG", label: "مصر" },
  { value: "SA", label: "السعودية" },
  { value: "AE", label: "الإمارات" },
  { value: "IQ", label: "العراق" },
  { value: "SY", label: "سوريا" },
  { value: "JO", label: "الأردن" },
  { value: "PS", label: "فلسطين" },
  { value: "LB", label: "لبنان" },
  { value: "KW", label: "الكويت" },
  { value: "QA", label: "قطر" },
  { value: "BH", label: "البحرين" },
  { value: "OM", label: "عمان" },
  { value: "YE", label: "اليمن" },
];

export function LibraryForm({
  open,
  onOpenChange,
  onSubmit,
  defaultParentId, // <--- استلام المتغير
  initialValues,
  allLibraries,
  isSubmitting,
}: LibraryFormProps) {
  // تحديث القيم الأولية لتأخذ defaultParentId في عين الاعتبار عند عدم وجود initialValues
  const effectiveParentId = initialValues?.parentId ?? defaultParentId ?? null;
  const [name, setName] = useState(() => initialValues?.name ?? "");
  const [type, setType] = useState(() => initialValues?.type ?? "movie");
  const [parentId, setParentId] = useState(() => initialValues?.parentId ?? null);
  const [linkedLibraryId, setLinkedLibraryId] = useState<number | null>(
    () => initialValues?.linkedLibraryId ?? null,
  );
  const [isInsideContainer, setIsInsideContainer] = useState(() => initialValues?.parentId != null);
  const [paths, setPaths] = useState(() => initialValues?.paths ?? []);
  const [currentPath, setCurrentPath] = useState("");
  const [imageFile, setImageFile] = useState<File | undefined>(undefined);
  const [hideSection, setHideSection] = useState(() => initialValues?.hideSection ?? false);
  const [language, setLanguage] = useState(() => initialValues?.language ?? "");
  const [country, setCountry] = useState(() => initialValues?.country ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { pickFolder, isPicking } = useFolderPicker();

  const containers = React.useMemo(
    () =>
      allLibraries.filter(
        (lib) =>
          (lib.type === "main" || lib.isContainer) &&
          lib.library_id !== initialValues?.id,
      ),
    [allLibraries, initialValues],
  );

  /**
   * الأقسام المستهدفة القابلة للاختيار في مكتبة من نوع "اختصار لقسم آخر".
   *
   * تُشتق ديناميكياً من المكتبات الفعلية الموجودة: تستثني الحاويات الرئيسية
   * (`main`) والاختصارات الأخرى والمكتبات المخفية والمكتبة الحالية عند التعديل.
   *
   * @returns مصفوفة مكتبات المحتوى الصالحة كهدف للاختصار.
   */
  const linkedTargets = React.useMemo(
    () =>
      allLibraries.filter(
        (lib) =>
          lib.type !== "main" &&
          lib.type !== "linked" &&
          !lib.isContainer &&
          !lib.is_container &&
          !lib.hideSection &&
          !lib.hide_section &&
          lib.library_id !== initialValues?.id,
      ),
    [allLibraries, initialValues],
  );

  const handlePickFolder = async () => {
    try {
      const path = await pickFolder();
      if (!path) return;

      if (paths.some((p) => p.toLowerCase() === path.toLowerCase())) {
        setErrors((prev) => ({ ...prev, paths: "هذا المسار مضاف مسبقاً" }));
        setCurrentPath("");
        return;
      }

      setPaths((prev) => [...prev, path]);
      setCurrentPath("");
      setErrors((prev) => ({ ...prev, paths: "" }));
    } catch {
      setErrors((prev) => ({ ...prev, paths: "تعذر الاتصال بـ Folder Picker Agent" }));
    }
  };

  const handleAddPath = () => {
    const trimmed = currentPath.trim();
    if (!trimmed) return;
    if (paths.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setErrors((prev) => ({ ...prev, paths: "هذا المسار مضاف مسبقاً" }));
      return;
    }

    setPaths((prev) => [...prev, trimmed]);
    setCurrentPath("");
    setErrors((prev) => ({ ...prev, paths: "" }));
  };

  const handleRemovePath = (index: number) => {
    setPaths((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (type === "main" && !name.trim()) {
      newErrors.name = "اسم الحاوية مطلوب";
    } else if (type !== "main" && !name.trim()) {
      newErrors.name = "اسم المكتبة مطلوب";
    }
    if (type === "linked" && !linkedLibraryId) {
      newErrors.linkedLibraryId = "اختر القسم المستهدف";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit({
      name: name.trim(),
      type,
      parentId: isInsideContainer ? parentId : null,
      linkedLibraryId: type === "linked" ? linkedLibraryId : null,
      paths: type === "main" || type === "linked" ? [] : paths,
      image: imageFile,
      hideSection,
      language,
      country,
    });
  };

  const showPaths = type !== "main" && type !== "linked";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="admin-layout   w-full max-w-sm   sm:max-w-md md:max-w-lg lg:max-w-md xl:max-w-lg max-h-[85svh] flex flex-col">
        {/* Header مدمج */}
        <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <ModalTitle className="text-base font-bold sm:text-lg">
            {initialValues ? "تعديل المكتبة" : "مكتبة جديدة"}
          </ModalTitle>
          <ModalDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {initialValues ? "عدّل بيانات المكتبة" : "أدخل بيانات المكتبة الجديدة"}
          </ModalDescription>
        </div>

        {/* المحتوى - يتكيف مع السكرول */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4 sm:space-y-4 sm:p-6">
          {/* ─── البيانات الأساسية ──────────────────────────────── */}
          <div className="space-y-3">
            <Input
              label="اسم المكتبة"
              placeholder={type === "main" ? "اسم الحاوية" : "اسم المكتبة"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="النوع"
                value={type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setType(nextType);
                  if (nextType !== "linked") setLinkedLibraryId(null);
                  if (nextType === "main") setIsInsideContainer(false);
                }}
                options={LIBRARY_TYPES}
              />

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">الموقع</label>
                <div className="flex gap-4 rounded-lg border border-border bg-input p-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="hierarchy"
                      checked={!isInsideContainer}
                      onChange={() => {
                        setIsInsideContainer(false);
                        setParentId(null);
                      }}
                      className="accent-primary"
                    />
                    <span>رئيسي</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="hierarchy"
                      checked={isInsideContainer}
                      onChange={() => setIsInsideContainer(true)}
                      className="accent-primary"
                    />
                    <span>داخل حاوية</span>
                  </label>
                </div>
              </div>
            </div>

            {isInsideContainer && (
              <Select
                placeholder="اختر حاوية..."
                value={parentId ? String(parentId) : ""}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                options={containers.map((c) => ({
                  value: String(c.library_id),
                  label: c.name,
                }))}
              />
            )}

            {type === "linked" && (
              <div className="space-y-1.5">
                <Select
                  label="القسم المستهدف"
                  placeholder="اختر القسم..."
                  value={linkedLibraryId ? String(linkedLibraryId) : ""}
                  onChange={(e) =>
                    setLinkedLibraryId(e.target.value ? Number(e.target.value) : null)
                  }
                  options={linkedTargets.map((t) => ({
                    value: String(t.library_id),
                    label: t.name,
                  }))}
                />
                {errors.linkedLibraryId && (
                  <p className="text-destructive text-xs">{errors.linkedLibraryId}</p>
                )}
              </div>
            )}
          </div>

          {/* ─── المسارات (يظهر فقط للأنواع العادية) ─────────────── */}
          {showPaths && (
            <>
              <hr className="border-border" />
              <div className="space-y-2">
                <label className="text-foreground text-sm font-medium">المسارات</label>

                {/* المسارات المضافة */}
                {paths.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {paths.map((path, idx) => (
                      <span
                        key={idx}
                        className="bg-secondary flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                        dir="ltr"
                      >
                        <span className="max-w-37.5 truncate sm:max-w-62.5">{path}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePath(idx)}
                          className="text-muted-foreground hover:text-destructive ml-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* إضافة مسار */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="اكتب مساراً..."
                    value={currentPath}
                    onChange={(e) => setCurrentPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPath();
                      }
                    }}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePickFolder}
                      disabled={isPicking}
                      className="flex-1 sm:flex-none"
                    >
                      <Folder size={14} />
                      <span className="sm:hidden">مجلد</span>
                      <span className="hidden sm:inline">{isPicking ? "جاري..." : "اختيار"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPath}
                      className="flex-1 sm:flex-none"
                    >
                      <Plus size={14} /> إضافة
                    </Button>
                  </div>
                </div>

                {errors.paths && (
                  <p className="text-destructive text-xs">{errors.paths}</p>
                )}

                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>مسار واحد على الأقل مطلوب</span>
                  <span className="font-mono">{paths.length}/10</span>
                </div>
              </div>
            </>
          )}

          {/* ─── الصورة ──────────────────────────────────────────── */}
          <hr className="border-border" />
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">الصورة</label>
            <label className="border-border bg-input hover:border-primary/40 flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm text-muted-foreground transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <Folder size={16} />
              {imageFile ? (
                <span className="text-foreground truncate">{imageFile.name}</span>
              ) : (
                <span>اختر صورة</span>
              )}
            </label>
          </div>

          {/* ─── الإعدادات المتقدمة ──────────────────────────────── */}
          <hr className="border-border" />
          <div className="space-y-3">
            <label className="text-foreground text-sm font-medium">إعدادات متقدمة</label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="اللغة"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={LANGUAGES}
              />
              <Select
                label="الدولة"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                options={COUNTRIES}
              />
            </div>

            <div className="border-border bg-secondary/50 flex items-center justify-between rounded-lg border p-3">
              <div>
                <span className="text-foreground text-sm font-medium">إخفاء القسم</span>
                <p className="text-muted-foreground text-xs">لن يظهر في الواجهة العامة</p>
              </div>
              <Switch checked={hideSection} onChange={(e) => setHideSection(e.target.checked)} />
            </div>
          </div>
        </div>

        {/* Footer مدمج */}
        <div className="shrink-0 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "جاري..." : initialValues ? "حفظ" : "إنشاء"}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

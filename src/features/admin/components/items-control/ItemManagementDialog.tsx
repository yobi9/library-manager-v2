"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, Eye, ExternalLink, Trash2, User, Hash, RotateCw, Wand2 } from "lucide-react";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { Select } from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  useEnrichItem,
  useUpdateItemMetadata,
  useUploadMediaImage,
  fetchAdminMediaDetails,
  type MediaPersonRow,
  type ItemMetadataPayload,
} from "@/features/admin/hooks/use-admin-media";
import { ChipInputField } from "@/features/admin/components/items-control/ChipInputField";
import type { MediaItem } from "@/lib/frontend/api-media";
import { MEDIA_TYPE_OPTIONS } from "@/lib/frontend/translate";

/** مفاتيح حقول الشرائح (chips) في النموذج. */
type ChipKey = "cast" | "directors" | "writers" | "tags";

interface ItemManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** العنصر المُراد تعديله؛ يُغلق النافذة عندما يكون null. */
  item: MediaItem | null;
  /** يُستدعى بعد الحفظ الناجح (لتحديث القائمة). */
  onSaved: () => void;
}

/**
 * نافذة تعديل بيانات عنصر وسائط في لوحة التحكم: العنوان، المدة/السنة، روابط الصور
 * مع تحميل/معاينة/فتح/حذف، الوصف، تقييم IMDb، البلد/اللغة، شرائح الطاقم
 * والتصنيفات، صندوق الإثراء السريع TMDB، ثم حقول النوع/مثبت/متاح.
 * مرتبة في أقسام عمودية (FormSection) بأزواج صغيرة للحقول المترابطة.
 *
 * تُحمّل التفاصيل الكاملة (genres + people) عند الفتح وتُحفظ عبر
 * POST /api/enrich/metadata/:id لتحافظ على أدوار الطاقم غير المعروضة.
 *
 * @param open - هل النافذة ظاهرة.
 * @param onOpenChange - إغلاق/فتح النافذة.
 * @param item - العنصر الحالي (null يغلق النافذة).
 * @param onSaved - استدعاء بعد الحفظ لتحديث القائمة.
 */
export function ItemManagementDialog({
  open,
  onOpenChange,
  item,
  onSaved,
}: ItemManagementDialogProps) {
  if (!item) {
    return null;
  }

  return (
    <ItemManagementForm
      key={item.media_id}
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  );
}

/** حالة النموذج الكاملة (قيم نصية لسهولة التحرير). */
interface EditFormState {
  title: string;
  runtime: string;
  year: string;
  overview: string;
  imdb_rating: string;
  imdb_votes: string;
  certification: string;
  country: string;
  language: string;
  poster_path: string;
  backdrop_path: string;
  tmdb_id: string;
  cast: string[];
  directors: string[];
  writers: string[];
  tags: string[];
  type: string;
  is_pinned: boolean;
  is_available: boolean;
}

/** حالة النموذج الابتدائية قبل جلب البيانات. */
const EMPTY_FORM: EditFormState = {
  title: "",
  runtime: "",
  year: "",
  overview: "",
  imdb_rating: "",
  imdb_votes: "",
  certification: "",
  country: "",
  language: "",
  poster_path: "",
  backdrop_path: "",
  tmdb_id: "",
  cast: [],
  directors: [],
  writers: [],
  tags: [],
  type: "movie",
  is_pinned: false,
  is_available: true,
};

/**
 * نموذج التعديل الداخلي — يُعاد تركيبه بوسم key عند تغيّر العنصر.
 * يجلب التفاصيل الكاملة عند التركيب ويُدير كل عمليات الحفظ/الإثراء/التحميل.
 */
function ItemManagementForm({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: MediaItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const saveMutation = useUpdateItemMetadata();
  const uploadMutation = useUploadMediaImage();
  const enrichMutation = useEnrichItem();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [downloading, setDownloading] = useState<"poster" | "backdrop" | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  /** صفوف الطاقم الأصلية — تُستخدم لحفظ الأدوار غير المعروضة في النموذج. */
  const [originalPeople, setOriginalPeople] = useState<MediaPersonRow[]>([]);
  const [chipInputs, setChipInputs] = useState<Record<ChipKey, string>>({
    cast: "",
    directors: "",
    writers: "",
    tags: "",
  });
  const [manualTmdbId, setManualTmdbId] = useState("");

  /** عدد أعضاء الطاقم في أدوار غير معروضة (يُحفظون كما هم تلقائياً). */
  const otherCrewCount = originalPeople.filter(
    (p) => p.role !== "Actor" && p.role !== "Director" && p.role !== "Writer",
  ).length;

  /**
   * يجلب تفاصيل العنصر الكاملة (بما فيها الطاقم والتصنيفات) ويطبّقها على النموذج.
   * المصدر الوحيد لجلب التفاصيل — يستخدمه التحميل الابتدائي وإعادة التحميل بعد الإثراء.
   *
   * @returns `true` عند النجاح، `false` عند الفشل (مع عرض رسالة خطأ).
   */
  const loadDetails = useCallback(async (): Promise<boolean> => {
    try {
      const details = await fetchAdminMediaDetails(item.media_id);
      const people = details.people ?? [];
      const namesByRole = (role: string) =>
        people.filter((p) => p.role === role).map((p) => p.name);

      setOriginalPeople(people);
      setForm({
        title: details.title ?? "",
        runtime: details.runtime ? String(details.runtime) : "",
        year: details.release_date || (details.year ? String(details.year) : ""),
        overview: details.overview ?? "",
        imdb_rating: details.imdb_rating != null ? String(details.imdb_rating) : "",
        imdb_votes: details.imdb_votes != null ? String(details.imdb_votes) : "",
        certification: details.certification ?? "",
        country: details.country ?? "",
        language: details.language ?? "",
        poster_path: details.poster_path ?? "",
        backdrop_path: details.backdrop_path ?? "",
        tmdb_id: details.tmdb_id != null ? String(details.tmdb_id) : "",
        cast: namesByRole("Actor"),
        directors: namesByRole("Director"),
        writers: namesByRole("Writer"),
        tags: details.genres ?? [],
        type: details.type ?? "movie",
        is_pinned: !!details.is_pinned,
        is_available: !!details.is_available,
      });
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تحميل البيانات");
      return false;
    }
  }, [item.media_id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadDetails();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [loadDetails]);

  /** إعادة جلب التفاصيل بعد الإثراء السريع لتحديث الحقول الظاهرة. */
  const reloadDetails = useCallback(async () => {
    setLoading(true);
    try {
      await loadDetails();
    } finally {
      setLoading(false);
    }
  }, [loadDetails]);

  /**
   * معالج تحديث حقل واحد في النموذج مع تحقق من نوع القيمة عبر المفتاح.
   *
   * @param key - مفتاح الحقل داخل `EditFormState`.
   * @param value - القيمة الجديدة للحقل.
   */
  const updateField = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** إضافة شريحة جديدة من صندوق إدخال الشريحة. */
  const handleChipAdd = (key: ChipKey) => {
    const value = chipInputs[key].trim();
    if (!value) return;
    if (form[key].includes(value)) return;
    setForm((prev) => ({ ...prev, [key]: [...prev[key], value] }));
    setChipInputs((prev) => ({ ...prev, [key]: "" }));
  };

  /** حذف شريحة. */
  const handleChipDelete = (key: ChipKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: prev[key].filter((v) => v !== value) }));
  };

  /** تحويل الطاقم المُحرَّر إلى صفوف، محافظاً على الأدوار غير المعروضة. */
  const buildPeople = (): MediaPersonRow[] => {
    const rows: MediaPersonRow[] = [];
    const originalByKey = new Map<string, MediaPersonRow>();
    for (const p of originalPeople) {
      if (p.role) originalByKey.set(`${p.role}|${p.name}`, p);
    }
    const findOriginal = (role: string, name: string) => originalByKey.get(`${role}|${name}`);

    form.cast.forEach((name, idx) => {
      const orig = findOriginal("Actor", name);
      rows.push({
        person_id: orig?.person_id ?? null,
        name,
        role: "Actor",
        character: orig?.character ?? "",
        department: "Acting",
        profile_path: orig?.profile_path ?? null,
        importance_order: orig?.importance_order ?? idx,
      });
    });
    for (const [role, department] of [
      ["Director", "Directing"],
      ["Writer", "Writing"],
    ] as const) {
      const key = (role === "Director" ? "directors" : "writers") as ChipKey;
      form[key].forEach((name) => {
        const orig = findOriginal(role, name);
        rows.push({
          person_id: orig?.person_id ?? null,
          name,
          role,
          character: null,
          department,
          profile_path: orig?.profile_path ?? null,
          importance_order: orig?.importance_order ?? 0,
        });
      });
    }
    for (const p of originalPeople) {
      if (p.role !== "Actor" && p.role !== "Director" && p.role !== "Writer") rows.push(p);
    }
    return rows;
  };

  /** حفظ كامل التعديلات عبر نقطة البيانات الوصفية اليدوية. */
  const handleSubmit = async () => {
    const payload: ItemMetadataPayload = {
      title: form.title || undefined,
      overview: form.overview || undefined,
      runtime: form.runtime ? Number(form.runtime) : undefined,
      release_date: form.year || undefined,
      year: form.year ? Number(form.year) || undefined : undefined,
      imdb_rating: form.imdb_rating ? Number(form.imdb_rating) : undefined,
      imdb_votes: form.imdb_votes ? Number(form.imdb_votes) : undefined,
      certification: form.certification || undefined,
      tmdb_id: form.tmdb_id ? Number(form.tmdb_id) : undefined,
      country: form.country || undefined,
      language: form.language || undefined,
      poster_path: form.poster_path,
      backdrop_path: form.backdrop_path,
      tags: form.tags,
      people: buildPeople(),
      type: form.type,
      is_pinned: form.is_pinned,
      is_available: form.is_available,
    };

    setSaving(true);
    try {
      await saveMutation.mutateAsync({ id: item.media_id, data: payload });
      toast.success("تم الحفظ بنجاح");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  /** تنزيل الصورة من الرابط الحالي إلى التخزين المحلي. */
  const handleDownloadImage = async (type: "poster" | "backdrop") => {
    const url = type === "poster" ? form.poster_path : form.backdrop_path;
    if (!url.trim()) {
      toast.error("الرابط فارغ");
      return;
    }
    setDownloading(type);
    try {
      const result = await uploadMutation.mutateAsync({
        mediaId: item.media_id,
        imageUrl: url,
        type,
      });
      setForm((prev) => ({
        ...prev,
        [type === "poster" ? "poster_path" : "backdrop_path"]: result.path,
      }));
      toast.success(`تم تحميل ${type === "poster" ? "الملصق" : "الخلفية"} بنجاح`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل تحميل الصورة");
    } finally {
      setDownloading(null);
    }
  };

  /** فتح معاينة الصورة (الرابط إن وُجد وإلا صورة العنصر المحلية). */
  const handlePreview = (type: "poster" | "backdrop") => {
    const url = type === "poster" ? form.poster_path : form.backdrop_path;
    const fallback = `/api/images/${item.media_id}?type=${type}&w=800&h=1200`;
    setPreviewImage({
      url: url.trim() || fallback,
      title: type === "poster" ? "معاينة الملصق" : "معاينة الخلفية",
    });
  };

  /** فتح رابط الصورة في تبويب جديد. */
  const handleOpenExternal = (type: "poster" | "backdrop") => {
    const url = type === "poster" ? form.poster_path : form.backdrop_path;
    if (url.trim()) window.open(url, "_blank", "noopener,noreferrer");
  };

  /** مسح رابط الصورة. */
  const handleClearImage = (type: "poster" | "backdrop") => {
    setForm((prev) => ({
      ...prev,
      [type === "poster" ? "poster_path" : "backdrop_path"]: "",
    }));
  };

  /** بدء الإثراء السريع TMDB ثم إعادة جلب البيانات. */
  const handleQuickEnrich = async () => {
    const tmdbId = Number(manualTmdbId);
    if (!manualTmdbId.trim() || !tmdbId) {
      toast.error("أدخل معرف TMDB");
      return;
    }
    setEnriching(true);
    try {
      await enrichMutation.mutateAsync({ id: item.media_id, tmdbId, force: true });
      toast.success("تم بدء الإثراء بنجاح");
      setManualTmdbId("");
      await reloadDetails();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الإثراء");
    } finally {
      setEnriching(false);
    }
  };

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent className="sm:max-w-2xl">
          <ModalHeader>
            <ModalTitle>تعديل البيانات</ModalTitle>
            <ModalDescription>{item.title}</ModalDescription>
          </ModalHeader>

          {loading ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16">
              <RotateCw className="h-6 w-6 animate-spin" />
              <span className="text-sm">جاري تحميل البيانات...</span>
            </div>
          ) : (
            <div className="max-h-[70vh] space-y-6 overflow-y-auto px-0.5 pb-1">
              <FormSection title="المعلومات الأساسية">
                <div className="space-y-3">
                  <Input
                    label="العنوان"
                    className="w-full"
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="المدة (دقيقة)"
                      type="number"
                      min="0"
                      value={form.runtime}
                      onChange={(e) => updateField("runtime", e.target.value)}
                    />
                    <Input
                      label="سنة الإصدار"
                      value={form.year}
                      placeholder="2020 أو 2020-05-01"
                      onChange={(e) => updateField("year", e.target.value)}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="الصور">
                <div className="space-y-3">
                  <ImageUrlField
                    label="ملصق (Poster)"
                    value={form.poster_path}
                    onChange={(value) => updateField("poster_path", value)}
                    downloading={downloading === "poster"}
                    onDownload={() => handleDownloadImage("poster")}
                    onPreview={() => handlePreview("poster")}
                    onOpen={() => handleOpenExternal("poster")}
                    onClear={() => handleClearImage("poster")}
                  />
                  <ImageUrlField
                    label="خلفية (Backdrop)"
                    value={form.backdrop_path}
                    onChange={(value) => updateField("backdrop_path", value)}
                    downloading={downloading === "backdrop"}
                    onDownload={() => handleDownloadImage("backdrop")}
                    onPreview={() => handlePreview("backdrop")}
                    onOpen={() => handleOpenExternal("backdrop")}
                    onClear={() => handleClearImage("backdrop")}
                  />
                </div>
              </FormSection>

              <FormSection title="الوصف والتفاصيل">
                <div className="space-y-3">
                  <Textarea
                    label="الوصف (Overview)"
                    rows={4}
                    value={form.overview}
                    onChange={(e) => updateField("overview", e.target.value)}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="تقييم IMDb"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={form.imdb_rating}
                      onChange={(e) => updateField("imdb_rating", e.target.value)}
                    />
                    <Input
                      label="عدد المقيمين (IMDb Votes)"
                      type="number"
                      min="0"
                      value={form.imdb_votes}
                      onChange={(e) => updateField("imdb_votes", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="البلد"
                      value={form.country}
                      onChange={(e) => updateField("country", e.target.value)}
                    />
                    <Input
                      label="اللغة"
                      value={form.language}
                      onChange={(e) => updateField("language", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="التصنيف العمري (Certification)"
                      value={form.certification}
                      onChange={(e) => updateField("certification", e.target.value)}
                    />
                    <Input
                      label="معرف TMDB"
                      type="number"
                      min="0"
                      value={form.tmdb_id}
                      onChange={(e) => updateField("tmdb_id", e.target.value)}
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="الطاقم والتصنيفات">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ChipInputField
                      label="طاقم التمثيل"
                      items={form.cast}
                      inputValue={chipInputs.cast}
                      onInputChange={(value) => setChipInputs((prev) => ({ ...prev, cast: value }))}
                      onAdd={() => handleChipAdd("cast")}
                      onDelete={(value) => handleChipDelete("cast", value)}
                      icon={User}
                    />
                    <ChipInputField
                      label="المخرجون"
                      items={form.directors}
                      inputValue={chipInputs.directors}
                      onInputChange={(value) =>
                        setChipInputs((prev) => ({ ...prev, directors: value }))
                      }
                      onAdd={() => handleChipAdd("directors")}
                      onDelete={(value) => handleChipDelete("directors", value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ChipInputField
                      label="الكتّاب"
                      items={form.writers}
                      inputValue={chipInputs.writers}
                      onInputChange={(value) =>
                        setChipInputs((prev) => ({ ...prev, writers: value }))
                      }
                      onAdd={() => handleChipAdd("writers")}
                      onDelete={(value) => handleChipDelete("writers", value)}
                    />
                    <ChipInputField
                      label="التصنيفات"
                      items={form.tags}
                      inputValue={chipInputs.tags}
                      onInputChange={(value) => setChipInputs((prev) => ({ ...prev, tags: value }))}
                      onAdd={() => handleChipAdd("tags")}
                      onDelete={(value) => handleChipDelete("tags", value)}
                      icon={Hash}
                    />
                  </div>
                  {otherCrewCount > 0 && (
                    <p className="text-muted-foreground text-xs">
                      سيتم الحفاظ على {otherCrewCount} من أعضاء الطاقم الآخرين تلقائياً.
                    </p>
                  )}
                </div>
              </FormSection>

              <FormSection title="التصنيف والإتاحة">
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                  <Select
                    label="النوع"
                    value={form.type}
                    options={MEDIA_TYPE_OPTIONS}
                    onChange={(e) => updateField("type", e.target.value)}
                  />
                  <div className="flex items-center gap-6 sm:justify-center sm:pb-1">
                    <Checkbox
                      checked={form.is_pinned}
                      onChange={(e) => updateField("is_pinned", e.target.checked)}
                      label="مثبت"
                    />
                    <Checkbox
                      checked={form.is_available}
                      onChange={(e) => updateField("is_available", e.target.checked)}
                      label="متاح"
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection title="إثراء سريع (TMDB)">
                <div className="flex items-center gap-2">
                  <Input
                    value={manualTmdbId}
                    placeholder="معرف TMDB..."
                    onChange={(e) => setManualTmdbId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickEnrich();
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleQuickEnrich}
                    disabled={enriching || loading}
                  >
                    <Wand2 className="h-4 w-4" />
                    {enriching ? "جاري..." : "إثراء"}
                  </Button>
                </div>
              </FormSection>
            </div>
          )}

          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || enriching || loading}
            >
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saving || enriching || loading}>
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        open={previewImage !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewImage(null);
        }}
      >
        <ModalContent className="sm:max-w-4xl">
          <ModalHeader>
            <ModalTitle>{previewImage?.title}</ModalTitle>
          </ModalHeader>
          {previewImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-h-80vh mx-auto w-auto rounded-lg"
            />
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * قسم عمودي في النموذج: عنوان فوق خط فاصل سفلي، ثم المحتوى تحته.
 * تُستخدم لتقسيم النافذة إلى أقسام مترابطة بدل شبكة موحّدة.
 *
 * @param title - عنوان القسم.
 * @param children - حقول القسم.
 */
function FormSection({ title, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <h3 className="border-border text-foreground border-b pb-2 text-sm font-bold">{title}</h3>
      {children}
    </section>
  );
}

interface ImageUrlFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  downloading: boolean;
  onDownload: () => void;
  onPreview: () => void;
  onOpen: () => void;
  onClear: () => void;
}

/**
 * حقل رابط صورة مع أزرار: تحميل إلى التخزين المحلي، معاينة، فتح في تبويب، ومسح.
 */
function ImageUrlField({
  label,
  value,
  onChange,
  downloading,
  onDownload,
  onPreview,
  onOpen,
  onClear,
}: ImageUrlFieldProps) {
  return (
    <div className="w-full">
      <label className="text-muted-foreground mb-0.5 block text-xs font-bold">{label}</label>
      <div className="flex items-center gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary h-8 w-8 shrink-0"
          onClick={onDownload}
          disabled={downloading}
          title="تحميل"
          aria-label="تحميل"
        >
          {downloading ? (
            <RotateCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary h-8 w-8 shrink-0"
          onClick={onPreview}
          title="معاينة"
          aria-label="معاينة"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary h-8 w-8 shrink-0"
          onClick={onOpen}
          title="فتح"
          aria-label="فتح"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
          onClick={onClear}
          title="حذف"
          aria-label="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

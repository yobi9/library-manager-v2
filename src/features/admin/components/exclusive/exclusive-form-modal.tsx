"use client";

import { useState } from "react";
import { Star, Plus, Trash2, ImageIcon, FolderOpen } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/shared/components/ui/modal";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import type { ExclusiveItemFormData } from "@/features/admin/types/exclusive";
import type { MediaItem } from "@/lib/frontend/api-media";
import { fetchMediaById } from "@/lib/frontend/api-media";
import { extractGenres, buildMediaUrl } from "@/lib/frontend/media-helpers";
import { MediaSelectorModal } from "./media-selector-modal";

interface ExclusiveFormModalProps {
  /** فتح/إغلاق النافذة. */
  open: boolean;
  /** إغلاق النافذة بدون حفظ. */
  onClose: () => void;
  /** يُستدعى عند الضغط على "حفظ" بعد نجاح التحقق. */
  onSubmit: (data: ExclusiveItemFormData) => void;
}

/** قيم النموذج الفارغة — تُستخدم عند كل فتح جديد. */
const EMPTY_FORM: ExclusiveItemFormData = {
  title: "",
  desc: "",
  href: "",
  rating: null,
  tags: [],
  video_url: "",
  image: "",
};

/** نوع الحقل الذي يملؤه منتقي المكتبة حاليًا. */
type SelectorTarget = "video" | "image";

/**
 * نموذج إضافة عنصر حصري جديد.
 *
 * الغرض: جمع البيانات اليدوية (العنوان، الوصف، الرابط، التقييم، الوسوم) مع
 * إمكانية اختيار وسيط من المكتبة لملء الحقول تلقائياً عبر `fetchMediaById`.
 *
 * @param props - فتح/إغلاق + معالج الحفظ.
 */
export function ExclusiveFormModal({ open, onClose, onSubmit }: ExclusiveFormModalProps) {
  const [form, setForm] = useState<ExclusiveItemFormData>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<SelectorTarget | null>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const setField = <K extends keyof ExclusiveItemFormData>(
    field: K,
    value: ExclusiveItemFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !form.tags.includes(trimmed)) {
      setField("tags", [...form.tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setField(
      "tags",
      form.tags.filter((t) => t !== tag),
    );
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors["title"] = "الاسم مطلوب";
    if (!form.desc.trim()) nextErrors["desc"] = "الوصف مطلوب";
    if (!form.href.trim()) nextErrors["href"] = "الرابط مطلوب";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(form);
  };

  const openSelector = (target: SelectorTarget) => {
    setSelectorTarget(target);
    setSelectorOpen(true);
  };

  const handleMediaSelect = async (item: MediaItem) => {
    const mediaId = Number(item.media_id ?? item.id);
    setLoadingMedia(true);
    try {
      const media = await fetchMediaById(mediaId);
      const title = media.title || media.display_title || media.name || form.title;
      const genres = extractGenres(media);
      const rating =
        media.rating ?? (media.imdb_rating != null ? Number(media.imdb_rating) : undefined);

      setForm((prev) => ({
        ...prev,
        media_id: mediaId,
        type: media.type || prev.type,
        year: media.year ?? prev.year,
        title,
        desc: media.overview || prev.desc,
        href: buildMediaUrl(media),
        tags: genres.length > 0 ? genres : prev.tags,
        rating: rating != null && rating > 0 ? rating : prev.rating,
        video_url: selectorTarget === "video" ? `/api/media/${mediaId}/stream` : prev.video_url,
        image:
          selectorTarget === "image"
            ? `/api/images/${mediaId}?type=poster&w=300&h=450`
            : prev.image,
      }));
    } catch {
      // لا شيء — يبقى النموذج كما هو عند فشل جلب التفاصيل.
    } finally {
      setLoadingMedia(false);
      setSelectorTarget(null);
    }
  };

  return (
    <>
      <Modal open={open} onOpenChange={(o) => !o && onClose()}>
        <ModalContent className="max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>إضافة حصرية جديدة</ModalTitle>
            <ModalDescription>
              أدخل بيانات الحصرية أو اختر وسيطاً من المكتبة لملء الحقول تلقائياً.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-4">
            <Input
              label="اسم الحصرية"
              placeholder="مثال: فيلم الأبطال"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              error={errors["title"]}
            />
            <Textarea
              label="وصف الحصرية"
              placeholder="وصف قصير يظهر تحت العنوان..."
              value={form.desc}
              onChange={(e) => setField("desc", e.target.value)}
              rows={3}
              error={errors["desc"]}
            />
            <Input
              label="رابط الحصرية"
              placeholder="/itemView/movie/123"
              value={form.href}
              onChange={(e) => setField("href", e.target.value)}
              error={errors["href"]}
            />

            <div className="space-y-1.5">
              <span className="text-sm leading-none font-medium">التقييم</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setField("rating", form.rating === star ? null : star)}
                  >
                    <Star
                      className={
                        star <= (form.rating ?? 0)
                          ? "fill-rating-star text-rating-star"
                          : "text-muted-foreground"
                      }
                    />
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm leading-none font-medium">الوسوم الحصرية</span>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="أضف وسماً..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  <Plus />
                  إضافة
                </Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`حذف وسم ${tag}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm leading-none font-medium">رابط الفيديو (اختياري)</span>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="https://..."
                    value={form.video_url}
                    onChange={(e) => setField("video_url", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openSelector("video")}
                    disabled={loadingMedia}
                  >
                    <FolderOpen />
                    اختر
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm leading-none font-medium">رابط الصورة (اختياري)</span>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="https://..."
                    value={form.image}
                    onChange={(e) => setField("image", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openSelector("image")}
                    disabled={loadingMedia}
                  >
                    <ImageIcon />
                    اختر
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={loadingMedia}>
              <Star />
              حفظ الحصرية
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <MediaSelectorModal
        open={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setSelectorTarget(null);
        }}
        onSelect={handleMediaSelect}
      />
    </>
  );
}

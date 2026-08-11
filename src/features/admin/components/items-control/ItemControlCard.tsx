"use client";

import { useState } from "react";
import {
  RotateCw,
  Languages,
  Pencil,
  Star,
  Trash2,
  RotateCcw,
  Clapperboard,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/frontend/api-media";
import { translateMediaType } from "@/lib/frontend/translate";

interface ItemControlCardProps {
  item: MediaItem;
  selected: boolean;
  isEnriching?: boolean;
  isTranslating?: boolean;
  isPinning?: boolean;
  isDeleting?: boolean;
  isResetting?: boolean;
  onToggleSelect: () => void;
  onEnrich: () => void;
  onTranslate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onReset: () => void;
}

/**
 * بطاقة تحكم لعنصر وسائط واحد في صفحة التحكم بالعناصر.
 * تعرض الملصق/الأيقونة، العنوان، السنة، وتُظهر أزرار الإجراءات
 * (إثراء، ترجمة، تعديل، تثبيت، حذف، تصفير). الحذف يحتاج تأكيداً داخلياً.
 *
 * @param item - كائن الوسيط.
 * @param selected - هل العنصر محدد في وضع الاختيار الجماعي.
 * @param isEnriching - جارٍ إثراء هذا العنصر (يدوّر الأيقونة).
 * @param isTranslating - جارٍ ترجمة هذا العنصر.
 * @param isPinning - جارٍ تغيير حالة التثبيت.
 * @param isDeleting - جارٍ حذف العنصر.
 * @param isResetting - جارٍ تصفير بيانات الإثراء للعنصر.
 * @param onToggleSelect - تبديل حالة التحديد.
 * @param onEnrich - بدء إثراء TMDB للعنصر.
 * @param onTranslate - بدء الترجمة للعنصر.
 * @param onEdit - فتح نافذة التعديل.
 * @param onDelete - طلب حذف العنصر.
 * @param onTogglePin - تبديل التثبيت.
 * @param onReset - تصفير بيانات الإثراء.
 */
export function ItemControlCard({
  item,
  selected,
  isEnriching,
  isTranslating,
  isPinning,
  isDeleting,
  isResetting,
  onToggleSelect,
  onEnrich,
  onTranslate,
  onEdit,
  onDelete,
  onTogglePin,
  onReset,
}: ItemControlCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const pinned = !!item.is_pinned;
  const hasPoster = !!item.poster_path || !!item.backdrop_path;

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow",
          selected ? "border-primary ring-2 ring-primary/30" : "border-border",
        )}
      >
        {/* حاوية الملصق بنسبة 2/3 */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-muted">
          {hasPoster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/images/${item.media_id}?type=poster&w=300&h=450`}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Clapperboard className="h-12 w-12" />
            </div>
          )}

          {/* شارة التحديد */}
          <div
            className="absolute right-2 top-2 z-10 rounded-md bg-background/80 p-1 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`تحديد ${item.title}`}
            />
          </div>

          {/* شارة النوع */}
          <div className="absolute left-2 top-2 z-10">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {translateMediaType(item.type)}
            </Badge>
          </div>
        </div>

        {/* معلومات + أزرار */}
        <div className="flex flex-1 flex-col gap-1 p-2">
          <p className="truncate text-sm font-bold">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.year || "—"}
            {pinned && <Badge variant="default" className="mr-2">مثبت</Badge>}
          </p>

          <div className="mt-auto flex flex-wrap items-center justify-end gap-0.5 pt-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              title="تعديل"
              aria-label={`تعديل ${item.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onTogglePin}
              disabled={isPinning}
              title={pinned ? "إزالة التثبيت" : "تثبيت"}
              aria-label={pinned ? "إزالة التثبيت" : "تثبيت"}
            >
              <Star
                className={cn("h-3.5 w-3.5", pinned && "fill-amber-400 text-amber-400")}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEnrich}
              disabled={isEnriching}
              title="إثراء"
              aria-label={`إثراء ${item.title}`}
            >
              <RotateCw className={cn("h-3.5 w-3.5", isEnriching && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onTranslate}
              disabled={isTranslating}
              title="ترجمة"
              aria-label={`ترجمة ${item.title}`}
            >
              <Languages className={cn("h-3.5 w-3.5", isTranslating && "animate-pulse")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setConfirmReset(true)}
              disabled={isResetting}
              title="تصفير الإثراء"
              aria-label={`تصفير إثراء ${item.title}`}
            >
              <RotateCcw className={cn("h-3.5 w-3.5", isResetting && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              title="حذف"
              aria-label={`حذف ${item.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="تأكيد الحذف"
        description={`هل أنت متأكد من حذف "${item.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        loading={isDeleting}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
      />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="تأكيد تصفير الإثراء"
        description={`هل تريد تصفير بيانات الإثراء الخاصة بـ "${item.title}"؟ سيؤدي هذا إلى حذف البيانات الوصفية المثراة ويحتاج إعادة إثراء.`}
        confirmLabel="تصفير"
        variant="destructive"
        loading={isResetting}
        onConfirm={() => {
          setConfirmReset(false);
          onReset();
        }}
      />
    </>
  );
}

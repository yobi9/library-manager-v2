"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Star,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Clapperboard,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  useExclusiveItems,
  useSaveExclusiveItems,
} from "@/features/admin/hooks/use-exclusive-items";
import type { ExclusiveItem, ExclusiveItemFormData } from "@/features/admin/types/exclusive";
import { ExclusiveFormModal } from "./exclusive-form-modal";

/** بناء رابط الصورة المصغرة من معرّف الوسيط. */
function buildThumbUrl(item: ExclusiveItem): string {
  if (item.image) return item.image;
  if (item.media_id != null) {
    return `/api/images/${item.media_id}?type=poster&w=100&h=150`;
  }
  return "";
}

/**
 * شاشة إدارة الحصريات.
 *
 * الغرض: عرض قائمة العناصر الحصرية مع إمكانية إضافة عنصر جديد (عبر
 * `ExclusiveFormModal`)، حذف عنصر، وإعادة ترتيبه بأزرار أعلى/أسفل.
 * كل تغيير يحفظ القائمة الكاملة عبر `useSaveExclusiveItems`.
 */
export function ExclusiveManager() {
  const { items, isLoading } = useExclusiveItems();
  const saveMutation = useSaveExclusiveItems();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExclusiveItem | null>(null);
  const [error, setError] = useState("");

  const isSaving = saveMutation.isPending;

  const commitItems = async (next: ExclusiveItem[], closeModals = false): Promise<boolean> => {
    setError("");
    try {
      await saveMutation.mutateAsync(next);
      if (closeModals) {
        setFormOpen(false);
        setDeleteTarget(null);
      }
      return true;
    } catch {
      setError("فشل حفظ التغييرات، حاول مرة أخرى.");
      return false;
    }
  };

  const handleAdd = async (data: ExclusiveItemFormData) => {
    const newItem: ExclusiveItem = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      media_id: data.media_id,
      title: data.title,
      desc: data.desc,
      image: data.image,
      video_url: data.video_url,
      href: data.href,
      rating: data.rating ?? undefined,
      tags: data.tags,
      type: data.type,
      year: data.year,
      sort_order: items.length,
    };
    await commitItems([...items, newItem], true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const next = items
      .filter((item) => item.id !== deleteTarget.id)
      .map((item, idx) => ({ ...item, sort_order: idx }));
    await commitItems(next, true);
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    const updated = next.map((item, idx) => ({ ...item, sort_order: idx }));
    await commitItems(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المحتوى الحصري</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            عناصر تُعرض في شريط الحصريات أعلى الصفحة الرئيسية.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={isSaving}>
          <Plus className="h-4 w-4" />
          إضافة حصرية جديدة
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            icon={<Clapperboard />}
            title="لا توجد عناصر حصرية بعد"
            description="أضف أول عنصر ليظهر في شريط الحصريات بالصفحة الرئيسية."
            action={{ label: "إضافة حصرية", onClick: () => setFormOpen(true) }}
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const thumb = buildThumbUrl(item);
            return (
              <li key={item.id}>
                <Card className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0 || isSaving}
                        aria-label="تحريك لأعلى"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleMove(index, 1)}
                        disabled={index === items.length - 1 || isSaving}
                        aria-label="تحريك لأسفل"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        className={cn("bg-muted h-20 w-13 shrink-0 rounded object-cover")}
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{item.title}</span>
                        {item.year && (
                          <span className="text-muted-foreground text-xs">({item.year})</span>
                        )}
                        {item.type && <Badge variant="outline">{item.type}</Badge>}
                        {item.rating != null && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  "h-3 w-3",
                                  star <= (item.rating ?? 0)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground",
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(item)}
                      disabled={isSaving}
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ExclusiveFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleAdd} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="حذف العنصر الحصري"
        description={`هل أنت متأكد من حذف "${deleteTarget?.title}" من شريط الحصريات؟`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isSaving}
      />
    </div>
  );
}

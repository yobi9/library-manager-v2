"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ImageIcon } from "lucide-react";
import { apiClient } from "@/lib/frontend/api-client";
import type { MediaItem } from "@/lib/frontend/api-media";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/shared/components/ui/modal";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface MediaSelectorModalProps {
  /** فتح/إغلاق النافذة (Radix Dialog). */
  open: boolean;
  /** إغلاق النافذة بدون اختيار. */
  onClose: () => void;
  /** يُستدعى عند اختيار عنصر من المكتبة مع كائن الوسيط الكامل. */
  onSelect: (item: MediaItem) => void;
}

/** نوع صف النوع الذي يُرجعه `GET /api/media/types`. */
interface MediaTypeRow {
  type: string;
}

/** استجابة قائمة الأدمن: `GET /api/media?admin=true`. */
interface AdminMediaListResponse {
  items: MediaItem[];
  total: number;
}

/** صورة مصغرة لبوستر الوسيط. */
function buildThumbUrl(mediaId: number): string {
  return `/api/images/${mediaId}?type=poster&w=100&h=150`;
}

/** مفاتيح كاش React Query لمكونات المنتقي. */
const mediaSelectorKeys = {
  types: ["admin", "media", "types"] as const,
  list: (search: string, type: string) => ["admin", "media", "selector", search, type] as const,
};

/**
 * نافذة اختيار وسيط من المكتبة (العناصر الجذرية فقط).
 *
 * الغرض: البحث والفلترة حسب النوع ثم اختيار عنصر يُملأ تلقائياً في
 * `ExclusiveFormModal` (العنوان، الوصف، الوسوم، الروابط...).
 *
 * @param props - فتح/إغلاق + معالج الاختيار.
 */
export function MediaSelectorModal({ open, onClose, onSelect }: MediaSelectorModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  // تأخير البحث 400ms حتى لا يُستدعى الـ API مع كل حرف.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: typeRows } = useQuery({
    queryKey: mediaSelectorKeys.types,
    queryFn: () => apiClient.get<MediaTypeRow[]>("/media/types"),
    enabled: open,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: mediaSelectorKeys.list(debouncedSearch, selectedType),
    queryFn: () => {
      const params: Record<string, string> = {
        admin: "true",
        page: "1",
        limit: "100",
        rootOnly: "true",
        excludeTypes: "season,episode,series_sports,series_deen",
      };
      if (debouncedSearch) params["search"] = debouncedSearch;
      if (selectedType !== "all") params["type"] = selectedType;
      return apiClient.get<AdminMediaListResponse>("/media", params);
    },
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const types = useMemo(() => (typeRows ?? []).map((row) => row.type).filter(Boolean), [typeRows]);

  const typeOptions = useMemo(
    () => [{ value: "all", label: "الكل" }, ...types.map((t) => ({ value: t, label: t }))],
    [types],
  );

  const items = data?.items ?? [];

  const handleSelect = (item: MediaItem) => {
    onSelect(item);
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>اختر من المكتبة (العناصر الجذرية فقط)</ModalTitle>
          <ModalDescription>ابحث عن وسيط لتعبئة بيانات الحصرية تلقائياً.</ModalDescription>
        </ModalHeader>

        <div className="space-y-3">
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            options={typeOptions}
            label="النوع"
          />
          <div className="relative">
            <Input
              type="text"
              placeholder="ابحث عن عنصر..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pe-9"
            />
            <Search className="text-muted-foreground absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ImageIcon />}
              title="لا توجد عناصر"
              description="لم يتم العثور على وسائط مطابقة، جرّب تغيير البحث أو النوع."
            />
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const mediaId = Number(item.media_id ?? item.id);
                return (
                  <li key={mediaId}>
                    <Button
                      variant="ghost"
                      className="h-auto w-full justify-start gap-3 px-2 py-2"
                      onClick={() => handleSelect(item)}
                    >
                      <img
                        src={buildThumbUrl(mediaId)}
                        alt=""
                        className={cn("bg-muted h-15 w-10 shrink-0 rounded object-cover")}
                        loading="lazy"
                      />
                      <span className="min-w-0 flex-1 text-right">
                        <span className="block truncate text-sm font-semibold">
                          {item.title || item.display_title || item.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.type} — ID: {mediaId}
                        </span>
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

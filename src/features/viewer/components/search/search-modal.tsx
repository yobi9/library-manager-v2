"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Film } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/shared/components/ui/modal";
import { SearchInput } from "@/shared/components/ui/search-input";
import { Spinner } from "@/shared/components/ui/spinner";
import { DEFAULT_IMAGES } from "@/shared/constants";
import { translateMediaType } from "@/lib/frontend/translate";
import { buildMediaUrl } from "@/lib/frontend/media-helpers";
import { useLiveSearch } from "@/lib/frontend/search-queries";

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * نافذة البحث الفوري في رأس الموقع.
 *
 * - السلوك: تعرض حقل بحث مع اقتراحات فورية (debounce 300ms) ونتائج فورية من
 *   `/api/search/live`، وتنتقل إلى صفحة العنصر عند اختيار نتيجة.
 * - البنية: زر "بحث" في `ViewerHeader` يفتح هذه النافذة؛ الاستعلام الفارغ أو
 *   القصير (حرف واحد) لا يطلق أي طلب.
 * - الإغلاق: عبر زر الإغلاق في الـ Modal أو زر Esc أو عند التنقل لصفحة العنصر.
 *
 * @param props.open - حالة فتح النافذة (مسيَّرة من الأب).
 * @param props.onOpenChange - معالج تغيير حالة الفتح.
 */
export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: results, isLoading, isError } = useLiveSearch(query);

  const navigateTo = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href as import("next").Route);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && results && results.length > 0) {
      const first = results[0];
      if (!first) return;
      navigateTo(buildMediaUrl({ id: first.id, type: first.type }));
    }
  };

  const showEmpty =
    !isLoading && !isError && query.trim().length >= 2 && (results?.length ?? 0) === 0;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
     <ModalContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl border border-border bg-background">

        <ModalHeader>
          <ModalTitle>البحث</ModalTitle>
          <ModalDescription>ابحث عن فيلم، مسلسل، أو محتوى آخر</ModalDescription>
        </ModalHeader>

        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="اكتب هنا للبحث..."
          autoFocus
          onKeyDown={handleKeyDown}
  className="focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-ring"
/>
        <div className="min-h-16 space-y-3">
          {isLoading && query.trim().length >= 2 && (
            <div className="text-muted-foreground flex items-center gap-2 py-6">
              <Spinner />
              <span>جاري البحث...</span>
            </div>
          )}

          {isError && (
            <div className="text-destructive py-6 text-center text-sm">
              تعذر إجراء البحث، حاول مجدداً
            </div>
          )}

          {showEmpty && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
              <Film className="h-8 w-8" />
              <p className="text-sm">لا توجد نتائج مطابقة لـ &quot;{query.trim()}&quot;</p>
            </div>
          )}

          {results && results.length > 0 && (
            <ul className="divide-border/60 divide-y">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigateTo(buildMediaUrl({ id: item.id, type: item.type }))}
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-right transition-colors"
                  >
                    <img
                      src={item.imageUrl || DEFAULT_IMAGES.POSTER}
                      alt={item.title}
                      className="h-14 w-10 shrink-0 rounded object-cover"
                      loading="lazy"
                    />
                    <span className="flex-1">
                      <span className="block truncate text-sm font-semibold">{item.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {translateMediaType(item.type)}
                        {item.year ? ` • ${item.year}` : ""}
                      </span>
                    </span>
                    <Search className="text-muted-foreground h-4 w-4 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.trim().length < 2 && (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Search className="h-4 w-4" />
              <span>ابدأ بكتابة حرفين على الأقل لعرض النتائج</span>
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Play, Heart, Bookmark, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/shared/constants";
import { Button } from "@/shared/components/ui/button";
import { useFavoritesContext } from "@/lib/frontend/favorites-context";
import { useWatchLater } from "@/lib/frontend/use-watch-later";
import { useOpenFolder } from "@/lib/frontend/hooks/use-open-folder";
import { cn } from "@/lib/utils";

interface MediaActionsProps {
  mediaId: number;
  title: string;
  type?: string;
  folderPath?: string | null;
  hasChildren?: boolean;
}

/**
 * أزرار التفاعل الرئيسية لعنصر الوسائط: تشغيل، مفضلة، مشاهدة لاحقاً، فتح المجلد.
 *
 * - `watchLater`/`favorite`: زران تفاعليان بحالتين (نشطة/غير نشطة) —
 *   غير نشط: `variant="outline"`، نشط: `variant="outline"` مع `bg-primary/10 text-primary border-primary/40`.
 * - `play`: زر أساسي `<Button asChild>` يoman linkage لصفحة التشغيل.
 * - `folder`: زر حدودي يفتح المجلد محلياً عبر IPC.
 *
 * @param props - معرّف الوسائط، العنوان، النوع، ومسار المجلد.
 */
export function MediaActions({ mediaId, title, type, folderPath }: MediaActionsProps) {
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { isWatchLater, toggle: toggleWatchLater } = useWatchLater();
  const { openFolder, isOpening } = useOpenFolder();

  const favorite = isFavorite(mediaId);
  const watchLater = isWatchLater(mediaId);

  const handleOpenFolder = useCallback(async () => {
    if (!folderPath) return;

    const ok = await openFolder(folderPath);
    toast(ok ? "تم فتح المجلد" : "تعذر فتح المجلد");
  }, [folderPath, openFolder]);

  return (
    <div className="flex flex-wrap gap-2">
      {(type === "movie" || type === "theater") && (
        <Button asChild variant="default" size="lg" className="rounded-xl px-6 font-bold">
          <Link href={ROUTES.PLAYER(String(mediaId)) as import("next").Route}>
            <Play size={16} fill="currentColor" />
            شاهد الآن
          </Link>
        </Button>
      )}

      <Button
        variant="outline"
        size="lg"
        className={cn(
          "rounded-xl px-4 font-bold",
          favorite
            ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
            : "shadow-sm hover:shadow-md",
        )}
        onClick={async () => {
          await toggleFavorite(mediaId, favorite);
          toast(favorite ? "أُزيل من المفضلة" : "أُضيف للمفضلة");
        }}
      >
        <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        {favorite ? "المفضلة" : "أضف للمفضلة"}
      </Button>

      <Button
        variant="outline"
        size="lg"
        className={cn(
          "rounded-xl px-4 font-bold",
          watchLater
            ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
            : "shadow-sm hover:shadow-md",
        )}
        onClick={() => {
          toggleWatchLater(mediaId, watchLater);
          toast(watchLater ? "أُزيل من المشاهدة لاحقاً" : "أُضيف للمشاهدة لاحقاً");
        }}
      >
        <Bookmark size={16} fill={watchLater ? "currentColor" : "none"} />
        {watchLater ? "المشاهدة لاحقاً" : "أضف للمشاهدة لاحقاً"}
      </Button>

      {folderPath && (
        <Button
          variant="outline"
          size="lg"
          className="rounded-xl px-4 font-bold shadow-sm hover:shadow-md"
          onClick={handleOpenFolder}
          disabled={isOpening}
        >
          {isOpening ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          فتح المجلد
        </Button>
      )}
    </div>
  );
}

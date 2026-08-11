"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Play, Heart, Bookmark, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/shared/constants";
import { useFavoritesContext } from "@/lib/frontend/favorites-context";
import { useWatchLater } from "@/lib/frontend/use-watch-later";
import { useOpenFolder } from "@/features/viewer/hooks/use-open-folder";
 

interface MediaActionsProps {
  mediaId: number;
   title: string;
  type?: string;
  folderPath?: string | null;
 hasChildren?: boolean; // ← إضافة
}

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
      {/* رابط شاهد الآن */}
       {/* <Link
        href={ROUTES.PLAYER(String(mediaId)) as import("next").Route}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all active:scale-95"
      >
        <Play size={16} fill="currentColor" />
        شاهد الآن
      </Link>  */}
 
  {/* ✅ تم إضافة الشرط هنا: يظهر فقط للأفلام والمسرحيات */}
      {(type === "movie" || type === "theater") && (
        <Link
          href={ROUTES.PLAYER(String(mediaId)) as import("next").Route}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition-all active:scale-95"
        >
          <Play size={16} fill="currentColor" />
          شاهد الآن
        </Link>
      )}
      {/* زر المفضلة */}
      <button
        onClick={async () => {
          await toggleFavorite(mediaId, favorite);
          toast(favorite ? "أُزيل من المفضلة" : "أُضيف للمفضلة");
        }}
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all active:scale-95 ${
          favorite
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
        }`}
      >
        <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        {favorite ? "المفضلة" : "أضف للمفضلة"}
      </button>

      {/* زر المشاهدة لاحقاً */}
      <button
        onClick={() => {
          toggleWatchLater(mediaId, watchLater);
          toast(watchLater ? "أُزيل من المشاهدة لاحقاً" : "أُضيف للمشاهدة لاحقاً");
        }}
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all active:scale-95 ${
          watchLater
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
        }`}
      >
        <Bookmark size={16} fill={watchLater ? "currentColor" : "none"} />
        {watchLater ? "المشاهدة لاحقاً" : "أضف للمشاهدة لاحقاً"}
      </button>

      {/* زر فتح المجلد (يظهر فقط عند توفر المسار) */}
      {folderPath && (
        <button
          onClick={handleOpenFolder}
          disabled={isOpening}
          className="text-muted-foreground hover:border-primary/40 hover:text-primary flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isOpening ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
          فتح المجلد
        </button>
      )}
    </div>
  );
}
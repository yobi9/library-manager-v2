"use client";

import Link from "next/link";
import { useGenres } from "@/lib/frontend/media-queries";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES } from "@/shared/constants";
import { Spinner } from "@/shared/components/ui/spinner";
import { AlertCircle, Tags } from "lucide-react";

export default function GenrePage() {
  const { data: genres = [], isLoading, error } = useGenres();

  return (
     //<div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
     <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "التصنيفات" }]} />
      <div className="flex items-center gap-3">
        <Tags className="text-primary h-6 w-6" />
        <h1 className="text-2xl font-bold">التصنيفات</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-20">
          <Spinner />
          <span className="text-muted-foreground">جاري تحميل التصنيفات...</span>
        </div>
      ) : error ? (
       // <div className="flex flex-col items-center gap-4 py-20">
       <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">فشل تحميل التصنيفات</p>
        </div>
      ) : genres.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">لا توجد تصنيفات</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {genres.map((genre) => (
            <Link
              key={genre.name}
              href={ROUTES.GENRE_ITEMS(genre.name.replace(/\s+/g, "_")) as import("next").Route}
              className="group border-border bg-card/50 hover:border-primary/40 hover:bg-card flex flex-col items-center justify-center gap-2 rounded-xl border p-6 text-center transition-all hover:shadow-lg"
            >
              <span className="group-hover:text-primary text-sm font-bold transition-colors sm:text-base">
                {genre.name}
              </span>
              {genre.count > 0 && (
                <span className="text-muted-foreground text-xs">{genre.count} عنصر</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

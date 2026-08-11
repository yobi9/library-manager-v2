// "use client";

// import Link from "next/link";
// import { Badge } from "@/shared/components/ui/badge";
// import { cn } from "@/lib/utils";
// import { ROUTES } from "@/shared/constants";
// import { translateMediaType, formatViews } from "@/lib/frontend/translate";

// import { Clock, Eye } from "lucide-react";
// interface MediaCardProps {
//   id: string;
//     type: string; // أصبح يقبل أي نوع
//   title: string;
//   posterUrl?: string | null;
//   posterId?: string | number | null;
//   rating?: number | null;
//   year?: string | null;
//   className?: string;

//    // NEW
//   certification?: string | null;
//   duration?: number | null;
//   views?: number | null;
//   seasonsCount?: number | null;
//   episodesCount?: number | null;
//   genres?: string[];
// }

// function getPosterUrl(id?: string | number | null): string | undefined {
//   if (id === undefined || id === null || id === "") return undefined;
//   return `/api/images/${id}?type=poster&w=300&h=450`;
// }

// export function MediaCard({
//   id,
//   type,
//   title,
//   posterUrl,
//   posterId,
//   rating,
//   year,
//   className,
//     certification,
//   duration,
//    views,
//     seasonsCount,
//   episodesCount,
//    genres,
// }: MediaCardProps) {
//   const resolvedPosterUrl = posterUrl ?? getPosterUrl(posterId ?? id);
//     const typeLabel = translateMediaType(type) || type;

//   return (
//     <Link
//       href={ROUTES.ITEM_VIEW(type, id) as import("next").Route}
//       className={cn(
//         "group relative flex flex-col overflow-hidden rounded-lg transition-transform hover:scale-105",
//         className,
//       )}
//     >
//       <div className="relative aspect-2/3 overflow-hidden rounded-lg bg-muted">
//         {resolvedPosterUrl ? (
//           <img
//             src={resolvedPosterUrl}
//             alt={title}
//             className="h-full w-full object-cover transition-transform group-hover:scale-110"
//             loading="lazy"
//           />
//         ) : (
//           <div className="flex h-full w-full items-center justify-center text-muted-foreground">
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               className="h-12 w-12"
//               fill="none"
//               viewBox="0 0 24 24"
//               stroke="currentColor"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={1.5}
//                 d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
//               />
//             </svg>
//           </div>
//         )}
//         {rating != null && rating > 0 && (
//           <div className="absolute left-2 top-2">
//             <Badge variant="default" className="bg-black/70 text-yellow-400 backdrop-blur-sm">
//               ★ {rating.toFixed(1)}
//             </Badge>
//           </div>
//         )}
//         <div className="absolute right-2 top-2">
//          <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-sm">
//             {typeLabel}

//           </Badge>

// {genres && genres.length > 0 && (
//   <Badge variant="outline" className="text-[10px] h-5">
//     {genres.slice(0, 2).join(" • ")}
//   </Badge>
// )}

//         </div>
//       </div>

//    <div className="mt-2 flex flex-wrap gap-1 px-1">
//         {certification && (
//           <Badge variant="outline" className="text-[10px] h-5">
//             {certification}
//           </Badge>
//         )}
//         {duration && duration > 0 && (
//           <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-1">
//             <Clock size={10} /> {duration}د
//           </Badge>
//         )}
//         {seasonsCount && seasonsCount > 0 && (
//           <Badge variant="outline" className="text-[10px] h-5">
//             {seasonsCount} موسم
//           </Badge>
//         )}
//         {episodesCount && episodesCount > 0 && (
//           <Badge variant="outline" className="text-[10px] h-5">
//             {episodesCount} حلقة
//           </Badge>
//         )}
//         {views && views > 0 && (
//           <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-1">
//             <Eye size={10} /> {views}
//           </Badge>
//         )}

//  </div>

//       <div className="mt-2 space-y-1 px-1">
//         <h3 className="line-clamp-1 text-sm font-medium leading-tight">{title}</h3>
//         {year && (
//           <p className="text-xs text-muted-foreground">{year}</p>
//         )}
//       </div>
//     </Link>
//   );
// }
"use client";

import Link from "next/link";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildMediaUrl } from "@/lib/frontend/media-helpers";
import { translateMediaType, formatViews } from "@/lib/frontend/translate";
import { Clock, Eye } from "lucide-react";

interface MediaCardProps {
  id: string;
  type: string;
  title: string;
  posterUrl?: string | null;
  posterId?: string | number | null;
  rating?: number | null;
  year?: string | null;
  className?: string;
  certification?: string | null;
  duration?: number | null;
  views?: number | null;
  seasonsCount?: number | null;
  episodesCount?: number | null;
  genres?: string[];
}

function getPosterUrl(id?: string | number | null): string | undefined {
  if (id === undefined || id === null || id === "") return undefined;
  return `/api/images/${id}?type=poster&w=300&h=450`;
}

export function MediaCard({
  id,
  type,
  title,
  posterUrl,
  posterId,
  rating,
  year,
  className,
  certification,
  duration,
  views,
  seasonsCount,
  episodesCount,
  genres,
}: MediaCardProps) {
  const resolvedPosterUrl = posterUrl ?? getPosterUrl(posterId ?? id);
  const typeLabel = translateMediaType(type) || type;

  return (
    <Link
      href={buildMediaUrl({ id, type }) as import("next").Route}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg transition-transform hover:scale-105",
        className,
      )}
    >
      <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-lg">
        {resolvedPosterUrl ? (
          <img
            src={resolvedPosterUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
        )}

        {/* التقييم */}
        {rating != null && rating > 0 && (
          <div className="absolute top-2 left-2">
            <Badge variant="default" className="bg-black/70 text-yellow-400 backdrop-blur-sm">
              ★ {rating.toFixed(1)}
            </Badge>
          </div>
        )}

        {/* النوع */}
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-sm">
            {typeLabel}
          </Badge>
        </div>

        {/* طبقة معلومات إضافية تظهر عند التمرير */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-3 opacity-0 transition-opacity group-hover:opacity-100">
          {/* عرض التصنيفات (genres) */}
          {genres && genres.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {genres.slice(0, 3).map((genre) => (
                <span key={genre} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white">
                  {genre}
                </span>
              ))}
              {genres.length > 3 && (
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                  +{genres.length - 3}
                </span>
              )}
            </div>
          )}

          {/* تفاصيل إضافية */}
          <div className="flex flex-wrap justify-center gap-1 text-xs text-white/80">
            {certification && <span>{certification}</span>}
            {duration && duration > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock size={12} /> {duration}د
              </span>
            )}
            {seasonsCount && seasonsCount > 0 && <span>{seasonsCount} موسم</span>}
            {episodesCount && episodesCount > 0 && <span>{episodesCount} حلقة</span>}
          </div>
        </div>
      </div>

      {/* العنوان والسنة دائماً ظاهرتان */}
      {/* العنوان والسنة + المشاهدات في الأسفل */}
      {/* <div className="mt-2 space-y-1 px-1">
        <h3 className="line-clamp-1 text-sm font-medium leading-tight">{title}</h3>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {year && <span>[السنة]</span>}
          {views && views > 0 && (
            <span className="flex items-center gap-1  text-red-500  font-light">
              <Eye size={12} /> {formatViews(views)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
} */}

      <div className="mt-2 space-y-1 px-1">
        <h3
          className="mt-3.75 line-clamp-1 text-sm leading-tight font-medium"
          style={{
            textShadow: "0 4px 3px rgba(0, 0, 0, 0.349)",
            marginTop: "15px",
          }}
        >
          {title}
        </h3>
        <div className="text-muted-foreground/45 mt-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-light">
            <Eye size={12} className="font-light text-red-500" /> {views ? formatViews(views) : "0"}
          </span>
          <span>{year || "[السنة]"}</span>
        </div>
      </div>
    </Link>
  );
}

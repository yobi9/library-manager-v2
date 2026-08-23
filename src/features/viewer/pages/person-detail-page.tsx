// //src\features\viewer\pages\person-detail-page.tsx
// "use client";

// import { useState } from "react";
// import { useParams } from "next/navigation";
// import { usePerson, usePersonWorks } from "@/lib/frontend/media-queries";
// import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
// import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
// import { AlertCircle } from "lucide-react";
// import { mapMediaToCard } from "@/lib/frontend/media-helpers";
// import type { Person } from "@/lib/frontend/api-media";

// function getPersonImageUrl(id: string | number): string {
//   return `/api/images/${id}?type=person&w=400&h=400`;
// }

// function formatDate(dateStr?: string): string {
//   if (!dateStr) return "";
//   try {
//     return new Date(dateStr).toLocaleDateString("ar-EG");
//   } catch {
//     return dateStr;
//   }
// }

// export default function PersonDetailPage() {
//   const { id } = useParams<{ id: string }>();
//   const { data: person, isLoading, error } = usePerson(id);
//   const { data: works = [], isLoading: worksLoading } = usePersonWorks(id);
//   const [bioExpanded, setBioExpanded] = useState(false);

//   if (isLoading) {
//     return (
//      // <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
//      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
//         <div className="flex flex-col gap-6 sm:flex-row">
//           <div className="bg-muted h-48 w-48 animate-pulse rounded-full" />
//           <div className="flex-1 space-y-4">
//             <div className="bg-muted h-8 w-48 animate-pulse rounded" />
//             <div className="bg-muted h-4 w-32 animate-pulse rounded" />
//             <div className="bg-muted h-20 w-full animate-pulse rounded" />
//           </div>
//         </div>
//         <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
//           {Array.from({ length: 6 }).map((_, i) => (
//             <div key={i} className="bg-muted aspect-2/3 animate-pulse rounded-lg" />
//           ))}
//         </div>
//       </div>
//     );
//   }

//   if (error || !person) {
//     return (
//      // <div className="mx-auto max-w-7xl px-4 py-6">
//      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
//         <div className="flex flex-col items-center gap-4 py-20">
//           <AlertCircle className="text-destructive h-12 w-12" />
//           <p className="text-destructive">{error?.message ?? "لم يتم العثور على الشخص"}</p>
//         </div>
//       </div>
//     );
//   }

//   const p = person as Person;
//   const name = p.display_name ?? p.name ?? "";
//   const bio = p.biography ?? "";
//   const longBio = bio.length > 300;
//   const displayBio = bioExpanded || !longBio ? bio : bio.slice(0, 300) + "...";
//   const hasPhoto = p.profile_path;
//   const birthDate = p.birth_date ?? p.birthday;
//   const birthPlace = p.birth_place ?? p.birthplace;
//   const deathDate = p.death_date ?? p.deathday;

//   return (
//    // <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
//    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
//       <Breadcrumbs
//         items={[
//           { label: "الرئيسية", href: "/" },
//           { label: "الأشخاص", href: "/person" },
//           { label: name },
//         ]}
//       />

//       <div className="border-border bg-card/40 shadow-card flex flex-col gap-4 rounded-2xl   p-6 backdrop-blur-md md:flex-row md:items-start">
//         <div className="ring-primary/30 shadow-elevated mx-auto h-40 w-40 shrink-0 overflow-hidden rounded-full ring-4 md:mx-0 md:h-64 md:w-64">
//           {hasPhoto ? (
//             <img
//               src={person.id != null ? getPersonImageUrl(person.id) : ""}
//               alt={name}
//               className="h-full w-full object-cover"
//             />
//           ) : (
//             <div className="text-muted-foreground flex h-full w-full items-center justify-center text-5xl font-bold">
//               {name[0] || "?"}
//             </div>
//           )}
//         </div>

//         <div className="flex-1">
//           <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{name || "ممثل غير معروف"}</h1>

//           {p.known_for_department && (
//             <p className="text-primary mb-2 text-lg font-bold">{p.known_for_department}</p>
//           )}

//           <div className="text-muted-foreground mb-4 flex flex-wrap gap-3 text-sm">
//             {birthDate && <span>{formatDate(birthDate)}</span>}
//             {birthPlace && <span>{birthPlace}</span>}
//             {deathDate && <span className="text-destructive">وفاة: {formatDate(deathDate)}</span>}
//           </div>

//           {bio && (
//             <div className="max-w-2xl">
//               <p
//                 className={`text-sm leading-relaxed whitespace-pre-wrap ${!bioExpanded ? "line-clamp-6" : ""}`}
//               >
//                 {displayBio}
//               </p>
//               {longBio && (
//                 <button
//                   onClick={() => setBioExpanded(!bioExpanded)}
//                   className="text-primary mt-1 text-sm hover:underline"
//                 >
//                   {bioExpanded ? "عرض أقل" : "المزيد..."}
//                 </button>
//               )}
//             </div>
//           )}
//         </div>
//       </div>

//       {works.length > 0 && (
//         <section className="space-y-4">
//           <h2 className="text-xl font-bold">الأعمال ({works.length})</h2>
//           <UnifiedMedia mode="grid" items={works} mapItemToProps={mapMediaToCard} />
//         </section>
//       )}

//       {works.length === 0 && !isLoading && !worksLoading && (
//         <p className="text-muted-foreground py-8 text-center">لا توجد أعمال متاحة لهذا الشخص</p>
//       )}
//     </div>
//   );
// }


//src\features\viewer\pages\person-detail-page.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { usePerson, usePersonWorks } from "@/lib/frontend/media-queries";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { AlertCircle } from "lucide-react";
import { mapMediaToCard } from "@/lib/frontend/media-helpers";
import { ROUTES, DEFAULT_IMAGES } from "@/shared/constants";
import type { Person } from "@/lib/frontend/api-media";

function getPersonImageUrl(id: string | number): string {
  return `/api/images/${id}?type=person&w=400&h=400`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("ar-EG");
  } catch {
    return dateStr;
  }
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading, error } = usePerson(id);
  const { data: works = [], isLoading: worksLoading } = usePersonWorks(id);
  const [bioExpanded, setBioExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="bg-muted h-48 w-48 animate-pulse rounded-full" />
          <div className="flex-1 space-y-4">
            <div className="bg-muted h-8 w-48 animate-pulse rounded" />
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="bg-muted h-20 w-full animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted aspect-2/3 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">{error?.message ?? "لم يتم العثور على الشخص"}</p>
        </div>
      </div>
    );
  }

  const p = person as Person;
  const name = p.display_name ?? p.name ?? "";
  const bio = p.biography ?? "";
  const longBio = bio.length > 300;
  const displayBio = bioExpanded || !longBio ? bio : bio.slice(0, 300) + "...";
  const birthDate = p.birth_date ?? p.birthday;
  const birthPlace = p.birth_place ?? p.birthplace;
  const deathDate = p.death_date ?? p.deathday;

  // ✅ صورة حقيقية أو الصورة الافتراضية
  const imageSrc =
    person.id && p.profile_path
      ? getPersonImageUrl(person.id)
      : DEFAULT_IMAGES.PERSON;

  return (
    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs
        items={[
          { label: "الرئيسية", href: ROUTES.HOME },
          { label: "الأشخاص", href: ROUTES.PERSON },
          { label: name },
        ]}
      />

      <div className="border-border bg-card/40 shadow-card flex flex-col gap-4 rounded-2xl p-6 backdrop-blur-md md:flex-row md:items-start">
        <div className="ring-primary/30 shadow-elevated mx-auto h-40 w-40 shrink-0 overflow-hidden rounded-full ring-4 md:mx-0 md:h-64 md:w-64">
          <img
            src={imageSrc}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              if (e.currentTarget.src !== DEFAULT_IMAGES.PERSON) {
                e.currentTarget.src = DEFAULT_IMAGES.PERSON;
              }
            }}
          />
        </div>

        <div className="flex-1">
          <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{name || "ممثل غير معروف"}</h1>

          {p.known_for_department && (
            <p className="text-primary mb-2 text-lg font-bold">{p.known_for_department}</p>
          )}

          <div className="text-muted-foreground mb-4 flex flex-wrap gap-3 text-sm">
            {birthDate && <span>{formatDate(birthDate)}</span>}
            {birthPlace && <span>{birthPlace}</span>}
            {deathDate && <span className="text-destructive">وفاة: {formatDate(deathDate)}</span>}
          </div>

          {bio && (
            <div className="max-w-2xl">
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${!bioExpanded ? "line-clamp-6" : ""}`}
              >
                {displayBio}
              </p>
              {longBio && (
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className="text-primary mt-1 text-sm hover:underline"
                >
                  {bioExpanded ? "عرض أقل" : "المزيد..."}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {works.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">الأعمال ({works.length})</h2>
          <UnifiedMedia mode="grid" items={works} mapItemToProps={mapMediaToCard} />
        </section>
      )}

      {works.length === 0 && !isLoading && !worksLoading && (
        <p className="text-muted-foreground py-8 text-center">لا توجد أعمال متاحة لهذا الشخص</p>
      )}
    </div>
  );
}
// //src\features\viewer\pages\people-directory-page.tsx
// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { useAllPeople } from "@/lib/frontend/media-queries";
// import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
// import { ROUTES } from "@/shared/constants";
// import { Spinner } from "@/shared/components/ui/spinner";
// import { AlertCircle } from "lucide-react";

// function getPersonImageUrl(id: string | number): string {
//   return `/api/images/${id}?type=person&w=120&h=120`;
// }

// export default function PeopleDirectoryPage() {
//   const [search, setSearch] = useState("");
//   const [debouncedSearch, setDebouncedSearch] = useState("");

//   const handleSearch = (value: string) => {
//     setSearch(value);
//     setTimeout(() => setDebouncedSearch(value), 400);
//   };

//   const { data, isLoading, error } = useAllPeople({ search: debouncedSearch, limit: 60 });
//   const people = data?.items ?? [];

//   return (
//   //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
//   <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
//       <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "الأشخاص" }]} />
//       <h1 className="text-2xl font-bold">الأشخاص</h1>

//       <input
//         type="text"
//         placeholder="بحث عن شخص..."
//         value={search}
//         onChange={(e) => handleSearch(e.target.value)}
//         className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
//         dir="rtl"
//       />

//       {isLoading ? (
//         <div className="flex items-center gap-2 py-20">
//           <Spinner />
//           <span className="text-muted-foreground">جاري التحميل...</span>
//         </div>
//       ) : error ? (
 
//      <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
//           <AlertCircle className="text-destructive h-12 w-12" />
//           <p className="text-destructive">فشل تحميل الأشخاص</p>
//         </div>
//       ) : people.length === 0 ? (
//         <div className="text-muted-foreground py-20 text-center">لا يوجد أشخاص</div>
//       ) : (
//         <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
//           {people.map((person) => (
//             <Link
//               key={person.id}
//               href={ROUTES.PERSON_ITEMS(String(person.id)) as import("next").Route}
//               className="group border-border bg-card/60 shadow-card hover:border-primary/40 hover:bg-card hover:shadow-hover flex flex-col items-center gap-2 rounded-lg border p-4 transition-all duration-300"
//             >
//               <div className="border-border bg-muted group-hover:border-primary/50 h-24 w-24 overflow-hidden rounded-full border-2 transition-colors">
//                 {person.profile_path ? (
//                   <img
//                     src={person.id != null ? getPersonImageUrl(person.id) : ""}
//                     alt={String(person.name ?? "")}
//                     className="h-full w-full object-cover"
//                     loading="lazy"
//                   />
//                 ) : (
//                   <div className="text-muted-foreground flex h-full w-full items-center justify-center text-2xl font-bold">
//                     {(person.display_name ?? person.name ?? "?")[0]}
//                   </div>
//                 )}
//               </div>
//               <span className="group-hover:text-primary line-clamp-2 text-center text-xs font-semibold transition-colors">
//                 {person.display_name ?? person.name}
//               </span>
//               {"media_count" in person &&
//                 typeof person.media_count === "number" &&
//                 person.media_count > 0 && (
//                   <span className="text-muted-foreground text-xs">
//                     {person.media_count} {person.media_count === 1 ? "عمل" : "أعمال"}
//                   </span>
//                 )}
//             </Link>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }


//src\features\viewer\pages\people-directory-page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useAllPeople } from "@/lib/frontend/media-queries";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES, DEFAULT_IMAGES } from "@/shared/constants";
import { Spinner } from "@/shared/components/ui/spinner";
import { AlertCircle } from "lucide-react";

function getPersonImageUrl(id: string | number): string {
  return `/api/images/${id}?type=person&w=120&h=120`;
}

export default function PeopleDirectoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearch = (value: string) => {
    setSearch(value);
    setTimeout(() => setDebouncedSearch(value), 400);
  };

  const { data, isLoading, error } = useAllPeople({ search: debouncedSearch, limit: 60 });
  const people = data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "الأشخاص" }]} />
      <h1 className="text-2xl font-bold">الأشخاص</h1>

      <input
        type="text"
        placeholder="بحث عن شخص..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        dir="rtl"
      />

      {isLoading ? (
        <div className="flex items-center gap-2 py-20">
          <Spinner />
          <span className="text-muted-foreground">جاري التحميل...</span>
        </div>
      ) : error ? (
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">فشل تحميل الأشخاص</p>
        </div>
      ) : people.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">لا يوجد أشخاص</div>
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {people.map((person) => {
            const personId = person.id ?? person.person_id;
            const name = person.display_name ?? person.name ?? "";
            
            // ✅ صورة حقيقية أو الصورة الافتراضية
            const imageSrc =
              personId && person.profile_path
                ? getPersonImageUrl(personId)
                : DEFAULT_IMAGES.PERSON;

            return (
              <Link
                key={person.id}
                href={ROUTES.PERSON_ITEMS(String(personId)) as import("next").Route}
                className="group border-border bg-card/60 shadow-card hover:border-primary/40 hover:bg-card hover:shadow-hover flex flex-col items-center gap-2 rounded-lg border p-4 transition-all duration-300"
              >
                <div className="border-border bg-muted group-hover:border-primary/50 h-24 w-24 overflow-hidden rounded-full border-2 transition-colors">
                  <img
                    src={imageSrc}
                    alt={name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      if (e.currentTarget.src !== DEFAULT_IMAGES.PERSON) {
                        e.currentTarget.src = DEFAULT_IMAGES.PERSON;
                      }
                    }}
                  />
                </div>
                <span className="group-hover:text-primary line-clamp-2 text-center text-xs font-semibold transition-colors">
                  {name}
                </span>
                {"media_count" in person &&
                  typeof person.media_count === "number" &&
                  person.media_count > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {person.media_count} {person.media_count === 1 ? "عمل" : "أعمال"}
                    </span>
                  )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
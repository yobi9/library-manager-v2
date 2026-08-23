// // "use client";

// // import { useLibraries } from "@/lib/frontend/media-queries";
// // import { MediaGrid } from "@/shared/components/ui/media-grid";
// // import { Spinner } from "@/shared/components/ui/spinner";
// // import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
// // import { ROUTES } from "@/shared/constants";
// // import type { Library } from "@/lib/frontend/api-media";
// // import { Folder } from "lucide-react";
// // import { SectionHeader } from "@/features/viewer/components/section-header";
// // import { SectionCard } from "@/features/viewer/components/sections/section-card";

// // function getParentId(section: Library): string | number | null {
// //   if (section.parent_id !== undefined && section.parent_id !== null) return section.parent_id;
// //   if (section.parentId !== undefined && section.parentId !== null) return section.parentId;
// //   return null;
// // }

// // interface SectionsGridProps {
// //   /** معرّف المكتبة الحاوية لعرض أقسامها الفرعية. */
// //   containerId?: string;
// //   /** هل يُعرض عنوان القسم (الافتراضي: `true`). */
// //   showTitle?: boolean;
// //   /** هل يُعرض مسار التنقل (الافتراضي: `false`). */
// //   showBreadcrumb?: boolean;
// // }

// // /**
// //  * شبكة عرض الأقسام (المكتبات) مع دعم التنقل الشجري.
// //  *
// //  * - بدون `containerId`: يعرض الأقسام الجذرية (`parent_id = null`).
// //  * - مع `containerId`: يعرض الأقسام الفرعية داخل المكتبة المحددة.
// //  *
// //  * @param props - خصائص العرض (containerId، showTitle، showBreadcrumb).
// //  * @returns عنصر شبكة الأقسام، أو مؤشر تحميل، أو رسالة خطأ.
// //  */
// // export function SectionsGrid({
// //   containerId,
// //   showTitle = true,
// //   showBreadcrumb = false,
// // }: SectionsGridProps) {
// //   const { data: allLibraries, isLoading, error } = useLibraries();

// //   const currentCategoryName =
// //     containerId && allLibraries
// //       ? (allLibraries.find((lib) => String(lib.library_id) === containerId)?.name ?? null)
// //       : null;

// //   const displayItems =
// //     containerId && allLibraries
// //       ? allLibraries.filter((lib) => String(getParentId(lib)) === containerId)
// //       : (allLibraries?.filter((lib) => getParentId(lib) === null && !lib.hideSection) ?? []);

// //   const sectionTitle = currentCategoryName
// //     ? `الأقسام بداخل : ${currentCategoryName}`
// //     : containerId
// //       ? "الأقسام الفرعية"
// //       : "الأقسام الرئيسية";

// //   // if (isLoading) {
// //   //   return (
// //   //     <div className="flex items-center gap-2 py-20">
// //   //       <Spinner />
// //   //       <span className="text-muted-foreground">جاري تحميل الأقسام...</span>
// //   //     </div>
// //   //   );
// //   // }


// // // ثم داخل الدالة، استبدل حالة التحميل:
// // if (isLoading) {
// //   return (
// //     <div className="flex min-h-screen items-center justify-center bg-background">
// //       <Spinner size="lg" label="جاري تحميل الأقسام..." labelPosition="bottom" />
// //     </div>
// //   );
// // }
// //   if (error) {
// //     return <div className="text-destructive py-20 text-center">فشل تحميل الأقسام</div>;
// //   }

// //   return (
// //     <div>
// //       {showBreadcrumb && currentCategoryName && (
// //         <div className="mb-4 pb-2">
// //           <Breadcrumbs
// //             items={[
// //               { label: "الأقسام الرئيسية", href: ROUTES.SECTIONS },
// //               { label: currentCategoryName },
// //             ]}
// //           />
// //         </div>
// //       )}
// //       {showTitle && displayItems.length > 0 && (
// //         <SectionHeader
// //           title={sectionTitle}
// //           icon={<Folder className="h-5 w-5 text-primary" />}
// //           count={displayItems.length}
// //           variant="default"
// //         />
// //       )}
// //       {displayItems.length === 0 ? (
// //         <div className="text-muted-foreground py-20 text-center">
// //           {currentCategoryName
// //             ? `لا توجد أقسام فرعية بداخل ${currentCategoryName}`
// //             : "لا توجد أقسام فرعية حالياً"}
// //         </div>
// //       ) : (
// //         <MediaGrid>
// //           {displayItems.map((section) => (
// //             <SectionCard key={section.library_id} section={section} />
// //           ))}
// //         </MediaGrid>
// //       )}
// //     </div>
// //   );
// // }

// // export default SectionsGrid;



// "use client";

// import React from "react"; // ✅ استيراد React ضروري لـ JSX
// import { useLibraries } from "@/lib/frontend/media-queries";
// import { Spinner } from "@/shared/components/ui/spinner";
// import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
// import { ROUTES } from "@/shared/constants";
// import type { Library } from "@/lib/frontend/api-media";
// import { Folder } from "lucide-react";
// import { SectionHeader } from "@/features/viewer/components/section-header";
// import { SectionCard } from "@/features/viewer/components/sections/section-card";

// /**
//  * يستخرج معرف الأب (parent_id) من كائن المكتبة بغض النظر عن اسم الحقل.
//  */
// function getParentId(section: Library): string | number | null {
//   if (section.parent_id !== undefined && section.parent_id !== null) return section.parent_id;
//   if (section.parentId !== undefined && section.parentId !== null) return section.parentId;
//   return null;
// }

// interface SectionsGridProps {
//   containerId?: string;
//   showTitle?: boolean;
//   showBreadcrumb?: boolean;
// }

// /**
//  * شبكة عرض الأقسام (المكتبات) مع دعم التنقل الشجري.
//  */
// export function SectionsGrid({
//   containerId,
//   showTitle = true,
//   showBreadcrumb = false,
// }: SectionsGridProps) {
//   const { data: allLibraries, isLoading, error } = useLibraries();

//   const currentCategoryName =
//     containerId && allLibraries
//       ? (allLibraries.find((lib) => String(lib.library_id) === containerId)?.name ?? null)
//       : null;

//   const displayItems =
//     containerId && allLibraries
//       ? allLibraries.filter((lib) => String(getParentId(lib)) === containerId)
//       : (allLibraries?.filter((lib) => getParentId(lib) === null && !lib.hideSection) ?? []);

//   const sectionTitle = currentCategoryName
//     ? `الأقسام بداخل : ${currentCategoryName}`
//     : containerId
//       ? "الأقسام الفرعية"
//       : "الأقسام الرئيسية";

//   if (isLoading) {
//     return (
//       <div className="flex min-h-screen items-center justify-center bg-background">
//         <Spinner size="lg" label="جاري تحميل الأقسام..." labelPosition="bottom" />
//       </div>
//     );
//   }
//   if (error) {
//     return <div className="text-destructive py-20 text-center">فشل تحميل الأقسام</div>;
//   }

//   return (
//     <div>
//       {showBreadcrumb && currentCategoryName && (
//         <div className="mb-4 pb-2">
//           <Breadcrumbs
//             items={[
//               { label: "الأقسام الرئيسية", href: ROUTES.SECTIONS },
//               { label: currentCategoryName },
//             ]}
//           />
//         </div>
//       )}
//       {showTitle && displayItems.length > 0 && (
//         <SectionHeader
//           title={sectionTitle}
//           icon={<Folder className="h-5 w-5 text-primary" />}
//           count={displayItems.length}
//           variant="default"
//         />
//       )}
//       {displayItems.length === 0 ? (
//         <div className="text-muted-foreground py-20 text-center">
//           {currentCategoryName
//             ? `لا توجد أقسام فرعية بداخل ${currentCategoryName}`
//             : "لا توجد أقسام فرعية حالياً"}
//         </div>
//       ) : (
//         /* ✅ شبكة مرنة مع تباعد عمودي محسّن */
//         <div
//           className="grid gap-x-2 sm:gap-x-3 gap-y-6 sm:gap-y-8"
//           style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
//         >
//           {displayItems.map((section) => (
//             <SectionCard key={section.library_id} section={section} />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// export default SectionsGrid;

"use client";

import React from "react";
import { useLibraries } from "@/lib/frontend/media-queries";
import { Spinner } from "@/shared/components/ui/spinner";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES } from "@/shared/constants";
import type { Library } from "@/lib/frontend/api-media";
import { Folder } from "lucide-react";
import { SectionHeader } from "@/features/viewer/components/section-header";
import { SectionCard } from "@/features/viewer/components/sections/section-card";

/**
 * يستخرج معرف الأب (parent_id) من كائن المكتبة بغض النظر عن اسم الحقل.
 */
function getParentId(section: Library): string | number | null {
  if (section.parent_id !== undefined && section.parent_id !== null) return section.parent_id;
  if (section.parentId !== undefined && section.parentId !== null) return section.parentId;
  return null;
}

interface SectionsGridProps {
  containerId?: string;
  showTitle?: boolean;
  showBreadcrumb?: boolean;
}

/**
 * شبكة عرض الأقسام (المكتبات) مع دعم التنقل الشجري.
 */
export function SectionsGrid({
  containerId,
  showTitle = true,
  showBreadcrumb = false,
}: SectionsGridProps) {
  const { data: allLibraries, isLoading, error } = useLibraries();

  const currentCategoryName =
    containerId && allLibraries
      ? (allLibraries.find((lib) => String(lib.library_id) === containerId)?.name ?? null)
      : null;

  const displayItems =
    containerId && allLibraries
      ? allLibraries.filter((lib) => String(getParentId(lib)) === containerId)
      : (allLibraries?.filter((lib) => getParentId(lib) === null && !lib.hideSection) ?? []);

  const sectionTitle = currentCategoryName
    ? `الأقسام بداخل : ${currentCategoryName}`
    : containerId
      ? "الأقسام الفرعية"
      : "الأقسام الرئيسية";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" label="جاري تحميل الأقسام..." labelPosition="bottom" />
      </div>
    );
  }
  if (error) {
    return <div className="text-destructive py-20 text-center">فشل تحميل الأقسام</div>;
  }

  return (
    <div>
      {showBreadcrumb && currentCategoryName && (
        <div className="mb-4 pb-2">
          <Breadcrumbs
            items={[
              { label: "الأقسام الرئيسية", href: ROUTES.SECTIONS },
              { label: currentCategoryName },
            ]}
          />
        </div>
      )}
      {showTitle && displayItems.length > 0 && (
        <SectionHeader
          title={sectionTitle}
          icon={<Folder className="h-5 w-5 text-primary" />}
          count={displayItems.length}
          variant="default"
        />
      )}
      {displayItems.length === 0 ? (
        <div className="text-muted-foreground py-20 text-center">
          {currentCategoryName
            ? `لا توجد أقسام فرعية بداخل ${currentCategoryName}`
            : "لا توجد أقسام فرعية حالياً"}
        </div>
      ) : (
        <div
          className="grid gap-x-2 sm:gap-x-3 gap-y-6 sm:gap-y-8"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {displayItems.map((section) => (
            <SectionCard key={section.library_id} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SectionsGrid;
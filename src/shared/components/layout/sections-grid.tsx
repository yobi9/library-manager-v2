"use client";

import { useState } from "react";
import { useLibraries } from "@/lib/frontend/media-queries";
import { MediaGrid } from "@/shared/components/ui/media-grid";
import { Spinner } from "@/shared/components/ui/spinner";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { DEFAULT_IMAGES, ROUTES } from "@/shared/constants";
import type { Library } from "@/lib/frontend/api-media";
import { Folder } from "lucide-react";
import { SectionHeader } from "@/features/viewer/components/section-header";

function getSectionDisplayTitle(section: Library): string {
  if (section.name) return section.name;
  const type = section.type?.toLowerCase();
  const translations: Record<string, string> = {
    main: "الأقسام الرئيسية",
    movie: "الأفلام",
    movies: "الأفلام",
    series: "المسلسلات",
    music: "الصوتيات",
    photo: "الصور",
    theater: "المسرحيات",
    series_anime: "مسلسلات الأنمي",
    series_tv: "البرامج التلفزيونية",
    series_sports: "البرامج الرياضية",
    series_ramadan: "مسلسلات رمضان",
    series_deen: "البرامج الدينية",
    series_kids: "مسلسلات الأطفال",
    series_learn: "البرامج التعليمية",
    series_doc: "البرامج الوثائقية",
 
  };
  return translations[type] ?? section.type ?? "قسم";
}

/**
 * يبني رابط التنقل الخاص ببطاقة القسم.
 *
 * - الحاوية الرئيسية (`main`): صفحة الأقسام الداخلية.
 * - الاختصار (`linked`): يفتح صفحة القسم المستهدف مباشرة (حسب `linked_library_id`).
 * - أي قسم محتوى عادي: صفحة عناصره.
 *
 * @param section - كائن المكتبة (Library) المراد بناء رابطها.
 * @returns مسار الرابط النسبي.
 */
function buildSectionLink(section: Library): string {
  if (section.type === "main") return `${ROUTES.SECTIONS}/${section.library_id}`;
  const targetId = section.linked_library_id ?? section.linkedLibraryId;
  if (section.type === "linked" && targetId) return `${ROUTES.ITEMS}/${targetId}`;
  return `${ROUTES.ITEMS}/${section.library_id}`;
}

function getParentId(section: Library): string | number | null {
  if (section.parent_id !== undefined && section.parent_id !== null) return section.parent_id;
  if (section.parentId !== undefined && section.parentId !== null) return section.parentId;
  return null;
}

/**
 * يحلّ مسار صورة المكتبة من سجلها بترتيب أولوية: `image` ثم `image_path`.
 *
 * يعد المسار الناتج مساراً ويبياً ثابتاً (`/assets/images/...`) يُعرض مباشرة؛
 * إذا كان السجل يشير لملف مفقود من القرص يُترك للـ `onError` في بطاقة القسم
 * استبداله بالصورة الافتراضية.
 *
 * @param section - كائن المكتبة (Library) المراد استخراج صورة له.
 * @returns مسار صورة ويبي، أو `null` إن لم يوجد أي مسار مسجّل.
 */
function getSectionImageUrl(section: Library): string | null {
  if (section.image) return section.image;
  if (section.image_path) return section.image_path;
  return null;
}

interface SectionCardProps {
  section: Library;
}

/**
 * بطاقة قسم واحد داخل شبكة الأقسام، تعرض صورة المكتبة مع بديل احتياطي.
 *
 * تحمل حالة `imgFailed` محلياً (داخل مكوّن مستقل وليس في حلقة `map`) لتفادي
 * إعادة التحميل عند فشل الصورة الأصلية (مسار قديم أو ملف مفقود)، فتُبدّلها
 * بصورة المكتبة الافتراضية المحايدة ثنائية الثيم. عند عدم وجود صورة أصل
 * البداية تكون الصورة الافتراضية مباشرة.
 *
 * @param section - كائن المكتبة (Library) المراد عرضه كبطاقة قسم.
 * @returns عنصر رابط بطاقة القسم بصورته الأصلية أو البديل الافتراضي.
 */
function SectionCard({ section }: SectionCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = getSectionImageUrl(section);
  const src = imageUrl && !imgFailed ? imageUrl : DEFAULT_IMAGES.LIBRARY;

  return (
    <a
      href={buildSectionLink(section)}
      className="group border-border bg-card/50 hover:border-primary/40 relative overflow-hidden rounded-lg border transition-all hover:shadow-lg"
    >
      <div className="bg-muted/50 relative aspect-2/3 overflow-hidden rounded-lg">
        <img
          src={src}
          alt={getSectionDisplayTitle(section)}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
          onError={() => {
            if (imageUrl) setImgFailed(true);
          }}
        />
        <div className="bg-background/70 border-border/50 absolute inset-e-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm">
          <Folder size={14} className="text-primary" />
        </div>
        {section.media_count !== undefined && section.media_count > 0 && (
          <div className="bg-primary/90 text-primary-foreground absolute inset-s-2 top-2 z-10 rounded-sm px-1.5 py-0.5 text-xs font-bold shadow-sm">
            {section.media_count}
          </div>
        )}
        <div className="from-background/90 pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t to-transparent" />
      </div>
      <div className="p-2">
        <h3 className="line-clamp-1 text-xs font-bold">{getSectionDisplayTitle(section)}</h3>
      </div>
    </a>
  );
}

interface SectionsGridProps {
  containerId?: string;
  showTitle?: boolean;
  showBreadcrumb?: boolean;
}

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
      <div className="flex items-center gap-2 py-20">
        <Spinner />
        <span className="text-muted-foreground">جاري تحميل الأقسام...</span>
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
{/* 
      {showTitle && displayItems.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Folder className="text-primary/70 h-5 w-5" />
          <h2 className="text-lg font-bold">{sectionTitle}</h2>
          <span className="text-muted-foreground text-sm">({displayItems.length})</span>
        </div>
      )} */}
     {/* 2. استبدال العنوان اليدوي بمكون SectionHeader */}
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
        <MediaGrid>
          {displayItems.map((section) => (
            <SectionCard key={section.library_id} section={section} />
          ))}
        </MediaGrid>
      )}
    </div>
  );
}

export default SectionsGrid;

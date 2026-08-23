//src\features\viewer\components\home\TypeSectionSlider.tsx
"use client";

import React from "react";
import { BookOpen, Film, Gamepad2, Monitor, Music, Palette, Radio, Tv } from "lucide-react";
import { useLatestMedia } from "@/lib/frontend/media-queries";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";

import { mapMediaToCard } from "@/lib/frontend/media-helpers";

/**
 * أيقونات أنواع الأقسام — تعليم محايد موحّد (text-muted-foreground)
 * وفق فلسفة Content-First: البوستر يحمل الهوية البصرية، والعنوان والأيقونة
 * طبقة ثانوية هادئة لا تنافس المحتوى ولا تصنع ضجيجاً لونياً في الصفحة الرئيسية.
 */
const SECTION_ICONS: Record<string, React.ReactNode> = {
  movie: <Film className="text-muted-foreground h-5 w-5" />,
  series: <Tv className="text-muted-foreground h-5 w-5" />,
  series_anime: <Tv className="text-muted-foreground h-5 w-5" />,
  series_sports: <Radio className="text-muted-foreground h-5 w-5" />,
  series_ramadan: <Tv className="text-muted-foreground h-5 w-5" />,
  series_tv: <Tv className="text-muted-foreground h-5 w-5" />,
  series_deen: <BookOpen className="text-muted-foreground h-5 w-5" />,
  series_kids: <Palette className="text-muted-foreground h-5 w-5" />,
  series_learn: <BookOpen className="text-muted-foreground h-5 w-5" />,
  series_doc: <Monitor className="text-muted-foreground h-5 w-5" />,
  theater: <Film className="text-muted-foreground h-5 w-5" />,
  music: <Music className="text-muted-foreground h-5 w-5" />,
  photo: <Palette className="text-muted-foreground h-5 w-5" />,
  book: <BookOpen className="text-muted-foreground h-5 w-5" />,
  app: <Gamepad2 className="text-muted-foreground h-5 w-5" />,
};

const SECTIONS: Array<{ type: string; title: string; iconKey: string; settingsKey: string }> = [
  { type: "movie", title: "أحدث الأفلام", iconKey: "movie", settingsKey: "show_movie" },
  { type: "series", title: "أحدث المسلسلات", iconKey: "series", settingsKey: "show_series" },
  {
    type: "series_anime",
    title: "أحدث الأنمي",
    iconKey: "series",
    settingsKey: "show_series_anime",
  },
  {
    type: "series_kids",
    title: "أحدث مسلسلات الاطفال",
    iconKey: "series",
    settingsKey: "show_series_kids",
  },
  {
    type: "series_sports",
    title: "أحدث الرياضة",
    iconKey: "series",
    settingsKey: "show_series_sports",
  },
  {
    type: "series_tv",
    title: "أحدث البرامج التلفزيونية",
    iconKey: "series",
    settingsKey: "show_series_tv",
  },
  {
    type: "series_ramadan",
    title: "أحدث المسلسلات الرمضانية",
    iconKey: "series",
    settingsKey: "show_series_ramadan",
  },
  {
    type: "series_doc",
    title: "أحدث الوثائقيات",
    iconKey: "series",
    settingsKey: "show_series_doc",
  },
  {
    type: "series_learn",
    title: "أحدث البرامج التعليمية",
    iconKey: "series",
    settingsKey: "show_series_learn",
  },
  {
    type: "series_deen",
    title: "أحدث المحاضرات الدينية",
    iconKey: "series",
    settingsKey: "show_series_deen",
  },
];

function TypeSectionSlider({
  type,
  title,
  iconKey,
}: {
  type: string;
  title: string;
  iconKey: string;
}) {
  const { data: items = [], isLoading } = useLatestMedia(type);

  if (!isLoading && items.length === 0) return null;

  return (
    <UnifiedMedia
      mode="slider"
      title={title}
      icon={SECTION_ICONS[iconKey]}
      items={items}
      isLoading={isLoading}
      mapItemToProps={mapMediaToCard}
    />
  );
}

export function EnabledTypeSections({
  settings,
  libraries,
}: {
  settings: Record<string, unknown>;
  libraries: Array<{ type: string }>;
}) {
  const enabledSections = SECTIONS.filter((section) => {
    const isEnabled = settings?.[section.settingsKey];
    if (isEnabled !== true) return false;
    if (libraries.length === 0) return true;
    return libraries.some((lib) => lib.type === section.type);
  });

  return (
    <>
      {enabledSections.map((section) => (
        <TypeSectionSlider
          key={section.type}
          type={section.type}
          title={section.title}
          iconKey={section.iconKey}
        />
      ))}
    </>
  );
}

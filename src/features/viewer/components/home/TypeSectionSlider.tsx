//src\features\viewer\components\home\TypeSectionSlider.tsx
"use client";

import React from "react";
import { BookOpen, Film, Gamepad2, Monitor, Music, Palette, Radio, Tv } from "lucide-react";
import { useLatestMedia } from "@/lib/frontend/media-queries";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
 
import { mapMediaToCard } from "@/lib/frontend/media-helpers";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  movie: <Film className="h-5 w-5 text-rose-500" />,
  series: <Tv className="h-5 w-5 text-blue-500" />,
  series_anime: <Tv className="h-5 w-5 text-purple-500" />, // بنفسجي
 
   series_sports: <Radio className="h-5 w-5  text-yellow-500   " />,
  series_ramadan: <Tv className="h-5 w-5" />,
  series_tv: <Tv className="h-5 w-5" />,
  series_deen: <BookOpen className="h-5 w-5 text-teal-500" />,
  series_kids: <Palette className="h-5 w-5 text-pink-500 " />,
  series_learn: <BookOpen className="h-5 w-5 text-cyan-500" />,
  series_doc: <Monitor className="h-5 w-5 text-indigo-500" />,
  theater: <Film className="h-5 w-5 text-red-500" />,
  music: <Music className="h-5 w-5 text-green-500" />,
  photo: <Palette className="h-5 w-5 text-sky-500" />,
  book: <BookOpen className="h-5 w-5 text-amber-500" />,
  app: <Gamepad2 className="h-5 w-5  text-gray-400" />,
};

const SECTIONS: Array<{ type: string; title: string; iconKey: string; settingsKey: string }> = [
  { type: "movie", title: "أحدث الأفلام", iconKey: "movie", settingsKey: "show_movie" },
  { type: "series", title: "أحدث المسلسلات", iconKey: "series", settingsKey: "show_series" },
  { type: "series_anime", title: "أحدث الأنمي", iconKey: "series", settingsKey: "show_series_anime" },
  { type: "series_kids", title: "أحدث أفلام الكرتون", iconKey: "series", settingsKey: "show_series_kids" },
  { type: "series_sports", title: "أحدث الرياضة", iconKey: "series", settingsKey: "show_series_sports" },
  { type: "series_tv", title: "أحدث البرامج التلفزيونية", iconKey: "series", settingsKey: "show_series_tv" },
  { type: "series_ramadan", title: "أحدث المسلسلات الرمضانية", iconKey: "series", settingsKey: "show_series_ramadan" },
  { type: "series_doc", title: "أحدث الوثائقيات", iconKey: "series", settingsKey: "show_series_doc" },
  { type: "series_learn", title: "أحدث البرامج التعليمية", iconKey: "series", settingsKey: "show_series_learn" },
  { type: "series_deen", title: "أحدث المحاضرات الدينية", iconKey: "series", settingsKey: "show_series_deen" },
];

function TypeSectionSlider({ type, title, iconKey }: { type: string; title: string; iconKey: string }) {
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

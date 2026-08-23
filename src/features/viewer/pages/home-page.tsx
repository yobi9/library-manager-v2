
"use client";

import { usePublicSettings, useLibraries } from "@/lib/frontend/media-queries";
import { SectionsGrid } from "@/features/viewer/components/sections/sections-grid";
import { HomeHero } from "@/features/viewer/components/home/hero";
import { PinnedSlider } from "@/features/viewer/components/home/pinned-slider";
import { FavoritesSlider } from "@/features/viewer/components/home/favorites-slider";
import { EnabledTypeSections } from "@/features/viewer/components/home/TypeSectionSlider";
import { Spinner } from "@/shared/components/ui/spinner";

export default function HomePage() {
  const { data: settings, isLoading: settingsLoading } = usePublicSettings();
  const { data: libraries = [] } = useLibraries();

  if (settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" label="جاري تحميل المحتوى..." labelPosition="bottom" />
      </div>
    );
  }

  return (
    <div>
      {/* قسم الهيرو الرئيسي في أعلى الصفحة */}
      <HomeHero settings={settings ?? {}} />

      {/* الحاوية الكبرى الموحدة للـ px (المحاذاة الجانبية متطابقة لكل الأجهزة) */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        
        {/* استدعاء مباشر: المسافات تُحسب داخلياً لحماية الصفحة عند الاختفاء التام */}
         {/* 1. سلايدر المثبتة مع مسافة سفلية */}
       
          <PinnedSlider />
         
        {/* 2. سلايدر المفضلة */}
       
          <FavoritesSlider />
    

   {/* 3.    سلايدر احدث الايتم لكل نوع سلايدر  حسب النوع      */}
    
        <EnabledTypeSections settings={settings ?? {}} libraries={libraries} />
    

        {/* قسم الشبكة الأخير: متميز بمسافته الخارجية المستقلة (mt) والداخلية لعنوانه (py) */}
        <div className="mt-4 sm:mt-6 md:mt-8 py-4 sm:py-6 pb-16">
          <SectionsGrid showTitle />
        </div>

      </div>
    </div>
  );
}

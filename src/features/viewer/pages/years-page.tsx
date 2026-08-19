"use client";

import Link from "next/link";
import { Calendar, AlertCircle } from "lucide-react";
import { useAvailableYears } from "@/lib/frontend/media-queries";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { ROUTES } from "@/shared/constants";

export default function YearsPage() {
  const { data: years = [], isLoading, error } = useAvailableYears();

  if (isLoading) {
    return (
      
        <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "جميع السنوات" }]} />
        <h1 className="text-2xl font-bold">جميع السنوات</h1>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
    //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
    <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "جميع السنوات" }]} />
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">فشل تحميل السنوات</p>
        </div>
      </div>
    );
  }

  return (
  //  <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
  <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <Breadcrumbs items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "جميع السنوات" }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">جميع السنوات</h1>
        <span className="text-sm text-muted-foreground">({years.length})</span>
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {years.map((year) => (
          <Link key={year} href={ROUTES.YEAR_ITEMS(String(year)) as import("next").Route}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card/60 p-4 text-center transition-all duration-300 hover:border-primary/40 hover:bg-card hover:shadow-hover shadow-card">
            <Calendar className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="text-sm font-bold transition-colors group-hover:text-primary sm:text-base">{year}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

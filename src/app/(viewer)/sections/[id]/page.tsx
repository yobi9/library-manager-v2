"use client";

import { useParams } from "next/navigation";
import { SectionsGrid } from "@/features/viewer/components/sections/sections-grid";

export default function ContainerPage() {
  const { id } = useParams<{ id: string }>();
  return (
     // <div className="mx-auto max-w-7xl px-4 py-6">
    <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8"> 
  
      <SectionsGrid containerId={id} showTitle showBreadcrumb />
    </div>
  );
}

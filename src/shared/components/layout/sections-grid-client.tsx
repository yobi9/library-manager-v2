"use client";

import dynamic from "next/dynamic";

const SectionsGrid = dynamic(
  () => import("@/features/viewer/components/sections/sections-grid").then((mod) => ({ default: mod.SectionsGrid })),
  { ssr: false },
);

export function SectionsGridClient(props: { containerId?: string; showTitle?: boolean; showBreadcrumb?: boolean }) {
  return <SectionsGrid {...props} />;
}

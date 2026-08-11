"use client";

import { useParams } from "next/navigation";
import { useInfiniteMediaByFilter } from "@/lib/frontend/media-queries";
import { ListingPage } from "@/shared/components/layout/listing-page";

export default function CertificationItemsPage() {
  const { cert } = useParams<{ cert: string }>();
  const certification = decodeURIComponent(cert);
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteMediaByFilter({ certification, rootOnly: true });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total;

  return (
    <ListingPage
      items={items}
      total={total}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      title={certification}
      breadcrumbs={[
        { label: "الرئيسية", href: "/" },
        { label: "الشهادة", href: "/certification" }, // ✅ تم التصحيح
        { label: certification },
      ]}
      hasMore={hasNextPage}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
    />
  );
}

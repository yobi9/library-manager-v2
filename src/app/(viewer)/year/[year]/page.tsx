"use client";

import { useParams } from "next/navigation";
import { useInfiniteMediaByFilter } from "@/lib/frontend/media-queries";
import { ListingPage } from "@/shared/components/layout/listing-page";

export default function YearItemsPage() {
  const { year } = useParams<{ year: string }>();
  const yearNum = parseInt(year, 10);
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteMediaByFilter({ year: yearNum, rootOnly: true });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total;

  return (
    <ListingPage
      items={items}
      total={total}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      title={`سنة ${year}`}
      breadcrumbs={[
        { label: "الرئيسية", href: "/" },
        { label: "السنوات", href: "/year" },
        { label: year },
      ]}
      hasMore={hasNextPage}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
    />
  );
}

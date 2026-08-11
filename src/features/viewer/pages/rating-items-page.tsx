"use client";

import { useParams } from "next/navigation";
import { useInfiniteMediaByFilter } from "@/lib/frontend/media-queries";
import { ListingPage } from "@/shared/components/layout/listing-page";

export default function RatingItemsPage() {
  const { value } = useParams<{ value: string }>();
  const ratingNum = parseFloat(value);
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteMediaByFilter({ minRating: ratingNum, rootOnly: true });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total;

  return (
    <ListingPage
      items={items}
      total={total}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      title={`تقييم ${value}`}
      breadcrumbs={[
        { label: "الرئيسية", href: "/" },
        { label: "التقييم", href: "/rating" },
        { label: `تقييم ${value}` },
      ]}
      hasMore={hasNextPage}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
    />
  );
}

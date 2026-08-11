"use client";

import { useParams } from "next/navigation";
import { useInfiniteMediaByFilter } from "@/lib/frontend/media-queries";
import { ListingPage } from "@/shared/components/layout/listing-page";

export default function GenreSlugPage() {
  const { slug } = useParams<{ slug: string }>();
  const genreName = decodeURIComponent(slug).replace(/_/g, " ");
  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteMediaByFilter({ genre: genreName, rootOnly: true });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total;

  return (
    <ListingPage
      items={items}
      total={total}
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      title={genreName}
      breadcrumbs={[
        { label: "الرئيسية", href: "/" },
        { label: "التصنيفات", href: "/genre" },
        { label: genreName },
      ]}
      hasMore={hasNextPage}
      isLoadingMore={isFetchingNextPage}
      onLoadMore={() => void fetchNextPage()}
    />
  );
}

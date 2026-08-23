//src\features\viewer\pages\item-detail-page.tsx
"use client";

import { useMemo, useCallback, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useMediaById, useRecommendations } from "@/lib/frontend/media-queries";
import type { MediaItem } from "@/lib/frontend/api-media";

import { useSeasonEpisodes } from "@/lib/frontend/use-season-episodes";

import { isSeriesType } from "@/lib/frontend/media-constants";
import { getPosterUrl, getBackdropUrl } from "@/lib/frontend/image-helpers";
import { mapMediaToCard, extractGenres, isItemNew } from "@/lib/frontend/media-helpers";
import { translateMediaType } from "@/lib/frontend/translate";
import { EpisodeCard } from "@/features/viewer/components/episode-card";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { UnifiedMedia } from "@/features/viewer/components/unified-media/unified-media";
import { UnifiedCard } from "@/features/viewer/components/unified-card/unified-card";
import { CrewMemberCard } from "@/features/viewer/components/member-cards/CrewMemberCard";
import { CastMemberCard } from "@/features/viewer/components/member-cards/CastMemberCard";
import { MediaActions } from "@/features/viewer/components/media-actions";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ROUTES } from "@/shared/constants";
import { CAST_DEFAULT_COUNT, CREW_DEFAULT_COUNT } from "@/shared/constants/crew-roles";
import { toast } from "sonner";
import { getUniqueCrewByRole } from "@/shared/utils/crew-helpers";
import { SectionHeader } from "@/features/viewer/components/section-header";

/**
 * زر «عرض الكل / إخفاء» لأقسام الممثلين وطاقم العمل.
 *
 * - الهدف: توسيع القسم ليعرض كل الأعضاء أو طيّه إلى العدد الافتراضي،
 *   بدون أي شريط تمرير — العرض دائماً شبكة/شرائح ملفوفة.
 *
 * @param expanded - حالة التوسيع الحالية (true = كل الأعضاء ظاهرون).
 * @param onClick - معالج تبديل الحالة.
 * @returns زر نصي مع سهم أعلى/أسفل وفق الحالة.
 */
function ExpandToggle({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <Button
      variant="link"
      size="sm"
      onClick={onClick}
      className="gap-0.5 p-0 text-xs font-medium transition-all hover:gap-1"
    >
      {expanded ? "إخفاء" : "عرض الكل"}
      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </Button>
  );
}

function SeasonEpisodesSection({
  selectedSeasonId,
  episodesSectionRef,
}: {
  selectedSeasonId: number | null;
  episodesSectionRef: React.Ref<HTMLDivElement>;
}) {
  const router = useRouter();
  const { data: episodes, seasonTitle, isLoading } = useSeasonEpisodes(selectedSeasonId);

  const handleEpisodeClick = useCallback(
    (ep: { media_id?: number; id?: number }) =>
      router.push(ROUTES.PLAYER(String(ep.media_id ?? ep.id)) as import("next").Route),
    [router],
  );

  if (!selectedSeasonId) return null;

  return (
    <div ref={episodesSectionRef} className="animate-in slide-in-from-bottom-4 mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">{seasonTitle || "الحلقات"}</h3>
        {episodes.length > 0 && (
          <Badge variant="count" className="px-3 py-0.5">
            {episodes.length} حلقة
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted aspect-video animate-pulse rounded-xl" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">لا توجد حلقات</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-3">
          {episodes.map(
            (
              ep: {
                media_id?: number;
                id?: number;
                title?: string;
                overview?: string;
                runtime?: number;
              },
              i: number,
            ) => (
              <EpisodeCard
                key={String(ep.media_id ?? ep.id ?? i)}
                title={ep.title ?? `الحلقة ${i + 1}`}
                episodeNumber={i + 1}
                mediaId={ep.media_id ?? ep.id}
                duration={ep.runtime}
                overview={ep.overview}
                priority={i < 4}
                onClick={() => handleEpisodeClick(ep)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * صفحة تفاصيل عنصر وسائط: الملصق، البيانات والتصنيفات، القصة، طاقم التمثيل والعمل،
 * شريط المواسم للمسلسلات، وقسم التوصيات.
 *
 * @returns صفحة التفاصيل كاملة.
 */
export default function ItemDetailPage() {
  const { id } = useParams<{ type: string; id: string }>();
  const router = useRouter();
  const { data: media, isLoading, error } = useMediaById(id);
  const { data: recommendations = [], isLoading: recsLoading } = useRecommendations(
    Number(media?.library_id ?? media?.libraryId) || undefined,
    media?.media_id ?? media?.id,
    media?.type,
  );

  const episodesSectionRef = useRef<HTMLDivElement>(null!);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [castExpanded, setCastExpanded] = useState(false);
  const [crewExpanded, setCrewExpanded] = useState(false);
  const [now] = useState(() => Date.now());

  const handleSeasonClick = useCallback((seasonId: number) => {
    setSelectedSeasonId((prev) => {
      const next = prev === seasonId ? null : seasonId;
      if (next) {
        setTimeout(() => {
          episodesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
      return next;
    });
  }, []);

  const mediaId = media?.media_id ?? media?.id ?? 0;
  const title = media?.display_title ?? media?.title ?? media?.name ?? "";
  const isSeries = isSeriesType(media?.type ?? "");

  const seasons = useMemo(() => {
    if (!media || !isSeries) return [];
    const children = (media as { children?: MediaItem[] }).children;
    return children?.filter((c) => c.type === "season") ?? [];
  }, [media, isSeries]);

  if (isLoading) {
    return (
      // <div className="space-y-6 py-8">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="bg-muted h-112.5 w-75 animate-pulse rounded-2xl" />
          <div className="flex-1 space-y-4">
            <div className="bg-muted h-8 w-64 animate-pulse rounded" />
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="bg-muted h-20 w-full animate-pulse rounded" />
          </div>
        </div>
      </div>
      //  </div>
    );
  }

  if (error || !media) {
    return (
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="text-destructive h-12 w-12" />
          <p className="text-destructive">{error?.message ?? "غير موجود"}</p>
          <Button variant="default" onClick={() => router.refresh()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const year = media.year ?? "";
  const rating = Number(media.rating ?? media.imdb_rating ?? 0) || 0;
  const overview = media.overview ?? "";
  const posterUrl = getPosterUrl(mediaId);
  const backdropUrl = getBackdropUrl(mediaId);
  const seasonsCount = media.seasons_count ?? media.seasonsCount ?? 0;
  const episodesCount = media.episodes_count ?? media.episodesCount ?? 0;
  const isCollection = isSeries || media.type === "season";
  const genres: string[] = extractGenres(media);
  const libraryName = media.library_name;
  const libraryId = media.library_id ?? media.libraryId ?? media.parent_id;

  return (
    <div className="relative w-full">
      {/* منطقة البطل: الخلفية + الملصق + العنوان + الأزرار */}
      <div className="relative">
        {backdropUrl && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <img src={backdropUrl} alt="" className="h-full w-full object-cover opacity-40" />
            <div className="from-background/40 via-background/70 to-background absolute inset-0 bg-linear-to-b" />
          </div>
        )}

        <div className="relative z-10 container mx-auto px-3 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pt-8 lg:px-8">
          <Breadcrumbs
            items={[
              ...(libraryName && libraryId
                ? [{ label: libraryName, href: `/items/${libraryId}` }]
                : [{ label: "الرئيسية", href: ROUTES.HOME }]),
              { label: title },
            ]}
          />

          <div className="mt-6 grid grid-cols-1 gap-6 pb-6 md:grid-cols-[auto_1fr] md:gap-8 lg:gap-12">
            <div className="mx-auto w-50 shrink-0 md:mx-0 md:w-65 lg:w-75">
              <div className="relative aspect-2/3 overflow-hidden rounded-2xl">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={title}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-4xl font-bold">
                    {title[0]}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 text-center md:text-start">
              <div className="flex flex-col gap-3">
                <h1
                  title={title}
                  className="text-foreground line-clamp-1 w-full cursor-pointer text-xl font-bold tracking-tight transition-all duration-300 hover:line-clamp-none sm:text-2xl"
                >
                  {title}
                </h1>

                <div className="flex flex-wrap justify-center gap-1.5 md:justify-start">
                  <Badge variant="secondary">{translateMediaType(media.type)}</Badge>
                  {year && (
                    <Link href={ROUTES.YEAR_ITEMS(String(year)) as import("next").Route}>
                      <Badge variant="secondary">
                        {year}
                      </Badge>
                    </Link>
                  )}
                  {(() => {
                    const ca = media.created_at ?? media.createdAt;
                    if (ca) {
                      const daysDiff = (now - new Date(ca).getTime()) / (1000 * 3600 * 24);
                      if (daysDiff <= 7)
                        return (
                          <Link href="/new">
                            <Badge variant="new">
                              جديد
                            </Badge>
                          </Link>
                        );
                    }
                    return null;
                  })()}
                  {media.certification && (
                    <Badge
                      variant="destructive"
                      onClick={() =>
                        router.push(
                          `/certification/${encodeURIComponent(String(media.certification))}` as import("next").Route,
                        )
                      }
                    >
                      {media.certification}
                    </Badge>
                  )}
                  {rating > 0 && (
                    <Badge variant="rating">
                      ★ {Number(rating).toFixed(1)}
                      {Number(media.imdb_votes) > 0 && (
                        <span className="ms-1 text-xs opacity-70">
                          ({Number(media.imdb_votes).toLocaleString()})
                        </span>
                      )}
                    </Badge>
                  )}
                  {(media.duration ?? media.runtime) && (
                    <Badge variant="secondary">{media.duration ?? media.runtime} دقيقة</Badge>
                  )}
                  {isCollection && seasonsCount > 0 && (
                    <Badge variant="secondary">
                      {seasonsCount === 1 ? `${seasonsCount} موسم` : `${seasonsCount} مواسم`}
                    </Badge>
                  )}
                  {isCollection && episodesCount > 0 && (
                    <Badge variant="secondary">
                      {episodesCount === 1 ? `${episodesCount} حلقة` : `${episodesCount} حلقات`}
                    </Badge>
                  )}
                </div>

                {genres.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 md:justify-start">
                    {genres.map((g) => (
                      <Link
                        key={g}
                        href={ROUTES.GENRE_ITEMS(g.replace(/\s+/g, "_")) as import("next").Route}
                      >
                        <Badge variant="genre">
                          {g}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {overview && (
                <div className="max-w-2xl">
                  <p
                    className={`text-muted-foreground text-sm leading-relaxed ${!isOverviewExpanded ? "line-clamp-3" : ""}`}
                  >
                    {overview}
                  </p>
                  {overview.length > 200 && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                      className="mt-1 gap-1 p-0 text-xs"
                    >
                      {isOverviewExpanded ? (
                        <>
                          عرض أقل <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          المزيد... <ChevronDown size={12} />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-2 flex justify-center md:justify-start">
                <MediaActions
                  mediaId={mediaId}
                  title={title}
                  type={media.type}
                  folderPath={media.folder_path}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* منطقة المحتوى: طاقم التمثيل + العمل + المواسم + الحلقات + التوصيات */}
      <div className="bg-background relative z-10">
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8 md:px-6 md:py-10 lg:px-8">
          {media.cast && media.cast.length > 0 && (
            <div className="border-border/50 border-t pt-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-normal">
                  طاقم التمثيل
                  <span className="text-muted-foreground ms-2 text-sm font-medium">
                    ({media.cast.length})
                  </span>
                </h2>
                {media.cast.length > CAST_DEFAULT_COUNT && (
                  <ExpandToggle
                    expanded={castExpanded}
                    onClick={() => setCastExpanded((v) => !v)}
                  />
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-5 md:justify-start">
                {(castExpanded ? media.cast : media.cast.slice(0, CAST_DEFAULT_COUNT)).map(
                  (member, idx) => (
                    <CastMemberCard key={`${String(member.person_id)}-${idx}`} member={member} />
                  ),
                )}
              </div>
            </div>
          )}

          {media.crew && media.crew.length > 0 && (
            <div className="border-border/50 mt-6 border-t pt-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-normal">
                  طاقم العمل
                  <span className="text-muted-foreground ms-2 text-sm font-medium">
                    ({media.crew.length})
                  </span>
                </h2>
                {media.crew.length > CREW_DEFAULT_COUNT && (
                  <ExpandToggle
                    expanded={crewExpanded}
                    onClick={() => setCrewExpanded((v) => !v)}
                  />
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-5 md:justify-start">
                {(crewExpanded
                  ? media.crew
                  : getUniqueCrewByRole(media.crew ?? []).slice(0, CREW_DEFAULT_COUNT)
                ).map((member, idx) => (
                  <CrewMemberCard key={`${String(member.person_id)}-${idx}`} member={member} />
                ))}
              </div>
            </div>
          )}

          {isSeries && seasons.length > 0 && (
            <section className="mt-8">
              <SectionHeader
                title={`المواسم (${seasonsCount || seasons.length})`}
                count={seasonsCount || seasons.length}
                variant="lined"
                className="mb-4"
              />
              <div className="-mx-3 flex gap-3 px-3 pb-2 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
                {seasons.map((season) => {
                  const seasonId = season.media_id ?? season.id ?? 0;
                  return (
                    <div key={String(seasonId)} className="w-36 shrink-0 sm:w-40">
                      <UnifiedCard
                        id={String(seasonId)}
                        title={season.title ?? "الموسم"}
                        imageUrl={
                          Number(seasonId)
                            ? `/api/images/${seasonId}?type=poster&w=300&h=450`
                            : undefined
                        }
                        year={season.year ?? ""}
                        isNew={isItemNew(season.created_at ?? season.createdAt)}
                        isSelected={selectedSeasonId === seasonId}
                        iconVariant="link"
                        onClick={() => handleSeasonClick(seasonId)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="mt-8">
            <SeasonEpisodesSection
              selectedSeasonId={selectedSeasonId}
              episodesSectionRef={episodesSectionRef}
            />
          </div>

          {(recsLoading || recommendations.length > 0) && (
            <section className="mt-8 space-y-4">
              <SectionHeader
                variant="default"
                title={isSeries ? "مسلسلات قد تعجبك" : "أفلام قد تعجبك"}
                count={recommendations.length}
                className="mb-4"
              />
              <UnifiedMedia
                mode="slider"
                isLoading={recsLoading}
                skeletonCount={10}
                items={recommendations.slice(0, 20)}
                mapItemToProps={mapMediaToCard}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

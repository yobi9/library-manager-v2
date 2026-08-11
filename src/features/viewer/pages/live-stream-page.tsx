"use client";

import { useState } from "react";
import { Radio, RefreshCw, TriangleAlert, MonitorPlay } from "lucide-react";
import { Breadcrumbs } from "@/shared/components/ui/breadcrumbs";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ROUTES } from "@/shared/constants";
import { useLiveChannels, type LiveChannel } from "@/features/viewer/hooks/use-live-channels";

/**
 * Single channel card: poster with a live badge, channel name and an action
 * that opens the external player in a new tab. Falls back to a radio icon when
 * the upstream image fails to load.
 */
function ChannelCard({ channel }: { channel: LiveChannel }) {
  const [imageError, setImageError] = useState(false);
  const showImage = channel.image !== null && !imageError;

  return (
    <Card className="group border-border/50 bg-card/50 hover:border-primary/30 flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="bg-muted relative aspect-video overflow-hidden">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- upstream images are remote and unknown at build time
          <img
            src={channel.image as string}
            alt={channel.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <Radio className="text-muted-foreground/30 h-12 w-12" />
          </div>
        )}

        <span className="absolute top-2 right-2">
          <Badge className="gap-1 bg-red-500 px-2 py-0.5 text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            مباشر
          </Badge>
        </span>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-3">
        <h3 className="truncate text-sm font-bold" title={channel.name}>
          {channel.name}
        </h3>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={channel.url} target="_blank" rel="noopener noreferrer">
            <MonitorPlay className="h-4 w-4" />
            فتح البث
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Loading placeholder grid shown while the channel list is being fetched.
 */
function ChannelGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="aspect-video rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Viewer live-stream page: lists channels from the external live-stream
 * system (fetched via the server-side proxy) and refreshes every 30 seconds
 * so newly added channels appear automatically.
 */
export function LiveStreamPage() {
  const { data: channels, isLoading, error, isFetching, refetch } = useLiveChannels();

  return (
    <div className="space-y-6">
      <div className="from-primary/5 via-background to-background relative overflow-hidden bg-linear-to-b">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center md:py-12">
          <div className="bg-primary/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
            <Radio className="text-primary h-8 w-8" />
          </div>
          <h1 className="mb-2 text-xl font-bold sm:text-2xl">البث المباشر</h1>
          <p className="text-muted-foreground text-sm">شاهد القنوات المباشرة عبر نظام البث الحي</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-6">
        <div className="flex items-center justify-between gap-3">
          <Breadcrumbs
            items={[{ label: "الرئيسية", href: ROUTES.HOME }, { label: "البث المباشر" }]}
          />
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : ""} />
            تحديث
          </Button>
        </div>

        {isLoading ? (
          <ChannelGridSkeleton />
        ) : error ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="فشل تحميل القنوات"
            description="تعذر الاتصال بنظام البث المباشر، حاول مرة أخرى."
            action={{ label: "إعادة المحاولة", onClick: () => void refetch() }}
          />
        ) : (channels ?? []).length === 0 ? (
          <EmptyState
            icon={<Radio />}
            title="لا توجد قنوات متاحة حالياً"
            description="أضف قنوات في نظام البث المباشر وستظهر هنا تلقائياً."
            action={{ label: "تحديث", onClick: () => void refetch() }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {(channels ?? []).map((channel) => (
              <ChannelCard key={String(channel.id)} channel={channel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

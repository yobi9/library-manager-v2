"use client";

import React, { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { ScanProgress as ScanProgressData } from "@/features/admin/hooks/use-admin-libraries";
import { HardDrive, Pause, Play, Square, AlertCircle } from "lucide-react";

interface ScanProgressCardProps {
  progress: ScanProgressData | undefined;
  isLoading: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  isPausing?: boolean;
  isResuming?: boolean;
  isStopping?: boolean;
}

export function ScanProgressCard({
  progress,
  isLoading,
  onPause,
  onResume,
  onStop,
  isPausing,
  isResuming,
  isStopping,
}: ScanProgressCardProps) {
  const [confirmStop, setConfirmStop] = useState(false);

  const isScanning = progress?.status === "scanning";
  const isPaused = progress?.status === "paused";
  const isStopped =
    progress?.status === "stopped" ||
    progress?.status === "completed" ||
    progress?.status === "failed";
  const isActive = isScanning || isPaused;
  const hasError = progress?.status === "failed";

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  if (!progress || (!isActive && !isStopped)) {
    return (
      <EmptyState title="لا توجد عمليات فحص" description="لم يتم العثور على أي عملية فحص جارية" />
    );
  }

  if (isStopped) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="bg-success/10 text-success flex h-12 w-12 items-center justify-center rounded-full">
          <HardDrive size={24} />
        </div>
        <p className="text-foreground text-sm font-bold">{progress.libraryName}</p>
        <p className="text-muted-foreground text-xs">
          تم {progress.status === "completed" ? "اكتمال" : "إيقاف"} الفحص
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${
            isPaused ? "border-warning border-t-transparent" : "border-primary border-t-transparent"
          } ${isScanning ? "animate-spin" : ""}`}
        >
          <HardDrive size={22} className={isPaused ? "text-warning" : "text-primary"} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-foreground text-sm font-bold">
          اضافة : {progress.currentRootFolder || "..."}
          {isPaused && <span className="text-warning me-1 text-xs"> (متوقف مؤقتاً)</span>}
        </p>
        <p className="text-muted-foreground text-xs">
          القسم : {progress.libraryName || "جاري معالجة البيانات"}
        </p>
        <p className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isPaused ? "bg-warning" : "bg-success"
            } animate-pulse`}
          />
          {isPaused ? "متوقف مؤقتاً..." : progress.currentActivity || "يتم الآن التحديث..."}
        </p>
      </div>

      <div
        className="bg-primary/10 h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-busy={isScanning}
      >
        <div
          className={`h-full rounded-full ${isPaused ? "bg-warning" : "bg-primary"} animate-pulse`}
          style={{ width: "100%" }}
        />
      </div>

      {hasError && (
        <div className="text-destructive flex items-center gap-2 text-sm">
          <AlertCircle size={16} />
          <span>فشل الفحص</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onPause} disabled={isPaused || isPausing}>
          <Pause size={14} /> إيقاف مؤقت
        </Button>
        <Button variant="secondary" size="sm" onClick={onResume} disabled={!isPaused || isResuming}>
          <Play size={14} /> استئناف
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (!confirmStop) {
              setConfirmStop(true);
              return;
            }
            onStop();
            setConfirmStop(false);
          }}
          disabled={isStopping}
          className={confirmStop ? "animate-pulse" : ""}
        >
          <Square size={14} /> {confirmStop ? "تأكيد الإنهاء؟" : "إنهاء"}
        </Button>
      </div>
    </div>
  );
}

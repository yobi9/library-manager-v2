"use client";

import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { Play, Square, RefreshCw } from "lucide-react";
import {
  useAdminProcesses,
  useStartScan,
  useStopScan,
  useResumeScan,
  type ScanProcess,
} from "@/features/admin/hooks/use-admin-processes";

const statusLabels: Record<string, string> = {
  idle: "خامل",
  scanning: "جارٍ المسح",
  paused: "متوقف مؤقتاً",
  completed: "مكتمل",
  failed: "فشل",
  stopped: "متوقف",
  error: "خطأ",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  idle: "secondary",
  scanning: "default",
  paused: "outline",
  completed: "secondary",
  failed: "destructive",
  stopped: "secondary",
  error: "destructive",
};

export function ProcessesPage() {
  const { data, isLoading } = useAdminProcesses();
  const startMutation = useStartScan();
  const stopMutation = useStopScan();
  const resumeMutation = useResumeScan();

  const processes: ScanProcess[] = data?.rows ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">العمليات الخلفية</h1>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">العمليات الخلفية</h1>

      {processes.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-muted-foreground">لا توجد عمليات مسح</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {processes.map((process) => (
          <Card key={process.library_id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{process.library_name}</CardTitle>
                <Badge variant={statusVariants[process.status] ?? "secondary"}>
                  {statusLabels[process.status] ?? process.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={process.progress ?? 0}
                variant={process.status === "error" ? "warning" : "default"}
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {process.status === "scanning" || process.status === "paused"
                    ? "جاري المسح…"
                    : `${process.progress ?? 0}%`}
                </span>
                <span>
                  {process.scanned_items ?? 0}
                  {process.total_items ? ` / ${process.total_items}` : ""} عنصر
                </span>
              </div>
              <div className="flex gap-2">
                {(process.status === "idle" || process.status === "completed" || process.status === "error") && (
                  <Button
                    size="sm"
                    onClick={() => startMutation.mutate(process.library_id)}
                    disabled={startMutation.isPending}
                  >
                    <Play className="h-4 w-4" />
                    بدء المسح
                  </Button>
                )}
                {process.status === "scanning" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => stopMutation.mutate(process.library_id)}
                    disabled={stopMutation.isPending}
                  >
                    <Square className="h-4 w-4" />
                    إيقاف
                  </Button>
                )}
                {process.status === "paused" && (
                  <Button
                    size="sm"
                    onClick={() => resumeMutation.mutate(process.library_id)}
                    disabled={resumeMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4" />
                    استئناف
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

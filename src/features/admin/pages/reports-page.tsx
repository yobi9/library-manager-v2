"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { AdminTable } from "@/features/admin/components/admin-table";
import { CheckCircle, XCircle } from "lucide-react";
import {
  useAdminReports,
  useUpdateReportStatus,
  type ReportItem,
} from "@/features/admin/hooks/use-admin-reports";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  resolved: "تم الحل",
  dismissed: "مرفوض",
};

const typeLabels: Record<string, string> = {
  broken: "رابط مكسور",
  abuse: "محتوى مسيء",
};

export function ReportsPage() {
  const { data, isLoading } = useAdminReports();
  const updateStatusMutation = useUpdateReportStatus();

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved" | "dismissed">(
    "all",
  );

  const reports = data?.rows ?? [];
  const filtered =
    statusFilter === "all" ? reports : reports.filter((r) => r.status === statusFilter);

  const handleUpdateStatus = (report: ReportItem, status: "resolved" | "dismissed") => {
    updateStatusMutation.mutate({ id: report.id, status });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">التبليغات</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">التبليغات</h1>

      <AdminTable
        columns={[
          {
            key: "type",
            header: "النوع",
            primary: true,
            render: (r: ReportItem) => typeLabels[r.report_type] ?? r.report_type,
          },
          { key: "reason", header: "السبب" },
          {
            key: "status",
            header: "الحالة",
            render: (r: ReportItem) => (
              <Badge
                variant={
                  r.status === "pending"
                    ? "default"
                    : r.status === "resolved"
                      ? "secondary"
                      : "outline"
                }
              >
                {statusLabels[r.status] ?? r.status}
              </Badge>
            ),
          },
          {
            key: "created_at",
            header: "التاريخ",
            render: (r: ReportItem) => new Date(r.created_at).toLocaleDateString("ar-SA"),
          },
        ]}
        data={filtered}
        keyExtractor={(r) => String(r.id)}
        filters={
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "الكل" },
              { value: "pending", label: "قيد الانتظار" },
              { value: "resolved", label: "تم الحل" },
              { value: "dismissed", label: "مرفوض" },
            ].map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(opt.value as typeof statusFilter)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        }
        actions={(r) => (
          <>
            {r.status === "pending" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUpdateStatus(r, "resolved")}
                  title="قبول"
                >
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUpdateStatus(r, "dismissed")}
                  title="رفض"
                >
                  <XCircle className="text-destructive h-4 w-4" />
                </Button>
              </>
            )}
          </>
        )}
      />
    </div>
  );
}

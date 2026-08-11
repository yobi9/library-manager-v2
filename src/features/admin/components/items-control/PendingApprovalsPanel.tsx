"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, CheckCheck, Inbox } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { Spinner } from "@/shared/components/ui/spinner";
import {
  usePendingApprovals,
  useApproveEnrichment,
  useRejectEnrichment,
  useApproveAllPending,
  type AdminApproval,
} from "@/features/admin/hooks/use-admin-enrichment";
import { adminMediaKeys } from "@/features/admin/hooks/use-admin-media";

/**
 * لوحة "الموافقات المعلقة" لإثراء TMDB في صفحة التحكم بالعناصر.
 *
 * تعرض الاقتراحات التي تنتظر موافقة المشرف (عند تشابه غير حاسم مع TMDB)
 * مع أزرار الموافقة/الرفض لكل عنصر، وزر "الموافقة على الكل" مع تأكيد.
 * عند أي موافقة يتم إبطال قائمة الوسائط لتحديث البيانات فوراً.
 */
export function PendingApprovalsPanel() {
  const queryClient = useQueryClient();
  const { data: pending, isLoading } = usePendingApprovals();
  const approveMutation = useApproveEnrichment();
  const rejectMutation = useRejectEnrichment();
  const approveAllMutation = useApproveAllPending();

  const [target, setTarget] = useState<{
    kind: "approve" | "reject";
    approval: AdminApproval;
  } | null>(null);
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);

  const refreshMedia = () => {
    queryClient.invalidateQueries({ queryKey: adminMediaKeys.all });
  };

  const handleApprove = (approval: AdminApproval) => {
    approveMutation.mutate(
      { id: approval.id },
      {
        onSuccess: () => {
          toast.success(`تم تطبيق الإثراء على "${approval.media_title}"`);
          refreshMedia();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "فشل الموافقة على الإثراء"),
      },
    );
  };

  const handleReject = (approval: AdminApproval) => {
    rejectMutation.mutate(approval.id, {
      onSuccess: () => toast.success("تم رفض الاقتراح"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل رفض الاقتراح"),
    });
  };

  const handleApproveAll = () => {
    approveAllMutation.mutate(
      {},
      {
        onSuccess: () => {
          toast.success("تمت الموافقة على جميع الاقتراحات");
          refreshMedia();
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "فشل الموافقة على الكل"),
      },
    );
  };

  const confirmTarget = () => {
    if (!target) return;
    if (target.kind === "approve") {
      handleApprove(target.approval);
    } else {
      handleReject(target.approval);
    }
    setTarget(null);
  };

  if (isLoading) {
    return (
      <Card className="border-border/10">
        <CardContent className="flex items-center justify-center gap-2 p-4">
          <Spinner className="h-4 w-4" />
          <p className="text-muted-foreground text-sm">جاري تحميل الموافقات المعلقة...</p>
        </CardContent>
      </Card>
    );
  }

  if (!pending || pending.length === 0) return null;

  return (
    <Card className="border-border/10">
      <CardContent className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Inbox className="text-muted-foreground h-4 w-4" />
            عناصر تنتظر موافقتك على الإثراء ({pending.length})
          </p>
          <Button
            size="sm"
            onClick={() => setConfirmApproveAll(true)}
            disabled={approveAllMutation.isPending}
            aria-busy={approveAllMutation.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            الموافقة على الكل
          </Button>
        </div>

        <ul className="divide-border/10 divide-y">
          {pending.map((approval) => (
            <li key={approval.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{approval.media_title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  التشابه: {(approval.similarity_score * 100).toFixed(1)}% • TMDB:{" "}
                  {approval.tmdb_title}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTarget({ kind: "approve", approval })}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="text-success hover:text-success"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTarget({ kind: "reject", approval })}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={target?.kind === "approve" ? "تأكيد الموافقة على الإثراء" : "تأكيد رفض الإثراء"}
        description={
          target?.kind === "approve"
            ? `هل أنت متأكد من تطبيق بيانات الإثراء للعنصر "${target?.approval.media_title}"؟`
            : `سيتم تجاهل هذا الاقتراح ولن يتم إثراء العنصر "${target?.approval.media_title}" تلقائياً.`
        }
        confirmLabel={target?.kind === "approve" ? "موافقة وتطبيق" : "رفض"}
        variant={target?.kind === "approve" ? "default" : "destructive"}
        loading={approveMutation.isPending || rejectMutation.isPending}
        onConfirm={confirmTarget}
      />

      <ConfirmDialog
        open={confirmApproveAll}
        onOpenChange={setConfirmApproveAll}
        title="تأكيد الموافقة على الكل"
        description={`سيتم تطبيق بيانات الإثراء على جميع الاقتراحات المعلقة (${pending.length}). هل أنت متأكد؟`}
        confirmLabel="موافقة على الكل"
        loading={approveAllMutation.isPending}
        onConfirm={() => {
          setConfirmApproveAll(false);
          handleApproveAll();
        }}
      />
    </Card>
  );
}

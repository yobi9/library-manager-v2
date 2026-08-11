"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalDescription,
} from "@/shared/components/ui/modal";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { AdminTable } from "@/features/admin/components/admin-table";
import { Send, Trash2 } from "lucide-react";
import {
  useVisitorRequests,
  useReplyToRequest,
  useDeleteVisitorRequest,
  useDeleteAllVisitorRequests,
  type VisitorRequest,
} from "@/features/admin/hooks/use-admin-visitor-requests";
import { toast } from "sonner";

/**
 * صفحة «طلبات الزوار» — تعرض الطلبات في جدول مع إمكانية الرد عليها
 * وحذف طلب واحد أو مسح الكل.
 */
export function RequestsPage() {
  const { data, isLoading } = useVisitorRequests();
  const replyMutation = useReplyToRequest();
  const deleteMutation = useDeleteVisitorRequest();
  const deleteAllMutation = useDeleteAllVisitorRequests();

  const [search, setSearch] = useState("");
  const [viewTarget, setViewTarget] = useState<VisitorRequest | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<VisitorRequest | null>(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  const requests = data ?? [];
  const filtered = requests.filter((req) => {
    const q = search.toLowerCase();
    return (
      req.userId?.toLowerCase().includes(q) ||
      req.device_id?.toLowerCase().includes(q) ||
      req.message?.toLowerCase().includes(q)
    );
  });

  const handleReply = async () => {
    if (!replyText.trim() || !viewTarget) return;
    try {
      await replyMutation.mutateAsync({
        id: viewTarget.id,
        reply: replyText.trim(),
      });
      toast.success("تم إرسال الرد");
      setReplyText("");
      setReplyOpen(false);
      setViewTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل إرسال الرد";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("تم حذف الطلب");
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل حذف الطلب";
      toast.error(message);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllMutation.mutateAsync();
      toast.success("تم حذف جميع الطلبات");
      setDeleteAllOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل حذف جميع الطلبات";
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">طلبات الزبائن</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">طلبات الزبائن</h1>
        {requests.length > 0 && (
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setDeleteAllOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            حذف الكل
          </Button>
        )}
      </div>

      <AdminTable
        columns={[
          {
            key: "userId",
            header: "المعرّف",
            primary: true,
            render: (req: VisitorRequest) => (
              <span className="font-medium">{req.userId || req.device_id || "—"}</span>
            ),
          },
          {
            key: "message",
            header: "الطلب",
            render: (req: VisitorRequest) => (
              <span className="block max-w-xs truncate">{req.message || "—"}</span>
            ),
          },
          {
            key: "status",
            header: "الحالة",
            render: (req: VisitorRequest) => (
              <Badge variant={req.status === "resolved" ? "secondary" : "default"}>
                {req.status === "resolved" ? "تم الرد" : "جديد"}
              </Badge>
            ),
          },
          {
            key: "createdAt",
            header: "التاريخ",
            render: (req: VisitorRequest) =>
              req.createdAt ? new Date(req.createdAt).toLocaleDateString("ar-SA") : "—",
          },
        ]}
        data={filtered}
        keyExtractor={(req) => String(req.id)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالمعرّف أو النص..."
        emptyMessage="لا توجد طلبات"
        actions={(req) => (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setViewTarget(req);
                setReplyOpen(true);
              }}
              title="عرض والرد"
            >
              <Send className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setDeleteTarget(req)}
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <Modal
        open={replyOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReplyOpen(false);
            setViewTarget(null);
          }
        }}
      >
        <ModalContent>
          <ModalHeader>
            <ModalTitle>عرض الطلب والرد</ModalTitle>
            <ModalDescription>
              {viewTarget
                ? `المعرّف: ${viewTarget.userId || viewTarget.device_id || "غير معروف"}`
                : ""}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <div className="border-border rounded-lg border p-4">
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {viewTarget?.message}
              </p>
            </div>
            {viewTarget?.reply && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="mb-1 text-sm font-medium text-green-700">الرد السابق</p>
                <p className="text-sm whitespace-pre-wrap text-green-800">{viewTarget.reply}</p>
              </div>
            )}
            <Textarea
              label="الرد"
              placeholder="اكتب ردك هنا..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
            />
          </div>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReplyOpen(false);
                setViewTarget(null);
              }}
            >
              إلغاء
            </Button>
            <Button onClick={handleReply} disabled={!replyText.trim() || replyMutation.isPending}>
              {replyMutation.isPending ? "جاري الإرسال..." : "إرسال الرد"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="حذف الطلب"
        description={`هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title="حذف جميع الطلبات"
        description={`سيتم حذف جميع طلبات الزبائن (${requests.length} طلب). لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف الكل"
        variant="destructive"
        onConfirm={handleDeleteAll}
        loading={deleteAllMutation.isPending}
      />
    </div>
  );
}

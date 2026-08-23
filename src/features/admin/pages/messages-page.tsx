"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Pagination } from "@/shared/components/ui/pagination";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/shared/components/ui/modal";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Eye, CheckCircle, Trash2, Mail, Send, XCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAdminMessages,
  useUpdateMessage,
  useDeleteMessage,
  useCreateMessage,
  type MessageItem,
} from "@/features/admin/hooks/use-admin-messages";

const PAGE_SIZE = 10;

export function MessagesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const offset = (page - 1) * PAGE_SIZE;
  const { data, isLoading } = useAdminMessages(PAGE_SIZE, offset);
  const updateStatusMutation = useUpdateMessage();
  const deleteMutation = useDeleteMessage();
  const createMutation = useCreateMessage();

  const [viewTarget, setViewTarget] = useState<MessageItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageItem | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({ subject: "", body: "" });

  const messages = data?.rows ?? [];
  const total = data?.total ?? 0;

  const filtered = messages.filter((msg) => {
    const q = search.toLowerCase();
    return (
      msg.name?.toLowerCase().includes(q) ||
      msg.email?.toLowerCase().includes(q) ||
      msg.subject?.toLowerCase().includes(q)
    );
  });

  const totalPages = search ? Math.ceil(filtered.length / PAGE_SIZE) : Math.ceil(total / PAGE_SIZE);
  const displayItems = search ? filtered : messages;

  const handleToggleStatus = async (msg: MessageItem) => {
    const newStatus = msg.status === "read" ? "unread" : "read";
    await updateStatusMutation.mutateAsync({ id: msg.id, status: newStatus });
    toast.success(`تم تغيير الحالة إلى ${newStatus === "read" ? "مقروء" : "غير مقروء"}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    toast.success("تم حذف الرسالة بنجاح");
    setDeleteTarget(null);
  };

  const handleSendMessage = async () => {
    if (!newMessage.subject.trim() || !newMessage.body.trim()) {
      toast.error("يرجى إدخال الموضوع ونص الرسالة");
      return;
    }
    try {
      await createMutation.mutateAsync({
        title: newMessage.subject,
        body: newMessage.body,
      });
      toast.success("تم إرسال الرسالة بنجاح");
      setSendModalOpen(false);
      setNewMessage({ subject: "", body: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل إرسال الرسالة");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="bg-secondary/50 h-10 w-48 animate-pulse rounded" />
          <div className="bg-secondary/50 h-10 w-32 animate-pulse rounded" />
        </div>
        <div className="bg-secondary/50 h-10 w-full animate-pulse rounded" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-secondary/50 h-16 w-full animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── العنوان والوصف مع زر الإرسال ───────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-xl font-bold sm:text-2xl md:text-3xl">الرسائل</h1>
            <Badge variant="secondary" className="bg-bg-hover text-muted-foreground border-border">
              {total}
            </Badge>
          </div>
          <p className="text-muted-foreground max-w-xl text-sm">
            يمكنك إرسال رسالة إلى جميع عملائك في الاستراحة على التطبيق والمتصفح.
          </p>
        </div>
        <Button onClick={() => setSendModalOpen(true)} className="shrink-0 gap-2">
          <Mail className="h-4 w-4" />
          إرسال رسالة للعملاء
        </Button>
      </div>

      {/* ─── شريط البحث والتصفية ────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64 md:w-72">
          <Search className="text-muted-foreground absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="بحث في الرسائل..."
            className="border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:ring-accent w-full rounded-md border py-1.5 pr-8 pl-8 text-xs transition-colors focus:ring-1 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="text-muted-foreground/50 hover:text-foreground absolute top-1/2 left-2 -translate-y-1/2 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            عرض {displayItems.length} من {search ? filtered.length : total} رسالة
          </span>
        </div>
      </div>

      {/* ─── Card View (الموبايل: < lg) ─────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {displayItems.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-lg border p-8 text-center">
            لا توجد رسائل تطابق معايير البحث
          </div>
        ) : (
          displayItems.map((msg) => (
            <div key={msg.id} className="border-border bg-card space-y-3 rounded-lg border p-4">
              {/* المعلومات الأساسية */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground truncate text-sm font-medium">
                  {msg.name || "—"}
                </span>
                <Badge
                  variant={msg.status === "read" ? "default" : "secondary"}
                  className={cn(
                    "shrink-0 px-2 py-0.5 text-[10px]",
                    msg.status === "read"
                      ? "border-success-border bg-success-bg text-success-text"
                      : "border-warning-border bg-warning-bg text-warning-text",
                  )}
                >
                  {msg.status === "read" ? "مقروء" : "غير مقروء"}
                </Badge>
              </div>

              {/* التفاصيل */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">البريد</span>
                  <span className="text-secondary-foreground truncate text-xs">
                    {msg.email || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">الموضوع</span>
                  <span className="text-secondary-foreground max-w-50 truncate text-xs">
                    {msg.subject || "بدون موضوع"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">التاريخ</span>
                  <span className="text-secondary-foreground text-xs">
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleDateString("ar-SA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </span>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div className="border-border/50 flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewTarget(msg)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleToggleStatus(msg)}
                  disabled={updateStatusMutation.isPending}
                >
                  {msg.status === "read" ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                  onClick={() => setDeleteTarget(msg)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Table View (الديسكتوب: lg+) ────────────────────────── */}
      <div className="border-border bg-card hidden overflow-hidden rounded-xl border shadow-sm lg:block">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr className="border-border border-b hover:bg-transparent">
              <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-medium">
                المرسل
              </th>
              <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-medium">
                البريد الإلكتروني
              </th>
              <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-medium">
                الموضوع
              </th>
              <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-medium">
                الحالة
              </th>
              <th className="text-muted-foreground px-4 py-2.5 text-right text-xs font-medium">
                التاريخ
              </th>
              <th className="text-muted-foreground px-4 py-2.5 text-center text-xs font-medium">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground py-12 text-center text-sm">
                  لا توجد رسائل تطابق معايير البحث
                </td>
              </tr>
            ) : (
              displayItems.map((msg) => (
                <tr
                  key={msg.id}
                  className="border-border/50 hover:bg-bg-hover/50 border-b transition-colors"
                >
                  <td className="text-foreground px-4 py-2.5 text-sm font-medium">
                    {msg.name || "—"}
                  </td>
                  <td className="text-secondary-foreground px-4 py-2.5 text-sm">
                    {msg.email || "—"}
                  </td>
                  <td className="text-foreground max-w-xs truncate px-4 py-2.5 text-sm">
                    {msg.subject || "بدون موضوع"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={msg.status === "read" ? "default" : "secondary"}
                      className={cn(
                        "px-2 py-0.5 text-[10px]",
                        msg.status === "read"
                          ? "border-success-border bg-success-bg text-success-text"
                          : "border-warning-border bg-warning-bg text-warning-text",
                      )}
                    >
                      {msg.status === "read" ? "مقروء" : "غير مقروء"}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5 text-xs">
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleDateString("ar-SA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground hover:bg-bg-hover h-7 w-7"
                        onClick={() => setViewTarget(msg)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground hover:bg-bg-hover h-7 w-7"
                        onClick={() => handleToggleStatus(msg)}
                        disabled={updateStatusMutation.isPending}
                      >
                        {msg.status === "read" ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                        onClick={() => setDeleteTarget(msg)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* الترقيم */}
        {totalPages > 1 && (
          <div className="border-border border-t px-4 py-2.5">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(newPage) => {
                setPage(newPage);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="justify-end"
            />
          </div>
        )}
      </div>

      {/* ─── مودال عرض التفاصيل ────────────────────────────────── */}
      <Modal open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <ModalContent className="bg-card border-border border">
          <ModalHeader>
            <ModalTitle className="text-foreground">
              {viewTarget?.subject || "بدون موضوع"}
            </ModalTitle>
            <ModalDescription className="text-muted-foreground">
              من: {viewTarget?.name || "غير معروف"} ({viewTarget?.email || "بريد غير متوفر"})
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <div className="border-border/50 bg-secondary/30 rounded-lg border p-4">
              <p className="text-secondary-foreground text-sm whitespace-pre-wrap">
                {viewTarget?.message || "لا يوجد محتوى"}
              </p>
            </div>
            <p className="text-muted-foreground text-xs">
              {viewTarget?.created_at
                ? new Date(viewTarget.created_at).toLocaleString("ar-SA")
                : ""}
            </p>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>
              إغلاق
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ─── مودال إرسال رسالة ──────────────────────────────────── */}
      <Modal open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <ModalContent className="bg-card border-border border">
          <ModalHeader>
            <ModalTitle className="text-foreground flex items-center gap-2">
              <Mail className="text-accent h-5 w-5" />
              إرسال رسالة للعملاء
            </ModalTitle>
            <ModalDescription className="text-muted-foreground">
              سيتم إرسال الرسالة إلى جميع عملائك في التطبيق والمتصفح.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <Input
              label="الموضوع"
              value={newMessage.subject}
              onChange={(e) => setNewMessage((prev) => ({ ...prev, subject: e.target.value }))}
              placeholder="عنوان الرسالة"
              className="bg-secondary/50 border-border text-foreground"
            />
            <Textarea
              label="نص الرسالة"
              value={newMessage.body}
              onChange={(e) => setNewMessage((prev) => ({ ...prev, body: e.target.value }))}
              placeholder="اكتب رسالتك هنا..."
              rows={5}
              className="bg-secondary/50 border-border text-foreground"
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={createMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {createMutation.isPending ? "جاري الإرسال..." : "إرسال"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ─── تأكيد الحذف ────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="حذف الرسالة"
        description={`هل أنت متأكد من حذف رسالة "${deleteTarget?.subject}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

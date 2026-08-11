"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
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
import { Plus, Edit3, Trash2 } from "lucide-react";
import { useAdminNews, useCreateNews, useUpdateNews, useDeleteNews, type NewsItem } from "@/features/admin/hooks/use-admin-news";

export function NewsPage() {
  const { data, isLoading } = useAdminNews();
  const createMutation = useCreateNews();
  const updateMutation = useUpdateNews();
  const deleteMutation = useDeleteNews();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [form, setForm] = useState({ title: "", content: "", status: true });

  const news = data?.rows ?? [];
  const filtered = news.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({ title: "", content: "", status: true });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: NewsItem) => {
    setEditing(item);
    setForm({ title: item.title, content: item.content, status: item.status === "published" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        title: form.title,
        content: form.content,
        status: form.status ? "published" : "draft",
      });
    } else {
      await createMutation.mutateAsync({
        title: form.title,
        content: form.content,
        status: form.status ? "published" : "draft",
      });
    }
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">الأخبار</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">الأخبار</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          إضافة خبر
        </Button>
      </div>

      <AdminTable
        columns={[
          { key: "title", header: "العنوان", primary: true },
          {
            key: "status",
            header: "الحالة",
            render: (item: NewsItem) => (
              <Badge variant={item.status === "published" ? "default" : "secondary"}>
                {item.status === "published" ? "منشور" : "مسودة"}
              </Badge>
            ),
          },
          {
            key: "created_at",
            header: "تاريخ الإنشاء",
            render: (item: NewsItem) =>
              new Date(item.created_at).toLocaleDateString("ar-SA"),
          },
        ]}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث بالعنوان..."
        actions={(item) => (
          <>
            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)} title="تعديل">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setDeleteTarget(item)}
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>{editing ? "تعديل خبر" : "إضافة خبر جديد"}</ModalTitle>
            <ModalDescription>
              {editing ? "قم بتعديل الخبر" : "أدخل بيانات الخبر الجديد"}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Input
              label="العنوان"
              placeholder="عنوان الخبر"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Textarea
              label="المحتوى"
              placeholder="محتوى الخبر..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
            />
            <Switch
              label="منشور"
              checked={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.checked })}
            />
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "جاري..." : "حفظ"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="حذف الخبر"
        description={`هل أنت متأكد من حذف "${deleteTarget?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

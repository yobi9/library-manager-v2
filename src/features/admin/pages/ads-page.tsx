"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
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
import {
  useAdminAds,
  useCreateAdminAd,
  useUpdateAdminAd,
  useDeleteAdminAd,
  type AdminAd,
} from "@/features/admin/hooks/use-admin-ads";

const positionLabels: Record<string, string> = {
  header: "رأس الصفحة",
  sidebar: "الشريط الجانبي",
  footer: "تذييل الصفحة",
  between: "بين المحتوى",
};

export function AdsPage() {
  const { data, isLoading } = useAdminAds();
  const createMutation = useCreateAdminAd();
  const updateMutation = useUpdateAdminAd();
  const deleteMutation = useDeleteAdminAd();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAd | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAd | null>(null);
  const [form, setForm] = useState({ title: "", position: "sidebar", status: true });

  const ads = data?.rows ?? [];
  const filtered = ads.filter((ad) =>
    ad.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({ title: "", position: "sidebar", status: true });
    setModalOpen(true);
  };

  const handleOpenEdit = (ad: AdminAd) => {
    setEditing(ad);
    setForm({ title: ad.title, position: ad.position, status: ad.status === "active" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) return;
    if (editing) {
      await updateMutation.mutateAsync({
        id: editing.id,
        title: form.title,
        position: form.position,
        status: form.status ? "active" : "inactive",
      });
    } else {
      await createMutation.mutateAsync({
        title: form.title,
        position: form.position,
        status: form.status ? "active" : "inactive",
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
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">الإعلانات</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">الإعلانات</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          إضافة إعلان
        </Button>
      </div>

      <AdminTable
        columns={[
          { key: "title", header: "العنوان", primary: true },
          {
            key: "position",
            header: "الموضع",
            render: (ad: AdminAd) => positionLabels[ad.position] ?? ad.position,
          },
          {
            key: "status",
            header: "الحالة",
            render: (ad: AdminAd) => (
              <Badge variant={ad.status === "active" ? "default" : "secondary"}>
                {ad.status === "active" ? "نشط" : "غير نشط"}
              </Badge>
            ),
          },
          {
            key: "impressions",
            header: "مرات الظهور",
            render: (ad: AdminAd) => ad.impressions?.toString() ?? "0",
          },
          {
            key: "clicks",
            header: "النقرات",
            render: (ad: AdminAd) => ad.clicks?.toString() ?? "0",
          },
        ]}
        data={filtered}
        keyExtractor={(ad) => String(ad.id)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث باسم الإعلان..."
        actions={(ad) => (
          <>
            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(ad)} title="تعديل">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setDeleteTarget(ad)}
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
            <ModalTitle>{editing ? "تعديل إعلان" : "إضافة إعلان جديد"}</ModalTitle>
            <ModalDescription>
              {editing ? "قم بتعديل بيانات الإعلان" : "أدخل بيانات الإعلان الجديد"}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Input
              label="العنوان"
              placeholder="اسم الإعلان"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Select
              label="الموضع"
              options={[
                { value: "header", label: "رأس الصفحة" },
                { value: "sidebar", label: "الشريط الجانبي" },
                { value: "footer", label: "تذييل الصفحة" },
                { value: "between", label: "بين المحتوى" },
              ]}
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
            />
            <Switch
              label="مفعل"
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
        title="حذف الإعلان"
        description={`هل أنت متأكد من حذف "${deleteTarget?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

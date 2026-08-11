"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
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
import { useAdminStoreProducts, useCreateStoreProduct, useUpdateStoreProduct, useDeleteStoreProduct, type StoreProduct } from "@/features/admin/hooks/use-admin-store";

export function StorePage() {
  const { data, isLoading } = useAdminStoreProducts();
  const createMutation = useCreateStoreProduct();
  const updateMutation = useUpdateStoreProduct();
  const deleteMutation = useDeleteStoreProduct();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState({ name: "", price: "", status: true });

  const items = data?.rows ?? [];
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({ name: "", price: "", status: true });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: StoreProduct) => {
    setEditing(item);
    setForm({
      name: item.name,
      price: item.price?.toString() ?? "",
      status: item.status === "active",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    const payload = {
      name: form.name,
      price: Number(form.price),
      status: form.status ? "active" : "inactive",
    };
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
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
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">المتجر</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">المتجر</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          إضافة عنصر
        </Button>
      </div>

      <AdminTable
        columns={[
          { key: "name", header: "الاسم", primary: true },
          {
            key: "price",
            header: "السعر",
            render: (item: StoreProduct) =>
              item.price != null ? `${item.price} ر.س` : "—",
          },
          {
            key: "status",
            header: "الحالة",
            render: (item: StoreProduct) => (
              <Badge variant={item.status === "active" ? "default" : "secondary"}>
                {item.status === "active" ? "نشط" : "غير نشط"}
              </Badge>
            ),
          },
          {
            key: "created_at",
            header: "تاريخ الإنشاء",
            render: (item: StoreProduct) =>
              new Date(item.created_at).toLocaleDateString("ar-SA"),
          },
        ]}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث باسم العنصر..."
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
            <ModalTitle>{editing ? "تعديل عنصر" : "إضافة عنصر جديد"}</ModalTitle>
            <ModalDescription>
              {editing ? "قم بتعديل بيانات العنصر" : "أدخل بيانات العنصر الجديد"}
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <Input
              label="الاسم"
              placeholder="اسم العنصر"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="السعر"
              placeholder="0.00"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
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
        title="حذف العنصر"
        description={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

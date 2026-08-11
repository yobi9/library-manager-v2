"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Avatar } from "@/shared/components/ui/avatar";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import {
  Search,
  Plus,
  Ban,
  CheckCircle,
  Shield,
  ShieldOff,
  Trash2,
  Pencil,
  Eye,
} from "lucide-react";
import {
  useAdminUsers,
  useDeleteAdminUser,
  useToggleBlockUser,
  useToggleAdminUser,
  type AdminUser,
} from "@/features/admin/hooks/use-admin-users";
import { UserFormModal } from "@/features/admin/components/users/user-form-modal";
import { UserDetailModal } from "@/features/admin/components/users/user-detail-modal";
import { toast } from "sonner";

const roleLabels: Record<string, string> = { admin: "مدير", viewer: "مشاهد" };

export function UsersPage() {
  const { data, isLoading } = useAdminUsers();
  const deleteMutation = useDeleteAdminUser();
  const blockMutation = useToggleBlockUser();
  const adminMutation = useToggleAdminUser();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "viewer">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formTarget, setFormTarget] = useState<AdminUser | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const users = data?.rows ?? [];
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.display_name?.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || (roleFilter === "admin" ? u.is_admin : !u.is_admin);
    return matchesSearch && matchesRole;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.user_id);
      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل حذف المستخدم";
      toast.error(message);
    }
  };

  const handleToggleBlock = (user: AdminUser) => {
    blockMutation.mutate(
      { id: user.user_id, block: !user.is_blocked },
      {
        onError: (error) => toast.error(error instanceof Error ? error.message : "فشل تغيير الحظر"),
      },
    );
  };

  const handleToggleAdmin = (user: AdminUser) => {
    adminMutation.mutate(
      { id: user.user_id, makeAdmin: !user.is_admin },
      {
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "فشل تغيير الصلاحية"),
      },
    );
  };

  const openAdd = () => {
    setFormMode("add");
    setFormTarget(null);
    setFormOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setFormMode("edit");
    setFormTarget(user);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">إدارة المستخدمين</h1>
        <div className="bg-muted h-64 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">إدارة المستخدمين</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          إضافة مستخدم
        </Button>
      </div>

      {/* ─── شريط البحث والفلاتر ───────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="بحث بالاسم أو البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "الكل" },
            { value: "admin", label: "مدراء" },
            { value: "viewer", label: "مشاهدون" },
          ].map((opt) => (
            <Button
              key={opt.value}
              variant={roleFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(opt.value as typeof roleFilter)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* ─── Card View (الموبايل: < lg) ─────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {filtered.length > 0 ? (
          filtered.map((user) => (
            <div
              key={user.user_id}
              className="border-border bg-card rounded-lg border p-4 space-y-3"
            >
              {/* المعلومات الأساسية */}
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.avatar ?? undefined}
                  alt={user.display_name}
                  fallback={user.display_name || user.username}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium truncate">
                    {user.display_name}
                  </p>
                  <p className="text-muted-foreground text-xs truncate">
                    {user.username}
                  </p>
                </div>
              </div>

              {/* التفاصيل */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">البريد</span>
                  <span className="text-secondary-foreground text-xs truncate">
                    {user.email ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">الدور</span>
                  <Badge variant={user.is_admin ? "default" : "secondary"}>
                    {roleLabels[user.is_admin ? "admin" : "viewer"]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">الحالة</span>
                  <Badge variant={user.is_blocked ? "destructive" : "default"}>
                    {user.is_blocked ? "محظور" : "نشط"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">تاريخ الانضمام</span>
                  <span className="text-secondary-foreground text-xs">
                    {new Date(user.created_at).toLocaleDateString("ar-SA")}
                  </span>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div className="border-border/50 flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDetailTarget(user)}
                  title="التفاصيل"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(user)}
                  title="تعديل"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleAdmin(user)}
                  title={user.is_admin ? "إزالة صلاحية المدير" : "تعيين كمدير"}
                >
                  {user.is_admin ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleBlock(user)}
                  title={user.is_blocked ? "إلغاء الحظر" : "حظر"}
                >
                  {user.is_blocked ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Ban className="text-destructive h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(user)}
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="border-border text-muted-foreground rounded-lg border p-8 text-center">
            لا توجد نتائج
          </div>
        )}
      </div>

      {/* ─── Table View (الديسكتوب: lg+) ────────────────────────── */}
      <div className="hidden rounded-lg border border-border lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="text-muted-foreground px-4 py-3 text-right text-sm font-medium">
                المستخدم
              </th>
              <th className="text-muted-foreground px-4 py-3 text-right text-sm font-medium">
                اسم المستخدم
              </th>
              <th className="text-muted-foreground px-4 py-3 text-right text-sm font-medium">
                البريد
              </th>
              <th className="text-muted-foreground px-4 py-3 text-right text-sm font-medium">
                الدور
              </th>
              <th className="text-muted-foreground px-4 py-3 text-right text-sm font-medium">
                الحالة
              </th>
              <th className="text-muted-foreground px-4 py-3 text-right text-sm font-medium">
                تاريخ الانضمام
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-sm font-medium">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.user_id} className="border-border border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={user.avatar ?? undefined}
                      alt={user.display_name}
                      fallback={user.display_name || user.username}
                      size="sm"
                    />
                    <span className="font-medium">{user.display_name}</span>
                  </div>
                </td>
                <td className="text-muted-foreground px-4 py-3">{user.username}</td>
                <td className="text-muted-foreground px-4 py-3">{user.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_admin ? "default" : "secondary"}>
                    {roleLabels[user.is_admin ? "admin" : "viewer"]}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_blocked ? "destructive" : "default"}>
                    {user.is_blocked ? "محظور" : "نشط"}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {new Date(user.created_at).toLocaleDateString("ar-SA")}
                </td>
                <td className="px-4 py-3 text-left">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDetailTarget(user)}
                      title="التفاصيل"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(user)}
                      title="تعديل"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleAdmin(user)}
                      title={user.is_admin ? "إزالة صلاحية المدير" : "تعيين كمدير"}
                    >
                      {user.is_admin ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <Shield className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleBlock(user)}
                      title={user.is_blocked ? "إلغاء الحظر" : "حظر"}
                    >
                      {user.is_blocked ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Ban className="text-destructive h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(user)}
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground h-24 text-center">
                  لا توجد نتائج
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <UserFormModal
          key={formTarget?.user_id ?? "add"}
          mode={formMode}
          initialUser={formTarget}
          onOpenChange={setFormOpen}
        />
      )}

      <UserDetailModal
        open={!!detailTarget}
        user={detailTarget}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="حذف المستخدم"
        description={`هل أنت متأكد من حذف "${deleteTarget?.display_name ?? deleteTarget?.username}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/shared/components/ui/modal";
import {
  useCreateAdminUser,
  useUpdateAdminUser,
  useUploadAdminAvatar,
  type AdminUser,
} from "@/features/admin/hooks/use-admin-users";

interface FormState {
  username: string;
  password: string;
  display_name: string;
  email: string;
  phone_number: string;
  about: string;
  date_of_birth: string;
  role: "admin" | "viewer";
  allowed: boolean;
}

interface UserFormModalProps {
  mode: "add" | "edit";
  initialUser?: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM: FormState = {
  username: "",
  password: "",
  display_name: "",
  email: "",
  phone_number: "",
  about: "",
  date_of_birth: "",
  role: "viewer",
  allowed: true,
};

/**
 * Builds the initial form state for the current mode. The parent renders this
 * modal only while open (with a `key`), so state initializes fresh on mount.
 */
function buildInitialForm(mode: "add" | "edit", initialUser?: AdminUser | null): FormState {
  if (mode === "edit" && initialUser) {
    return {
      username: initialUser.username ?? "",
      password: "",
      display_name: initialUser.display_name ?? "",
      email: initialUser.email ?? "",
      phone_number: initialUser.phone_number ?? "",
      about: initialUser.about ?? "",
      date_of_birth: initialUser.date_of_birth ?? "",
      role: initialUser.is_admin ? "admin" : "viewer",
      allowed: !initialUser.is_blocked,
    };
  }
  return EMPTY_FORM;
}

/**
 * Add/edit user modal with profile fields and optional avatar upload.
 * On add, the user is created first and the avatar is uploaded afterwards
 * using the new user id. On edit, changed profile fields are saved via PUT.
 */
export function UserFormModal({ mode, initialUser, onOpenChange }: UserFormModalProps) {
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const avatarMutation = useUploadAdminAvatar();

  const [form, setForm] = useState<FormState>(() => buildInitialForm(mode, initialUser));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.username.trim()) {
      toast.error("اسم المستخدم مطلوب");
      return;
    }
    if (mode === "add" && !form.password.trim()) {
      toast.error("كلمة المرور مطلوبة");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("البريد الإلكتروني غير صالح");
      return;
    }

    setSubmitting(true);
    try {
      let userId: number;
      if (mode === "add") {
        const created = await createMutation.mutateAsync({
          username: form.username.trim(),
          password: form.password,
          email: form.email.trim() || undefined,
          display_name: form.display_name.trim() || form.username.trim(),
          is_admin: form.role === "admin",
        });
        userId = created.user_id;
        toast.success("تم إنشاء المستخدم");
      } else {
        if (!initialUser) return;
        userId = initialUser.user_id;
        await updateMutation.mutateAsync({
          id: userId,
          data: {
            username: form.username.trim(),
            display_name: form.display_name.trim() || form.username.trim(),
            email: form.email.trim() || undefined,
            password: form.password.trim() || undefined,
            phone_number: form.phone_number.trim() || undefined,
            about: form.about.trim() || undefined,
            date_of_birth: form.date_of_birth || undefined,
            is_admin: form.role === "admin",
            is_blocked: form.allowed ? 0 : 1,
          },
        });
        toast.success("تم تحديث المستخدم");
      }

      if (avatarFile) {
        await avatarMutation.mutateAsync({ id: userId, file: avatarFile });
        toast.success("تم تحديث الصورة الشخصية");
      }

      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[85vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{mode === "add" ? "إضافة مستخدم جديد" : "تعديل المستخدم"}</ModalTitle>
          <ModalDescription>
            {mode === "add"
              ? "أدخل بيانات المستخدم الجديد"
              : `تعديل بيانات "${initialUser?.display_name ?? initialUser?.username}"`}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="الاسم المعروض"
              placeholder="الاسم الكامل"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
            <Input
              label="اسم المستخدم"
              placeholder="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="البريد الإلكتروني"
              placeholder="user@example.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label={mode === "add" ? "كلمة المرور" : "كلمة المرور (اختياري)"}
              placeholder="••••••••"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="رقم الهاتف"
              placeholder="05xxxxxxxx"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            />
            <Input
              label="تاريخ الميلاد"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>

          <Textarea
            label="نبذة"
            placeholder="اكتب نبذة قصيرة..."
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            rows={3}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="الدور"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as FormState["role"] })}
              options={[
                { value: "viewer", label: "مشاهد" },
                { value: "admin", label: "مدير" },
              ]}
            />
            <Switch
              label="حساب مفعّل"
              checked={form.allowed}
              onChange={(e) => setForm({ ...form, allowed: e.target.checked })}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm leading-none font-medium">
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="h-3.5 w-3.5" />
                الصورة الشخصية
              </span>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarFile ? avatarFile.name : "اختر صورة..."}
            </Button>
          </div>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "جاري الحفظ..." : mode === "add" ? "إنشاء الحساب" : "حفظ التغييرات"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

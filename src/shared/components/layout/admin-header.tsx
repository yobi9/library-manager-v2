"use client";

import { LogOut, User, Sun, Moon, Menu } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useState } from "react";
import { useAdminTheme, useAdminSidebar } from "@/app/admin/layout";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { useAuth } from "@/lib/frontend/auth-context";

/**
 * رأس لوحة الإدارة.
 * - على الموبايل: يعرض زر Hamburger لفتح السايد بار.
 * - على الديسكتوب: يعرض معلومات المستخدم والخروج.
 * - يستخدم ثيم الإدارة المعزول (dark/light عبر useAdminTheme).
 */
export function AdminHeader() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { theme, setTheme } = useAdminTheme();
  const { openMobile } = useAdminSidebar();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    setConfirmOpen(false);
    await logout();
    router.push("/login");
  };

  return (
    <header className="border-border/50 bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 flex h-16 w-full items-center justify-between px-4 backdrop-blur-xl sm:px-6">
      {/* زر Hamburger - يظهر على الموبايل فقط */}
      <Button
        variant="ghost"
        size="icon"
        onClick={openMobile}
        className="text-muted-foreground hover:text-foreground lg:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/*spacer للديسكتوب */}
      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="border-border text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "تفعيل وضع الإدارة الفاتح" : "تفعيل وضع الإدارة الداكن"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden text-sm font-medium md:inline-block">{user?.username}</span>

          <Button
            variant="ghost"
            size="sm"
            className="text-accent hover:bg-destructive/10 hover:text-destructive gap-1.5"
            onClick={() => setConfirmOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline-block">تسجيل الخروج</span>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="تسجيل الخروج"
        description="هل أنت متأكد من رغبتك في تسجيل الخروج؟"
        confirmLabel="تسجيل الخروج"
        variant="destructive"
        onConfirm={() => void handleLogout()}
      />
    </header>
  );
}

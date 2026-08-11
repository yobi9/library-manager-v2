"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Search, Menu, X, Send, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/shared/components/ui/modal";
import { ROUTES, APP_NAME } from "@/shared/constants";
import { cn } from "@/lib/utils";
import { useSubmitVisitorRequest } from "@/features/viewer/hooks/use-visitor-request";
import { SearchModal } from "@/features/viewer/components/search/search-modal";
import { MobileNavigation, ViewerNavigation } from "./viewer-navigation";

/**
 * الهيدر الرئيسي للواجهة العامة: شعار التطبيق، البحث، قائمة التنقل،
 * زر تقديم طلب زائر، وتبديل المظهر (ليلي/نهاري).
 */
export function ViewerHeader() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const submitRequest = useSubmitVisitorRequest();

  const { theme, setTheme } = useTheme();

  // إغلاق القائمة المنسدلة بزر Escape (إمكانية الوصول + الاستخدام اليومي).
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const handleSendRequest = () => {
    const message = requestText.trim();
    if (!message) {
      toast.error("اكتب طلبك أولاً");
      return;
    }
    submitRequest.mutate(message, {
      onSuccess: () => {
        toast.success("تم إرسال طلبك بنجاح");
        setRequestText("");
        setRequestOpen(false);
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "فشل إرسال الطلب"),
    });
  };

  return (
    <>
      {/* <header className="border-border/10 bg-background/80 supports-backdrop-filter:bg-background/60 fixed inset-x-0 top-0 z-40 border-b backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4"> */}
      <header className="border-border/10 bg-background/80 supports-backdrop-filter:bg-background/60 fixed inset-x-0 top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300">
        {/* <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"> */}
        <div className="container mx-auto flex h-16 items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8">
          <Link
            href={ROUTES.HOME as import("next").Route}
            className="text-foreground flex items-center gap-2 text-lg font-bold"
          >
            {APP_NAME}
          </Link>
          {/* شريط التنقل (يظهر في الشاشات الكبيرة lg فأكبر فقط — موبايل فريست) */}
          <ViewerNavigation className="hidden lg:flex" />

          <nav className="hidden items-center gap-4 lg:flex">
            <Button
              variant="ghost"
              className="text-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span>بحث</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={
                mounted
                  ? theme === "dark"
                    ? "تفعيل الوضع الفاتح"
                    : "تفعيل الوضع الداكن"
                  : "تبديل الثيم"
              }
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              className="border-border/20 text-foreground hover:bg-white/10"
              onClick={() => setRequestOpen(true)}
            >
              <Send className="h-4 w-4" />
              <span>طلب</span>
            </Button>
          </nav>

          {/* إجراءات سريعة للموبايل (أيقونات مصغرة تحت lg) */}
          <div className="flex items-center gap-1 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => setSearchOpen(true)}
              aria-label="بحث"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:text-foreground hover:bg-white/10"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={
                mounted
                  ? theme === "dark"
                    ? "تفعيل الوضع الفاتح"
                    : "تفعيل الوضع الداكن"
                  : "تبديل الثيم"
              }
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-foreground lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={mobileOpen}
            aria-controls="viewer-mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <div
          id="viewer-mobile-menu"
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out lg:hidden",
            mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          inert={!mobileOpen}
        >
          <div className="overflow-hidden">
            <div className="border-border/10 space-y-2 border-t px-3 py-3 sm:px-4">
              <MobileNavigation onNavigate={() => setMobileOpen(false)} />

              <div className="border-border/10 border-t" />

              <Button
                variant="ghost"
                className="text-foreground hover:text-foreground w-full justify-start hover:bg-white/10"
                onClick={() => {
                  setSearchOpen(true);
                  setMobileOpen(false);
                }}
              >
                <Search className="h-4 w-4" />
                <span>بحث</span>
              </Button>
              <Button
                variant="ghost"
                className="text-foreground hover:text-foreground w-full justify-start hover:bg-white/10"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {mounted ? (
                  theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )
                ) : (
                  <div className="h-4 w-4" />
                )}
                <span>{mounted ? (theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن") : ""}</span>
              </Button>
              <Button
                variant="outline"
                className="border-border/20 text-foreground w-full justify-start hover:bg-white/10"
                onClick={() => {
                  setRequestOpen(true);
                  setMobileOpen(false);
                }}
              >
                <Send className="h-4 w-4" />
                <span>طلب</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />

      <Modal open={requestOpen} onOpenChange={setRequestOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>طلب محتوى</ModalTitle>
            <ModalDescription>أرسل طلبك لإضاف محتوى جديد</ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="اكتب طلبك هنا (اسم الفيلم أو المسلسل...)"
              rows={5}
              disabled={submitRequest.isPending}
            />
            <Button
              onClick={handleSendRequest}
              disabled={submitRequest.isPending || !requestText.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4" />
              {submitRequest.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}

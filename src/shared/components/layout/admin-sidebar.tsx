//src\shared\components\layout\admin-sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Cpu,
  Settings,
  UploadCloud,
  Tv,
  ShoppingCart,
  Megaphone,
  Newspaper,
  Mail,
  ListOrdered,
  Sliders,
  Users,
  Check,
  AlertTriangle,
  Key,
  HelpCircle,
  Database,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants";
import { cn } from "@/lib/utils";
import { useAdminSidebar } from "@/app/admin/layout";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "الرئيسية",
    items: [
      { label: "لوحة القيادة", href: ROUTES.ADMIN, icon: LayoutDashboard },
      { label: "الأحداث", href: ROUTES.ADMIN_EVENTS, icon: Zap },
      { label: "العمليات الخلفية", href: ROUTES.ADMIN_PROCESSES, icon: Cpu },
      { label: "الاعدادات الرئيسية", href: ROUTES.ADMIN_SETTINGS, icon: Settings },
      { label: "البث المباشر", href: "#", icon: Tv, external: true },
    ],
  },
  {
    title: "إدارة المحتوى",
    items: [
      { label: "ترتيب الأقسام", href: ROUTES.ADMIN_LIBRARIES, icon: ListOrdered },
      { label: "التحكم بالعناصر", href: ROUTES.ADMIN_MEDIA, icon: Sliders },
    ],
  },
  {
    title: "الحصريات والاخبار",
    items: [
      { label: "الحصريات", href: ROUTES.ADMIN_EXCLUSIVE, icon: Newspaper },
      { label: "الأخبار", href: ROUTES.ADMIN_NEWS, icon: Newspaper },
      { label: "الرسائل", href: ROUTES.ADMIN_MESSAGES, icon: Mail },
    ],
  },
  {
    title: "المتجر والتسويق",
    items: [
      { label: "المتجر", href: ROUTES.ADMIN_STORE, icon: ShoppingCart },
      { label: "الإعلانات", href: ROUTES.ADMIN_ADS, icon: Megaphone },
    ],
  },
  {
    title: "المستخدمين",
    items: [
      { label: "إدارة المستخدمين", href: ROUTES.ADMIN_USERS, icon: Users },
      { label: "طلبات الزبائن", href: ROUTES.ADMIN_REQUESTS, icon: Check },
      { label: "التبليغات", href: ROUTES.ADMIN_REPORTS, icon: AlertTriangle },
    ],
  },
  {
    title: "النظام",
    items: [
      { label: "رفع الملفات", href: ROUTES.ADMIN_UPLOAD, icon: UploadCloud },
      { label: "قاعدة البيانات", href: ROUTES.ADMIN_DATABASE, icon: Database },
      { label: "الترخيص", href: ROUTES.ADMIN_LICENSE, icon: Key },
      { label: "الشروط", href: ROUTES.ADMIN_TERMS, icon: ShieldCheck },
    ],
  },
  {
    title: "المساعدة",
    items: [
      { label: "المساعدة", href: ROUTES.ADMIN_HELP, icon: HelpCircle },
      { label: "الاشتراك", href: ROUTES.ADMIN_SUBSCRIPTION, icon: Key },
    ],
  },
];

/**
 * الشريط الجانبي للوحة الإدارة.
 * - على الديسكتوب (lg+): يظهر كشريط جانبي ثابت.
 * - على الموبايل (< lg): يظهر كـ Drawer من اليمين مع Overlay.
 * - يستخدم ألوان الإدارة المعزولة (admin-*) لضمان هوية بصرية مستقلة.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { isMobileOpen, closeMobile } = useAdminSidebar();

  return (
    <>
      {/* ─── Mobile Drawer ──────────────────────────────────────── */}
      <aside
        className={cn(
          "border-border bg-card fixed top-0 right-0 z-50 flex h-screen flex-col border-l transition-all duration-300 ease-in-out lg:hidden",
          isMobileOpen ? "translate-x-0" : "translate-x-full",
          collapsed ? "w-16" : "w-61.25",
        )}
      >
        {/* Header: اللوجو وزر الإغلاق */}
        <div className="border-border! flex h-16 items-center justify-between px-4">
          {!collapsed ? (
            <div className="relative flex w-full flex-col items-center">
              <Link
                href={ROUTES.ADMIN as import("next").Route}
                className="flex w-full items-center justify-center"
                onClick={closeMobile}
              >
                <div className="relative">
                  <img
                    src="/estra7ah.svg"
                    alt="Logo"
                    className="admin-logo h-auto w-20 object-contain brightness-110 transition-transform hover:scale-105"
                  />
                </div>
              </Link>
              <a
                href={ROUTES.ADMIN_LICENSE}
                className="absolute bg-brand-accent text-brand-accent-foreground rounded-full px-0.5 text-[10px] font-light no-underline"
                style={{ top: "25px", left: "105px", width: "fit-content" }}
              >
                <div>بروفاشنال</div>
              </a>
            </div>
          ) : (
            <div className="relative mx-auto h-8 w-8">
              <Image
                src="/estra7ah.svg"
                alt="Logo"
                fill
                className="admin-logo object-contain brightness-110"
              />
            </div>
          )}

          {/* زر التصغير/التكبير */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground hover:bg-bg-hover h-8 w-8 shrink-0 rounded-full transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="custom-sidebar-scroll flex-1 overflow-y-auto p-2 pt-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-5">
              {!collapsed && (
                <h3 className="text-muted-foreground/70 mb-2 px-3 text-[13px] font-medium tracking-widest uppercase opacity-70">
                  {section.title}
                </h3>
              )}
              <div className="space-y-2">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== ROUTES.ADMIN && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href as import("next").Route}
                      onClick={closeMobile}
                      className={cn(
                        "group m-0! flex h-7 items-center gap-3 rounded-md p-0! px-3 transition-all duration-200",
                        isActive
                          ? "bg-accent text-accent-foreground shadow-accent/25 shadow-lg"
                          : "hover:bg-bg-hover text-muted-foreground hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive
                            ? "text-accent-foreground"
                            : "text-muted-foreground/70 group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <span
                          className={cn(
                            "flex-1 text-[13.5px] leading-normal font-light",
                            isActive ? "text-accent-foreground" : "text-secondary-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                      )}
                      {!collapsed && (
                        <ChevronLeft
                          className={cn(
                            "h-3 w-3 transform transition-all duration-300",
                            isActive
                              ? "translate-x-0 opacity-100"
                              : "translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-40",
                          )}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-border border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="hover:bg-bg-hover text-muted-foreground/70 hover:text-foreground h-8 w-full rounded-md transition-colors"
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* ─── Desktop Sidebar ────────────────────────────────────── */}
      <aside
        className={cn(
          "border-border bg-card shadow-card sticky top-0 z-50 hidden h-screen flex-col border-l transition-all duration-300 ease-in-out lg:flex",
          collapsed ? "w-16" : "w-61.25",
        )}
      >
        {/* Header: اللوجو والوسم الفوسفوري */}
        <div className="border-border! flex h-16 items-center justify-between px-4">
          {!collapsed ? (
            <div className="relative flex w-full flex-col items-center">
              <Link
                href={ROUTES.ADMIN as import("next").Route}
                className="flex w-full items-center justify-center"
              >
                <div className="relative">
                  <img
                    src="/estra7ah.svg"
                    alt="Logo"
                    className="admin-logo h-auto w-20 object-contain brightness-110 transition-transform hover:scale-105"
                  />
                </div>
              </Link>
              <a
                href={ROUTES.ADMIN_LICENSE}
                className="absolute bg-brand-accent text-brand-accent-foreground rounded-full px-0.5 text-[10px] font-light no-underline"
                style={{ top: "25px", left: "105px", width: "fit-content" }}
              >
                <div>بروفاشنال</div>
              </a>
            </div>
          ) : (
            <div className="relative mx-auto h-8 w-8">
              <Image
                src="/estra7ah.svg"
                alt="Logo"
                fill
                className="admin-logo object-contain brightness-110"
              />
            </div>
          )}

          {/* زر التصغير */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-muted-foreground hover:text-foreground hover:bg-bg-hover h-8 w-8 shrink-0 rounded-full transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation: القائمة البرمجية المكتنزة */}
        <nav className="custom-sidebar-scroll flex-1 overflow-y-auto p-2 pt-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-5">
              {!collapsed && (
                <h3 className="text-muted-foreground/70 mb-2 px-3 text-[13px] font-medium tracking-widest uppercase opacity-70">
                  {section.title}
                </h3>
              )}
              <div className="space-y-2">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== ROUTES.ADMIN && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href as import("next").Route}
                      className={cn(
                        "group m-0! flex h-7 items-center gap-3 rounded-md p-0! px-3 transition-all duration-200",
                        isActive
                          ? "bg-accent text-accent-foreground shadow-accent/25 shadow-lg"
                          : "hover:bg-bg-hover text-muted-foreground hover:text-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive
                            ? "text-accent-foreground"
                            : "text-muted-foreground/70 group-hover:text-foreground",
                        )}
                      />
                      {!collapsed && (
                        <span
                          className={cn(
                            "flex-1 text-[13.5px] leading-normal font-light",
                            isActive ? "text-accent-foreground" : "text-secondary-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                      )}
                      {!collapsed && (
                        <ChevronLeft
                          className={cn(
                            "h-3 w-3 transform transition-all duration-300",
                            isActive
                              ? "translate-x-0 opacity-100"
                              : "translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-40",
                          )}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: زر التصغير الأنيق */}
        <div className="border-border border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="hover:bg-bg-hover text-muted-foreground/70 hover:text-foreground h-8 w-full rounded-md transition-colors"
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    </>
  );
}

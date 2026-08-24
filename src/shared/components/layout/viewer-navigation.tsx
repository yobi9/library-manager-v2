// src/shared/components/layout/viewer-navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/shared/constants";

interface NavLink {
  href: string;
  label: string;
}

const navLinks: NavLink[] = [
  { href: ROUTES.HOME, label: "الرئيسية" },
  { href: ROUTES.SECTIONS, label: "الأقسام" },
  { href: ROUTES.NEW, label: "جديد" }, // إضافة هذا السطر
  { href: ROUTES.GENRE, label: "التصنيفات" },
  { href: ROUTES.YEAR, label: "السنوات" },
  { href: ROUTES.PERSON, label: "الأشخاص" },
  { href: ROUTES.WATCH_LATER, label: "شاهد لاحقاً" },
  { href: ROUTES.RATING, label: "التقييم" },
  { href: ROUTES.CERTIFICATION, label: "الشهادة" },
];

/**
 * شريط التنقل الرئيسي للشاشات الكبيرة (lg فأعلى)
 * - يُخفى تلقائياً تحت نقطة الكسر `lg` ويحل محله `MobileNavigation` في الهيدر.
 * - تمرير أفقي عند زيادة العناصر عن عرض الحاوية المتاحة.
 * - خلفية زجاجية مع تأثير blur.
 * - مؤشر نشاط هادئ (خلفية ولون نص فقط، دون توهج).
 * - انتقالات ناعمة باستخدام Tailwind v4.
 * - دعم RTL وإمكانية الوصول.
 *
 * @param className - كلاسات إضافية تُدمج عبر `cn` (مثل `hidden lg:flex` للتحكم بالظهور).
 */
export function ViewerNavigation({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={`border-border/30 bg-background/60 flex scrollbar-none items-center gap-1 overflow-x-auto rounded-full border px-1.5 py-1.5 backdrop-blur-xl md:gap-1.5 md:px-2 [&::-webkit-scrollbar]:hidden ${className}`}
      aria-label="التنقل الرئيسي"
    >
      {navLinks.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href as import("next").Route}
            className={cn(
              "relative shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all duration-300 ease-out sm:px-4 sm:py-1.5 sm:text-sm",
              "hover:bg-primary/5 hover:text-primary",
              "focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * نسخة التنقل للشاشات الصغيرة (قائمة منسدلة في الهيدر)
 * - تصميم عمودي أنيق مع شريط جانبي لنشاط الصفحة.
 * - نقطة نشاط صغيرة بجانب العنصر النشط.
 * - تُستخدم داخل القائمة المنسدلة للهيدر تحت نقطة الكسر `lg`.
 *
 * @param onNavigate - مُنادٍ يُستدعى عند النقر على أي رابط (لإغلاق القائمة مثلاً).
 */
export function MobileNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col space-y-0.5">
      {navLinks.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href as import("next").Route}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-out",
              "hover:bg-primary/5 hover:text-primary",
              "focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "bg-primary/5 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {/* شريط جانبي للنشاط (يظهر على اليمين في RTL) */}
            {isActive && (
              <span className="bg-primary absolute top-1/2 right-0 h-6 w-0.5 -translate-y-1/2 rounded-full" />
            )}
            <span className="flex-1 text-right">{link.label}</span>
            {isActive && <span className="bg-primary h-2 w-2 rounded-full" />}
          </Link>
        );
      })}
    </div>
  );
}

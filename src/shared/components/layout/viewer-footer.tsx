import { APP_NAME } from "@/shared/constants";

/**
 * تذييل الموقع العام — يعرض سنة الحقوق واسم التطبيق من `APP_NAME`.
 */
export function ViewerFooter() {
  return (
    <footer className="border-border bg-muted/30 border-t py-6">
      <div className="text-muted-foreground container mx-auto px-3 text-center text-sm sm:px-4 md:px-6 lg:px-8">
        © {new Date().getFullYear()} {APP_NAME}. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}

import { Wrench } from "lucide-react";

/**
 * شاشة وضع الصيانة — تُعرض للزوار غير المدراء عندما يكون
 * `maintenance_mode` مفعّلاً، وتُمنح للمدراء تمريرة تلقائية من التخطيط.
 *
 * @returns واجهة معلوماتية بسيطة تشرح إغلاق الموقع مؤقتاً.
 */
export function MaintenanceScreen() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
        <Wrench className="text-muted-foreground h-8 w-8" />
      </div>
      <h1 className="text-foreground text-2xl font-bold">الموقع قيد الصيانة</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        نعمل حالياً على تحسين تجربتك. يرجى المحاولة مرة أخرى في وقت لاحق.
      </p>
    </div>
  );
}

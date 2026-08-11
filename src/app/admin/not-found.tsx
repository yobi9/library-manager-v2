import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">404 — صفحة الإدارة غير موجودة</h2>
      <Link href={"/admin" as import("next").Route} className="text-primary underline">
        العودة للوحة التحكم
      </Link>
    </div>
  );
}

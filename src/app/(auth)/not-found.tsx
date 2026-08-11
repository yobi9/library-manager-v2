import Link from "next/link";

export default function AuthNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">404 — صفحة غير موجودة</h2>
      <Link href={"/login" as import("next").Route} className="text-primary underline">
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}

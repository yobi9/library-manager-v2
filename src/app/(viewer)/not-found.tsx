import Link from "next/link";

export default function ViewerNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-bold">404 — الصفحة غير موجودة</h2>
      <Link href="/" className="text-primary underline">
        العودة للرئيسية
      </Link>
    </div>
  );
}

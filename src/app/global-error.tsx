"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold text-destructive">خطأ عام</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            حاول مرة أخرى
          </button>
        </div>
      </body>
    </html>
  );
}

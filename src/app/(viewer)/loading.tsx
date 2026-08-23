
//src\app\(viewer)\loading.tsx
// export default function ViewerLoading() {
//   return (
//     <div className="flex flex-1 items-center justify-center">
//       <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
//     </div>
//   );
// }
// src/app/(viewer)/loading.tsx
import { Spinner } from "@/shared/components/ui/spinner";

export default function ViewerLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner size="lg" label="جاري تحميل المحتوى..." labelPosition="bottom" />
    </div>
  );
}
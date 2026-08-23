import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPut } from "@/lib/frontend/api-client";
import {
  useAdminSettings,
  adminSettingsKeys,
} from "@/features/admin/hooks/use-admin-settings";
import type { ExclusiveItem } from "@/features/admin/types/exclusive";

/**
 * قراءة قائمة العناصر الحصرية من إعدادات الأدمن مع ترتيبها حسب `sort_order`.
 *
 * الغرض: مصدر وحيد للبيانات في شاشة "إدارة الحصريات" — يجلب القائمة الكاملة
 * (كجزء من `AdminSettings.exclusive_items`) ويعيدها مرتبة للعرض.
 *
 * @returns كائن يحوي `items` (العناصر مرتبة تصاعدياً حسب sort_order) و `isLoading`.
 */
export function useExclusiveItems(): {
  items: ExclusiveItem[];
  isLoading: boolean;
} {
  const { data: settings, isLoading } = useAdminSettings();

  const items = useMemo(() => {
    const raw = settings?.exclusive_items;
    if (!Array.isArray(raw)) return [];
    return (raw as ExclusiveItem[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [settings]);

  return { items, isLoading };
}

/**
 * حفظ القائمة الكاملة للعناصر الحصرية في إعدادات الأدمن.
 *
 * الغرض: كل عملية (إضافة/حذف/إعادة ترتيب) ترسل القائمة كاملة عبر
 * `PUT /api/settings` تحت مفتاح `exclusive_items` — نفس سلوك المشروع القديم.
 *
 * @param items - القائمة الكاملة المراد حفظها.
 * @throws يرمي خطأً عند فشل الـ API.
 */
async function saveExclusiveItems(items: ExclusiveItem[]): Promise<void> {
  const res = await apiPut("/api/settings", { exclusive_items: items });
  if (!res.success) throw new Error(res.error ?? "فشل حفظ التغييرات");
}

/**
 * Mutation لحفظ القائمة الكاملة للعناصر الحصرية.
 *
 * @returns MutateAsync يقبل `ExclusiveItem[]` ويبطل كاش الإعدادات عند النجاح
 *          حتى ينعكس التغيير على شاشة العرض (HomeHero) فوراً.
 */
export function useSaveExclusiveItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveExclusiveItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSettingsKeys.all });
    },
  });
}

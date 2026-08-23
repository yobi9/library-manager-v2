"use client";

import { useCallback, useState } from "react";

/**
 * الرابط الأساسي لوكيل FolderPickerAgent المحلي (نفس الوكيل المستخدم في نموذج
 * مكتبات الأدمن لاختيار المجلد). قابل للتجاوز لكل نشر عبر
 * `NEXT_PUBLIC_FOLDER_PICKER_URL` (انظر `.env.example`).
 */
const FOLDER_PICKER_URL = process.env.NEXT_PUBLIC_FOLDER_PICKER_URL || "http://localhost:5199";

/**
 * فتح مجلد (مسار محلي أو مشاركة UNC) على جهاز العميل في مستكشف Windows عبر
 * سؤال الوكيل المحلي المثبّت على الجهاز نفسه.
 *
 * يجب أن يكون الوكيل يعمل على نفس جهاز المتصفح. يُرمَّز المسار بالكامل
 * (`encodeURIComponent`) حتى تنجو الأحرف العربية والمسافات أثناء النقل.
 *
 * @param path - المسار الكامل للمجلد المراد فتحه.
 * @returns `true` عند نجاح الفتح، و`false` عند رفض الوكيل (مسار غير موجود...).
 */
async function requestOpenFolder(path: string): Promise<boolean> {
  const url = `${FOLDER_PICKER_URL}/open-folder?path=${encodeURIComponent(path)}`;
  try {
    const res = await fetch(url);
    await res.text().catch(() => "");
    return res.ok;
  } catch (err) {
    throw err;
  }
}

/**
 * هوك عميل يكشف دالة `openFolder` مربوطة بوكيل FolderPickerAgent المحلي، مع
 * حالة واجهة (زر) ورسالة الخطأ الأخيرة.
 *
 * لا يُرسل أي شيء إلى خادم المكتبة — الطلب يذهب مباشرة إلى الوكيل على جهاز
 * العميل، محاكاةً لتدفق منتقي المجلدات في لوحة الأدمن.
 *
 * الهوك مشترك بين الواجهة العامة والأدمن ولذلك يسكن في `lib/frontend/hooks`.
 *
 * @returns `openFolder` تُرسل الطلب وتعيد النجاح، و`isOpening` تتبع حالة
 *          الطلب الجارية، و`lastError` تحمل آخر رسالة فشل (عربية) ليُعرضها
 *          الواجهة عبر Toast.
 */
export function useOpenFolder(): {
  openFolder: (path: string) => Promise<boolean>;
  isOpening: boolean;
  lastError: string | null;
} {
  const [isOpening, setIsOpening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const openFolder = useCallback(async (path: string): Promise<boolean> => {
    if (!path.trim()) {
      setLastError("المسار فارغ — لا يمكن فتح المجلد");
      return false;
    }
    setIsOpening(true);
    setLastError(null);
    try {
      const ok = await requestOpenFolder(path);
      if (!ok) {
        setLastError("تعذر فتح المجلد — المسار غير موجود أو المساعد لا يستجيب");
        return false;
      }
      return true;
    } catch {
      setLastError("تعذر الاتصال بالمساعد المحلي. تأكد من تشغيل FolderPickerAgent");
      return false;
    } finally {
      setIsOpening(false);
    }
  }, []);

  return { openFolder, isOpening, lastError };
}

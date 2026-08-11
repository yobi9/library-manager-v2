"use client";

import { useState, useCallback } from "react";

const FOLDER_PICKER_URL =
  process.env.NEXT_PUBLIC_FOLDER_PICKER_URL || "http://localhost:5199";

/**
 * Hook للتواصل مع Folder Picker Agent المحلي.
 * الـ Agent يفتح نافذة Windows لاختيار مجلد عبر HTTP على port 5199.
 *
 * لا يدير أي حالة فورم — فقط يعيد المسار أو null.
 *
 * @returns {pickFolder} دالة غير متزامنة تعيد المسار (string) أو null عند الإلغاء.
 * @returns {isPicking} boolean يشير إلى أن الطلب قيد التنفيذ.
 */
export function useFolderPicker(): {
  pickFolder: () => Promise<string | null>;
  isPicking: boolean;
} {
  const [isPicking, setIsPicking] = useState(false);

  const pickFolder = useCallback(async (): Promise<string | null> => {
    setIsPicking(true);
    try {
      const res = await fetch(`${FOLDER_PICKER_URL}/pick-folder`);

      if (res.status === 204) return null;

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: { path?: string } = await res.json();
      return data.path ?? null;
    } finally {
      setIsPicking(false);
    }
  }, []);

  return { pickFolder, isPicking };
}

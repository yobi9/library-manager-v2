"use client";

import { useCallback, useState } from "react";

/**
 * Base URL of the local FolderPickerAgent (same agent used by the admin
 * Library Form for folder selection). Overridable per deployment via
 * `NEXT_PUBLIC_FOLDER_PICKER_URL` (see `.env.example`).
 */
const FOLDER_PICKER_URL = process.env.NEXT_PUBLIC_FOLDER_PICKER_URL || "http://localhost:5199";

/**
 * Opens a folder (local path or UNC share) on the client machine in Windows
 * Explorer by asking the locally-installed FolderPickerAgent to run it.
 *
 * The agent must be running on the same device as the browser. The path is
 * fully percent-encoded so Arabic characters and spaces survive transport.
 *
 * @returns The folder is opened successfully.
 */
async function requestOpenFolder(path: string): Promise<boolean> {
  const url = `${FOLDER_PICKER_URL}/open-folder?path=${encodeURIComponent(path)}`;
  console.log("[OpenFolder] request URL:", url);
  try {
    const res = await fetch(url);
    const body = await res.text().catch(() => "");
    console.log("[OpenFolder] response status:", res.status, "| ok:", res.ok, "| body:", body);
    return res.ok;
  } catch (err) {
    console.error("[OpenFolder] fetch failed:", err);
    throw err;
  }
}

/**
 * Client hook that exposes an `openFolder` action wired to the local
 * FolderPickerAgent, plus UI state for the calling button.
 *
 * Nothing is sent to the library server — the request goes directly to the
 * agent on the client machine, mirroring the admin folder-picker flow.
 *
 * @returns `openFolder` fires the request and returns success, `isOpening`
 *          tracks the in-flight state, and `lastError` holds the last failure
 *          message (Arabic) so the UI can show a toast.
 */
export function useOpenFolder(): {
  openFolder: (path: string) => Promise<boolean>;
  isOpening: boolean;
  lastError: string | null;
} {
  const [isOpening, setIsOpening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const openFolder = useCallback(async (path: string): Promise<boolean> => {
    console.log("[OpenFolder] openFolder called with path:", JSON.stringify(path));
    if (!path.trim()) {
      console.warn("[OpenFolder] empty path — aborting");
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

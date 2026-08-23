import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/lib/frontend/api-client";
import { getDeviceId } from "@/shared/utils/device";

/**
 * Submits a visitor content request to the public `POST /api/user/requests`
 * endpoint. The visitor's device id (stable per-browser) is sent as the
 * `userId` so the admin can identify the requester without an account.
 *
 * @param message - The request text (media title, etc.).
 * @returns void on success.
 * @throws When the device id is unavailable or the request fails.
 */
async function submitVisitorRequest(message: string): Promise<void> {
  const userId = getDeviceId();
  if (!userId) throw new Error("تعذر تحديد هوية الجهاز");
  const res = await apiPost("/api/user/requests", { userId, message });
  if (!res.success) {
    throw new Error(res.error ?? "فشل إرسال الطلب");
  }
}

/**
 * Mutation hook used by the viewer header request modal to send a visitor
 * request. Callers handle success/error feedback (e.g. via `toast`).
 */
export function useSubmitVisitorRequest() {
  return useMutation({
    mutationFn: submitVisitorRequest,
  });
}

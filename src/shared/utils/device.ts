/**
 * Client-side stable device identifier used to associate visitor requests with
 * a specific browser/device without requiring an account. Persisted in
 * `localStorage` so the same visitor keeps the same id across page loads.
 */
const DEVICE_ID_KEY = "lm_device_id";

/**
 * Returns the current device id, creating and persisting a random UUID on
 * first call. Server-side (SSR) returns an empty string since there is no
 * browser storage to read from.
 *
 * @returns The stable device id string (may be empty during SSR).
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

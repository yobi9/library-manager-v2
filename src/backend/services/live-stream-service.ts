import { getEnv } from "@/lib/config/env";

/**
 * Raw channel payload as returned by the external live-stream system at
 * `LIVE_STREAM_BASE_URL + LIVE_CHANNELS_PATH` (mubasher viewer channels API).
 * Field names follow the external `cha_*` contract and are intentionally
 * loosely typed because the upstream payload is not part of this codebase.
 */
interface RawExternalChannel {
  id?: string | number;
  cha_name?: string;
  cha_img?: string;
  cha_player?: string;
  cha_src?: string;
}

/**
 * Normalized live channel exposed to the viewer page. All URLs are absolute
 * (image and player) so the browser can open them directly without knowing
 * the external system's address.
 */
export interface LiveChannel {
  /** Channel id from the external system (used inside the player URL). */
  id: string | number;
  /** Channel display name (Arabic). */
  name: string;
  /** Resolved absolute image URL, or null when the upstream has no image. */
  image: string | null;
  /** Player key understood by the external player page. */
  player: string;
  /** Raw source URL provided by the upstream (may be empty). */
  src: string;
  /** Absolute player page URL opened in a new tab. */
  url: string;
}

/** Default player key used by the external system when none is provided. */
const DEFAULT_PLAYER = "MediaElementJS";

/** Timeout (ms) for the upstream channel request. */
const FETCH_TIMEOUT_MS = 8000;

/**
 * Extracts the channel array from an upstream payload that may be a bare
 * array or an envelope object (`{ channels: [...] }`).
 *
 * @param data - Parsed upstream JSON body.
 * @returns The channel entries, or an empty array when the shape is unknown.
 */
function extractChannelList(data: unknown): RawExternalChannel[] {
  if (Array.isArray(data)) return data as RawExternalChannel[];
  if (data && typeof data === "object") {
    const channels = (data as Record<string, unknown>)["channels"];
    if (Array.isArray(channels)) return channels as RawExternalChannel[];
  }
  return [];
}

/**
 * Maps a single raw upstream channel to the normalized {@link LiveChannel}
 * shape and builds the player URL exactly like the old viewer page did:
 * `{base}/player/100f/470/{player|MediaElementJS}/{id}`.
 *
 * @param raw - Raw channel entry from the external system.
 * @param base - `LIVE_STREAM_BASE_URL` used to resolve relative URLs.
 * @returns The normalized channel descriptor.
 */
function normalizeChannel(raw: RawExternalChannel, base: string): LiveChannel {
  const player = raw.cha_player || DEFAULT_PLAYER;
  const id = raw.id ?? "";
  return {
    id,
    name: raw.cha_name || "قناة بدون اسم",
    image: resolveUrl(base, raw.cha_img),
    player,
    src: raw.cha_src ?? "",
    url: `${base}/player/100f/470/${player}/${String(id)}`,
  };
}

/**
 * Resolves a possibly-relative URL against the external system's base. Fully
 * qualified HTTP(S) URLs are returned untouched.
 *
 * @param base - Absolute base URL of the external system.
 * @param value - Raw value from the upstream (may be undefined).
 * @returns The absolute URL, or null when `value` is empty.
 */
function resolveUrl(base: string, value: string | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
}

/**
 * Fetches and normalizes the live channel list from the external live-stream
 * system. This runs entirely server-side so the browser never touches the
 * foreign origin (avoids CORS) and the upstream address stays server-only.
 *
 * @returns The normalized channel list (may be empty when the upstream has no
 *          channels).
 * @throws When the upstream is unreachable or answers with a non-2xx status.
 */
export class LiveStreamService {
  async fetchChannels(): Promise<LiveChannel[]> {
    const { LIVE_STREAM_BASE_URL, LIVE_CHANNELS_PATH } = getEnv();
    const url = `${LIVE_STREAM_BASE_URL}${LIVE_CHANNELS_PATH}`;
    let response: Response;
    try {
      response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new Error("تعذر الاتصال بنظام البث المباشر، تأكد من تشغيله ومن إعدادات العنوان");
    }
    if (!response.ok) {
      throw new Error(`تعذر الاتصال بنظام البث المباشر (${response.status})`);
    }
    const data = (await response.json()) as unknown;
    return extractChannelList(data).map((channel) =>
      normalizeChannel(channel, LIVE_STREAM_BASE_URL),
    );
  }
}

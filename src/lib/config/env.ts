import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(1),
  LIVE_STREAM_BASE_URL: z.string().url().default("http://localhost:3333"),
  LIVE_CHANNELS_PATH: z.string().default("/mubasher_admin/api/viewer/channels"),
});

function parseEnv() {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    LIVE_STREAM_BASE_URL: process.env.LIVE_STREAM_BASE_URL,
    LIVE_CHANNELS_PATH: process.env.LIVE_CHANNELS_PATH,
  });

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

let _env: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}

/**
 * Decides whether the session cookie should be flagged `Secure`.
 *
 * Derives the flag from the `NEXT_PUBLIC_APP_URL` protocol instead of the
 * Node environment so an internal HTTP deployment (LAN over plain
 * `http://SERVER_IP:PORT`) keeps working — a `Secure` cookie would be
 * rejected by browsers over HTTP. HTTPS deployments (or TLS-proxied setups)
 * set `NEXT_PUBLIC_APP_URL=https://...` and automatically get `Secure: true`.
 *
 * @returns `true` when the configured public URL uses `https`, otherwise `false`.
 */
export function shouldUseSecureCookies(): boolean {
  return getEnv().NEXT_PUBLIC_APP_URL.startsWith("https://");
}

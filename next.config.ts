import os from "node:os";
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/**
 * يستخرج أسماء مضيفات مسموحة للـ dev server من متغير بيئة مفصول بفواصل.
 *
 * - لماذا: إضافة أسماء مضيفات إضافية لا يملكها الخادم نفسه (مثل دومين مخصص
 *   يتوجه لهذا الجهاز) دون تعديل الشيفرة.
 * - السلوك: يُقصّ الـ scheme والمنفذ ويُحوَّل المضيف إلى أحرف صغيرة.
 *
 * @param raw - قيمة `ALLOWED_DEV_ORIGINS` الخام (مثال: "192.168.1.220,http://10.0.0.5:4000").
 * @returns مصفوفة أسماء مضيفات نظيفة للسماح بها.
 */
function normalizeDevOrigins(raw: string): string[] {
  const results: string[] = [];
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    const host = withoutScheme.split(":")[0];
    if (host) results.push(host.toLowerCase());
  }
  return results;
}

/**
 * يجمع عناوين الشبكة الحية (IPv4/IPv6 غير الحلقية) لكل واجهات الجهاز.
 *
 * - لماذا: حل ديناميكي — Next.js يرفض النمط `*` المجرد في `allowedDevOrigins`
 *   فلا يمكن إدخال "أي مضيف" حرفياً، لذا تُسحب عناوين الخادم الفعلية من نظام
 *   التشغيل عند كل إقلاع. أي جهاز داخل الشبكة يصل عبر أي من هذه العناوين
 *   يُسمح له تلقائياً، ويبقى صحيحاً حتى لو تغيّر IP الجهاز عبر DHCP.
 * - النطاق: كل واجهات الشبكة (إيثرنت/واي فاي/ظاهرية). تُستبعد الحلقية فقط
 *   لأنها تُضاف صراحة في القائمة الافتراضية.
 *
 * @returns مصفوفة عناوين IP الحية غير الحلقية.
 */
function getLocalInterfaceAddresses(): string[] {
  const addresses: string[] = [];
  for (const infos of Object.values(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.internal) continue;
      addresses.push(info.address);
    }
  }
  return addresses;
}

const envDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? normalizeDevOrigins(process.env.ALLOWED_DEV_ORIGINS)
  : [];

const nextConfig: NextConfig = {
  output: "standalone", // <--- Added this line to enable standalone build
  reactStrictMode: true,
  // قائمة المضيفات المسموحة للـ dev server تُبنى ديناميكياً:
  // الحلقي + كل عناوين واجهات الشبكة للجهاز + إضافات المتغير الاختياري.
  // ملاحظة: `['*']` لا يعمل — Next.js يرفض النمط المجرد ويحجب الموارد
  // الداخلية بـ 403.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "::1",
    ...getLocalInterfaceAddresses(),
    ...envDevOrigins,
  ],

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [];
  },
  async rewrites() {
    return [];
  },
  typedRoutes: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;

/**
 * اختبارات وحدة لسلوك الـ Edge Proxy (`src/proxy.ts`).
 *
 * الغاية: تأمين قواعد التوجيه والحماية المركزية: مرور المسارات الثابتة،
 * تحديد هوية الزائر، المرور الحر لمسارات المصادقة، وحماية /admin
 * (إعادة التوجيه عند غياب التوكن، والرفض 403 عند دور غير مخوّل).
 *
 * ملاحظة: استدعاء `/api/auth/verify-admin` داخل الـ proxy يتم عبر `fetch`
 * عالمي — يُستبدل هنا بدالة وهمية عبر `vi.stubGlobal`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * يبني `NextRequest` لمسار معين مع رؤوس اختيارية (مثل كوكيز).
 *
 * @param pathname - المسار المطلوب (مثال `/admin`).
 * @param headers - رؤوس إضافية تُمرَّر للطلب (تُستخدم `cookie` لرمز الدخول).
 * @returns كائن طلب جاهز لتمريره لدالة `proxy`.
 */
function makeRequest(pathname: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:4000${pathname}`, { headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxy routing", () => {
  it("يسمح بمرور المسارات الثابتة ويضبط x-url", async () => {
    const res = await proxy(makeRequest("/assets/img.png"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-url")).toBe("/assets/img.png");
  });

  it("يسمح بمرور مسارات المصادقة دون توكن", async () => {
    const res = await proxy(makeRequest("/login"));

    expect(res.status).toBe(200);
  });

  it("يمرر مسارات المشاهد العادية", async () => {
    const res = await proxy(makeRequest("/"));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-url")).toBe("/");
  });

  it("يضبط كوكيز هوية الزائر عند أول زيارة ولا يعيد ضبطها عند وجودها", async () => {
    const first = await proxy(makeRequest("/"));
    const visitorId = first.cookies.get("visitor_session_id")?.value;
    expect(visitorId).toBeTruthy();

    const second = await proxy(makeRequest("/", { cookie: `visitor_session_id=${visitorId}` }));
    expect(second.cookies.get("visitor_session_id")).toBeUndefined();
  });
});

describe("proxy admin protection", () => {
  it("يعيد التوجيه إلى /login عند غياب session_token", async () => {
    const res = await proxy(makeRequest("/admin"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("callbackUrl=%2Fadmin");
  });

  it("يسمح بالمرور عندما يتأكد verify-admin من الصلاحية", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );

    const res = await proxy(makeRequest("/admin", { cookie: "session_token=valid-token" }));

    expect(res.status).toBe(200);
  });

  it("يعيد التوجيه إلى /login عند رفض 401 من verify-admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    const res = await proxy(makeRequest("/admin", { cookie: "session_token=expired-token" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("يرد 403 عند دور غير مخوّل", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 403 })),
    );

    const res = await proxy(makeRequest("/admin", { cookie: "session_token=user-token" }));

    expect(res.status).toBe(403);
    expect(await res.text()).toContain("غير مصرح");
  });

  it("يعيد التوجيه عند فشل الاتصال بخدمة التحقق", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const res = await proxy(makeRequest("/admin", { cookie: "session_token=any-token" }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});

//src\app\layout.tsx
import type { Metadata, Viewport } from "next";

import localFont from "next/font/local"; // 1. استيراد أداة الخطوط المحلية
import { Providers } from "@/providers";
import { APP_NAME, APP_DESCRIPTION } from "@/shared/constants";
import "./globals.css";
// 2. إعداد خط Estra7ah بأوزانه الثلاثة كمصفوفة داخل كائن واحد
const estra7ah = localFont({
  src: [
    {
      path: "../../public/fonts/Estra7ah-Light.woff2", // تأكد من صحة المسار لملفاتك
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/Estra7ah-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/Estra7ah-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-estra7ah", // المتغير الذي يقرأه Tailwind v4
  display: "swap",
});

// 2. إعداد خط IBM Plex Sans Arabic (محلي)
const ibmPlexSansArabic = localFont({
  src: [
    {
      path: "../../public/fonts/ibm-plex-sans-arabic-v15-arabic_latin-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans-arabic-v15-arabic_latin-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans-arabic-v15-arabic_latin-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans-arabic-v15-arabic_latin-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-sans-arabic-v15-arabic_latin-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",

  display: "swap",
});

// 3. إعداد خط IBM Plex Mono (محلي)
const ibmPlexMono = localFont({
  src: [
    {
      path: "../../public/fonts/ibm-plex-mono-v20-latin-regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-mono-v20-latin-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/ibm-plex-mono-v20-latin-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-mono",

  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000"),
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: APP_NAME,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${estra7ah.variable} ${ibmPlexSansArabic.variable} ${ibmPlexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="bg-background font-estra7ah text-foreground flex min-h-full flex-col antialiased">
        {/* 4. قمنا بتغيير الخط الافتراضي في الـ body من font-sans إلى font-estra7ah ليصبح الخط الأساسي للموقع */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

/**
 * @file daily-views-chart.tsx
 * @description مكوّن الرسم البياني الخطي لنقل البيانات اليومي في لوحة القيادة.
 * يعتمد chart.js عبر react-chartjs-2 ويُستورد ديناميكيًا بـ `ssr: false`
 * لأنه يتطلب بيئة المتصفح (canvas).
 *
 * الألوان تُقرأ وقت التشغيل من توكنز globals.css (--primary، --border،
 * --muted-foreground) عبر getComputedStyle، فيتبع الرسم ثيم الإدارة النشط
 * تلقائياً بدل قيم صلبة قديمة.
 */
"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
  type ChartOptions,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, Tooltip, Legend, PointElement, LineElement, Filler);

/** قيم احتياطية مطابقة لهوية الإدارة الداكنة عند تعذّر قراءة التوكنز. */
const FALLBACKS = {
  primary: "oklch(0.53 0.09 183)",
  border: "oklch(0.36 0.006 260)",
  mutedForeground: "oklch(0.72 0.008 260)",
} as const;

/**
 * يقرأ قيمة متغير CSS محسوبة من عنصر body مع قيمة احتياطية.
 *
 * @param name - اسم المتغير بصيغة CSS (مثل "--primary").
 * @param fallback - القيمة البديلة إن كان المتغير غير معرّف أو البيئة غير متصفح.
 * @returns قيمة اللون المحسوبة كنص جاهز للاستهلاك في canvas.
 */
function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * رسم بياني خطي يعرض عدد المشاهدات اليومية خلال الأيام الأخيرة.
 *
 * ألوان الخط والشبكة والتسميات مشتقة من توكنز الثيم النشط؛ وتعبئة المسطح
 * أسفل الخط مشتقة من نفس لون التوكن بشفافية 10% عبر color-mix.
 *
 * @param props - `data` مصفوفة قيم المشاهدات اليومية (الأقدم أولًا).
 * @returns واجهة الرسم البياني الخطي داخل حاوية بارتفاع ثابت.
 */
export function DailyViewsChart({ data }: { data: number[] }) {
  const { accent, grid, tick } = useMemo(
    () => ({
      accent: readCssVar("--primary", FALLBACKS.primary),
      grid: readCssVar("--border", FALLBACKS.border),
      tick: readCssVar("--muted-foreground", FALLBACKS.mutedForeground),
    }),
    [],
  );

  const chartData = {
    labels: data.map((_, i) => `${i + 1}`),
    datasets: [
      {
        label: "نقل البيانات",
        data,
        borderColor: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 10%, transparent)`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { display: false },
      y: {
        grid: { color: grid },
        ticks: { color: tick, font: { size: 10 } },
      },
    },
  };

  return (
    <div className="h-50" dir="ltr">
      <Line data={chartData} options={options} />
    </div>
  );
}

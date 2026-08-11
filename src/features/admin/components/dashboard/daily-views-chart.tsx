/**
 * @file daily-views-chart.tsx
 * @description مكوّن الرسم البياني الخطي لنقل البيانات اليومي في لوحة القيادة.
 * يعتمد chart.js عبر react-chartjs-2 ويُستورد ديناميكيًا بـ `ssr: false`
 * لأنه يتطلب بيئة المتصفح (canvas).
 */
"use client";

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

/**
 * رسم بياني خطي يعرض عدد المشاهدات اليومية خلال الأيام الأخيرة.
 *
 * @param props - `data` مصفوفة قيم المشاهدات اليومية (الأقدم أولًا).
 * @returns واجهة الرسم البياني الخطي داخل حاوية بارتفاع ثابت.
 */
export function DailyViewsChart({ data }: { data: number[] }) {
  const chartData = {
    labels: data.map((_, i) => `${i + 1}`),
    datasets: [
      {
        label: "نقل البيانات",
        data,
        borderColor: "#009688",
        backgroundColor: "rgba(0, 150, 136, 0.1)",
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
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#9ea2ae", font: { size: 10 } },
      },
    },
  };

  return (
    <div className="h-50" dir="ltr">
      <Line data={chartData} options={options} />
    </div>
  );
}

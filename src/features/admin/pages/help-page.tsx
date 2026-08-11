import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

const faqs = [
  {
    question: "كيف يمكنني إضافة مستخدم جديد؟",
    answer:
      "يمكنك إضافة مستخدم جديد من صفحة إدارة المستخدمين. انقر على زر 'إضافة مستخدم' واملأ البيانات المطلوبة.",
  },
  {
    question: "كيف يمكنني تغيير صلاحيات مستخدم؟",
    answer:
      "من صفحة إدارة المستخدمين، يمكنك استخدام زر الدرع لتعيين أو إزالة صلاحية المدير لأي مستخدم.",
  },
  {
    question: "كيف يمكنني مسح المكتبات؟",
    answer:
      "يمكنك بدء عملية مسح المكتبات من صفحة العمليات الخلفية. اختر المكتبة التي تريد مسحها ثم انقر على 'بدء المسح'.",
  },
  {
    question: "كيف يمكنني عمل نسخة احتياطية لقاعدة البيانات؟",
    answer:
      "من صفحة قاعدة البيانات، انقر على زر 'إنشاء نسخة احتياطية' لإنشاء نسخة احتياطية من قاعدة البيانات.",
  },
  {
    question: "كيف يمكنني تغيير إعدادات الوصول للمحتوى؟",
    answer:
      "من صفحة الإعدادات، يمكنك تغيير وضع الوصول للمحتوى بين عام (بدون تسجيل دخول) ومحمي (يتطلب تسجيل دخول).",
  },
];

export function HelpPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">المساعدة</h1>

      <Card>
        <CardHeader>
          <CardTitle>الأسئلة الشائعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <details key={idx} className="group rounded-lg border border-border">
                <summary className="flex cursor-pointer items-center justify-between p-4 font-medium">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

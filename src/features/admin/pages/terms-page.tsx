import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { APP_NAME } from "@/shared/constants";

/**
 * صفحة «الشروط والأحكام» — تعرض نصوص الشروط الثابتة في الواجهة الإدارية
 * مع اسم التطبيق من `APP_NAME`.
 */
export function TermsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">الشروط والأحكام</h1>

      <Card>
        <CardHeader>
          <CardTitle>مقدمة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            مرحباً بك في {APP_NAME}. باستخدامك لهذا التطبيق، فإنك توافق على الشروط والأحكام التالية.
            يرجى قراءة هذه الشروط بعناية قبل استخدام التطبيق.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>استخدام التطبيق</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            يُسمح لك باستخدام هذا التطبيق للأغراض الشخصية وغير التجارية فقط. لا يجوز لك نسخ أو تعديل
            أو توزيع أي جزء من هذا التطبيق دون الحصول على إذن كتابي مسبق.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الحسابات</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            أنت مسؤول عن الحفاظ على سرية معلومات حسابك وكلمة المرور. يجب عليك إبلاغنا فوراً عن أي
            استخدام غير مصرح به لحسابك.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المحتوى</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            جميع المحتويات المعروضة في هذا التطبيق هي ملك لأصحابها. لا يجوز لك تحميل أو مشاركة أي
            محتوى ينتهك حقوق الملكية الفكرية للآخرين.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تعديل الشروط</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت. سيتم إخطارك بالتغييرات عبر البريد
            الإلكتروني أو من خلال إشعار داخل التطبيق.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اتصل بنا</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            إذا كان لديك أي استفسار حول هذه الشروط، يرجى الاتصال بنا عبر صفحة الاتصال.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

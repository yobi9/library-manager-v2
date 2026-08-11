"use client";

import { Card, CardContent } from "@/shared/components/ui/card";
import { UploadCloud } from "lucide-react";

export function UploadPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">رفع الملفات</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <UploadCloud className="mb-6 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-3 text-2xl font-bold">قريباً</h2>
          <p className="max-w-md text-center text-muted-foreground">
            نظام رفع الملفات قيد التطوير. سيتم إطلاق هذه الميزة قريباً.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

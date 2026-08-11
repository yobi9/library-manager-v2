"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search } from "lucide-react";

interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
  /** هل العمود أساسي (يظهر في Card View على الموبايل) */
  primary?: boolean;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: React.ReactNode;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  actions?: (item: T) => React.ReactNode;
}

/**
 * جدول إدارة موحد مع دعم Mobile First.
 *
 * - على الشاشات الكبيرة (lg+): يعرض جدول كامل.
 * - على الشاشات الصغيرة (< lg): يعرض بطاقات (Card View) لكل صف.
 * - يعرض شريط البحث والفلاتر في الأعلى.
 *
 * @param columns - تعريف الأعمدة (key, header, render اختياري, primary اختياري)
 * @param data - مصفوفة البيانات المراد عرضها
 * @param searchPlaceholder - نص بديل لحقل البحث
 * @param searchValue - قيمة البحث المُتحكَّم بها
 * @param onSearchChange - دالة تحديث البحث
 * @param filters - فلاتر اختيارية تظهر بجانب البحث
 * @param emptyMessage - رسالة عند عدم وجود نتائج
 * @param keyExtractor - دالة استخراج المفتاح الفريد لكل صف
 * @param actions - أزرار إجراءات اختيارية تظهر في آخر عمود
 */
export function AdminTable<T>({
  columns,
  data,
  searchPlaceholder = "بحث...",
  searchValue,
  onSearchChange,
  filters,
  emptyMessage = "لا توجد نتائج",
  keyExtractor,
  actions,
}: AdminTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* ─── شريط البحث والفلاتر ───────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pr-9"
          />
        </div>
        {filters && <div className="flex flex-wrap gap-2">{filters}</div>}
      </div>

      {/* ─── Card View (الموبايل: < lg) ─────────────────────────── */}
      <div className="space-y-3 lg:hidden">
        {data.length > 0 ? (
          data.map((item) => (
            <div
              key={keyExtractor(item)}
              className="border-border bg-card rounded-lg border p-4 space-y-3"
            >
              {/* الأعمدة الأساسية */}
              <div className="space-y-2">
                {columns
                  .filter((col) => col.primary)
                  .map((col) => (
                    <div key={col.key} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-sm">{col.header}</span>
                      <span className="text-foreground text-sm font-medium">
                        {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </span>
                    </div>
                  ))}
                {/* إذا لم يكن هناك أعمدة primary، نعرض العمود الأول */}
                {columns.filter((col) => col.primary).length === 0 && columns[0] && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm">{columns[0].header}</span>
                    <span className="text-foreground text-sm font-medium">
                      {columns[0].render
                        ? columns[0].render(item)
                        : String((item as Record<string, unknown>)[columns[0].key] ?? "")}
                    </span>
                  </div>
                )}
              </div>

              {/* باقي الأعمدة */}
              <div className="border-border/50 space-y-2 border-t pt-3">
                {columns
                  .filter((col) => !col.primary)
                  .slice(0, 3)
                  .map((col, idx) => (
                    <div key={col.key} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs">{col.header}</span>
                      <span className="text-secondary-foreground text-xs">
                        {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </span>
                    </div>
                  ))}
              </div>

              {/* أزرار الإجراءات */}
              {actions && (
                <div className="border-border/50 flex items-center justify-end gap-2 border-t pt-3">
                  {actions(item)}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="border-border text-muted-foreground rounded-lg border p-8 text-center">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* ─── Table View (الديسكتوب: lg+) ────────────────────────── */}
      <div className="hidden rounded-lg border border-border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              {actions && <TableHead className="text-left">الإجراءات</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((item) => (
                <TableRow key={keyExtractor(item)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-left">
                      <div className="flex gap-1">{actions(item)}</div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { Search } from "lucide-react";

export interface LibraryFiltersProps {
  yearOptions: { value: string; label: string }[];
  genreOptions: { value: string; label: string }[];
  sortOptions: { value: string; label: string }[];
  filters: { year: string; genre: string; sortBy: string };
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (newFilters: { year?: string; genre?: string; sortBy?: string }) => void;
}

export function LibraryFilters({
  yearOptions,
  genreOptions,
  sortOptions,
  filters,
  searchTerm,
  onSearchChange,
  onFilterChange,
}: LibraryFiltersProps) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3 backdrop-blur-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="w-full shrink-0 sm:w-36">
          <label className="mb-1 block text-xs text-muted-foreground">السنة</label>
          <select
            value={filters.year}
            onChange={(e) => onFilterChange({ year: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full shrink-0 sm:w-36">
          <label className="mb-1 block text-xs text-muted-foreground">الفئة</label>
          <select
            value={filters.genre}
            onChange={(e) => onFilterChange({ genre: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {genreOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">البحث</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث داخل المكتبة..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-1.5 pr-9 pl-3 text-sm"
              dir="rtl"
            />
          </div>
        </div>

        <div className="w-full shrink-0 sm:w-36">
          <label className="mb-1 block text-xs text-muted-foreground">الترتيب</label>
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

import React from "react";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change?: string;
}

interface AdminStatsCardsProps {
  stats: StatCard[];
}

/**
 * Displays a grid of stat cards for the admin dashboard.
 * Each card has a label, value, icon, and optional percentage change.
 * @param stats - Array of stat card data
 */
export function AdminStatsCards({ stats }: AdminStatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-border bg-card p-6"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </span>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{stat.value}</span>
            {stat.change && (
              <span className="text-sm text-success-text">{stat.change}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

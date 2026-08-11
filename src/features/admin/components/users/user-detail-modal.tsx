"use client";

import { Globe, Monitor, Clock, Film, ListVideo, Activity as ActivityIcon } from "lucide-react";
import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/shared/components/ui/modal";
import {
  useUserSessions,
  useUserActivity,
  useUserStats,
  type AdminUser,
} from "@/features/admin/hooks/use-admin-users";

interface UserDetailModalProps {
  open: boolean;
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ar-SA");
}

/**
 * Admin detail modal for a user: profile header, aggregated stats,
 * active sessions, and recent activity.
 */
export function UserDetailModal({ open, user, onOpenChange }: UserDetailModalProps) {
  const userId = user?.user_id ?? null;
  const { data: stats } = useUserStats(userId);
  const { data: sessions, isLoading: sessionsLoading } = useUserSessions(userId);
  const { data: activities, isLoading: activityLoading } = useUserActivity(userId);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[85vh] overflow-y-auto">
        {user && (
          <>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.avatar ?? undefined}
                  alt={user.display_name}
                  fallback={user.display_name || user.username}
                  size="lg"
                />
                <div>
                  <ModalTitle>{user.display_name}</ModalTitle>
                  <ModalDescription>
                    @{user.username}
                    {user.email ? ` • ${user.email}` : ""}
                  </ModalDescription>
                </div>
              </div>
            </ModalHeader>

            <div className="flex flex-wrap gap-2">
              <Badge variant={user.is_admin ? "default" : "secondary"}>
                {user.is_admin ? "مدير" : "مشاهد"}
              </Badge>
              <Badge variant={user.is_blocked ? "destructive" : "default"}>
                {user.is_blocked ? "محظور" : "نشط"}
              </Badge>
              <Badge variant="secondary">انضم {formatDate(user.created_at)}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "أعمال اكتملت", value: stats?.watched_count ?? "…", icon: Film },
                { label: "قيد المشاهدة", value: stats?.in_progress_count ?? "…", icon: ListVideo },
                { label: "جلسات نشطة", value: stats?.active_sessions ?? "…", icon: Monitor },
                { label: "إجمالي الجلسات", value: stats?.total_sessions ?? "…", icon: Globe },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border-border flex flex-col items-center gap-1 rounded-lg border p-3 text-center"
                >
                  <item.icon className="text-muted-foreground h-4 w-4" />
                  <span className="text-lg font-bold">{item.value}</span>
                  <span className="text-muted-foreground text-xs">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Clock className="h-4 w-4" />
                الجلسات
              </h3>
              {sessionsLoading ? (
                <div className="bg-muted h-20 animate-pulse rounded-lg" />
              ) : sessions && sessions.length > 0 ? (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {s.os || s.user_agent || "جهاز غير معروف"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs" dir="ltr">
                          {s.ip_address}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={s.is_active ? "default" : "secondary"}>
                          {s.is_active ? "نشطة" : "منتهية"}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(s.last_active)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-border text-muted-foreground rounded-lg border p-3 text-sm">
                  لا توجد جلسات
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ActivityIcon className="h-4 w-4" />
                النشاط الأخير
              </h3>
              {activityLoading ? (
                <div className="bg-muted h-20 animate-pulse rounded-lg" />
              ) : activities && activities.length > 0 ? (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <div
                      key={a.id}
                      className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{a.action}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(a.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="border-border text-muted-foreground rounded-lg border p-3 text-sm">
                  لا يوجد نشاط مسجل
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إغلاق
              </Button>
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

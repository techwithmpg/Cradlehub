"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type StaffNoticesBellLinkProps = {
  staffId: string;
  branchId?: string | null;
  workspace: "staff" | "driver" | "utility" | "crm";
  href: string;
  className?: string;
  iconSize?: number;
  iconStrokeWidth?: number;
  badgeClassName?: string;
};

/**
 * Staff PWA header bell with live unread count and Supabase Realtime updates.
 * Automatically refreshes the active view and pops a toast when CRM or the
 * backend creates a new assignment/transition notice for this staff member.
 */
export function StaffNoticesBellLink({
  staffId,
  branchId,
  workspace,
  href,
  className,
  iconSize = 19,
  iconStrokeWidth = 1.9,
  badgeClassName = "bg-[#E25343] text-white",
}: StaffNoticesBellLinkProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!staffId) return;
    let active = true;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const loadUnreadCount = async () => {
      try {
        let query = supabase
          .from("workspace_notifications")
          .select("id", { count: "exact", head: true });

        if (workspace === "crm") {
          if (branchId) query = query.eq("branch_id", branchId);
          query = query.or(`recipient_staff_id.is.null,recipient_staff_id.eq.${staffId}`);
        } else {
          query = query.eq("recipient_staff_id", staffId);
        }

        const { count, error } = await query
          .eq("target_workspace", workspace)
          .eq("status", "unread")
          .is("resolved_at", null);

        if (active && !error && typeof count === "number") {
          setUnreadCount(count);
        }
      } catch {
        // Ignore transient count fetch errors
      }
    };

    void loadUnreadCount();

    const realtimeFilter =
      workspace === "crm"
        ? branchId
          ? `branch_id=eq.${branchId}`
          : "target_workspace=eq.crm"
        : `recipient_staff_id=eq.${staffId}`;

    const channel = supabase
      .channel(`staff-notices-bell:${workspace}:${staffId}:${branchId ?? "any"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_notifications",
          filter: realtimeFilter,
        },
        (payload) => {
          const row = (payload.new ?? payload.old ?? null) as {
            target_workspace?: string;
            recipient_staff_id?: string | null;
            branch_id?: string;
            title?: string;
            body?: string | null;
          } | null;
          if (row?.target_workspace && row.target_workspace !== workspace) return;
          if (workspace === "crm") {
            if (branchId && row?.branch_id && row.branch_id !== branchId) return;
            if (row?.recipient_staff_id && row.recipient_staff_id !== staffId) return;
          } else if (row?.recipient_staff_id && row.recipient_staff_id !== staffId) {
            return;
          }
          void loadUnreadCount();
          if (payload.eventType === "INSERT") {
            if (row && row.target_workspace === workspace && row.title) {
              toast(row.title, {
                description: row.body ?? undefined,
                duration: 8000,
                action: {
                  label: "View",
                  onClick: () => router.push(href),
                },
              });
            }
          }
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [staffId, branchId, workspace, href, router]);

  return (
    <Link
      href={href}
      aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
      className={`relative ${className ?? ""}`}
    >
      <Bell size={iconSize} strokeWidth={iconStrokeWidth} aria-hidden="true" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className={`absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4 shadow-xs ${badgeClassName}`}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

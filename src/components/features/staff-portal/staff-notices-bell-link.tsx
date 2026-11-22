"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type StaffNoticesBellLinkProps = {
  staffId: string;
  workspace: "staff" | "driver" | "utility";
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
    const supabase = createClient();

    const loadUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("workspace_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_staff_id", staffId)
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

    const channel = supabase
      .channel(`staff-notices-bell:${workspace}:${staffId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_notifications",
          filter: `recipient_staff_id=eq.${staffId}`,
        },
        (payload) => {
          void loadUnreadCount();
          if (payload.eventType === "INSERT") {
            const row = payload.new as {
              target_workspace?: string;
              title?: string;
              body?: string | null;
            } | null;
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
  }, [staffId, workspace, href, router]);

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

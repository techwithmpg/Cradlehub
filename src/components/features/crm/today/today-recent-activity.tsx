"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  CreditCard,
  Home,
  UserCheck,
} from "lucide-react";
import type { AttendanceScanFeedData } from "@/lib/attendance/types";
import type { CradleFlowBooking } from "@/lib/crm/cradle-flow";
import { formatCradleFlowMoney } from "@/lib/crm/cradle-flow";
import { formatAttendanceScanTime } from "@/lib/attendance/scan-feed";
import { cn } from "@/lib/utils";

type ActivityCategory = "all" | "bookings" | "payments" | "attendance" | "system";

type ActivityItem = {
  id: string;
  time: string;
  timestamp: number;
  category: "Booking" | "Payment" | "Attendance" | "System" | "Home Service";
  title: string;
  detail: string;
  status: string;
};

function formatBookingTime(timeStr?: string | null): string {
  if (!timeStr) return "Today";
  try {
    const [hRaw, mRaw] = timeStr.split(":").map(Number);
    const h = hRaw ?? 0;
    const m = mRaw ?? 0;
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  } catch {
    return timeStr;
  }
}

export function CradleFlowRecentActivity({
  bookings = [],
  attendance,
  notifications = [],
}: {
  bookings?: CradleFlowBooking[];
  attendance: AttendanceScanFeedData;
  notifications: { id: string; title: string; message?: string }[];
}) {
  const [activeTab, setActiveTab] = useState<ActivityCategory>("all");

  const items = useMemo(() => {
    const list: ActivityItem[] = [];

    // Real booking events
    for (const b of bookings) {
      const isHs = b.type === "home_service" || b.delivery_type === "home_service";
      const time = formatBookingTime(b.start_time);
      const bookingTimestamp = b.created_at ? new Date(b.created_at).getTime() : 0;

      // Booking creation / status event
      list.push({
        id: `booking-${b.id}`,
        time,
        timestamp: bookingTimestamp,
        category: isHs ? "Home Service" : "Booking",
        title: `${isHs ? "Home service booking" : "Booking"} — ${b.customer_name ?? "Guest"}`,
        detail: `${b.service_duration ? `${b.service_duration} min ` : ""}${b.service_name ?? "Service"}`,
        status:
          b.status === "pending" || b.status === "pending_crm_confirmation"
            ? "Needs front-desk review"
            : b.status === "confirmed"
              ? "Confirmed"
              : b.status === "in_progress"
                ? "In service"
                : "Completed",
      });

      // Real payment event (ONLY if actual payment was recorded)
      if (b.payment_status === "paid" || (Number(b.amount_paid ?? 0) > 0)) {
        list.push({
          id: `payment-${b.id}`,
          time,
          timestamp: bookingTimestamp + 1,
          category: "Payment",
          title: `Payment received — ${b.customer_name ?? "Guest"}`,
          detail: `${formatCradleFlowMoney(b.amount_paid ?? b.price_paid ?? 0)} via ${b.payment_method ?? "Cash"}`,
          status: b.payment_status === "paid" ? "Completed" : "Partial",
        });
      }
    }

    // Real attendance scans
    for (const scan of attendance.items) {
      const time = formatAttendanceScanTime(scan.occurredAt, scan.timezone);
      const isLate = scan.attendanceStatus === "late";
      const isOut = scan.eventType === "clock_out";
      const scanTimestamp = new Date(scan.occurredAt).getTime();

      list.push({
        id: `attendance-${scan.rootOperationId ?? scan.eventId}`,
        time,
        timestamp: scanTimestamp,
        category: "Attendance",
        title: `Staff ${isOut ? "check-out" : "check-in"} — ${scan.staffNickname || scan.staffName}`,
        detail: scan.branchName ?? "Attendance",
        status: isLate ? "Late" : isOut ? "Checked out" : "Checked in",
      });
    }

    // Real system notifications
    for (const notif of notifications) {
      list.push({
        id: `notif-${notif.id}`,
        time: "Today",
        timestamp: 1,
        category: "System",
        title: notif.title,
        detail: notif.message ?? "Needs front-desk review",
        status: "Needs review",
      });
    }

    // Sort descending by timestamp / time
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [bookings, attendance, notifications]);

  const filteredItems = useMemo(() => {
    if (activeTab === "all") return items;
    if (activeTab === "bookings") {
      return items.filter((i) => i.category === "Booking" || i.category === "Home Service");
    }
    if (activeTab === "payments") {
      return items.filter((i) => i.category === "Payment");
    }
    if (activeTab === "attendance") {
      return items.filter((i) => i.category === "Attendance");
    }
    if (activeTab === "system") {
      return items.filter((i) => i.category === "System");
    }
    return items;
  }, [items, activeTab]);

  const visibleItems = filteredItems.slice(0, 5);

  const getCategoryBadge = (cat: ActivityItem["category"]) => {
    switch (cat) {
      case "Booking":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200/60",
          icon: <Calendar className="size-3 text-emerald-700" />,
        };
      case "Payment":
        return {
          bg: "bg-teal-50 text-teal-800 border-teal-200/60",
          icon: <CreditCard className="size-3 text-teal-700" />,
        };
      case "Attendance":
        return {
          bg: "bg-sky-50 text-sky-800 border-sky-200/60",
          icon: <UserCheck className="size-3 text-sky-700" />,
        };
      case "Home Service":
        return {
          bg: "bg-orange-50 text-orange-800 border-orange-200/60",
          icon: <Home className="size-3 text-orange-700" />,
        };
      case "System":
      default:
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200/60",
          icon: <Bell className="size-3 text-amber-700" />,
        };
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs">
      {/* Header with Title, Filter Tabs, and View All */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-[var(--cs-text)]">Recent Activity</h2>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1" role="tablist">
          {[
            { key: "all", label: "All" },
            { key: "bookings", label: "Bookings" },
            { key: "payments", label: "Payments" },
            { key: "attendance", label: "Attendance" },
            { key: "system", label: "System" },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab.key as ActivityCategory)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700",
                  isSelected
                    ? "bg-[#0B472C] text-white shadow-xs"
                    : "bg-stone-50/80 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <Link
          href="/crm/bookings"
          className="text-xs font-semibold text-stone-500 hover:text-stone-800 transition shrink-0"
        >
          View all
        </Link>
      </div>

      {/* Activity Item List */}
      <div className="mt-3.5 divide-y divide-stone-100">
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => {
            const badge = getCategoryBadge(item.category);
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 py-2.5 text-xs transition hover:bg-stone-50/50 sm:flex-row sm:items-center sm:justify-between px-1"
              >
                {/* Left: Time + Icon + Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[11px] text-stone-400 w-16 shrink-0">
                    {item.time}
                  </span>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-stone-50 border border-stone-200/60">
                    {badge.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate font-bold text-[var(--cs-text)] block">
                      {item.title}
                    </span>
                  </div>
                </div>

                {/* Right: Detail + Category Badge + Status */}
                <div className="flex items-center gap-3 shrink-0 pl-16 sm:pl-0">
                  <span className="truncate text-stone-500 text-[11px] max-w-[180px]">
                    {item.detail}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                      badge.bg
                    )}
                  >
                    {item.category}
                  </span>
                  <span className="text-[11px] font-medium text-stone-600 min-w-[70px] text-right">
                    {item.status}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-6 text-center text-xs text-[var(--cs-text-muted)]">
            No activity recorded for this category yet today.
          </p>
        )}
      </div>
    </section>
  );
}

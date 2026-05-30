"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { updateWaitlistStatusAction } from "@/app/(dashboard)/crm/waitlist/actions";
import { firstRelation, daysSinceDate } from "./lib/customer-segments";
import { CalendarPlus } from "lucide-react";

export type WaitlistRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  visit_type: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  services: { name: string } | { name: string }[] | null;
};

interface WaitlistFollowupTableProps {
  rows: WaitlistRow[];
}

function deriveType(status: string): string {
  if (status === "waiting") return "Waitlist";
  if (status === "contacted") return "Follow-up";
  if (status === "converted") return "Converted";
  return "Waitlist";
}

function derivePriority(row: WaitlistRow): { label: string; className: string } {
  if (row.status === "converted") return { label: "Low", className: "bg-[var(--cs-success-bg)] text-[var(--cs-success)]" };
  if (row.status === "cancelled" || row.status === "expired") return { label: "Low", className: "bg-[var(--cs-neutral-bg)] text-[var(--cs-neutral)]" };
  const daysWaiting = daysSinceDate(row.created_at);
  if (daysWaiting > 3) return { label: "High", className: "bg-red-50 text-red-700" };
  if (daysWaiting > 1) return { label: "Medium", className: "bg-amber-50 text-amber-700" };
  return { label: "Low", className: "bg-[var(--cs-success-bg)] text-[var(--cs-success)]" };
}

function WaitlistActionButton({
  row,
  target,
  label,
  variant = "secondary",
}: {
  row: WaitlistRow;
  target: string;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      const result = await updateWaitlistStatusAction({ requestId: row.id, status: target as "waiting" | "contacted" | "converted" | "expired" | "cancelled" });
      if (result.ok) {
        toast.success(`${label} updated.`);
      } else {
        toast.error(result.error ?? "Could not update request.");
      }
    });
  }

  const variantClass =
    variant === "primary"
      ? "cs-btn cs-btn-primary cs-btn-sm"
      : variant === "ghost"
      ? "cs-btn cs-btn-ghost cs-btn-sm"
      : "cs-btn cs-btn-secondary cs-btn-sm";

  return (
    <button onClick={handleClick} disabled={isPending} className={cn(variantClass, "inline-flex items-center gap-1")}>
      {isPending ? "…" : label}
    </button>
  );
}

export function WaitlistFollowupTable({ rows }: WaitlistFollowupTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No waitlist or follow-up items"
        description="Walk-in requests and callbacks will appear here."
        icon="📋"
      />
    );
  }

  return (
    <div className="cs-table-wrap">
      <table className="cs-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th className="hidden sm:table-cell">Type</th>
            <th className="hidden md:table-cell">Service</th>
            <th>Date</th>
            <th className="hidden lg:table-cell">Status</th>
            <th>Priority</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const svc = firstRelation(row.services);
            const type = deriveType(row.status);
            const priority = derivePriority(row);
            return (
              <tr
                key={row.id}
                className="transition-colors"
              >
                <td>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--cs-text)]">
                      {row.customer_name}
                    </div>
                    <div className="text-[11px] text-[var(--cs-text-muted)]">
                      {row.customer_phone}
                    </div>
                  </div>
                </td>
                <td className="hidden sm:table-cell">
                  <span className="inline-flex items-center rounded-md bg-[var(--cs-info-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--cs-info)]">
                    {type}
                  </span>
                </td>
                <td className="hidden md:table-cell">
                  <div className="text-xs text-[var(--cs-text-secondary)]">
                    {svc?.name ?? "—"}
                  </div>
                  {row.visit_type && (
                    <div className="text-[11px] text-[var(--cs-text-muted)]">
                      {row.visit_type === "home_service" ? "Home" : "In-Spa"}
                    </div>
                  )}
                </td>
                <td>
                  <div className="text-xs text-[var(--cs-text-secondary)]">
                    {row.preferred_date
                      ? new Date(row.preferred_date + "T00:00:00").toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </div>
                  {row.preferred_time && (
                    <div className="text-[11px] text-[var(--cs-text-muted)]">
                      {row.preferred_time.substring(0, 5)}
                    </div>
                  )}
                </td>
                <td className="hidden lg:table-cell">
                  <span className="inline-flex items-center rounded-md bg-[var(--cs-sand-mist)] px-2 py-0.5 text-[11px] font-medium capitalize text-[var(--cs-sand)]">
                    {row.status}
                  </span>
                </td>
                <td>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                      priority.className
                    )}
                  >
                    {priority.label}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {row.status === "waiting" && (
                      <>
                        <WaitlistActionButton row={row} target="contacted" label="Follow Up" />
                        <Link
                          href={`/crm/bookings/new?phone=${encodeURIComponent(row.customer_phone)}&name=${encodeURIComponent(row.customer_name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="cs-btn cs-btn-primary cs-btn-sm inline-flex items-center gap-1"
                        >
                          <CalendarPlus size={12} />
                          <span className="hidden sm:inline">Book</span>
                        </Link>
                      </>
                    )}
                    {row.status === "contacted" && (
                      <>
                        <Link
                          href={`/crm/bookings/new?phone=${encodeURIComponent(row.customer_phone)}&name=${encodeURIComponent(row.customer_name)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="cs-btn cs-btn-primary cs-btn-sm inline-flex items-center gap-1"
                        >
                          <CalendarPlus size={12} />
                          <span className="hidden sm:inline">Book</span>
                        </Link>
                        <WaitlistActionButton row={row} target="converted" label="Convert" />
                        <WaitlistActionButton row={row} target="expired" label="Expire" variant="ghost" />
                      </>
                    )}
                    {(row.status === "waiting" || row.status === "contacted") && (
                      <WaitlistActionButton row={row} target="cancelled" label="Remove" variant="ghost" />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

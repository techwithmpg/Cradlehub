"use client";

import { cn } from "@/lib/utils";

import { EmptyState } from "@/components/features/dashboard/empty-state";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import { daysSinceDate, initials } from "./lib/customer-segments";
import type { CustomerListItem } from "./lib/customer-segments";
import { safeFormatDate } from "./lib/customer-formatters";
import { CalendarPlus, Eye } from "lucide-react";

interface LapsedClientsTableProps {
  rows: CustomerListItem[];
  selectedId?: string | null;
  onSelect: (customer: CustomerListItem) => void;
}

export function LapsedClientsTable({ rows, selectedId, onSelect }: LapsedClientsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No lapsed clients"
        description="All customers have visited within the last 30 days. Great job!"
        icon="🎉"
      />
    );
  }

  return (
    <div className="cs-table-wrap">
      <table className="cs-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Last Visit</th>
            <th className="hidden md:table-cell">Days Inactive</th>
            <th className="hidden lg:table-cell">Recovery Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((customer) => {
            const isSelected = customer.id === selectedId;
            const days = customer.last_booking_date ? daysSinceDate(customer.last_booking_date) : 0;
            const status = days > 60 ? "Not Contacted" : days > 30 ? "Follow-up Sent" : "Contacted";
            const statusColor =
              status === "Not Contacted"
                ? "bg-[#FEF3C7] text-[#92400E]"
                : status === "Follow-up Sent"
                ? "bg-[var(--cs-warning-bg)] text-[var(--cs-warning)]"
                : "bg-[var(--cs-success-bg)] text-[var(--cs-success)]";
            return (
              <tr
                key={customer.id}
                onClick={() => onSelect(customer)}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected && "bg-[var(--cs-sand-tint)]"
                )}
              >
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-error-bg)] text-xs font-semibold text-[var(--cs-error-text)]">
                      {initials(customer.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--cs-text)]">
                        {customer.full_name}
                      </div>
                      <div className="text-[11px] text-[var(--cs-text-muted)]">
                        {customer.phone}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="text-xs text-[var(--cs-text-secondary)]">
                    {safeFormatDate(customer.last_booking_date)}
                  </div>
                </td>
                <td className="hidden md:table-cell">
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      days > 90
                        ? "text-red-600"
                        : days > 60
                        ? "text-amber-600"
                        : "text-[var(--cs-text-muted)]"
                    )}
                  >
                    {days}
                  </div>
                  <div className="text-[11px] text-[var(--cs-text-muted)]">days</div>
                </td>
                <td className="hidden lg:table-cell">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                      statusColor
                    )}
                  >
                    {status}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(customer);
                      }}
                      className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1"
                    >
                      <Eye size={12} />
                      <span className="hidden sm:inline">View</span>
                    </button>
                    <OpenAdministrativeBookingButton
                      mode="standard_future"
                      customerId={customer.id}
                      onClick={(e) => e.stopPropagation()}
                      className="cs-btn cs-btn-primary cs-btn-sm inline-flex items-center gap-1"
                    >
                      <CalendarPlus size={12} />
                      <span className="hidden sm:inline">Book</span>
                    </OpenAdministrativeBookingButton>
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

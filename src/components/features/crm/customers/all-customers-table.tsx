"use client";

import Link from "next/link";
import { CrmTableShell } from "@/components/features/crm/premium/crm-table-shell";
import { CrmTableRow } from "@/components/features/crm/premium/crm-table-row";
import { CrmEmptyState } from "@/components/features/crm/premium/crm-empty-state";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import type { CrmStatusVariant } from "@/components/features/crm/premium/crm-status-badge";
import { computeSegment, daysSinceDate, initials } from "./lib/customer-segments";
import type { CustomerListItem, Segment } from "./lib/customer-segments";
import { safeFormatDate } from "./lib/customer-formatters";
import { Eye, CalendarPlus } from "lucide-react";

interface AllCustomersTableProps {
  rows: CustomerListItem[];
  selectedId?: string | null;
  onSelect: (customer: CustomerListItem) => void;
}

const SEGMENT_TO_VARIANT: Record<NonNullable<Segment>, CrmStatusVariant> = {
  new:    "new",
  repeat: "repeat",
  lapsed: "lapsed",
  vip:    "vip",
};

export function AllCustomersTable({ rows, selectedId, onSelect }: AllCustomersTableProps) {
  return (
    <CrmTableShell
      isEmpty={rows.length === 0}
      emptyState={
        <CrmEmptyState
          variant="search"
          title="No customers found"
          description="Try adjusting your search or filters."
        />
      }
    >
      <table className="cs-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th className="hidden sm:table-cell">Phone / Email</th>
            <th>Last Visit</th>
            <th className="hidden md:table-cell">Visits</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((customer, i) => {
            const segment = computeSegment(customer);
            const statusVariant = segment ? SEGMENT_TO_VARIANT[segment] : null;
            const isSelected = customer.id === selectedId;

            return (
              <CrmTableRow
                key={customer.id}
                index={i}
                isSelected={isSelected}
                onClick={() => onSelect(customer)}
              >
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-sand-mist)] text-xs font-semibold text-[var(--cs-sand)]">
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
                <td className="hidden sm:table-cell">
                  <div className="text-xs text-[var(--cs-text-secondary)]">
                    {customer.phone}
                  </div>
                  {customer.email && (
                    <div className="text-[11px] text-[var(--cs-text-muted)]">
                      {customer.email}
                    </div>
                  )}
                </td>
                <td>
                  <div className="text-xs text-[var(--cs-text-secondary)]">
                    {safeFormatDate(customer.last_booking_date)}
                  </div>
                  {customer.last_booking_date && (
                    <div className="text-[11px] text-[var(--cs-text-muted)]">
                      {formatDaysSince(daysSinceDate(customer.last_booking_date))}
                    </div>
                  )}
                </td>
                <td className="hidden md:table-cell">
                  <div className="text-xs font-medium text-[var(--cs-text)]">
                    {customer.total_bookings}
                  </div>
                </td>
                <td>
                  {statusVariant ? (
                    <CrmStatusBadge variant={statusVariant} />
                  ) : (
                    <span className="text-xs text-[var(--cs-text-muted)]">—</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(customer);
                      }}
                      className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1"
                      title="Quick view"
                    >
                      <Eye size={12} />
                      <span className="hidden sm:inline">View</span>
                    </button>
                    <Link
                      href={`/crm/bookings/new?customerId=${customer.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="cs-btn cs-btn-primary cs-btn-sm inline-flex items-center gap-1"
                    >
                      <CalendarPlus size={12} />
                      <span className="hidden sm:inline">Book</span>
                    </Link>
                  </div>
                </td>
              </CrmTableRow>
            );
          })}
        </tbody>
      </table>
    </CrmTableShell>
  );
}

function formatDaysSince(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

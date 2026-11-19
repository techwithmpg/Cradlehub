"use client";

import { CalendarClock, RotateCcw, Search, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { CrmSectionCard, CrmStatCard } from "@/components/features/crm/shared/crm-cards";
import { CradleFlowTicket } from "./cradle-flow-ticket";
import {
  CRADLE_FLOW_FILTERS,
  getCradleFlowDisplayCounts,
  groupCradleFlowBookings,
  matchesCradleFlowGroupFilter,
  matchesCradleFlowGroupSearch,
  type CradleFlowGroup,
  type CradleFlowFilter,
} from "./cradle-flow-display";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import { type CradleFlowBooking } from "@/lib/crm/cradle-flow";
import type { PredictiveConflictItem } from "@/lib/optimization/types";
import { cn } from "@/lib/utils";

function EmptyContextCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <CrmStatCard
      title={label}
      value={value}
      icon={icon}
      href={href}
      tone="neutral"
      compact
    />
  );
}

export function CradleFlowWorkflow({
  bookings,
  businessDate,
  staffAvailable,
  pendingFollowUps,
  pendingBooking,
  onOpen,
  onOpenGroup,
  onPrimary,
  onAssignRoom,
  onAssignTherapist,
  activeBookingId,
  bookingConflictsById,
  filter,
  onFilterChange,
}: {
  bookings: CradleFlowBooking[];
  businessDate: string;
  staffAvailable: number;
  pendingFollowUps: number;
  pendingBooking?: CradleFlowBooking | null;
  onOpen: (booking: CradleFlowBooking) => void;
  onOpenGroup?: (group: CradleFlowGroup) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
  onAssignRoom: (booking: CradleFlowBooking) => void;
  onAssignTherapist: (booking: CradleFlowBooking) => void;
  activeBookingId: string | null;
  bookingConflictsById?: Map<string, PredictiveConflictItem[]>;
  filter: CradleFlowFilter;
  onFilterChange: (filter: CradleFlowFilter) => void;
}) {
  const { openBookingModal } = useAdministrativeBookingModal();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupCradleFlowBookings(bookings), [bookings]);
  const counts = useMemo(
    () => getCradleFlowDisplayCounts(bookings, businessDate),
    [bookings, businessDate]
  );
  const upcomingCount = counts.upcoming;
  const visible = useMemo(
    () =>
      groups.filter(
        (group) =>
          matchesCradleFlowGroupFilter(group, filter, businessDate) &&
          matchesCradleFlowGroupSearch(group, query)
      ),
    [groups, query, filter, businessDate]
  );

  return (
    <CrmSectionCard
      title={
        <>
          Active Service Workflow{" "}
          <span className="font-medium text-[var(--cs-text-muted)]">({counts.all})</span>
        </>
      }
      description="Manage today’s customer visits and service flow."
      noPadding
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {pendingBooking ? (
            <button
              type="button"
              onClick={() => onOpen(pendingBooking)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-[var(--cs-sand)] bg-[var(--cs-sand-tint)] px-3 text-xs font-bold text-[var(--cs-sand-dark)] transition hover:bg-[#F5EBD6]"
            >
              <RotateCcw className="size-3.5" />
              <span>Resume pending · {pendingBooking.customer_name ?? "Unfinished booking"}</span>
            </button>
          ) : null}
          <label className="relative block w-full sm:w-68">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Customer, phone, booking ID, therapist…"
              className="h-9 w-full rounded-xl border border-[var(--cs-border)] bg-[#FAF8F5] pl-9 pr-3 text-sm text-[var(--cs-text)] outline-none focus:border-[#1F4E33]"
            />
          </label>
        </div>
      }
    >
      <div className="border-b border-[var(--cs-border-soft)] bg-[#FAF8F5]/60 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Service status">
          {CRADLE_FLOW_FILTERS.map((item) => {
            const count = counts[item.key];
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => onFilterChange(item.key)}
                className={cn(
                  "flex h-8 items-center justify-between gap-2 rounded-lg border px-2.5 text-[11px] font-bold transition sm:justify-center",
                  filter === item.key
                    ? "border-[#1F4E33] bg-[#1F4E33] text-white"
                    : "border-[var(--cs-border-soft)] bg-white text-[var(--cs-text-secondary)] hover:border-[#CFE5D6]"
                )}
              >
                {item.label}
                <span
                  className={filter === item.key ? "text-white/75" : "text-[var(--cs-text-muted)]"}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-60 p-3 sm:p-4">
        {visible.length > 0 ? (
          <div className="grid gap-2.5">
            {visible.map((group) => {
              const seenKeys = new Set<string>();
              const groupConflicts: PredictiveConflictItem[] = [];
              for (const line of group.lines) {
                for (const item of bookingConflictsById?.get(line.id) ?? []) {
                  if (!seenKeys.has(item.dedupe_key)) {
                    seenKeys.add(item.dedupe_key);
                    groupConflicts.push(item);
                  }
                }
              }
              return (
                <CradleFlowTicket
                  key={group.displayId}
                  booking={group.lines[0]!}
                  group={group}
                  businessDate={businessDate}
                  onOpen={onOpen}
                  onOpenGroup={onOpenGroup}
                  onPrimary={onPrimary}
                  onAssignRoom={onAssignRoom}
                  onAssignTherapist={onAssignTherapist}
                  primaryPending={activeBookingId === group.primaryBookingId}
                  optimizationConflicts={groupConflicts}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center">
            <div className="w-full max-w-2xl text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#EEF7F1] text-[#1F4E33] ring-1 ring-[#CFE5D6]">
                <CalendarClock className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-extrabold text-[var(--cs-text)]">
                {query
                  ? "No matching bookings"
                  : `No ${CRADLE_FLOW_FILTERS.find((item) => item.key === filter)?.label.toLowerCase()} bookings`}
              </h3>
              <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                {query
                  ? "Try a customer name, phone number, booking ID, therapist, or address."
                  : "Start with a new booking or review the supporting work below."}
              </p>
              {!query && filter === "all" ? (
                <button
                  type="button"
                  onClick={() => openBookingModal({ mode: "walkin" })}
                  className="mt-4 h-10 rounded-xl bg-[#1F4E33] px-5 text-sm font-bold text-white transition hover:bg-[#163B26]"
                >
                  New Booking
                </button>
              ) : null}
              {!query ? (
                <div className="mt-5 grid gap-2.5 text-left sm:grid-cols-3">
                  <EmptyContextCard
                    icon={<CalendarClock className="size-4" />}
                    label="Upcoming"
                    value={`${upcomingCount} booking${upcomingCount === 1 ? "" : "s"}`}
                    href="/crm/bookings"
                  />
                  <EmptyContextCard
                    icon={<UserRoundCheck className="size-4" />}
                    label="Staff available"
                    value={`${staffAvailable} now`}
                    href="/crm/schedule"
                  />
                  <EmptyContextCard
                    icon={<UsersRound className="size-4" />}
                    label="Follow-ups"
                    value={`${pendingFollowUps} pending`}
                    href="/crm/customers?tab=followup"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </CrmSectionCard>
  );
}

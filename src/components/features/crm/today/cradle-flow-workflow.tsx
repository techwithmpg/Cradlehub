"use client";

import Link from "next/link";
import { CalendarClock, Search, UserRoundCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { CradleFlowTicket } from "./cradle-flow-ticket";
import { useAdministrativeBookingModal } from "@/components/features/bookings/administrative-booking-modal-provider";
import {
  CRADLE_FLOW_STAGES,
  getCradleFlowStage,
  matchesCradleFlowSearch,
  type CradleFlowBooking,
  type CradleFlowStage,
} from "@/lib/crm/cradle-flow";
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
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] p-3 hover:border-[var(--cs-border-strong)]"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-[var(--cs-surface)] text-[var(--cs-sand-dark)]">
        {icon}
      </span>
      <span>
        <span className="block text-[11px] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
          {label}
        </span>
        <span className="mt-0.5 block text-sm font-semibold text-[var(--cs-text)]">{value}</span>
      </span>
    </Link>
  );
}

export function CradleFlowWorkflow({
  bookings,
  staffAvailable,
  pendingFollowUps,
  onOpen,
  onPrimary,
}: {
  bookings: CradleFlowBooking[];
  staffAvailable: number;
  pendingFollowUps: number;
  onOpen: (booking: CradleFlowBooking) => void;
  onPrimary: (booking: CradleFlowBooking) => void;
}) {
  const { openBookingModal } = useAdministrativeBookingModal();
  const [stage, setStage] = useState<CradleFlowStage>("waiting");
  const [query, setQuery] = useState("");
  const upcomingCount = bookings.filter(
    (booking) => getCradleFlowStage(booking) === "waiting"
  ).length;
  const visible = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          getCradleFlowStage(booking) === stage && matchesCradleFlowSearch(booking, query)
      ),
    [bookings, query, stage]
  );

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
      <header className="border-b border-[var(--cs-border-soft)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-[var(--cs-text)]">
              Active Service Workflow
            </h2>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              One clear next action for every customer visit.
            </p>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--cs-text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Customer, phone, booking ID, therapist…"
              className="h-10 w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] pl-9 pr-3 text-sm text-[var(--cs-text)] outline-none focus:border-[var(--cs-sand)]"
            />
          </label>
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          role="tablist"
          aria-label="Service status"
        >
          {CRADLE_FLOW_STAGES.map((item) => {
            const count = bookings.filter(
              (booking) => getCradleFlowStage(booking) === item.key
            ).length;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={stage === item.key}
                onClick={() => setStage(item.key)}
                className={cn(
                  "flex h-9 items-center justify-between gap-2 rounded-lg border px-3 text-xs font-bold sm:justify-center",
                  stage === item.key
                    ? "border-[#164b36] bg-[#164b36] text-white"
                    : "border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)]"
                )}
              >
                {item.label}
                <span
                  className={stage === item.key ? "text-white/70" : "text-[var(--cs-text-muted)]"}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-72 p-4 sm:p-5">
        {visible.length > 0 ? (
          <div className="grid gap-3">
            {visible.map((booking) => (
              <CradleFlowTicket
                key={booking.id}
                booking={booking}
                onOpen={onOpen}
                onPrimary={onPrimary}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center">
            <div className="w-full max-w-2xl text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
                <CalendarClock className="size-5" />
              </span>
              <h3 className="mt-3 text-base font-extrabold text-[var(--cs-text)]">
                {query
                  ? "No matching bookings"
                  : `No ${CRADLE_FLOW_STAGES.find((item) => item.key === stage)?.label.toLowerCase()} bookings`}
              </h3>
              <p className="mt-1 text-sm text-[var(--cs-text-muted)]">
                {query
                  ? "Try a customer name, phone number, booking ID, therapist, or address."
                  : "Start with a new booking or review the supporting work below."}
              </p>
              {!query && stage === "waiting" ? (
                <button
                  type="button"
                  onClick={() => openBookingModal({ mode: "walkin" })}
                  className="mt-4 h-10 rounded-lg bg-[#164b36] px-5 text-sm font-bold text-white"
                >
                  New Booking
                </button>
              ) : null}
              {!query ? (
                <div className="mt-5 grid gap-2 text-left sm:grid-cols-3">
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
    </section>
  );
}

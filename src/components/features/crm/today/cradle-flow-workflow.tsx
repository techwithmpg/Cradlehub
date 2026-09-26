"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Search, SlidersHorizontal } from "lucide-react";
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

export function CradleFlowWorkflow({
  bookings,
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

  const visible = useMemo(
    () =>
      bookings.filter(
        (booking) =>
          getCradleFlowStage(booking) === stage && matchesCradleFlowSearch(booking, query)
      ),
    [bookings, query, stage]
  );

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-xs xl:h-full xl:min-h-0">
      {/* Top Header: Title & Subtitle + Search (Non-scrolling header) */}
      <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[var(--cs-text)]">
            Active Service Workflow
          </h2>
          <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
            Manage today’s customers from check-in to completion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative block w-full sm:w-64 md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Customer, phone, booking ID, therapist..."
              className="h-8.5 w-full rounded-lg border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]/40 pl-8 pr-3 text-xs text-[var(--cs-text)] outline-none transition placeholder:text-[var(--cs-text-muted)] focus:border-stone-400 focus:bg-white"
            />
          </label>
          <button
            type="button"
            className="flex size-8.5 shrink-0 items-center justify-center rounded-lg border border-[var(--cs-border-soft)] text-stone-400 hover:bg-stone-50 hover:text-stone-700 transition"
            aria-label="Filter bookings"
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Stage Status Tabs (Non-scrolling tabs) */}
      <div
        className="shrink-0 mt-3.5 flex flex-wrap items-center gap-1.5 border-b border-[var(--cs-border-soft)] pb-3"
        role="tablist"
        aria-label="Service status tabs"
      >
        {CRADLE_FLOW_STAGES.map((item) => {
          const count = bookings.filter(
            (booking) => getCradleFlowStage(booking) === item.key
          ).length;
          const isSelected = stage === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setStage(item.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700",
                isSelected
                  ? "bg-[#0B472C] text-white shadow-xs"
                  : "bg-stone-50/80 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                  isSelected ? "bg-white/20 text-white" : "text-stone-400"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Booking Row List — Internal Scroll Container */}
      <div className="mt-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
        {visible.length > 0 ? (
          <div className="space-y-2">
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
          <div className="flex h-full min-h-48 flex-col items-center justify-center p-6 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-500">
              <CalendarClock className="size-5" />
            </span>
            <h3 className="mt-2.5 text-sm font-bold text-[var(--cs-text)]">
              {query
                ? "No matching bookings"
                : `No ${CRADLE_FLOW_STAGES.find((item) => item.key === stage)?.label.toLowerCase()} bookings`}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--cs-text-muted)]">
              {query
                ? "Try searching with a customer name, phone number, or therapist."
                : "New customer visits and bookings will appear here."}
            </p>
            {!query && stage === "waiting" ? (
              <button
                type="button"
                onClick={() => openBookingModal({ mode: "walkin" })}
                className="mt-3.5 inline-flex h-8.5 items-center justify-center rounded-lg bg-[#0B472C] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#083823]"
              >
                New Booking
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

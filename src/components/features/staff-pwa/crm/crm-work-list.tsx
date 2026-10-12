"use client";

import { ClipboardList } from "lucide-react";
import {
  StaffCard,
  StaffEmptyState,
  StaffFeedback,
  StaffScreen,
  StaffScreenHeader,
  StaffSegmentedControl,
} from "@/components/features/staff-pwa/native-foundation";
import {
  StaffSnapshotRecorder,
  useStaffSafeMemory,
} from "@/components/features/staff-pwa/safe-memory";
import {
  crmBookingCounts,
  filterCrmBookings,
  type CrmBookingFilter,
} from "@/lib/staff-pwa/crm-model";
import type { CrmMobileRuntime } from "@/lib/staff-pwa/crm-runtime";
import type { StaffWorkResult } from "@/lib/staff-pwa/work-model";
import { CrmBookingRow } from "./crm-booking-row";

const filters: readonly { value: CrmBookingFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

function isFilter(value: string | null): value is CrmBookingFilter {
  return filters.some((option) => option.value === value);
}

export function CrmWorkList({
  runtime,
  work,
}: {
  runtime: CrmMobileRuntime | null;
  work: StaffWorkResult;
}) {
  const memory = useStaffSafeMemory();
  const saved = memory?.readPreference("crmWorkFilter") ?? null;
  const filter: CrmBookingFilter = isFilter(saved) ? saved : "today";
  const visible = runtime ? filterCrmBookings(runtime.bookings, runtime.date, filter) : [];
  const counts = runtime ? crmBookingCounts(runtime.bookings, runtime.date) : null;

  return (
    <StaffScreen>
      {runtime && !runtime.bookingError && runtime.canViewBookings && counts ? (
        <StaffSnapshotRecorder
          snapshot={{
            screen: "crmWork",
            label: "Front Desk work",
            counts: [
              { label: "Today shown", value: counts.today },
              { label: "Attention", value: work.items.length },
            ],
          }}
        />
      ) : null}
      <StaffScreenHeader title="Work" subtitle="Branch bookings and operational attention" />

      {work.errors.map((error) => (
        <StaffFeedback key={error} error className="mb-3">
          {error}
        </StaffFeedback>
      ))}
      {work.items.length ? (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-[#163a2b]">Needs attention</h2>
          <div className="space-y-3">
            {work.items.slice(0, 12).map((item) => (
              <StaffCard key={`${item.source}:${item.id}`} className="p-4">
                <p className="text-sm font-semibold text-[#20342c]">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#65746b]">{item.detail}</p>
                <p className="mt-2 text-[11px] text-[#76501a]">
                  Review and make changes in the authorized CRM workspace.
                </p>
              </StaffCard>
            ))}
          </div>
          {work.items.length > 12 ? (
            <p className="mt-2 text-xs text-[#65746b]">
              Showing 12 of {work.items.length} attention items.
            </p>
          ) : null}
        </section>
      ) : !work.errors.length ? (
        <StaffEmptyState
          icon={<ClipboardList size={20} />}
          title="No work needs attention"
          description="New booking and workflow items appear here."
        />
      ) : null}

      {runtime?.canViewBookings ? (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-[#163a2b]">Bookings</h2>
          <StaffSegmentedControl
            options={filters}
            value={filter}
            onChange={(next) => memory?.writePreference("crmWorkFilter", next)}
            label="Booking date filter"
          />
          {!runtime.bookingError ? (
            visible.length ? (
              <StaffCard className="mt-4 overflow-hidden">
                {visible.map((booking) => (
                  <CrmBookingRow
                    key={booking.id}
                    booking={booking}
                    showDate={filter === "upcoming"}
                  />
                ))}
              </StaffCard>
            ) : (
              <div className="mt-4">
                <StaffEmptyState
                  title="No bookings in this view"
                  description="Choose another date filter to see available bookings."
                />
              </div>
            )
          ) : (
            <StaffFeedback error className="mt-4">
              {runtime.bookingError}
            </StaffFeedback>
          )}
          {runtime.truncated ? (
            <StaffFeedback className="mt-3">
              Showing the first 120 bookings in the next 14 days. Open the CRM workspace for the
              full list.
            </StaffFeedback>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-[#65746b]">
            Booking status is read-only here. Payment, check-in, and booking changes stay in the
            authorized CRM workflow.
          </p>
        </section>
      ) : runtime ? (
        <StaffFeedback className="mt-5">
          Booking details are available to authorized Front Desk roles.
        </StaffFeedback>
      ) : (
        <StaffFeedback error className="mt-5">
          Booking schedule is unavailable. Refresh when your connection returns.
        </StaffFeedback>
      )}
    </StaffScreen>
  );
}

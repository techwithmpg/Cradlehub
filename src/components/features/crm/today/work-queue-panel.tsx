"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Copy, ExternalLink, MoreHorizontal, RefreshCw } from "lucide-react";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { DriverAssignMenu, type AvailableDriver } from "@/components/features/control-console/driver-assign-menu";
import type { EtaRefreshResult } from "@/lib/actions/eta-actions";
import {
  getWorkQueueNextAction,
  type WorkQueueActionCategory,
  type WorkQueuePrimaryKind,
} from "@/lib/crm/work-queue-next-actions";
import type { ControlBooking } from "@/components/features/control-console/types";

const FILTER_PARAM = "filter";

export type WorkQueueFilterKey = "all" | "confirmations" | "follow-up" | "exceptions";
export type WorkQueueBooking = ControlBooking & {
  booking_date: string;
};

type MutationAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;
type TrackingLinkAction = (input: unknown) => Promise<{ ok: boolean; message?: string; error?: string }>;

const FILTERS: { key: WorkQueueFilterKey; label: string; category?: WorkQueueActionCategory }[] = [
  { key: "all", label: "All" },
  { key: "confirmations", label: "Confirmations", category: "confirmation" },
  { key: "follow-up", label: "Follow-up", category: "follow_up" },
  { key: "exceptions", label: "Exceptions", category: "exception" },
];

function getFilterFromSearchParams(searchParams: URLSearchParams): WorkQueueFilterKey {
  const raw = searchParams.get(FILTER_PARAM);
  return FILTERS.some((filter) => filter.key === raw) ? (raw as WorkQueueFilterKey) : "all";
}

function formatTime(time: string): string {
  const [hoursRaw, minutesRaw] = time.split(":").map(Number);
  const hours = hoursRaw ?? 0;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutesRaw ?? 0).padStart(2, "0")} ${suffix}`;
}

function formatBookingType(type: string): string {
  if (type === "home_service") return "Home service";
  if (type === "walk_in" || type === "walkin") return "Walk-in";
  return "Online booking";
}

function formatSource(type: string): string {
  if (type === "walk_in" || type === "walkin") return "Front desk";
  if (type === "home_service") return "Home service";
  return "Online";
}

function buildBookingHref(bookingId: string): string {
  return `/crm/bookings?bookingId=${bookingId}`;
}

function getActionTone(category: WorkQueueActionCategory): { bg: string; border: string; color: string } {
  if (category === "exception") {
    return { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B" };
  }
  if (category === "confirmation") {
    return { bg: "#EEF0F8", border: "#D8DEF4", color: "#1A2A5A" };
  }
  if (category === "follow_up") {
    return { bg: "#FFF7ED", border: "#FED7AA", color: "#92400E" };
  }
  if (category === "closed") {
    return { bg: "#F3F4F6", border: "#E5E7EB", color: "#4B5563" };
  }
  return { bg: "var(--cs-sand-mist)", border: "var(--cs-border-soft)", color: "var(--cs-sand)" };
}

function isPrimaryKind(actionKind: WorkQueuePrimaryKind, expected: WorkQueuePrimaryKind): boolean {
  return actionKind === expected;
}

function PrimaryAction({
  booking,
  primaryKind,
  primaryLabel,
  viewerRole,
  paymentAction,
  statusAction,
  assignDriverAction,
  availableDrivers,
}: {
  booking: WorkQueueBooking;
  primaryKind: WorkQueuePrimaryKind;
  primaryLabel: string;
  viewerRole: string;
  paymentAction?: MutationAction;
  statusAction?: MutationAction;
  assignDriverAction?: MutationAction;
  availableDrivers?: AvailableDriver[];
}) {
  if (primaryKind === "payment" && paymentAction) {
    return (
      <PaymentActionMenu
        bookingId={booking.id}
        paymentStatus={booking.payment_status ?? "unpaid"}
        paymentMethod={booking.payment_method ?? "pay_on_site"}
        amountPaid={booking.amount_paid ?? 0}
        pricePaid={booking.price_paid ?? 0}
        paymentAction={paymentAction}
        triggerLabel={primaryLabel}
        triggerVariant="panelSecondary"
      />
    );
  }

  if (primaryKind === "status" && statusAction) {
    return (
      <BookingActionMenu
        bookingId={booking.id}
        currentStatus={booking.status}
        userRole={viewerRole}
        statusAction={statusAction}
        actionScope="status"
        triggerLabel={primaryLabel}
        triggerVariant="panelSecondary"
        emptyBehavior="disabled"
      />
    );
  }

  if (primaryKind === "driver" && assignDriverAction && availableDrivers) {
    return (
      <DriverAssignMenu
        bookingId={booking.id}
        currentDriverId={booking.driver_id}
        currentDriverName={booking.driver_name}
        availableDrivers={availableDrivers}
        assignDriverAction={assignDriverAction}
      />
    );
  }

  return (
    <Link href={buildBookingHref(booking.id)} style={primaryLinkStyle}>
      {primaryLabel}
    </Link>
  );
}

function TrackingCopyButton({
  bookingId,
  existingMessage,
  getTrackingLinkAction,
}: {
  bookingId: string;
  existingMessage?: string | null;
  getTrackingLinkAction: TrackingLinkAction;
}) {
  const [label, setLabel] = useState(existingMessage ? "Copy tracking" : "Create tracking");
  const [isPending, startTransition] = useTransition();

  function copyMessage(message: string) {
    navigator.clipboard
      .writeText(message)
      .then(() => {
        setLabel("Copied");
        window.setTimeout(() => setLabel(existingMessage ? "Copy tracking" : "Create tracking"), 2500);
      })
      .catch(() => {
        setLabel("Copy failed");
        window.setTimeout(() => setLabel(existingMessage ? "Copy tracking" : "Create tracking"), 2500);
      });
  }

  function handleClick() {
    if (isPending) return;
    if (existingMessage) {
      copyMessage(existingMessage);
      return;
    }

    setLabel("Creating");
    startTransition(async () => {
      const result = await getTrackingLinkAction({ bookingId });
      if (result.ok && result.message) {
        copyMessage(result.message);
      } else {
        setLabel("Unavailable");
        window.setTimeout(() => setLabel("Create tracking"), 2500);
      }
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} style={overflowButtonStyle}>
      <Copy size={13} />
      {label}
    </button>
  );
}

function EtaRefreshButton({
  bookingId,
  refreshEtaAction,
}: {
  bookingId: string;
  refreshEtaAction: (bookingId: string) => Promise<EtaRefreshResult>;
}) {
  const [label, setLabel] = useState("Refresh ETA");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (isPending) return;
    setLabel("Refreshing");
    startTransition(async () => {
      const result = await refreshEtaAction(bookingId);
      setLabel(result.ok ? "ETA updated" : "ETA failed");
      window.setTimeout(() => setLabel("Refresh ETA"), 2500);
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} style={overflowButtonStyle}>
      <RefreshCw size={13} />
      {label}
    </button>
  );
}

export function WorkQueuePanel({
  bookings,
  viewerRole,
  paymentAction,
  statusAction,
  assignDriverAction,
  availableDrivers,
  getTrackingLinkAction,
  refreshEtaAction,
}: {
  bookings: WorkQueueBooking[];
  viewerRole: string;
  paymentAction?: MutationAction;
  statusAction?: MutationAction;
  assignDriverAction?: MutationAction;
  availableDrivers?: AvailableDriver[];
  getTrackingLinkAction?: TrackingLinkAction;
  refreshEtaAction?: (bookingId: string) => Promise<EtaRefreshResult>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeFilter = getFilterFromSearchParams(searchParams);

  const rows = useMemo(() => {
    return bookings
      .map((booking) => ({
        booking,
        action: getWorkQueueNextAction({
          status: booking.status,
          type: booking.type,
          paymentStatus: booking.payment_status,
          staffName: booking.staff_name,
          resourceName: booking.resource_name,
          dispatchWarning: booking.dispatch_warning,
          needsLocationReview: booking.needs_location_review,
          noDriverWarning: booking.no_driver_warning,
        }),
      }))
      .sort((a, b) => {
        const priority = b.action.priority - a.action.priority;
        return priority !== 0 ? priority : a.booking.start_time.localeCompare(b.booking.start_time);
      });
  }, [bookings]);

  const filterCounts = useMemo(() => {
    return {
      all: rows.length,
      confirmations: rows.filter((row) => row.action.category === "confirmation").length,
      "follow-up": rows.filter((row) => row.action.category === "follow_up").length,
      exceptions: rows.filter((row) => row.action.category === "exception").length,
    } satisfies Record<WorkQueueFilterKey, number>;
  }, [rows]);

  const filteredRows = rows.filter((row) => {
    const config = FILTERS.find((filter) => filter.key === activeFilter);
    return !config?.category || row.action.category === config.category;
  });

  function setFilter(filter: WorkQueueFilterKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete(FILTER_PARAM);
    } else {
      params.set(FILTER_PARAM, filter);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <section className="cs-card" style={{ padding: "1rem", borderRadius: "var(--cs-r-xl)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.875rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--cs-text)" }}>
            Prioritized Actions
          </h2>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
            Work the first clear next step for each booking.
          </p>
        </div>
        <Link href="/crm/bookings/new" style={secondaryLinkStyle}>
          New booking
        </Link>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1rem" }} role="tablist" aria-label="Work queue filters">
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(filter.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 0.75rem",
                borderRadius: "var(--cs-r-sm)",
                border: `1px solid ${isActive ? "var(--cs-sand)" : "var(--cs-border)"}`,
                background: isActive ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {filter.label}
              <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{filterCounts[filter.key]}</span>
            </button>
          );
        })}
      </div>

      {filteredRows.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--cs-border-soft)",
            borderRadius: "var(--cs-r-md)",
            padding: "1.5rem",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
            textAlign: "center",
          }}
        >
          No bookings match this work queue filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {filteredRows.map(({ booking, action }) => {
            const tone = getActionTone(action.category);
            const isHomeService = booking.type === "home_service";
            return (
              <article
                key={booking.id}
                style={{
                  gap: "0.875rem",
                  alignItems: "center",
                  padding: "0.875rem",
                  border: `1px solid ${tone.border}`,
                  borderLeft: `4px solid ${tone.color}`,
                  borderRadius: "var(--cs-r-md)",
                  background: "var(--cs-surface)",
                }}
                className="grid grid-cols-1 lg:grid-cols-[72px_minmax(0,1fr)_minmax(190px,260px)]"
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--cs-text)", lineHeight: 1 }}>
                    {formatTime(booking.start_time)}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--cs-text-muted)", marginTop: 4 }}>
                    {booking.service_duration ? `${booking.service_duration}m` : booking.end_time}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                    <strong style={{ fontSize: "0.925rem", color: "var(--cs-text)" }}>
                      {booking.customer_name ?? "Unnamed customer"}
                    </strong>
                    <span style={{ ...pillStyle, background: tone.bg, color: tone.color }}>
                      {action.category === "follow_up" ? "Follow-up" : action.category.replace("_", " ")}
                    </span>
                    <span style={pillStyle}>{formatBookingType(booking.type)}</span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--cs-text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {booking.service_name ?? "Service"} · {formatSource(booking.type)}
                    {booking.staff_name ? ` · ${booking.staff_name}` : ""}
                    {booking.resource_name ? ` · ${booking.resource_name}` : ""}
                  </div>

                  {isHomeService && (booking.hs_zone || booking.hs_address || booking.driver_name || booking.no_driver_warning) && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#92400E",
                        marginTop: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {booking.driver_name ? `Driver: ${booking.driver_name}` : booking.no_driver_warning ? "Driver needed" : "Home service"}
                      {booking.hs_zone ? ` · ${booking.hs_zone}` : ""}
                      {booking.hs_address ? ` · ${booking.hs_address}` : ""}
                    </div>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--cs-text)" }}>
                      {action.instruction}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                      {action.detail}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "0.5rem",
                    minWidth: 0,
                  }}
                  className="max-md:!justify-start"
                >
                  <PrimaryAction
                    booking={booking}
                    primaryKind={action.primaryKind}
                    primaryLabel={action.primaryLabel}
                    viewerRole={viewerRole}
                    paymentAction={paymentAction}
                    statusAction={statusAction}
                    assignDriverAction={assignDriverAction}
                    availableDrivers={availableDrivers}
                  />

                  <details style={{ position: "relative" }}>
                    <summary
                      aria-label="More actions"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        border: "1px solid var(--cs-border)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        listStyle: "none",
                        color: "var(--cs-text-muted)",
                        background: "var(--cs-surface)",
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </summary>
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 6px)",
                        zIndex: 20,
                        width: 220,
                        padding: "0.5rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.375rem",
                        border: "1px solid var(--cs-border)",
                        borderRadius: "var(--cs-r-md)",
                        background: "var(--cs-surface)",
                        boxShadow: "var(--cs-shadow-sm)",
                      }}
                    >
                      <Link href={buildBookingHref(booking.id)} style={overflowLinkStyle}>
                        <ExternalLink size={13} />
                        Open booking
                      </Link>
                      {booking.hs_map_url && (
                        <Link href={booking.hs_map_url} target="_blank" rel="noreferrer" style={overflowLinkStyle}>
                          <ExternalLink size={13} />
                          Open map
                        </Link>
                      )}
                      {paymentAction && !isPrimaryKind(action.primaryKind, "payment") && (
                        <PaymentActionMenu
                          bookingId={booking.id}
                          paymentStatus={booking.payment_status ?? "unpaid"}
                          paymentMethod={booking.payment_method ?? "pay_on_site"}
                          amountPaid={booking.amount_paid ?? 0}
                          pricePaid={booking.price_paid ?? 0}
                          paymentAction={paymentAction}
                          triggerLabel="Payment"
                          triggerVariant="panelSecondary"
                          fullWidth
                        />
                      )}
                      {statusAction && !isPrimaryKind(action.primaryKind, "status") && (
                        <BookingActionMenu
                          bookingId={booking.id}
                          currentStatus={booking.status}
                          userRole={viewerRole}
                          statusAction={statusAction}
                          actionScope="status"
                          triggerLabel="Status"
                          triggerVariant="panelSecondary"
                          fullWidth
                          emptyBehavior="disabled"
                        />
                      )}
                      {isHomeService && assignDriverAction && availableDrivers && !isPrimaryKind(action.primaryKind, "driver") && (
                        <DriverAssignMenu
                          bookingId={booking.id}
                          currentDriverId={booking.driver_id}
                          currentDriverName={booking.driver_name}
                          availableDrivers={availableDrivers}
                          assignDriverAction={assignDriverAction}
                        />
                      )}
                      {isHomeService && getTrackingLinkAction && (
                        <TrackingCopyButton
                          bookingId={booking.id}
                          existingMessage={booking.tracking_message}
                          getTrackingLinkAction={getTrackingLinkAction}
                        />
                      )}
                      {isHomeService && refreshEtaAction && (
                        <EtaRefreshButton bookingId={booking.id} refreshEtaAction={refreshEtaAction} />
                      )}
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 0.5rem",
  borderRadius: "var(--cs-r-sm)",
  background: "var(--cs-surface-warm)",
  color: "var(--cs-text-muted)",
  fontSize: "0.6875rem",
  fontWeight: 800,
  textTransform: "capitalize",
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 0.875rem",
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface-warm)",
  color: "var(--cs-text)",
  fontSize: "0.8125rem",
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 34,
  padding: "0 0.85rem",
  borderRadius: 6,
  background: "var(--cs-sand)",
  color: "#fff",
  fontSize: "0.8125rem",
  fontWeight: 700,
  textDecoration: "none",
};

const overflowLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 34,
  padding: "0 0.65rem",
  borderRadius: 6,
  color: "var(--cs-text)",
  textDecoration: "none",
  fontSize: "0.8125rem",
  fontWeight: 650,
};

const overflowButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 6,
  minHeight: 34,
  padding: "0 0.65rem",
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  background: "var(--cs-surface-warm)",
  color: "var(--cs-text)",
  fontSize: "0.8125rem",
  fontWeight: 650,
  cursor: "pointer",
};

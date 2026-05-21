"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { BookingTypeBadge } from "@/components/features/dashboard/booking-type-badge";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";
import { PaymentMethodBadge } from "@/components/features/dashboard/payment-method-badge";
import { BookingActionMenu } from "@/components/features/dashboard/booking-action-menu";
import { PaymentActionMenu } from "@/components/features/dashboard/payment-action-menu";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { formatTime, formatCurrency } from "@/lib/utils";
import { AssignmentRecommendationPanel } from "@/components/features/assignments/assignment-recommendation-panel";
import { getAssignmentRecommendationsAction } from "@/lib/actions/assignment-recommendations";
import { assignBookingDriverAction } from "@/lib/actions/driver-actions";
import type { WorkspaceBookingRow } from "./bookings-workspace";

type OneOrMany<T> = T | T[] | null;

const DEFAULT_ROWS_PER_PAGE = 8;
const ROWS_PER_PAGE_OPTIONS = [8, 10, 20] as const;
const NO_SELECTION = "__no_booking_selected__";

function readFirst<T>(rel: OneOrMany<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

function readPricePaid(metadata: Record<string, unknown> | null | undefined): number {
  if (!metadata) return 0;
  const n = Number(metadata["price_paid"] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getPageIndexes(totalPages: number, currentPage: number): number[] {
  const maxButtons = 5;
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  let start = Math.max(0, currentPage - 2);
  let end = Math.min(totalPages - 1, start + maxButtons - 1);
  start = Math.max(0, end - maxButtons + 1);
  end = Math.min(totalPages - 1, start + maxButtons - 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

type ActionFn = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type BookingsTableProps = {
  bookings: WorkspaceBookingRow[];
  viewerRole: string;
  search?: string;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  initialSelectedId?: string;
  confirmPaymentAction?: ActionFn;
};

export function BookingsTable({
  bookings,
  viewerRole,
  search,
  statusAction,
  paymentAction,
  initialSelectedId,
  confirmPaymentAction,
}: BookingsTableProps) {
  const filtered = search
    ? bookings.filter((booking) => {
        const customer = readFirst(booking.customers);
        const staff = readFirst(booking.staff);
        const staffName = staff ? getStaffAdminName(staff) : "";
        const term = search.toLowerCase();
        return (
          booking.id.toLowerCase().includes(term) ||
          (customer?.full_name ?? "").toLowerCase().includes(term) ||
          (customer?.phone ?? "").includes(term) ||
          staffName.toLowerCase().includes(term)
        );
      })
    : bookings;

  const [selectedId, setSelectedId] = useState<string | null>(() => initialSelectedId ?? null);
  const [pageIndex, setPageIndex] = useState(() => {
    if (!initialSelectedId) return 0;
    const idx = filtered.findIndex((b) => b.id === initialSelectedId);
    return idx >= 0 ? Math.floor(idx / DEFAULT_ROWS_PER_PAGE) : 0;
  });
  const [rowsPerPage, setRowsPerPage] = useState<number>(DEFAULT_ROWS_PER_PAGE);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const startIndex = safePageIndex * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, filtered.length);
  const pageBookings = filtered.slice(startIndex, endIndex);
  const selected =
    selectedId === NO_SELECTION
      ? null
      : pageBookings.find((booking) => booking.id === selectedId) ?? pageBookings[0] ?? null;
  const pageIndexes = getPageIndexes(totalPages, safePageIndex);

  function goToPage(nextPage: number) {
    setPageIndex(Math.min(Math.max(nextPage, 0), totalPages - 1));
  }

  function handleRowsPerPageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextRowsPerPage = Number(event.target.value);
    if (!Number.isFinite(nextRowsPerPage)) return;
    setRowsPerPage(nextRowsPerPage);
    setPageIndex(0);
  }

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No bookings"
        description={
          search
            ? "No bookings match your search."
            : "No bookings match the selected filters."
        }
        icon="Bookings"
      />
    );
  }

  return (
    <>
      <style>{`
        .bw-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .bw-th { font-size: 0.6875rem; font-weight: 600; color: var(--cs-text-muted);
          text-transform: uppercase; letter-spacing: 0.05em; padding: 0.5rem 0.625rem;
          background: var(--cs-surface-warm); border-bottom: 1px solid var(--cs-border);
          white-space: nowrap; text-align: left; }
        .bw-td { padding: 0.625rem 0.625rem; vertical-align: middle; border-bottom: 1px solid var(--cs-border); }
        .bw-row:last-child .bw-td { border-bottom: none; }
        .bw-row { cursor: pointer; transition: background-color 0.12s ease; }
        .bw-row:hover .bw-td { background-color: var(--cs-surface-warm); }
        .bw-row-selected .bw-td { background-color: var(--cs-sand-mist); }
        .bw-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bw-col-id { width: 92px; font-family: var(--font-mono, monospace); white-space: nowrap; }
        .bw-col-customer { width: 164px; }
        .bw-col-type { width: 86px; }
        .bw-col-time { width: 82px; white-space: nowrap; }
        .bw-col-status { width: 108px; }
        .bw-col-payment { width: 88px; }
        .bw-col-amount { width: 92px; }
        .bw-col-actions { width: 42px; white-space: nowrap; text-align: right; }
        .bw-pagination { border-top: 1px solid var(--cs-border); background: var(--cs-surface);
          display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          flex-wrap: wrap; padding: 0.75rem; }
        .bw-page-controls { display: flex; align-items: center; justify-content: center; gap: 0.25rem; flex-wrap: wrap; }
        .bw-page-button { height: 30px; min-width: 30px; border-radius: 6px; border: 1px solid var(--cs-border);
          background: var(--cs-surface); color: var(--cs-text); font-size: 0.75rem; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; padding: 0 0.55rem; }
        .bw-page-button:disabled { opacity: 0.45; cursor: not-allowed; }
        .bw-page-button-active { background: var(--cs-sand-mist); border-color: var(--cs-sand); color: var(--cs-text); font-weight: 700; }
        @media (max-width: 1100px) {
          .bw-shell { grid-template-columns: 1fr !important; }
          .bw-panel { display: none; }
        }
        @media (max-width: 900px) {
          .bw-col-type, .bw-col-amount { display: none; }
        }
        @media (max-width: 640px) {
          .bw-col-payment, .bw-col-service { display: none; }
          .bw-pagination { align-items: stretch; }
          .bw-page-controls { width: 100%; justify-content: flex-start; }
        }
      `}</style>

      <div className="bw-shell" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 330px", gap: "1rem", alignItems: "start" }}>
        <div style={{ backgroundColor: "var(--cs-surface)", border: "1px solid var(--cs-border)", borderRadius: 10, overflow: "hidden", minWidth: 0 }}>
          <table className="bw-table">
            <thead>
              <tr>
                <th className="bw-th bw-col-id">Booking ID</th>
                <th className="bw-th bw-col-customer">Customer</th>
                <th className="bw-th bw-col-type">Type</th>
                <th className="bw-th bw-col-time">Time</th>
                <th className="bw-th bw-col-service">Service</th>
                <th className="bw-th bw-col-status">Status</th>
                <th className="bw-th bw-col-payment">Payment</th>
                <th className="bw-th bw-col-amount">Amount</th>
                <th className="bw-th bw-col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pageBookings.map((booking) => {
                const customer = readFirst(booking.customers);
                const service = readFirst(booking.services);
                const staff = readFirst(booking.staff);
                const resource = readFirst(booking.branch_resources);
                const staffName = staff ? getStaffAdminName(staff) : "Unassigned";
                const price = readPricePaid(booking.metadata);
                const isSelected = booking.id === selected?.id;
                const shortId = booking.id.slice(0, 8).toUpperCase();

                return (
                  <tr
                    key={booking.id}
                    className={`bw-row${isSelected ? " bw-row-selected" : ""}`}
                    onClick={() => setSelectedId(booking.id)}
                    aria-selected={isSelected}
                  >
                    <td className="bw-td bw-col-id">
                      <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                        #{shortId}
                      </span>
                    </td>

                    <td className="bw-td bw-col-customer">
                      <div className="bw-truncate" style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }} title={customer?.full_name ?? undefined}>
                        {customer?.full_name ?? "—"}
                      </div>
                      {customer?.phone && (
                        <div className="bw-truncate" style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 1 }} title={customer.phone}>
                          {customer.phone}
                        </div>
                      )}
                    </td>

                    <td className="bw-td bw-col-type">
                      <BookingTypeBadge type={booking.type} />
                    </td>

                    <td className="bw-td bw-col-time">
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                        {formatTime(booking.start_time)}
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 1 }}>
                        {new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </div>
                    </td>

                    <td className="bw-td bw-col-service">
                      <div className="bw-truncate" style={{ fontSize: "0.8125rem", color: "var(--cs-text)" }} title={service?.name ?? undefined}>
                        {service?.name ?? "—"}
                      </div>
                      <div
                        className="bw-truncate"
                        style={{ fontSize: "0.6875rem", color: "var(--cs-text-muted)", marginTop: 1 }}
                        title={[staffName, resource?.name].filter(Boolean).join(" · ")}
                      >
                        {staffName}
                        {resource && <> · {resource.name}</>}
                      </div>
                    </td>

                    <td className="bw-td bw-col-status">
                      <BookingStatusBadge status={booking.status} />
                    </td>

                    <td className="bw-td bw-col-payment">
                      <PaymentStatusBadge status={booking.payment_status} />
                    </td>

                    <td className="bw-td bw-col-amount">
                      {price > 0 ? (
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--cs-text)", whiteSpace: "nowrap" }}>
                          {formatCurrency(price)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--cs-text-muted)" }}>—</span>
                      )}
                    </td>

                    <td className="bw-td bw-col-actions" onClick={(event) => event.stopPropagation()}>
                      <BookingActionMenu
                        bookingId={booking.id}
                        currentStatus={booking.status}
                        userRole={viewerRole}
                        statusAction={statusAction}
                        triggerVariant="icon"
                        triggerAriaLabel={`Open actions for booking ${shortId}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="bw-pagination">
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
              Showing {startIndex + 1} to {endIndex} of {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
            </div>

            <div className="bw-page-controls" aria-label="Booking pagination">
              <button type="button" className="bw-page-button" onClick={() => goToPage(safePageIndex - 1)} disabled={safePageIndex === 0}>
                Previous
              </button>
              {pageIndexes.map((index) => (
                <button
                  key={index}
                  type="button"
                  className={`bw-page-button${index === safePageIndex ? " bw-page-button-active" : ""}`}
                  onClick={() => goToPage(index)}
                  aria-current={index === safePageIndex ? "page" : undefined}
                >
                  {index + 1}
                </button>
              ))}
              <button type="button" className="bw-page-button" onClick={() => goToPage(safePageIndex + 1)} disabled={safePageIndex >= totalPages - 1}>
                Next
              </button>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
              Rows per page
              <select
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                aria-label="Rows per page"
                style={{
                  height: 30,
                  borderRadius: 6,
                  border: "1px solid var(--cs-border)",
                  backgroundColor: "var(--cs-surface)",
                  color: "var(--cs-text)",
                  padding: "0 0.5rem",
                }}
              >
                {ROWS_PER_PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bw-panel">
          {selected ? (
            <BookingDetailsPanel
              booking={selected}
              viewerRole={viewerRole}
              onClose={() => setSelectedId(NO_SELECTION)}
              statusAction={statusAction}
              paymentAction={paymentAction}
              confirmPaymentAction={confirmPaymentAction}
            />
          ) : (
            <div style={{
              backgroundColor: "var(--cs-surface)",
              border: "1px solid var(--cs-border)",
              borderRadius: 10,
              padding: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 120,
            }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>Select a booking to view details.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function BookingDetailsPanel({
  booking,
  viewerRole,
  onClose,
  statusAction,
  paymentAction,
  confirmPaymentAction,
}: {
  booking: WorkspaceBookingRow;
  viewerRole: string;
  onClose: () => void;
  statusAction?: ActionFn;
  paymentAction?: ActionFn;
  confirmPaymentAction?: ActionFn;
}) {
  const customer = readFirst(booking.customers);
  const service = readFirst(booking.services);
  const staff = readFirst(booking.staff);
  const staffName = staff ? getStaffAdminName(staff) : "Unassigned";
  const branch = readFirst(booking.branches);
  const resource = readFirst(booking.branch_resources);
  const price = readPricePaid(booking.metadata);
  const balance = price > 0 ? Math.max(0, price - booking.amount_paid) : 0;
  const notes = (booking.metadata as Record<string, unknown> | null)?.["customer_notes"];
  const durationMinutes = service?.duration_minutes;

  return (
    <div style={{
      backgroundColor: "var(--cs-surface)",
      border: "1px solid var(--cs-border)",
      borderRadius: 10,
      padding: "1.25rem",
      position: "sticky",
      top: "1rem",
      height: "fit-content",
      maxHeight: "calc(100vh - 160px)",
      overflowY: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Booking Details
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-text-muted)", fontSize: "1.125rem", lineHeight: 1, padding: "0 2px" }}
          aria-label="Close booking details"
        >
          x
        </button>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", fontFamily: "var(--font-mono, monospace)", marginBottom: "0.5rem" }}>
          #{booking.id.slice(0, 8).toUpperCase()}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <BookingStatusBadge status={booking.status} />
          <BookingTypeBadge type={booking.type} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <PanelSection label="Customer">
          <PanelRow label="Name" value={customer?.full_name ?? "—"} />
          {customer?.phone && <PanelRow label="Phone" value={customer.phone} />}
        </PanelSection>

        <PanelSection label="Booking Info">
          <PanelRow
            label="Date"
            value={new Date(booking.booking_date + "T00:00:00").toLocaleDateString("en-PH", {
              weekday: "short", month: "long", day: "numeric",
            })}
          />
          <PanelRow label="Time" value={formatTime(booking.start_time)} />
          <PanelRow label="Service" value={service?.name ?? "—"} />
          {durationMinutes != null && <PanelRow label="Duration" value={`${durationMinutes} min`} />}
          <PanelRow label="Staff" value={staffName} />
          {resource && <PanelRow label="Room/Bed" value={resource.name} />}
          {branch && <PanelRow label="Branch" value={branch.name} />}
          {booking.travel_buffer_mins != null && booking.travel_buffer_mins > 0 && (
            <PanelRow label="Travel buffer" value={`+${booking.travel_buffer_mins} min`} />
          )}
        </PanelSection>

        <PanelSection label="Payment">
          <PanelRow label="Status" value={<PaymentStatusBadge status={booking.payment_status} />} />
          <PanelRow label="Method" value={<PaymentMethodBadge method={booking.payment_method} />} />
          {price > 0 && (
            <>
              <PanelRow label="Total" value={formatCurrency(price)} />
              <PanelRow label="Paid" value={formatCurrency(booking.amount_paid)} />
              {balance > 0 && <PanelRow label="Balance" value={formatCurrency(balance)} danger />}
            </>
          )}
        </PanelSection>

        {typeof notes === "string" && notes.trim() && (
          <PanelSection label="Notes">
            <p style={{ fontSize: "0.8125rem", color: "var(--cs-text)", lineHeight: 1.55, margin: 0 }}>
              {notes}
            </p>
          </PanelSection>
        )}

        {(booking.status === "pending_payment" || booking.status === "pending_crm_confirmation") && (
          <PaymentConfirmationPanel booking={booking} confirmPaymentAction={confirmPaymentAction} />
        )}

        {/* Recommendations */}
        <BookingRecommendationSection booking={booking} />

        <PanelSection label="Actions">
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <button
              type="button"
              disabled
              style={editButtonStyle}
              title="Edit booking is not available from this panel yet."
            >
              Edit Booking
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
              <BookingActionMenu
                bookingId={booking.id}
                currentStatus={booking.status}
                userRole={viewerRole}
                statusAction={statusAction}
                actionScope="status"
                triggerLabel="Change Status"
                triggerVariant="panelSecondary"
                fullWidth
                emptyBehavior="disabled"
              />
              <PaymentActionMenu
                bookingId={booking.id}
                paymentStatus={booking.payment_status}
                paymentMethod={booking.payment_method}
                amountPaid={booking.amount_paid}
                pricePaid={price}
                paymentAction={paymentAction}
                triggerLabel="Take Payment"
                triggerVariant="panelSecondary"
                fullWidth
              />
            </div>

            <BookingActionMenu
              bookingId={booking.id}
              currentStatus={booking.status}
              userRole={viewerRole}
              statusAction={statusAction}
              actionScope="cancel"
              triggerLabel="Cancel Booking"
              triggerVariant="panelDanger"
              fullWidth
            />
          </div>
        </PanelSection>
      </div>
    </div>
  );
}

function BookingRecommendationSection({
  booking,
}: {
  booking: WorkspaceBookingRow;
}) {
  const isHomeService = Boolean(
    booking.type === "home_service" ||
    (booking.metadata && (booking.metadata.delivery_type === "home_service" || booking.metadata.type === "home_service"))
  );
  const staff = readFirst(booking.staff);
  const needsTherapist = !staff;
  const needsDriver = isHomeService;

  if (!needsTherapist && !needsDriver) return null;

  return (
    <div>
      <AssignmentRecommendationPanel
        bookingId={booking.id}
        fetchRecommendations={getAssignmentRecommendationsAction}
        onAssignDriver={(driverId) => {
          assignBookingDriverAction({ bookingId: booking.id, driverId });
        }}
        currentTherapistId={staff?.id ?? null}
        currentDriverId={null}
        showTherapists={needsTherapist}
        showDrivers={needsDriver}
      />
      <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 6, textAlign: "center" }}>
        Recommendation only. Use existing booking controls to confirm assignment.
      </div>
    </div>
  );
}

const CONFIRM_PAYMENT_METHODS = [
  { value: "cash",  label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "maya",  label: "Maya" },
  { value: "card",  label: "Card" },
  { value: "other", label: "Other" },
] as const;

function PaymentConfirmationPanel({
  booking,
  confirmPaymentAction,
}: {
  booking: WorkspaceBookingRow;
  confirmPaymentAction?: ActionFn;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const now = new Date();
  const holdExpired =
    !booking.hold_expires_at ||
    new Date(booking.hold_expires_at).getTime() <= now.getTime();

  const holdExpiresLabel = (() => {
    if (!booking.hold_expires_at) return null;
    const exp = new Date(booking.hold_expires_at);
    if (exp.getTime() <= now.getTime()) return "Hold expired";
    return `Hold active until ${exp.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`;
  })();

  function handleConfirm() {
    if (!confirmPaymentAction) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await confirmPaymentAction({
        bookingId:        booking.id,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        note:             note.trim() || undefined,
      });
      if (result.success) {
        setFeedback({ ok: true, message: "Payment confirmed. Booking is now active." });
        router.refresh();
      } else {
        setFeedback({ ok: false, message: result.error ?? "Failed to confirm payment." });
      }
    });
  }

  return (
    <div style={{
      borderRadius: 8,
      border: `1.5px solid ${holdExpired ? "#FCA5A5" : "#86EFAC"}`,
      background: holdExpired ? "#FFF5F5" : "#F0FDF4",
      padding: "0.875rem",
    }}>
      <div style={{ fontSize: "0.625rem", fontWeight: 700, color: holdExpired ? "#DC2626" : "#16A34A", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.625rem" }}>
        Payment Confirmation
      </div>

      {holdExpiresLabel && (
        <div style={{ fontSize: "0.75rem", color: holdExpired ? "#DC2626" : "#16A34A", marginBottom: "0.625rem", fontWeight: 500 }}>
          {holdExpiresLabel}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Payment method
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={isPending}
            style={confirmInputStyle}
          >
            {CONFIRM_PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Reference / receipt no. <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. GCash ref #"
            disabled={isPending}
            style={confirmInputStyle}
          />
        </label>

        <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          Note <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Internal note…"
            disabled={isPending}
            style={{ ...confirmInputStyle, height: "auto", resize: "vertical", paddingTop: "0.375rem", paddingBottom: "0.375rem" }}
          />
        </label>

        {feedback && (
          <div style={{ fontSize: "0.75rem", color: feedback.ok ? "#16A34A" : "#DC2626", fontWeight: 500 }}>
            {feedback.message}
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || !confirmPaymentAction || feedback?.ok === true}
          style={{
            height: 38,
            borderRadius: 7,
            border: "none",
            backgroundColor: isPending ? "var(--cs-text-muted)" : "#16A34A",
            color: "#fff",
            fontSize: "0.8125rem",
            fontWeight: 700,
            cursor: isPending || !confirmPaymentAction || feedback?.ok === true ? "not-allowed" : "pointer",
            opacity: isPending || !confirmPaymentAction ? 0.7 : 1,
            transition: "background-color 0.15s",
          }}
        >
          {isPending ? "Confirming…" : "Confirm payment & finalize booking"}
        </button>
      </div>
    </div>
  );
}

const confirmInputStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  padding: "0 0.625rem",
  fontSize: "0.8125rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
  width: "100%",
  boxSizing: "border-box",
};

function PanelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.625rem", fontWeight: 700, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        {children}
      </div>
    </div>
  );
}

function PanelRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", fontWeight: danger ? 600 : 400, color: danger ? "#DC2626" : "var(--cs-text)", textAlign: "right", minWidth: 0 }}>
        {value}
      </span>
    </div>
  );
}

const editButtonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 7,
  border: "1px solid transparent",
  backgroundColor: "var(--cs-charcoal)",
  color: "#fff",
  fontSize: "0.875rem",
  fontWeight: 700,
  cursor: "not-allowed",
  opacity: 0.5,
};

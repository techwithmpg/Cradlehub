"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/validations/booking";
import { notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";

const QUICK_METHODS: PaymentMethod[] = ["cash", "gcash", "maya", "card"];

type PaymentAction = (input: unknown) => Promise<{ success: boolean; error?: string }>;

type Props = {
  bookingId:        string;
  paymentStatus:    string;
  paymentMethod:    string;
  amountPaid:       number;
  pricePaid:        number;
  onUpdate?:        () => void;
  paymentAction?:   PaymentAction;
  triggerLabel?:    string;
  triggerAriaLabel?: string;
  triggerVariant?:  "default" | "panelSecondary";
  fullWidth?:       boolean;
  reviewRequired?:  boolean;
};

type ViewState = "idle" | "quickPay" | "editForm" | "confirmUnpaid";

export function PaymentActionMenu({
  bookingId,
  paymentStatus,
  paymentMethod,
  amountPaid,
  pricePaid,
  onUpdate,
  paymentAction,
  triggerLabel = "Pay",
  triggerAriaLabel,
  triggerVariant = "default",
  fullWidth = false,
  reviewRequired = false,
}: Props) {
  const callPaymentAction = paymentAction ?? updateBookingPaymentAction;
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<ViewState>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit form state
  const [editMethod,    setEditMethod]    = useState(paymentMethod);
  const [editStatus,    setEditStatus]    = useState(paymentStatus);
  const [editAmount,    setEditAmount]    = useState(String(amountPaid > 0 ? amountPaid : pricePaid));
  const [editReference, setEditReference] = useState("");
  const [reason,        setReason]        = useState("");
  const triggerStyle = getTriggerButtonStyle(triggerVariant, fullWidth, isPending);
  const triggerText = `${triggerLabel} ▾`;

  function showFeedback(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function handleQuickPay(method: PaymentMethod) {
    if (reviewRequired) return;
    setView("idle");
    startTransition(async () => {
      const result = await callPaymentAction({
        bookingId,
        paymentMethod:    method,
        paymentStatus:    "paid",
        amountPaid:       pricePaid,
        paymentReference: undefined,
      });
      if (!result.success) {
        showFeedback(result.error ?? "Failed to update payment");
        return;
      }
      toast.success("Payment confirmed.");
      onUpdate?.();
      notifyBookingsChanged();
    });
  }

  function handleMarkUnpaid() {
    if (reviewRequired) return;
    setReason("");
    setView("confirmUnpaid");
  }

  function handleConfirmUnpaid() {
    if (reviewRequired) return;
    setView("idle");
    startTransition(async () => {
      const result = await callPaymentAction({
        bookingId,
        paymentMethod:    "pay_on_site",
        paymentStatus:    "unpaid",
        amountPaid:       0,
        paymentReference: undefined,
        reason:           reason.trim() || undefined,
      });
      if (!result.success) {
        showFeedback(result.error ?? "Failed to update payment");
        return;
      }
      toast.success("Marked as unpaid.");
      setReason("");
      onUpdate?.();
      notifyBookingsChanged();
    });
  }

  function handleEditSave() {
    if (reviewRequired) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount < 0) {
      showFeedback("Amount must be a non-negative number");
      return;
    }
    const isSignificantChange =
      (paymentStatus === "paid" && editStatus !== "paid") ||
      (amountPaid > amount && amountPaid > 0);
    if (isSignificantChange && !reason.trim()) {
      showFeedback("Reason is required for voids, refunds, or corrections");
      return;
    }
    setView("idle");
    startTransition(async () => {
      const result = await callPaymentAction({
        bookingId,
        paymentMethod:    editMethod as PaymentMethod,
        paymentStatus:    editStatus as "unpaid" | "pending" | "paid" | "refunded",
        amountPaid:       amount,
        paymentReference: editReference || undefined,
        reason:           reason.trim() || undefined,
      });
      if (!result.success) {
        showFeedback(result.error ?? "Failed to update payment");
        return;
      }
      toast.success("Payment updated.");
      setReason("");
      onUpdate?.();
      notifyBookingsChanged();
    });
  }

  if (view === "confirmUnpaid" && !reviewRequired) {
    return (
      <div style={{ position: "relative", display: fullWidth ? "block" : "inline-flex", width: fullWidth ? "100%" : undefined }}>
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 30,
            width: 230,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>
            Mark as Unpaid
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
              This will reset payment to unpaid / zero. Add a reason if needed.
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              style={{ ...inputStyle, height: "auto", padding: "6px 8px", resize: "none" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button type="button" onClick={handleConfirmUnpaid} disabled={isPending} style={saveButtonStyle}>
                {isPending ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : "Confirm"}
              </button>
              <button type="button" onClick={() => { setView("idle"); setReason(""); }} style={cancelButtonStyle}>Cancel</button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setView("quickPay")}
          disabled={isPending}
          style={triggerStyle}
          aria-haspopup="menu"
          aria-label={triggerAriaLabel}
        >
          {triggerText}
        </button>
      </div>
    );
  }

  if (view === "editForm" && !reviewRequired) {
    return (
      <div style={{ position: "relative", display: fullWidth ? "block" : "inline-flex", gap: 4, alignItems: "center", width: fullWidth ? "100%" : undefined }}>
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 30,
            width: 230,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text)", marginBottom: 8 }}>
            Update Payment
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              value={editMethod}
              onChange={(e) => setEditMethod(e.target.value)}
              style={inputStyle}
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              style={inputStyle}
            >
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="Amount (₱)"
              style={inputStyle}
            />
            <input
              type="text"
              value={editReference}
              onChange={(e) => setEditReference(e.target.value)}
              placeholder="Ref # (optional)"
              style={inputStyle}
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                (paymentStatus === "paid" && editStatus !== "paid") || (amountPaid > parseFloat(editAmount || "0") && amountPaid > 0)
                  ? "Reason required *"
                  : "Reason (optional)"
              }
              rows={2}
              style={{ ...inputStyle, height: "auto", padding: "6px 8px", resize: "none" }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button type="button" onClick={handleEditSave} disabled={isPending} style={saveButtonStyle}>
                {isPending ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : "Save"}
              </button>
              <button type="button" onClick={() => { setView("idle"); setReason(""); }} style={cancelButtonStyle}>Cancel</button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setView("quickPay")}
          disabled={isPending}
          style={triggerStyle}
          aria-haspopup="menu"
          aria-label={triggerAriaLabel}
        >
          {triggerText}
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: fullWidth ? "block" : "inline-block", width: fullWidth ? "100%" : undefined }}>
      {feedback && (
        <div style={feedbackStyle}>{feedback}</div>
      )}

      <button
        type="button"
        onClick={() => setView(view === "quickPay" ? "idle" : "quickPay")}
        disabled={isPending}
        style={triggerStyle}
        aria-haspopup="menu"
        aria-expanded={view === "quickPay"}
        aria-label={triggerAriaLabel}
      >
        {isPending
          ? <Loader2 className="animate-spin" style={{ width: 12, height: 12, display: "inline" }} />
          : triggerText}
      </button>

      {view === "quickPay" && (
        <>
          <div onClick={() => setView("idle")} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div
            style={{
              ...dropdownStyle,
              minWidth: reviewRequired ? 240 : 150,
              padding: reviewRequired ? "10px 12px" : "4px 0",
            }}
          >
            {reviewRequired ? (
              <>
                <div
                  data-testid="payment-review-warning"
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b21a8",
                    backgroundColor: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    borderRadius: 6,
                    padding: "6px 8px",
                    marginBottom: 8,
                    fontWeight: 500,
                    lineHeight: 1.3,
                  }}
                >
                  Order evidence requires review. Reconcile details before collecting.
                </div>

                <div
                  data-testid="payment-review-details"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    fontSize: "0.75rem",
                    color: "var(--cs-text)",
                    padding: "2px 0 8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--cs-text-muted)" }}>Price:</span>
                    <span style={{ fontWeight: 600 }}>
                      ₱{Number(pricePaid || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--cs-text-muted)" }}>Recorded Paid:</span>
                    <span style={{ fontWeight: 600 }}>
                      ₱{Number(amountPaid || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--cs-text-muted)" }}>Status:</span>
                    <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                      {paymentStatus}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--cs-text-muted)" }}>Method:</span>
                    <span style={{ fontWeight: 500 }}>
                      {PAYMENT_METHOD_LABELS[paymentMethod as PaymentMethod] ?? paymentMethod}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--cs-border)",
                    paddingTop: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <Link
                    href="/crm/reconciliation"
                    data-testid="link-reconciliation"
                    onClick={() => setView("idle")}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "6px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#6b21a8",
                      backgroundColor: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: 6,
                      textDecoration: "none",
                    }}
                  >
                    Open Reconciliation
                  </Link>
                  <Link
                    href="/crm/cash-flow"
                    data-testid="link-cash-flow"
                    onClick={() => setView("idle")}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "6px 10px",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      color: "var(--cs-text)",
                      backgroundColor: "var(--cs-surface)",
                      border: "1px solid var(--cs-border)",
                      borderRadius: 6,
                      textDecoration: "none",
                    }}
                  >
                    View Cash Flow Ledger
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView("idle")}
                    style={{
                      ...menuItemStyle,
                      textAlign: "center",
                      fontSize: "0.75rem",
                      color: "var(--cs-text-muted)",
                      padding: "4px 0 0",
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={sectionLabelStyle}>Quick Mark Paid</div>
                {QUICK_METHODS.map((method) => (
                  <button key={method} type="button" onClick={() => handleQuickPay(method)} style={menuItemStyle}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </button>
                ))}
                <div style={{ borderTop: "1px solid var(--cs-border)", margin: "4px 0" }} />
                {paymentStatus !== "unpaid" && (
                  <button type="button" onClick={handleMarkUnpaid} style={{ ...menuItemStyle, color: "#92400E" }}>
                    Mark Unpaid
                  </button>
                )}
                <button type="button" onClick={() => setView("editForm")} style={{ ...menuItemStyle, color: "var(--cs-text-muted)" }}>
                  Edit Details…
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 30,
  borderRadius: 5,
  border: "1px solid var(--cs-border)",
  padding: "0 8px",
  fontSize: "0.8125rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
};

const saveButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  borderRadius: 5,
  border: "none",
  backgroundColor: "var(--cs-sand)",
  color: "#fff",
  fontSize: "0.8125rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cancelButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 28,
  borderRadius: 5,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text-muted)",
  fontSize: "0.8125rem",
  cursor: "pointer",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 4px)",
  backgroundColor: "var(--cs-surface)",
  border: "1px solid var(--cs-border)",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  zIndex: 30,
  minWidth: 150,
  overflow: "hidden",
  padding: "4px 0",
};

const sectionLabelStyle: React.CSSProperties = {
  padding: "4px 12px 2px",
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--cs-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  display: "block",
  padding: "7px 12px",
  textAlign: "left",
  border: "none",
  backgroundColor: "transparent",
  fontSize: "0.875rem",
  color: "var(--cs-text)",
  cursor: "pointer",
};

const feedbackStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 4px)",
  right: 0,
  backgroundColor: "#FEF2F2",
  border: "1px solid #FECACA",
  borderRadius: 6,
  padding: "4px 8px",
  fontSize: "0.75rem",
  color: "#991B1B",
  whiteSpace: "nowrap",
  zIndex: 10,
};

function getTriggerButtonStyle(
  variant: NonNullable<Props["triggerVariant"]>,
  fullWidth: boolean,
  disabled: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 6,
    border: "1px solid var(--cs-border)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : undefined,
  };

  if (variant === "panelSecondary") {
    return {
      ...base,
      height: 38,
      padding: "0 0.875rem",
      backgroundColor: "var(--cs-surface-warm)",
      color: "var(--cs-text)",
      fontSize: "0.8125rem",
      fontWeight: 600,
    };
  }

  return {
    ...base,
    padding: "4px 9px",
    backgroundColor: "var(--cs-surface)",
    color: "var(--cs-text)",
    fontSize: "0.75rem",
  };
}

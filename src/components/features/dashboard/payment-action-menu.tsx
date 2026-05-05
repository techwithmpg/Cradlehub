"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateBookingPaymentAction } from "@/app/(dashboard)/manager/bookings/actions";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/validations/booking";

const QUICK_METHODS: PaymentMethod[] = ["cash", "gcash", "maya", "card"];

type Props = {
  bookingId:        string;
  paymentStatus:    string;
  paymentMethod:    string;
  amountPaid:       number;
  pricePaid:        number;
  onUpdate?:        () => void;
};

type ViewState = "idle" | "quickPay" | "editForm";

export function PaymentActionMenu({
  bookingId,
  paymentStatus,
  paymentMethod,
  amountPaid,
  pricePaid,
  onUpdate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<ViewState>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit form state
  const [editMethod,    setEditMethod]    = useState(paymentMethod);
  const [editStatus,    setEditStatus]    = useState(paymentStatus);
  const [editAmount,    setEditAmount]    = useState(String(amountPaid > 0 ? amountPaid : pricePaid));
  const [editReference, setEditReference] = useState("");

  function showFeedback(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function handleQuickPay(method: PaymentMethod) {
    setView("idle");
    startTransition(async () => {
      const result = await updateBookingPaymentAction({
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
      onUpdate?.();
      router.refresh();
    });
  }

  function handleMarkUnpaid() {
    setView("idle");
    startTransition(async () => {
      const result = await updateBookingPaymentAction({
        bookingId,
        paymentMethod:    "pay_on_site",
        paymentStatus:    "unpaid",
        amountPaid:       0,
        paymentReference: undefined,
      });
      if (!result.success) {
        showFeedback(result.error ?? "Failed to update payment");
        return;
      }
      onUpdate?.();
      router.refresh();
    });
  }

  function handleEditSave() {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount < 0) {
      showFeedback("Amount must be a non-negative number");
      return;
    }
    setView("idle");
    startTransition(async () => {
      const result = await updateBookingPaymentAction({
        bookingId,
        paymentMethod:    editMethod as PaymentMethod,
        paymentStatus:    editStatus as "unpaid" | "pending" | "paid" | "refunded",
        amountPaid:       amount,
        paymentReference: editReference || undefined,
      });
      if (!result.success) {
        showFeedback(result.error ?? "Failed to update payment");
        return;
      }
      onUpdate?.();
      router.refresh();
    });
  }

  if (view === "editForm") {
    return (
      <div style={{ position: "relative", display: "inline-flex", gap: 4, alignItems: "center" }}>
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
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button type="button" onClick={handleEditSave} disabled={isPending} style={saveButtonStyle}>
                {isPending ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : "Save"}
              </button>
              <button type="button" onClick={() => setView("idle")} style={cancelButtonStyle}>Cancel</button>
            </div>
          </div>
        </div>
        <button type="button" style={triggerButtonStyle}>Pay ▾</button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {feedback && (
        <div style={feedbackStyle}>{feedback}</div>
      )}

      <button
        type="button"
        onClick={() => setView(view === "quickPay" ? "idle" : "quickPay")}
        disabled={isPending}
        style={{ ...triggerButtonStyle, opacity: isPending ? 0.5 : 1 }}
      >
        {isPending
          ? <Loader2 className="animate-spin" style={{ width: 12, height: 12, display: "inline" }} />
          : "Pay ▾"}
      </button>

      {view === "quickPay" && (
        <>
          <div onClick={() => setView("idle")} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div style={dropdownStyle}>
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

const triggerButtonStyle: React.CSSProperties = {
  padding: "4px 9px",
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
  fontSize: "0.75rem",
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

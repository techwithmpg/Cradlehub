"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOnlineBookingAction } from "@/app/(public)/book/actions";

type BookingFormProps = {
  branchId: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  serviceName: string;
  servicePrice: number;
  durationMins: number;
};

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const display = (h ?? 0) % 12 || 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function formatDateDisplay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatCurrencyLocal(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function BookingForm({
  branchId,
  serviceId,
  staffId,
  date,
  time,
  serviceName,
  servicePrice,
  durationMins,
}: BookingFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isHome, setIsHome] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOnlineBookingAction({
        branchId,
        serviceId,
        staffId: staffId || undefined,
        date,
        startTime: time,
        type: isHome ? "home_service" : "online",
        travelBufferMins: isHome ? 30 : undefined,
        fullName,
        phone,
        email: email || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        router.push(`/book/success?bookingId=${result.bookingId}`);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          backgroundColor: "var(--ch-accent-light)",
          border: "1px solid var(--ch-border)",
          borderRadius: 10,
          padding: "1rem 1.25rem",
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--ch-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.5rem",
          }}
        >
          Your Appointment
        </div>
        <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--ch-text)", marginBottom: 4 }}>
          {serviceName}
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--ch-text-muted)" }}>
          {formatDateDisplay(date)} at {formatDisplayTime(time)}
        </div>
        <div
          style={{
            marginTop: "0.5rem",
            display: "flex",
            gap: "1rem",
            fontSize: "0.8125rem",
            color: "var(--ch-text-muted)",
          }}
        >
          <span>{durationMins} minutes</span>
          <span style={{ fontWeight: 600, color: "var(--ch-accent)" }}>
            {formatCurrencyLocal(servicePrice)}
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "0.875rem",
            backgroundColor: "var(--ch-surface)",
            border: "1px solid var(--ch-border)",
            borderRadius: 8,
            fontSize: "0.875rem",
            color: "var(--ch-crm-text)",
          }}
        >
          {error}
          {error.toLowerCase().includes("slot") && (
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={() => router.back()}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ch-crm-text)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                ← Go back and pick another time
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: "pointer",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: `1.5px solid ${isHome ? "var(--ch-accent)" : "var(--ch-border)"}`,
            backgroundColor: isHome ? "var(--ch-accent-light)" : "var(--ch-surface)",
          }}
        >
          <input
            type="checkbox"
            checked={isHome}
            onChange={(event) => setIsHome(event.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--ch-accent)" }}
          />
          <div>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: isHome ? "var(--ch-accent)" : "var(--ch-text)",
              }}
            >
              This is a home service visit
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
              Therapist will travel to your location
            </div>
          </div>
        </label>
      </div>

      <div>
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.875rem",
          }}
        >
          Your Details
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="fullName">Full name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Maria Santos"
              required
              autoFocus
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="phone">Phone number *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+63 XXX XXX XXXX"
              required
            />
            <p style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)", margin: 0 }}>
              We&apos;ll use this to confirm your appointment
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="email">Email address (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="maria@email.com"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="notes">
              {isHome ? "Address and special instructions *" : "Special requests (optional)"}
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                isHome
                  ? "Your full address, building/room number, and any special instructions for the therapist..."
                  : "Allergies, preferences, any areas to focus on or avoid..."
              }
              required={isHome}
              rows={3}
              style={{
                borderRadius: 6,
                border: "1px solid var(--ch-border)",
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                color: "var(--ch-text)",
                backgroundColor: "var(--ch-surface)",
                resize: "vertical",
                fontFamily: "inherit",
                width: "100%",
              }}
            />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending || !fullName || !phone || (isHome && !notes)}
        style={{
          backgroundColor: "var(--ch-accent)",
          color: "#fff",
          border: "none",
          height: 46,
          fontSize: "1rem",
          fontWeight: 600,
          opacity: isPending || !fullName || !phone || (isHome && !notes) ? 0.5 : 1,
        }}
      >
        {isPending ? "Confirming your booking..." : "Confirm Appointment"}
      </Button>

      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--ch-text-subtle)",
          textAlign: "center",
          margin: 0,
        }}
      >
        By confirming, your appointment is immediately booked. To cancel or reschedule, please
        contact us directly.
      </p>
    </form>
  );
}

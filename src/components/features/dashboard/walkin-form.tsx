"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeSlotGrid } from "./time-slot-grid";
import { createWalkinBookingAction } from "@/app/(dashboard)/manager/walkin/actions";

type BranchService = {
  id: string;
  custom_price: number | null;
  services: {
    id: string;
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
};

type BranchStaff = {
  id: string;
  full_name: string;
  tier: string;
};

type ContextData = {
  branchId: string;
  services: BranchService[];
  staff: BranchStaff[];
};

type ManagerContextResponse = ContextData | { error: string };

type LookupResponse = {
  customer: {
    full_name: string;
    email: string | null;
  } | null;
};

type SelectedSlot = {
  staffId: string;
  staffName: string;
  time: string;
};

function isContextData(value: ManagerContextResponse): value is ContextData {
  return !("error" in value);
}

function formatCurrencyLocal(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function WalkinForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [bookingType, setBookingType] = useState<"walkin" | "home_service">("walkin");
  const [travelMins, setTravelMins] = useState(30);
  const [notes, setNotes] = useState("");

  const [selected, setSelected] = useState<SelectedSlot | null>(null);

  const [lookupResult, setLookupResult] = useState<{ found: boolean; name?: string } | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/manager/context")
      .then(async (response) => {
        const data = (await response.json()) as ManagerContextResponse;
        if (!response.ok) {
          const message = "error" in data ? data.error : "Could not load branch data";
          throw new Error(message);
        }
        if (!isContextData(data)) {
          throw new Error(data.error);
        }
        setCtx(data);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load branch data";
        setContextError(message);
      });
  }, []);

  useEffect(() => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 7) {
      setLookupResult(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setLooking(true);
      fetch(`/api/customers/lookup?phone=${encodeURIComponent(cleaned)}`)
        .then(async (response) => {
          const data = (await response.json()) as LookupResponse;
          if (data.customer) {
            setLookupResult({ found: true, name: data.customer.full_name });
            setFullName(data.customer.full_name);
            setEmail(data.customer.email ?? "");
            return;
          }
          setLookupResult({ found: false });
        })
        .catch(() => {
          // Best effort lookup only.
        })
        .finally(() => setLooking(false));
    }, 500);

    return () => window.clearTimeout(timer);
  }, [phone]);

  const selectedService = ctx?.services.find((branchService) => branchService.services?.id === serviceId) ?? null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !serviceId) return;

    setError(null);
    startTransition(async () => {
      const result = await createWalkinBookingAction({
        serviceId,
        staffId: selected.staffId,
        date,
        startTime: selected.time,
        type: bookingType,
        travelBufferMins: bookingType === "home_service" ? travelMins : undefined,
        fullName,
        phone,
        email: email || undefined,
        notes: notes || undefined,
      });

      if (!result.success) {
        setError(result.error ?? "Booking failed");
        return;
      }
      router.push("/manager");
      router.refresh();
    });
  }

  if (contextError) {
    return (
      <div
        style={{
          padding: "0.75rem",
          backgroundColor: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          fontSize: "0.875rem",
          color: "#991B1B",
          maxWidth: 640,
        }}
      >
        {contextError}
      </div>
    );
  }

  if (!ctx) {
    return (
      <div style={{ padding: "1rem", color: "var(--cs-text-muted)", fontSize: "0.875rem" }}>
        Loading branch context…
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        maxWidth: 640,
      }}
    >
      {error && (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            fontSize: "0.875rem",
            color: "#991B1B",
          }}
        >
          {error}
        </div>
      )}

      <div>
        <Label style={{ marginBottom: "0.5rem", display: "block" }}>Booking type</Label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(
            [
              { value: "walkin", label: "Walk-in" },
              { value: "home_service", label: "Home Service" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setBookingType(option.value)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: `1.5px solid ${
                  bookingType === option.value ? "var(--cs-sand)" : "var(--cs-border)"
                }`,
                backgroundColor:
                  bookingType === option.value ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                color: bookingType === option.value ? "var(--cs-sand)" : "var(--cs-text)",
                fontSize: "0.875rem",
                fontWeight: bookingType === option.value ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {bookingType === "home_service" && (
          <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Label htmlFor="travelMins" style={{ whiteSpace: "nowrap" }}>
              Travel buffer
            </Label>
            <input
              id="travelMins"
              type="number"
              value={travelMins}
              min={0}
              max={120}
              step={5}
              onChange={(event) => setTravelMins(Number(event.target.value))}
              style={{
                width: 72,
                height: 36,
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                padding: "0 0.5rem",
                fontSize: "0.875rem",
                backgroundColor: "var(--cs-surface)",
              }}
            />
            <span style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>minutes</span>
          </div>
        )}
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Customer
        </legend>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="phone">Phone number *</Label>
            <div style={{ position: "relative" }}>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+63 XXX XXX XXXX"
                required
              />
              {looking && (
                <div
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "0.75rem",
                    color: "var(--cs-text-muted)",
                  }}
                >
                  Looking up…
                </div>
              )}
            </div>
            {lookupResult && (
              <div
                style={{
                  fontSize: "0.8125rem",
                  padding: "4px 8px",
                  borderRadius: 5,
                  backgroundColor: lookupResult.found ? "#F0FDF4" : "#FEFCE8",
                  color: lookupResult.found ? "#15803D" : "#713F12",
                }}
              >
                {lookupResult.found
                  ? `✓ Returning customer — ${lookupResult.name}`
                  : "New customer — please fill in their name below"}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="fullName">Full name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Maria Santos"
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="maria@email.com"
            />
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Service
        </legend>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.5rem",
          }}
        >
          {ctx.services.map((branchService) => {
            const service = branchService.services;
            if (!service) return null;

            const isSelected = serviceId === service.id;
            const price = branchService.custom_price ?? service.price;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  setServiceId(service.id);
                  setSelected(null);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${isSelected ? "var(--cs-sand)" : "var(--cs-border)"}`,
                  backgroundColor: isSelected ? "var(--cs-sand-mist)" : "var(--cs-surface)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: isSelected ? "var(--cs-sand)" : "var(--cs-text)",
                  }}
                >
                  {service.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", marginTop: 2 }}>
                  {service.duration_minutes} min · {formatCurrencyLocal(Number(price))}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {serviceId && (
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--cs-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
            }}
          >
            Date &amp; Time
          </legend>

          <div style={{ marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
            {selectedService?.services?.name
              ? `Selected service: ${selectedService.services.name}`
              : "Choose an available slot"}
          </div>

          <div style={{ marginBottom: "0.875rem" }}>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelected(null);
              }}
              style={{
                height: 36,
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                padding: "0 0.75rem",
                fontSize: "0.875rem",
                backgroundColor: "var(--cs-surface)",
                color: "var(--cs-text)",
              }}
            />
          </div>

          <TimeSlotGrid
            branchId={ctx.branchId}
            serviceId={serviceId}
            date={date}
            onSelect={(slot) => setSelected(slot)}
            selected={selected ? { staffId: selected.staffId, time: selected.time } : null}
          />

          {selected && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "8px 12px",
                backgroundColor: "var(--cs-sand-mist)",
                border: "1px solid var(--cs-sand)",
                borderRadius: 6,
                fontSize: "0.875rem",
                color: "var(--cs-sand)",
                fontWeight: 500,
              }}
            >
              Selected: {selected.time.substring(0, 5)} with {selected.staffName}
            </div>
          )}
        </fieldset>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={
            bookingType === "home_service"
              ? "Address and any special instructions…"
              : "Any preferences or special requests…"
          }
          rows={3}
          style={{
            borderRadius: 6,
            border: "1px solid var(--cs-border)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            color: "var(--cs-text)",
            backgroundColor: "var(--cs-surface)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending || !selected || !serviceId || !fullName || !phone}
        style={{
          backgroundColor: "var(--cs-sand)",
          color: "#fff",
          border: "none",
          opacity: isPending || !selected || !serviceId || !fullName || !phone ? 0.5 : 1,
        }}
      >
        {isPending ? "Creating booking…" : `Confirm ${bookingType === "home_service" ? "Home Service" : "Walk-in"}`}
      </Button>
    </form>
  );
}


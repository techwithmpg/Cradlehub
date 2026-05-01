"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createCustomerAction } from "@/app/(dashboard)/crm/actions";

type CreateCustomerResult = {
  success: boolean;
  customerId?: string;
  error?: string;
};

export function CustomerCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = (await createCustomerAction({
        fullName,
        phone,
        email,
        notes,
      })) as CreateCustomerResult;

      if (!result.success || !result.customerId) {
        setFeedback(result.error ?? "Could not create customer");
        return;
      }

      setFullName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setFeedback("Customer created");
      router.push(`/crm/${result.customerId}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="cs-card"
      style={{
        padding: "1rem",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "0.625rem",
        alignItems: "end",
      }}
    >
      <div style={{ gridColumn: "1 / -1", marginBottom: "0.25rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--cs-text-muted)",
          }}
        >
          Create Customer
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Full name *</span>
        <input
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Guest full name"
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Phone *</span>
        <input
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="09xx xxx xxxx"
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="optional@email.com"
          style={inputStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Notes</span>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional preference notes"
          style={inputStyle}
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={isPending}
          className="cs-btn cs-btn-primary cs-btn-sm"
        >
          {isPending ? "Saving..." : "Create"}
        </button>
        {feedback && (
          <span
            style={{
              fontSize: "0.75rem",
              color: feedback === "Customer created" ? "var(--cs-success)" : "#DC2626",
            }}
          >
            {feedback}
          </span>
        )}
      </div>
    </form>
  );
}

const inputStyle: CSSProperties = {
  height: 36,
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  padding: "0 0.625rem",
  fontSize: "0.8125rem",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
};

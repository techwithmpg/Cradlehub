"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateCustomerAction } from "@/app/(dashboard)/crm/actions";

type StaffOption = {
  id: string;
  full_name: string;
  tier: string;
};

type Props = {
  customerId: string;
  initialNotes: string | null;
  initialPreferredStaffId: string | null;
  staff: StaffOption[];
};

type UpdateCustomerResult = {
  success: boolean;
  error?: string;
};

export function CustomerNotesForm({
  customerId,
  initialNotes,
  initialPreferredStaffId,
  staff,
}: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [preferredId, setPreferredId] = useState(initialPreferredStaffId ?? "");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleSave() {
    startTransition(async () => {
      const result = (await updateCustomerAction({
        customerId,
        notes: notes || undefined,
        preferredStaffId: preferredId || null,
      })) as UpdateCustomerResult;

      if (result.success) {
        setFeedback("Saved");
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback(result.error ?? "Failed to save");
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.375rem",
          }}
        >
          Preferred Therapist
        </div>
        <select
          value={preferredId}
          onChange={(event) => setPreferredId(event.target.value)}
          style={{
            width: "100%",
            height: 36,
            borderRadius: 6,
            border: "1px solid var(--ch-border)",
            padding: "0 0.5rem",
            fontSize: "0.875rem",
            backgroundColor: "var(--ch-surface)",
            color: "var(--ch-text)",
          }}
        >
          <option value="">No preference</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name} ({member.tier})
            </option>
          ))}
        </select>
      </div>

      <div>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--ch-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.375rem",
          }}
        >
          Internal Notes
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Allergies, preferences, special notes..."
          rows={4}
          style={{
            width: "100%",
            borderRadius: 6,
            border: "1px solid var(--ch-border)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.875rem",
            color: "var(--ch-text)",
            backgroundColor: "var(--ch-surface)",
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          size="sm"
          style={{
            backgroundColor: "var(--ch-accent)",
            color: "#fff",
            border: "none",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending ? "Saving..." : "Save Notes"}
        </Button>
        {feedback && (
          <span
            style={{
              fontSize: "0.8125rem",
              color: feedback === "Saved" ? "#15803D" : "#DC2626",
            }}
          >
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}

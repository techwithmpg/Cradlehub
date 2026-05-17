"use client";

import { useState, useTransition } from "react";
import { approveSuggestionAction, rejectSuggestionAction } from "@/app/(dashboard)/manager/scheduling/actions";
import { explainSuggestion } from "@/lib/scheduling/rules/explain-suggestion";
import type { ScheduleSuggestion, SuggestionPriority } from "@/lib/scheduling/types";

interface SuggestionWithStaff extends ScheduleSuggestion {
  staff?: { full_name: string; nickname?: string | null; system_role: string } | null;
}

interface Props {
  suggestions:  SuggestionWithStaff[];
  managerStaffId: string;
}

const PRIORITY_STYLES: Record<SuggestionPriority, { bg: string; text: string }> = {
  low:      { bg: "#F3F4F6", text: "#6B7280" },
  normal:   { bg: "#EFF6FF", text: "#1E40AF" },
  high:     { bg: "#FEF3C7", text: "#92400E" },
  critical: { bg: "#FEE2E2", text: "#991B1B" },
};

function SuggestionCard({
  suggestion,
  managerStaffId,
  onDone,
}: {
  suggestion:     SuggestionWithStaff;
  managerStaffId: string;
  onDone:         (id: string) => void;
}) {
  const [actionPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus]   = useState<"idle" | "approving" | "rejecting" | "done">("idle");
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  const staffName  = suggestion.staff?.full_name;
  const { headline, detail } = explainSuggestion(suggestion, staffName);
  const priorityStyle = PRIORITY_STYLES[suggestion.priority] ?? PRIORITY_STYLES.normal;

  function handleApprove() {
    setLocalStatus("approving");
    setErrorMsg(null);
    startTransition(async () => {
      const res = await approveSuggestionAction({
        suggestion_id: suggestion.id,
        approved_by:   managerStaffId,
      });
      if (res.success) {
        setLocalStatus("done");
        onDone(suggestion.id);
      } else {
        setLocalStatus("idle");
        setErrorMsg(res.error ?? "Failed");
      }
    });
  }

  function handleReject() {
    setLocalStatus("rejecting");
    setErrorMsg(null);
    startTransition(async () => {
      const res = await rejectSuggestionAction({
        suggestion_id: suggestion.id,
        rejected_by:   managerStaffId,
      });
      if (res.success) {
        setLocalStatus("done");
        onDone(suggestion.id);
      } else {
        setLocalStatus("idle");
        setErrorMsg(res.error ?? "Failed");
      }
    });
  }

  if (localStatus === "done") return null;

  return (
    <div
      style={{
        border:          "1px solid #E5E7EB",
        borderRadius:    10,
        padding:         "0.875rem 1rem",
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "flex-start",
          justifyContent: "space-between",
          gap:            "0.75rem",
          marginBottom:   "0.5rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{headline}</span>
            <span
              style={{
                fontSize:        "0.7rem",
                fontWeight:      600,
                padding:         "0.15rem 0.5rem",
                borderRadius:    100,
                backgroundColor: priorityStyle.bg,
                color:           priorityStyle.text,
                textTransform:   "uppercase",
              }}
            >
              {suggestion.priority}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>{suggestion.target_date}</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#6B7280", margin: "0.25rem 0 0" }}>{detail}</p>
        </div>
      </div>

      {errorMsg && (
        <p style={{ fontSize: "0.75rem", color: "#DC2626", margin: "0 0 0.5rem" }}>{errorMsg}</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={actionPending}
          onClick={handleReject}
          style={{
            padding:         "0.3rem 0.75rem",
            backgroundColor: "#fff",
            color:           "#374151",
            border:          "1px solid #D1D5DB",
            borderRadius:    8,
            fontSize:        "0.8rem",
            cursor:          actionPending ? "not-allowed" : "pointer",
            opacity:         localStatus === "rejecting" ? 0.7 : 1,
          }}
        >
          {localStatus === "rejecting" ? "Rejecting…" : "Reject"}
        </button>
        <button
          type="button"
          disabled={actionPending}
          onClick={handleApprove}
          style={{
            padding:         "0.3rem 0.75rem",
            backgroundColor: "#7C3AED",
            color:           "#fff",
            border:          "none",
            borderRadius:    8,
            fontSize:        "0.8rem",
            cursor:          actionPending ? "not-allowed" : "pointer",
            opacity:         localStatus === "approving" ? 0.7 : 1,
          }}
        >
          {localStatus === "approving" ? "Approving…" : "Approve & Apply"}
        </button>
      </div>
    </div>
  );
}

export function SuggestionsReviewPanel({ suggestions: initial, managerStaffId }: Props) {
  const [visible, setVisible] = useState(initial.map((s) => s.id));

  function dismiss(id: string) {
    setVisible((prev) => prev.filter((v) => v !== id));
  }

  const shown = initial.filter((s) => visible.includes(s.id));

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border:          "1px solid #E5E7EB",
        borderRadius:    12,
        padding:         "1.25rem 1.5rem",
      }}
    >
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   "0.875rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          Pending Suggestions
          {shown.length > 0 && (
            <span
              style={{
                marginLeft:      "0.5rem",
                fontSize:        "0.75rem",
                fontWeight:      600,
                backgroundColor: "#EDE9FE",
                color:           "#5B21B6",
                padding:         "0.15rem 0.5rem",
                borderRadius:    100,
              }}
            >
              {shown.length}
            </span>
          )}
        </h2>
      </div>

      {shown.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "#9CA3AF" }}>
          No pending suggestions. Run &quot;Generate Suggestions&quot; from the health panel to create new ones.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {shown.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              managerStaffId={managerStaffId}
              onDone={dismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}

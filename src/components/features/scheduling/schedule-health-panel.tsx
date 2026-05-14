"use client";

import { useState, useTransition } from "react";
import { generateSuggestionsAction } from "@/app/(dashboard)/manager/scheduling/actions";
import type { ScheduleHealthCheck, ScheduleHealthStatus } from "@/lib/scheduling/types";

interface Props {
  health: ScheduleHealthCheck | null;
  date: string;
}

const STATUS_COLORS: Record<ScheduleHealthStatus, { bg: string; text: string; label: string }> = {
  ok:       { bg: "#ECFDF5", text: "#065F46", label: "Healthy" },
  warning:  { bg: "#FFFBEB", text: "#92400E", label: "Warning" },
  critical: { bg: "#FEF2F2", text: "#991B1B", label: "Critical" },
};

function CountCard({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div
      style={{
        backgroundColor: muted ? "#F9FAFB" : "#fff",
        border:          "1px solid #E5E7EB",
        borderRadius:    8,
        padding:         "0.625rem 0.875rem",
        textAlign:       "center",
      }}
    >
      <p style={{ fontSize: "1.375rem", fontWeight: 700, margin: 0, color: muted ? "#9CA3AF" : "#111827" }}>
        {value}
      </p>
      <p style={{ fontSize: "0.7rem", color: "#6B7280", margin: "0.125rem 0 0" }}>{label}</p>
    </div>
  );
}

export function ScheduleHealthPanel({ health, date }: Props) {
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setGenerating(true);
    setGenMsg(null);
    startTransition(async () => {
      const res = await generateSuggestionsAction({ branch_id: health?.branch_id ?? "", date });
      setGenerating(false);
      if (res.success && "data" in res) {
        const count = (res.data as { suggestions?: unknown[] }).suggestions?.length ?? 0;
        setGenMsg(count > 0 ? `${count} suggestion(s) generated.` : "No new suggestions needed.");
      } else {
        setGenMsg("error" in res ? (res.error ?? "Error generating suggestions.") : "Error.");
      }
    });
  }

  if (!health) {
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
            marginBottom:   "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Schedule Health</h2>
          <button
            type="button"
            disabled={isPending || generating}
            onClick={handleGenerate}
            style={{
              padding:         "0.375rem 0.875rem",
              backgroundColor: "#7C3AED",
              color:           "#fff",
              border:          "none",
              borderRadius:    8,
              fontSize:        "0.8rem",
              cursor:          generating ? "not-allowed" : "pointer",
              opacity:         generating ? 0.7 : 1,
            }}
          >
            {generating ? "Generating…" : "Generate Suggestions"}
          </button>
        </div>

        <p style={{ fontSize: "0.875rem", color: "#6B7280" }}>
          No health check run yet for {date}. Run &quot;Generate Suggestions&quot; to analyse coverage.
        </p>
        {genMsg && (
          <p style={{ fontSize: "0.8rem", color: "#374151", marginTop: "0.5rem" }}>{genMsg}</p>
        )}
      </div>
    );
  }

  const statusStyle = STATUS_COLORS[health.status as ScheduleHealthStatus] ?? STATUS_COLORS.ok;
  const issues      = Array.isArray(health.issues)
    ? (health.issues as Array<{ message: string; severity: string }>)
    : [];
  const recommendations = Array.isArray(health.recommendations)
    ? (health.recommendations as string[])
    : [];

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Schedule Health</h2>
          <span
            style={{
              fontSize:        "0.75rem",
              fontWeight:      600,
              padding:         "0.2rem 0.6rem",
              borderRadius:    100,
              backgroundColor: statusStyle.bg,
              color:           statusStyle.text,
            }}
          >
            {statusStyle.label}
          </span>
        </div>

        <button
          type="button"
          disabled={isPending || generating}
          onClick={handleGenerate}
          style={{
            padding:         "0.375rem 0.875rem",
            backgroundColor: "#7C3AED",
            color:           "#fff",
            border:          "none",
            borderRadius:    8,
            fontSize:        "0.8rem",
            cursor:          generating ? "not-allowed" : "pointer",
            opacity:         generating ? 0.7 : 1,
          }}
        >
          {generating ? "Generating…" : "Refresh"}
        </button>
      </div>

      {/* Count grid */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:                 "0.5rem",
          marginBottom:        "0.875rem",
        }}
      >
        <CountCard label="Available staff" value={health.available_staff_count} />
        <CountCard label="Therapists"      value={health.available_therapists_count} />
        <CountCard label="Drivers"         value={health.available_drivers_count} />
        <CountCard label="Missing"         value={health.missing_staff_count}     muted={health.missing_staff_count === 0} />
        <CountCard label="Affected bookings" value={health.affected_bookings_count} muted={health.affected_bookings_count === 0} />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", margin: "0 0 0.375rem" }}>
            ISSUES
          </p>
          {issues.map((issue, i) => (
            <div
              key={i}
              style={{
                display:         "flex",
                alignItems:      "flex-start",
                gap:             "0.5rem",
                padding:         "0.375rem 0",
                borderTop:       i > 0 ? "1px solid #F3F4F6" : "none",
              }}
            >
              <span
                style={{
                  width:           8,
                  height:          8,
                  borderRadius:    "50%",
                  backgroundColor: issue.severity === "critical" ? "#EF4444" : "#F59E0B",
                  flexShrink:      0,
                  marginTop:       5,
                }}
              />
              <p style={{ fontSize: "0.8rem", color: "#374151", margin: 0 }}>{issue.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6B7280", margin: "0 0 0.375rem" }}>
            RECOMMENDATIONS
          </p>
          {recommendations.map((rec, i) => (
            <p
              key={i}
              style={{
                fontSize:  "0.8rem",
                color:     "#374151",
                margin:    0,
                padding:   "0.25rem 0",
                borderTop: i > 0 ? "1px solid #F3F4F6" : "none",
              }}
            >
              {rec}
            </p>
          ))}
        </div>
      )}

      {genMsg && (
        <p style={{ fontSize: "0.8rem", color: "#374151", marginTop: "0.5rem" }}>{genMsg}</p>
      )}
    </div>
  );
}

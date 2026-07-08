"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { AssignmentRecommendationCard } from "./assignment-recommendation-card";
import type { ScoredStaff } from "@/lib/assignments/recommendation-engine";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  bookingId: string;
  fetchRecommendations: (input: { bookingId: string }) => Promise<
    | { success: true; data: { therapists: ScoredStaff[]; drivers: ScoredStaff[] } }
    | { success: false; error: string }
  >;
  onAssignTherapist?: (staffId: string, overrideReason?: string) => void;
  onAssignDriver?: (staffId: string) => void;
  currentTherapistId?: string | null;
  currentDriverId?: string | null;
  showTherapists?: boolean;
  showDrivers?: boolean;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function AssignmentRecommendationPanel({
  bookingId,
  fetchRecommendations,
  onAssignTherapist,
  onAssignDriver,
  currentTherapistId,
  currentDriverId,
  showTherapists = true,
  showDrivers = true,
}: Props) {
  const [recommendations, setRecommendations] = useState<{
    therapists: ScoredStaff[];
    drivers: ScoredStaff[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const autoLoadAttemptedRef = useRef(false);

  const hasLoaded = recommendations !== null;

  const loadRecommendations = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await fetchRecommendations({ bookingId });
      if (result.success) {
        setRecommendations(result.data);
      } else {
        setError(result.error);
      }
    });
  }, [bookingId, fetchRecommendations]);

  // Auto-load recommendations once when the panel mounts for a given booking.
  // State is only updated inside the async transition callback to avoid
  // synchronous setState in the effect body.
  useEffect(() => {
    if (!autoLoadAttemptedRef.current && !hasLoaded && !isPending && bookingId) {
      autoLoadAttemptedRef.current = true;
      startTransition(async () => {
        const result = await fetchRecommendations({ bookingId });
        if (result.success) {
          setRecommendations(result.data);
        } else {
          setError(result.error);
        }
      });
    }
  }, [bookingId, hasLoaded, isPending, fetchRecommendations]);

  const topTherapist = showTherapists
    ? recommendations?.therapists.find((t) => t.status !== "unavailable") ?? null
    : null;
  const topDriver = showDrivers
    ? recommendations?.drivers.find((d) => d.status !== "unavailable") ?? null
    : null;
  const altTherapists = showTherapists
    ? (recommendations?.therapists.filter(
        (t) => t.staffId !== topTherapist?.staffId
      ) ?? [])
    : [];
  const altDrivers = showDrivers
    ? (recommendations?.drivers.filter((d) => d.staffId !== topDriver?.staffId) ?? [])
    : [];

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface-warm)",
        border: "1px solid var(--cs-border-soft)",
        borderRadius: "var(--cs-r-md)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={isPending}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={14} color="var(--cs-sand)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--cs-text)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Assignment Assistant
          </span>
          {hasLoaded && (
            <span style={{ fontSize: 10, color: "var(--cs-text-muted)" }}>
              {showTherapists && topTherapist ? `Therapist: ${topTherapist.displayName}` : ""}
              {showTherapists && topTherapist && showDrivers && topDriver ? " · " : ""}
              {showDrivers && topDriver ? `Driver: ${topDriver.displayName}` : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isPending && <Loader2 size={14} color="var(--cs-text-muted)" className="animate-spin" />}
          {expanded ? (
            <ChevronUp size={14} color="var(--cs-text-muted)" />
          ) : (
            <ChevronDown size={14} color="var(--cs-text-muted)" />
          )}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "var(--cs-text-muted)", lineHeight: 1.4 }}>
            Suggestions use attendance queue, service capability, schedule, and current workload.
          </div>

          {hasLoaded && (
            <button
              type="button"
              onClick={loadRecommendations}
              disabled={isPending}
              style={{
                padding: "6px 10px",
                borderRadius: "var(--cs-r-sm)",
                border: "1px solid var(--cs-sand)",
                backgroundColor: "var(--cs-sand-mist)",
                color: "var(--cs-sand-dark)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
              }}
            >
              <RefreshCw size={12} />
              Refresh Suggestions
            </button>
          )}

          {!hasLoaded && !isPending && (
            <button
              type="button"
              onClick={loadRecommendations}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--cs-r-sm)",
                border: "1px solid var(--cs-sand)",
                backgroundColor: "var(--cs-sand-mist)",
                color: "var(--cs-sand-dark)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Get Recommendations
            </button>
          )}

          {error && (
            <div style={{ fontSize: 11, color: "var(--cs-error-text)", padding: "6px 8px", backgroundColor: "var(--cs-error-bg)", borderRadius: "var(--cs-r-sm)" }}>
              {error}
            </div>
          )}

          {/* Top Therapist */}
          {showTherapists && topTherapist && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Best Therapist
              </div>
              <AssignmentRecommendationCard
                candidate={topTherapist}
                onAssign={onAssignTherapist}
                assignLabel="Assign Therapist"
                isAssigned={currentTherapistId === topTherapist.staffId}
                topSuggestedId={topTherapist.staffId}
              />
            </div>
          )}

          {/* Alternative Therapists */}
          {showTherapists && altTherapists.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Alternative Therapists
              </div>
              {altTherapists.slice(0, 3).map((candidate) => (
                <AssignmentRecommendationCard
                  key={candidate.staffId}
                  candidate={candidate}
                  onAssign={onAssignTherapist}
                  assignLabel="Assign"
                  isAssigned={currentTherapistId === candidate.staffId}
                  topSuggestedId={topTherapist?.staffId}
                />
              ))}
            </div>
          )}

          {/* Top Driver */}
          {showDrivers && topDriver && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Best Driver
              </div>
              <AssignmentRecommendationCard
                candidate={topDriver}
                onAssign={onAssignDriver}
                assignLabel="Assign Driver"
                isAssigned={currentDriverId === topDriver.staffId}
              />
            </div>
          )}

          {/* Alternative Drivers */}
          {showDrivers && altDrivers.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Alternative Drivers
              </div>
              {altDrivers.slice(0, 3).map((candidate) => (
                <AssignmentRecommendationCard
                  key={candidate.staffId}
                  candidate={candidate}
                  onAssign={onAssignDriver}
                  assignLabel="Assign"
                  isAssigned={currentDriverId === candidate.staffId}
                />
              ))}
            </div>
          )}

          {hasLoaded && !topTherapist && !topDriver && !error && (
            <div style={{ fontSize: 12, color: "var(--cs-text-muted)", textAlign: "center", padding: "8px 0" }}>
              No available recommendations for this booking.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

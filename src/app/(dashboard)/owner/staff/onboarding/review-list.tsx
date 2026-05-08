"use client";

import { useState, useTransition } from "react";
import { approveOnboardingAction, rejectOnboardingAction } from "@/app/staff-onboarding/actions";
import type { Database } from "@/types/supabase";

type OnboardingRequest = Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];
type Branch = { id: string; name: string };

const SYSTEM_ROLES = [
  { value: "staff", label: "Service Staff" },
  { value: "csr_staff", label: "CSR Staff" },
  { value: "csr", label: "CRM / Front Desk" },
];

const OWNER_EXTRA_ROLES = [
  { value: "csr_head", label: "CSR Head" },
  { value: "manager", label: "Manager" },
];

const TIERS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
];

const PREFERRED_ROLE_LABELS: Record<string, string> = {
  therapist: "Therapist / Service Staff",
  csr: "CSR / Front Desk",
  driver: "Driver",
  utility: "Utility / Room Prep",
  other: "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function RequestCard({
  request,
  branches,
  isOwner,
  reviewerBranchId,
}: {
  request: OnboardingRequest;
  branches: Branch[];
  isOwner: boolean;
  reviewerBranchId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const availableRoles = isOwner
    ? [...SYSTEM_ROLES, ...OWNER_EXTRA_ROLES]
    : SYSTEM_ROLES;

  const defaultBranchId = request.requested_branch_id ?? reviewerBranchId ?? branches[0]?.id ?? "";

  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [selectedRole, setSelectedRole] = useState("staff");
  const [selectedTier, setSelectedTier] = useState("junior");

  function handleApprove() {
    if (!request.staff_id) { setApproveError("No staff record linked to this request."); return; }
    setApproveError(null);
    startTransition(async () => {
      const result = await approveOnboardingAction({
        requestId: request.id,
        staffId: request.staff_id!,
        branchId: selectedBranchId,
        systemRole: selectedRole,
        tier: selectedTier,
      });
      if (!result.success) setApproveError(result.error ?? "Failed to approve");
      else window.location.reload();
    });
  }

  function handleReject() {
    setRejectError(null);
    startTransition(async () => {
      const result = await rejectOnboardingAction({
        requestId: request.id,
        staffId: request.staff_id ?? "",
        rejectionReason: rejectionReason.trim() || undefined,
      });
      if (!result.success) setRejectError(result.error ?? "Failed to reject");
      else window.location.reload();
    });
  }

  const isSubmitted = request.status === "submitted";

  return (
    <div
      style={{
        backgroundColor: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: "1.5rem" }}>👤</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: "var(--cs-text)", fontSize: "0.9375rem" }}>
            {request.full_name}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)" }}>
            {request.email} · {request.phone ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 20,
              backgroundColor:
                request.status === "submitted" ? "var(--cs-warning-bg, #FEF9C3)" :
                request.status === "approved"  ? "var(--cs-success-bg)" :
                "var(--cs-border)",
              color:
                request.status === "submitted" ? "#92400E" :
                request.status === "approved"  ? "var(--cs-success)" :
                "var(--cs-text-muted)",
              textTransform: "capitalize",
            }}
          >
            {request.status}
          </span>
          <span style={{ color: "var(--cs-text-muted)", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 1rem 1rem",
            borderTop: "1px solid var(--cs-border)",
          }}
        >
          {/* Details grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.625rem",
              padding: "0.875rem 0",
              fontSize: "0.8125rem",
            }}
          >
            {[
              { label: "Preferred role", value: PREFERRED_ROLE_LABELS[request.preferred_role ?? ""] ?? request.preferred_role ?? "—" },
              { label: "Requested branch", value: request.requested_branch_id ?? "No preference" },
              { label: "Address", value: request.address ?? "—" },
              { label: "Emergency contact", value: request.emergency_contact_name ? `${request.emergency_contact_name} · ${request.emergency_contact_phone ?? "—"}` : "—" },
              { label: "Submitted", value: formatDate(request.created_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ color: "var(--cs-text-muted)", marginBottom: 2 }}>{label}</div>
                <div style={{ color: "var(--cs-text)", fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {request.experience_notes && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "var(--cs-surface-warm)",
                borderRadius: 6,
                fontSize: "0.8125rem",
                color: "var(--cs-text-secondary)",
                lineHeight: 1.6,
                marginBottom: "0.875rem",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.04em" }}>
                Experience notes
              </span>
              <p style={{ margin: "0.375rem 0 0" }}>{request.experience_notes}</p>
            </div>
          )}

          {/* Approve controls */}
          {isSubmitted && (
            <div
              style={{
                backgroundColor: "var(--cs-surface-warm)",
                border: "1px solid var(--cs-border)",
                borderRadius: 8,
                padding: "0.875rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Assign &amp; Approve
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Branch</label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    title="Assign branch"
                    style={selectStyle}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    title="Assign role"
                    style={selectStyle}
                  >
                    {availableRoles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>Tier</label>
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    title="Assign tier"
                    style={selectStyle}
                  >
                    {TIERS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {approveError && <p style={{ fontSize: "0.8125rem", color: "#DC2626", margin: 0 }}>{approveError}</p>}

              <button
                onClick={handleApprove}
                disabled={isPending}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "var(--cs-success, #16A34A)",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                  alignSelf: "flex-start",
                }}
              >
                {isPending ? "Approving…" : "Approve & Activate"}
              </button>

              {/* Reject section */}
              <div style={{ borderTop: "1px solid var(--cs-border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Reject
                </div>
                <input
                  type="text"
                  placeholder="Rejection reason (optional)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{
                    ...selectStyle,
                    height: "2.25rem",
                    padding: "0 0.75rem",
                  }}
                />
                {rejectError && <p style={{ fontSize: "0.8125rem", color: "#DC2626", margin: 0 }}>{rejectError}</p>}
                <button
                  onClick={handleReject}
                  disabled={isPending}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #FECACA",
                    backgroundColor: "#FEF2F2",
                    color: "#991B1B",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.7 : 1,
                    alignSelf: "flex-start",
                  }}
                >
                  {isPending ? "Rejecting…" : "Reject Application"}
                </button>
              </div>
            </div>
          )}

          {!isSubmitted && request.rejection_reason && (
            <div style={{ fontSize: "0.8125rem", color: "var(--cs-text-muted)", padding: "0.625rem", backgroundColor: "var(--cs-surface-warm)", borderRadius: 6 }}>
              <span style={{ fontWeight: 600 }}>Reason: </span>{request.rejection_reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: "2.25rem",
  padding: "0 0.625rem",
  borderRadius: 6,
  border: "1px solid var(--cs-border)",
  backgroundColor: "var(--cs-surface)",
  color: "var(--cs-text)",
  fontSize: "0.8125rem",
  boxSizing: "border-box",
};

export function OnboardingReviewList({
  requests,
  branches,
  isOwner,
  reviewerBranchId,
}: {
  requests: OnboardingRequest[];
  branches: Branch[];
  isOwner: boolean;
  reviewerBranchId: string | null;
}) {
  if (requests.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 1rem",
          color: "var(--cs-text-muted)",
          fontSize: "0.9375rem",
        }}
      >
        No requests in this status.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          branches={branches}
          isOwner={isOwner}
          reviewerBranchId={reviewerBranchId}
        />
      ))}
    </div>
  );
}

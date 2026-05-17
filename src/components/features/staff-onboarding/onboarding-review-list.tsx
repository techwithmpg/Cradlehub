"use client";

import { useState, useTransition } from "react";
import { approveOnboardingAction, rejectOnboardingAction } from "@/app/staff-onboarding/actions";
import { canApproveStaffOnboarding } from "@/lib/staff/approval-permissions";
import { getOnboardingRoleLabel } from "@/lib/staff/onboarding-roles";
import { isTherapistRole } from "@/lib/staff/profile-completeness";
import { ROLE_LABELS } from "@/lib/permissions";
import { InlineWorkflowTaskCard } from "@/components/features/notifications/inline-workflow-task-card";
import type { Database } from "@/types/supabase";
import type { WorkflowTask } from "@/lib/notifications/types";

type OnboardingRequest = Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];
type Branch = { id: string; name: string };

const ALL_TIERS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "n/a", label: "N/A" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function readRequestNickname(metadata: OnboardingRequest["metadata"]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const nickname = (metadata as { nickname?: unknown }).nickname;
  return typeof nickname === "string" && nickname.trim().length > 0 ? nickname.trim() : null;
}

function RequestCard({
  request,
  branches,
  reviewerSystemRole,
  reviewerBranchId,
  workflowTask,
}: {
  request: OnboardingRequest;
  branches: Branch[];
  reviewerSystemRole: string;
  reviewerBranchId: string | null;
  workflowTask?: WorkflowTask;
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const approvalCheck = canApproveStaffOnboarding({
    approverRole: reviewerSystemRole,
    approverBranchId: reviewerBranchId,
    targetBranchId: request.requested_branch_id,
    requestedSystemRole: request.preferred_role === "managerial" ? "manager" : "staff",
  });

  const availableRoles = approvalCheck.assignableRoles.map((r) => ({ 
    value: r, 
    label: ROLE_LABELS[r] ?? r 
  }));

  const defaultBranchId = request.requested_branch_id ?? reviewerBranchId ?? branches[0]?.id ?? "";
  const isApplicantTherapist = isTherapistRole(request.preferred_role ?? "");
  const nickname = readRequestNickname(request.metadata);

  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  
  // Smart default role assignment
  const initialRole = () => {
    if (request.preferred_role === "csr") return approvalCheck.assignableRoles.includes("csr_staff") ? "csr_staff" : "staff";
    if (request.preferred_role === "driver") return approvalCheck.assignableRoles.includes("driver") ? "driver" : "staff";
    if (request.preferred_role === "utility") return approvalCheck.assignableRoles.includes("utility") ? "utility" : "staff";
    return approvalCheck.assignableRoles.includes("staff") ? "staff" : (approvalCheck.assignableRoles[0] ?? "staff");
  };

  const [selectedRole, setSelectedRole] = useState(initialRole());
  const [selectedTier, setSelectedTier] = useState(isApplicantTherapist ? "junior" : "n/a");

  const requestedServiceIds = (request.metadata as { requested_service_ids?: string[] } | null)?.requested_service_ids ?? [];

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
        serviceIds: requestedServiceIds,
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
  const canApprove = approvalCheck.allowed;

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
            {request.email} · {nickname ? `Known as ${nickname} · ` : ""}{request.phone ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {!canApprove && isSubmitted && (
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--cs-error)", background: "var(--cs-error-bg)", padding: "2px 8px", borderRadius: 4 }}>
              Owner/Manager required
            </span>
          )}
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
          {workflowTask && isSubmitted && <InlineWorkflowTaskCard task={workflowTask} />}

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
              { label: "Preferred role", value: getOnboardingRoleLabel(request.preferred_role ?? "") },
              { label: "Nickname", value: nickname ?? "—" },
              { label: "Requested branch", value: branches.find(b => b.id === request.requested_branch_id)?.name ?? request.requested_branch_id ?? "No preference" },
              { label: "Services requested", value: requestedServiceIds.length > 0 ? `${requestedServiceIds.length} service(s)` : "None — will use legacy fallback" },
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

              {!canApprove && (
                <div style={{ padding: "0.75rem", backgroundColor: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: 6, fontSize: "0.8125rem", color: "#991B1B" }}>
                  <strong>{approvalCheck.reason ?? "Owner/Manager approval required."}</strong>
                  <p style={{ margin: "4px 0 0", color: "#B91C1C", fontSize: "0.75rem" }}>
                    This role has management access and cannot be approved from the current workspace.
                  </p>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", opacity: canApprove ? 1 : 0.5, pointerEvents: canApprove ? "auto" : "none" }}>
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
                  <label style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {isApplicantTherapist ? "Therapist Level *" : "Tier"}
                  </label>
                  <select
                    value={selectedTier}
                    onChange={(e) => setSelectedTier(e.target.value)}
                    title="Assign tier"
                    style={selectStyle}
                  >
                    {ALL_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {isApplicantTherapist && selectedTier === "n/a" && (
                    <span style={{ fontSize: "0.75rem", color: "#92400E" }}>
                      Therapist level should be Junior, Mid, or Senior.
                    </span>
                  )}
                </div>
              </div>

              {approveError && <p style={{ fontSize: "0.8125rem", color: "#DC2626", margin: 0 }}>{approveError}</p>}

              <button
                onClick={handleApprove}
                disabled={isPending || !canApprove}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "var(--cs-success, #16A34A)",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: (isPending || !canApprove) ? "not-allowed" : "pointer",
                  opacity: (isPending || !canApprove) ? 0.7 : 1,
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
  reviewerSystemRole,
  reviewerBranchId,
  workflowTasks = [],
}: {
  requests: OnboardingRequest[];
  branches: Branch[];
  reviewerSystemRole: string;
  reviewerBranchId: string | null;
  workflowTasks?: WorkflowTask[];
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

  const taskByEntityId = new Map(workflowTasks.map((task) => [task.entity_id, task]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {requests.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          branches={branches}
          reviewerSystemRole={reviewerSystemRole}
          reviewerBranchId={reviewerBranchId}
          workflowTask={taskByEntityId.get(r.id)}
        />
      ))}
    </div>
  );
}

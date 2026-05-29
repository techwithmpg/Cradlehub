"use client";

import { OnboardingReviewList } from "@/components/features/staff-onboarding/onboarding-review-list";
import type { Database } from "@/types/supabase";

type OnboardingRequest = Database["public"]["Tables"]["staff_onboarding_requests"]["Row"];
type Branch = { id: string; name: string };

type Props = {
  requests: OnboardingRequest[];
  branches: Branch[];
  reviewerSystemRole: string;
  reviewerBranchId: string | null;
  canReviewOnboarding: boolean;
};

export function CrmStaffApplicationsTab({
  requests,
  branches,
  reviewerSystemRole,
  reviewerBranchId,
  canReviewOnboarding,
}: Props) {
  if (!canReviewOnboarding) {
    return (
      <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-center text-sm text-[var(--cs-text-muted)]">
        You do not have permission to review staff applications.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        style={{
          padding: "1rem",
          backgroundColor: "var(--cs-surface-warm)",
          borderRadius: 8,
          border: "1px solid var(--cs-border-soft)",
          fontSize: "0.8125rem",
          color: "var(--cs-text-muted)",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <span style={{ fontSize: "1.25rem" }}>ℹ️</span>
        <div>
          <p style={{ margin: 0, fontWeight: 500, color: "var(--cs-text)" }}>MVP Helper Note</p>
          <p style={{ margin: "4px 0 0" }}>
            CSR users can approve only normal operational staff (Therapists, Drivers, Utility, and Front Desk).
            Management roles require owner or manager approval.
          </p>
        </div>
      </div>

      <OnboardingReviewList
        requests={requests}
        branches={branches}
        reviewerSystemRole={reviewerSystemRole}
        reviewerBranchId={reviewerBranchId}
      />
    </div>
  );
}

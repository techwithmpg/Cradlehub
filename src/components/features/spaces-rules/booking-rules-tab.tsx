import { BranchBookingRulesForm } from "@/app/(dashboard)/owner/branches/[branchId]/branch-booking-rules-form";
import { RuleImpactPreview } from "./rule-impact-preview";
import type { BranchBookingRules } from "@/lib/validations/booking-rules";

export function BookingRulesTab({
  rules,
  canEdit,
}: {
  rules: BranchBookingRules;
  canEdit: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 300px",
        gap: "1.5rem",
        alignItems: "start",
      }}
    >
      <div>
        {!canEdit && (
          <div
            style={{
              padding: "0.625rem 0.875rem",
              backgroundColor: "#FEFCE8",
              border: "1px solid #FEF08A",
              borderRadius: 8,
              fontSize: "0.8125rem",
              color: "#854D0E",
              marginBottom: "1rem",
            }}
          >
            Booking rules are view-only in this workspace.
          </div>
        )}
        <BranchBookingRulesForm rules={rules} />
      </div>

      <RuleImpactPreview rules={rules} />
    </div>
  );
}

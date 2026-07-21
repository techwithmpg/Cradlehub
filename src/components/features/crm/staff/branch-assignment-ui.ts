import type {
  BranchAssignmentIssue,
  BranchAssignmentResolutionType,
} from "@/lib/staff/branch-correction-types";

export type BranchAssignmentDecision =
  | "temporary_shift"
  | "temporary_day"
  | "permanent_transfer";

export function formatBranchAssignmentDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function humanizeBranchAssignmentValue(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function branchAssignmentStatusLabel(issue: BranchAssignmentIssue): string {
  if (issue.status === "open") return "Pending";
  if (issue.status === "requires_review") return "Manager review";
  if (issue.resolutionType) return humanizeBranchAssignmentValue(issue.resolutionType);
  return humanizeBranchAssignmentValue(issue.status);
}

export function branchAssignmentResolutionForDecision(
  decision: BranchAssignmentDecision
): BranchAssignmentResolutionType {
  return decision === "permanent_transfer"
    ? "correct_permanent_primary_branch"
    : "grant_temporary_branch_access";
}

export function localIsoDate(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function temporaryBranchWindow(
  decision: Exclude<BranchAssignmentDecision, "permanent_transfer">,
  now = new Date()
): {
  validFrom: string;
  validUntil: string;
  effectiveDate: string;
  temporaryScope: "shift" | "business_day";
} {
  const validUntil = new Date(now);
  if (decision === "temporary_shift") {
    validUntil.setTime(now.getTime() + 12 * 60 * 60 * 1000);
  } else {
    validUntil.setDate(validUntil.getDate() + 1);
    validUntil.setHours(4, 0, 0, 0);
    if (validUntil <= now) validUntil.setDate(validUntil.getDate() + 1);
  }

  return {
    validFrom: now.toISOString(),
    validUntil: validUntil.toISOString(),
    effectiveDate: localIsoDate(now),
    temporaryScope: decision === "temporary_shift" ? "shift" : "business_day",
  };
}

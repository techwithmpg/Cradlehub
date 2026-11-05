import { z } from "zod";
import { isManager } from "@/lib/permissions";

export const assistanceStaffTypes = ["therapist", "nail_tech", "aesthetician"] as const;
export type AssistanceStaffType = (typeof assistanceStaffTypes)[number];
export type AssistanceStatus =
  | "requested"
  | "accepted_pending_activation"
  | "declined"
  | "cancelled";

export const requestAssistanceSchema = z.object({
  lendingBranchId: z.string().uuid(),
  staffType: z.enum(assistanceStaffTypes),
  staffCount: z.coerce.number().int().min(1).max(12),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(5).max(500),
});

export const decideAssistanceSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["accept", "decline"]),
  staffIds: z.array(z.string().uuid()).max(12).default([]),
  note: z.string().trim().max(500).default(""),
});

export const cancelAssistanceSchema = z.object({
  requestId: z.string().uuid(),
});

export type AssistanceRequest = {
  id: string;
  requesting_branch_id: string;
  lending_branch_id: string;
  staff_type: AssistanceStaffType;
  staff_count: number;
  starts_at: string;
  ends_at: string;
  reason: string;
  status: AssistanceStatus;
  requested_by_auth_user_id: string;
  decided_by_auth_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  selected_staff_ids: string[];
  created_at: string;
};

export function canDecideAssistance(role: string): boolean {
  return isManager(role);
}

/** This stage is explicitly non-operational: no booking or attendance mutations. */
export function assistanceMakesStaffBookable(status: AssistanceStatus): boolean {
  void status;
  return false;
}

export function validateAssistanceWindow(startsAt: string, endsAt: string, now: Date): string | null {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Enter valid dates.";
  if (start <= now.getTime()) return "The assistance window must start in the future.";
  if (end <= start || end - start > 16 * 60 * 60 * 1000)
    return "End time must be after start, within 16 hours.";
  return null;
}

export function formatAssistanceRole(type: AssistanceStaffType): string {
  return type === "nail_tech" ? "Nail technician"
    : type === "aesthetician" ? "Facialist / aesthetician"
    : "Therapist";
}

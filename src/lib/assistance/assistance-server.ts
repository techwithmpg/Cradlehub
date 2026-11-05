import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { createClient } from "@/lib/supabase/server";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import {
  type AssistanceRequest,
  assistanceStaffTypes,
} from "@/lib/assistance/assistance-contract";

/*
 * New tables deliberately have no browser grants/RLS policies.
 * Until authorized SQL deployment and db-types regeneration, use an untyped
 * server-only client with explicit result shapes; no service key reaches UI.
 */
export function assistanceDb(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

export async function requireAssistanceActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to manage assistance requests.");
  const context = await getFrontDeskContext();
  if (!canAccessCrmWorkspace(context.role)) throw new Error("Not authorized.");
  return {
    authUserId: user.id,
    role: context.role,
    branchId: context.branchId,
    branchName: context.branchName,
  };
}

export async function loadAssistanceWorkspace() {
  const actor = await requireAssistanceActor();
  const db = assistanceDb();
  const [branchesResult, requestsResult, staffResult] = await Promise.all([
    db.from("branches")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    db.from("branch_assistance_requests")
      .select("id,requesting_branch_id,lending_branch_id,staff_type,staff_count,starts_at,ends_at,reason,status,requested_by_auth_user_id,decided_by_auth_user_id,decided_at,decision_note,selected_staff_ids,created_at")
      .or(`requesting_branch_id.eq.${actor.branchId},lending_branch_id.eq.${actor.branchId}`)
      .order("created_at", { ascending: false })
      .limit(60),
    db.from("staff")
      .select("id,full_name,staff_type")
      .eq("branch_id", actor.branchId)
      .eq("is_active", true)
      .is("archived_at", null)
      .is("merged_into_staff_id", null)
      .in("staff_type", [...assistanceStaffTypes])
      .order("full_name"),
  ]);
  if (branchesResult.error || requestsResult.error || staffResult.error)
    throw new Error("Assistance workspace cannot load. Check whether the reviewed migration is installed.");
  return {
    actor,
    branches: (branchesResult.data ?? []) as Array<{ id: string; name: string }>,
    requests: (requestsResult.data ?? []) as AssistanceRequest[],
    staff: (staffResult.data ?? []) as Array<{ id: string; full_name: string; staff_type: string }>,
  };
}

/** Asia/Manila has a fixed +08:00 civil offset for the supported spa branches. */
function manilaYmd(ms: number): string {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
}

function startOfLocalBooking(date: string, clock: string): number {
  return Date.parse(`${date}T${clock.slice(0, 8)}+08:00`);
}

export async function ensureDesignatedStaffHaveNoConflicts(input: {
  staffIds: string[];
  lendingBranchId: string;
  staffType: string;
  startsAt: string;
  endsAt: string;
  ignoreRequestId: string;
}): Promise<string | null> {
  const db = assistanceDb();
  const uniqueIds = [...new Set(input.staffIds)];
  if (uniqueIds.length !== input.staffIds.length) return "Choose each staff member only once.";

  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  const fromDate = manilaYmd(start - 86400_000);
  const untilDate = manilaYmd(end);

  const [staffResult, bookingsResult, transfersResult] = await Promise.all([
    db.from("staff").select("id,branch_id,staff_type,is_active,archived_at,merged_into_staff_id")
      .in("id", uniqueIds),
    db.from("bookings")
      .select("id,staff_id,booking_date,start_time,end_time,status")
      .in("staff_id", uniqueIds)
      .gte("booking_date", fromDate)
      .lte("booking_date", untilDate)
      .not("status", "in", '("cancelled","no_show","expired")'),
    db.from("branch_assistance_requests")
      .select("id,selected_staff_ids")
      .eq("status", "accepted_pending_activation")
      .lt("starts_at", input.endsAt)
      .gt("ends_at", input.startsAt)
      .neq("id", input.ignoreRequestId)
      .overlaps("selected_staff_ids", uniqueIds),
  ]);
  if (staffResult.error || bookingsResult.error || transfersResult.error)
    return "Staff availability could not be checked. Try again.";

  const eligible = (staffResult.data ?? []).filter((person) =>
    person.branch_id === input.lendingBranchId &&
    person.staff_type === input.staffType &&
    person.is_active === true &&
    person.archived_at == null &&
    person.merged_into_staff_id == null
  );
  if (eligible.length !== uniqueIds.length)
    return "One or more selected staff members are not active, qualified, or assigned to the lending branch.";

  const busy = (bookingsResult.data ?? []).some((booking) => {
    const bookedStart = startOfLocalBooking(booking.booking_date, booking.start_time);
    let bookedEnd = startOfLocalBooking(booking.booking_date, booking.end_time);
    if (!Number.isFinite(bookedStart) || !Number.isFinite(bookedEnd)) return true;
    if (bookedEnd <= bookedStart) bookedEnd += 86400_000;
    return bookedStart < end && bookedEnd > start;
  });
  if (busy) return "A selected staff member has a conflicting booking. Choose another.";
  if ((transfersResult.data ?? []).length > 0)
    return "A selected staff member is already designated for overlapping assistance.";
  return null;
}

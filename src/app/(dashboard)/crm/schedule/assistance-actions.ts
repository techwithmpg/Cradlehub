"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { canonicalizeSystemRole } from "@/constants/staff";
import { createNotification } from "@/lib/notifications/create";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import {
  assistanceSubmitSchema,
  assistanceDecisionSchema,
  canSubmitAssistance,
  canReviewAssistance,
  canCancelAssistance,
} from "@/lib/staff/interbranch-assistance-request-policy";
import type { AssistanceRole, AssistanceVisitType } from "@/lib/staff/interbranch-assistance-contract";

const TABLE = "staff_assistance_requests";
const MANILA_OFFSET_HOURS = 8;

export type AssistanceRequestRecord = {
  id: string;
  requesting_branch_id: string;
  lending_branch_id: string;
  requested_role: AssistanceRole;
  quantity: number;
  visit_type: AssistanceVisitType;
  start_at: string;
  end_at: string;
  notes: string;
  status: "requested" | "approved_pending_arrival" | "declined" | "cancelled";
  selected_staff_ids: string[];
  requested_by_auth_user_id: string;
  reviewed_by_auth_user_id: string | null;
  decision_note: string;
  created_at: string;
  reviewed_at: string | null;
};

export type AssistanceView = AssistanceRequestRecord & {
  requesting_branch_name: string;
  lending_branch_name: string;
  selected_staff_names: string[];
};

export type AssistanceDashboard = {
  branchId: string;
  branchName: string;
  role: string;
  branchAllowsHomeService: boolean;
  branches: Array<{ id: string; name: string }>;
  requests: AssistanceView[];
};

export type AssistanceCandidateView = {
  id: string;
  name: string;
  hasBookingConflict: boolean;
  hasAssistanceConflict: boolean;
};

type AssistanceResult<T> = { success: true; data: T } | { success: false; error: string };

function failure<T>(error: string): AssistanceResult<T> {
  return { success: false, error };
}
function enabled() {
  return process.env.CRADLEHUB_INTERBRANCH_ASSISTANCE_ENABLED === "true";
}

async function getActor() {
  if (!enabled()) return null;
  const ctx = await getFrontDeskContext();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ctx.branchId) return null;
  const role = canonicalizeSystemRole(ctx.role);
  if (!canSubmitAssistance(role)) return null;
  return { role, branchId: ctx.branchId, branchName: ctx.branchName, userId: user.id };
}

function adminDb(): SupabaseClient {
  // Only this server action can use an untyped table until regenerated DB types
  // are reviewed. All incoming payloads and roles are validated before writes.
  return createAdminClient() as unknown as SupabaseClient;
}

function isMissingSchema(error: { code?: string | null; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205"));
}

async function branchAllowsHomeService(db: SupabaseClient, branchId: string) {
  const { data, error } = await db.from("branch_booking_rules")
    .select("home_service_enabled").eq("branch_id", branchId).maybeSingle();
  if (error) return false;
  return data?.home_service_enabled === true;
}

/** Stage B list: scope reads to the requesting or lending branch explicitly. */
export async function loadStaffAssistanceAction(): Promise<AssistanceResult<AssistanceDashboard>> {
  const actor = await getActor();
  if (!actor) return failure("Staff Assistance has not been activated.");
  const db = adminDb();
  const [branchesResult, requestsResult, homeEnabled] = await Promise.all([
    db.from("branches").select("id,name").eq("is_active", true).order("name"),
    db.from(TABLE).select("*")
      .or(`requesting_branch_id.eq.${actor.branchId},lending_branch_id.eq.${actor.branchId}`)
      .order("created_at", { ascending: false }).limit(100),
    branchAllowsHomeService(db, actor.branchId),
  ]);
  if (branchesResult.error || requestsResult.error) {
    return failure(isMissingSchema(requestsResult.error)
      ? "Assistance database setup is pending. Contact the system administrator."
      : "Could not load assistance requests.");
  }
  const branches = (branchesResult.data ?? []) as Array<{ id: string; name: string }>;
  const requests = (requestsResult.data ?? []) as AssistanceRequestRecord[];
  const branchNames = new Map(branches.map((b) => [b.id, b.name]));
  const selectedIds = [...new Set(requests.flatMap((request) => request.selected_staff_ids ?? []))];
  const names = new Map<string, string>();
  if (selectedIds.length) {
    const selectedResult = await db.from("staff").select("id,full_name,nickname").in("id", selectedIds);
    if (selectedResult.error) return failure("Approved staff names could not be loaded.");
    for (const member of selectedResult.data ?? []) {
      names.set(member.id as string, String(member.nickname || member.full_name || "Staff member"));
    }
  }
  return {
    success: true,
    data: {
      branchId: actor.branchId,
      branchName: actor.branchName,
      role: actor.role,
      branchAllowsHomeService: homeEnabled,
      branches,
      requests: requests.map((request) => ({
        ...request,
        requesting_branch_name: branchNames.get(request.requesting_branch_id) ?? "Requesting branch",
        lending_branch_name: branchNames.get(request.lending_branch_id) ?? "Lending branch",
        selected_staff_names: request.selected_staff_ids.map((id) => names.get(id) ?? "Staff member"),
      })),
    },
  };
}

function toManilaDate(instant: string): string {
  const ms = Date.parse(instant) + MANILA_OFFSET_HOURS * 3600_000;
  return new Date(ms).toISOString().slice(0, 10);
}
function bookingWindow(row: { booking_date: string; start_time: string; end_time: string }) {
  const start = Date.parse(`${row.booking_date}T${row.start_time.slice(0, 8)}+08:00`);
  const end0 = Date.parse(`${row.booking_date}T${row.end_time.slice(0, 8)}+08:00`);
  return { start, end: end0 <= start ? end0 + 86400000 : end0 };
}

async function candidateConflicts(
  db: SupabaseClient,
  request: AssistanceRequestRecord,
  staffIds: string[],
): Promise<AssistanceResult<{ booked: Set<string>; assisting: Set<string> }>> {
  if (!staffIds.length) return { success: true, data: { booked: new Set(), assisting: new Set() } };
  const startDate = toManilaDate(new Date(Date.parse(request.start_at) - 86400000).toISOString());
  const endDate = toManilaDate(request.end_at);
  const [bookings, assistance] = await Promise.all([
    db.from("bookings")
      .select("staff_id,booking_date,start_time,end_time,status,hold_expires_at")
      .in("staff_id", staffIds).gte("booking_date", startDate).lte("booking_date", endDate),
    db.from(TABLE)
      .select("id,selected_staff_ids")
      .eq("status", "approved_pending_arrival")
      .lt("start_at", request.end_at).gt("end_at", request.start_at)
      .neq("id", request.id),
  ]);
  if (bookings.error || assistance.error) return failure("Could not verify staff booking conflicts.");
  const booked = new Set<string>();
  for (const raw of bookings.data ?? []) {
    const b = raw as { staff_id: string | null; booking_date: string; start_time: string; end_time: string; status: string; hold_expires_at: string | null };
    if (!b.staff_id || !bookingBlocksAvailability(b)) continue;
    if (!b.start_time || !b.end_time || !b.booking_date) {
      booked.add(b.staff_id); // fail closed on incomplete legacy booking timing
      continue;
    }
    const range = bookingWindow(b);
    if (range.start < Date.parse(request.end_at) && Date.parse(request.start_at) < range.end) {
      booked.add(b.staff_id);
    }
  }
  const assisting = new Set<string>();
  for (const row of assistance.data ?? []) {
    for (const id of (row.selected_staff_ids as string[] | null) ?? []) assisting.add(id);
  }
  return { success: true, data: { booked, assisting } };
}

async function loadCandidates(
  db: SupabaseClient,
  request: AssistanceRequestRecord,
): Promise<AssistanceResult<AssistanceCandidateView[]>> {
  const { data: staff, error } = await db.from("staff")
    .select("id,full_name,nickname,staff_type,branch_id,is_active,archived_at,merged_into_staff_id")
    .eq("branch_id", request.lending_branch_id)
    .eq("staff_type", request.requested_role)
    .eq("is_active", true).is("archived_at", null).is("merged_into_staff_id", null)
    .order("full_name").limit(250);
  if (error) return failure("Could not load staff for the lending branch.");
  const ids = (staff ?? []).map((person) => String(person.id));
  const conflicts = await candidateConflicts(db, request, ids);
  if (!conflicts.success) return conflicts;
  return { success: true, data: (staff ?? []).map((person) => ({
    id: String(person.id),
    name: String(person.nickname || person.full_name || "Staff member"),
    hasBookingConflict: conflicts.data.booked.has(String(person.id)),
    hasAssistanceConflict: conflicts.data.assisting.has(String(person.id)),
  })) };
}

export async function loadStaffAssistanceCandidatesAction(
  requestId: string
): Promise<AssistanceResult<AssistanceCandidateView[]>> {
  const actor = await getActor();
  if (!actor) return failure("Unauthorized.");
  const db = adminDb();
  const { data, error } = await db.from(TABLE).select("*").eq("id", requestId).maybeSingle();
  if (error || !data) return failure("Request not found.");
  const request = data as AssistanceRequestRecord;
  if (request.status !== "requested" ||
      !canReviewAssistance(actor, {
        requestingBranchId: request.requesting_branch_id, lendingBranchId: request.lending_branch_id,
      })) return failure("Only CSR at the lending branch can review this request.");
  return loadCandidates(db, request);
}

export async function submitStaffAssistanceAction(
  input: unknown
): Promise<AssistanceResult<{ id: string }>> {
  const actor = await getActor();
  if (!actor) return failure("Unauthorized.");
  const parsed = assistanceSubmitSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid request.");
  const value = parsed.data;
  if (value.requestingBranchId !== actor.branchId) return failure("You can only request help for your current branch.");
  if (Date.parse(value.startAt) < Date.now() - 15 * 60_000) {
    return failure("The requested start time has already passed.");
  }
  const db = adminDb();
  const { data: branchRows, error: branchError } = await db.from("branches")
    .select("id,is_active").in("id", [value.requestingBranchId, value.lendingBranchId]);
  if (branchError || (branchRows ?? []).length !== 2 || (branchRows ?? []).some((b) => !b.is_active)) {
    return failure("Both branches must be active.");
  }
  if (value.visitType === "home_service" &&
      !(await branchAllowsHomeService(db, value.requestingBranchId))) {
    return failure("Home Service is not available at the requesting branch.");
  }
  const { data, error } = await db.from(TABLE).insert({
    requesting_branch_id: value.requestingBranchId,
    lending_branch_id: value.lendingBranchId,
    requested_role: value.role,
    quantity: value.count,
    visit_type: value.visitType,
    start_at: value.startAt,
    end_at: value.endAt,
    notes: value.notes,
    requested_by_auth_user_id: actor.userId,
  }).select("id").single();
  if (error || !data?.id) return failure("Request could not be saved. Check database setup or retry.");
  await createNotification({
    branchId: value.lendingBranchId,
    targetWorkspace: "crm",
    type: "interbranch_assistance_requested",
    title: "Staff assistance requested",
    body: `${actor.branchName} requests ${value.count} ${value.role.replaceAll("_", " ")} staff member(s).`,
    entityType: "staff_assistance_request",
    entityId: String(data.id),
    actionHref: "/crm/schedule?tab=assistance",
    priority: "high", requiresAction: true,
    dedupeKey: `assistance:${data.id}:requested`,
  });
  revalidatePath("/crm/schedule");
  return { success: true, data: { id: String(data.id) } };
}

export async function decideStaffAssistanceAction(
  input: unknown
): Promise<AssistanceResult<{ status: string }>> {
  const actor = await getActor();
  if (!actor) return failure("Unauthorized.");
  const parsed = assistanceDecisionSchema.safeParse(input);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Invalid decision.");
  const value = parsed.data;
  const db = adminDb();
  const { data, error } = await db.from(TABLE).select("*").eq("id", value.requestId).maybeSingle();
  if (error || !data) return failure("Request not found.");
  const request = data as AssistanceRequestRecord;
  if (request.status !== "requested") return failure("This request was already reviewed or cancelled.");

  if (value.decision === "cancel") {
    if (!canCancelAssistance(actor, {
      requestingBranchId: request.requesting_branch_id, status: request.status,
    })) return failure("Only the requesting branch can cancel a pending request.");
  } else if (!canReviewAssistance(actor, {
    requestingBranchId: request.requesting_branch_id,
    lendingBranchId: request.lending_branch_id,
  })) {
    return failure("Only CSR at the lending branch can approve or decline.");
  }

  if (value.decision !== "approve" && value.staffIds.length) return failure("No staff should be selected.");
  if (value.decision === "approve") {
    if (value.staffIds.length !== request.quantity ||
        new Set(value.staffIds).size !== value.staffIds.length) {
      return failure(`Select exactly ${request.quantity} different staff member(s).`);
    }
    const eligible = await loadCandidates(db, request);
    if (!eligible.success) return eligible;
    const eligibleIds = new Set(eligible.data
      .filter((c) => !c.hasBookingConflict && !c.hasAssistanceConflict).map((c) => c.id));
    if (!value.staffIds.every((id) => eligibleIds.has(id))) {
      return failure("One or more staff are no longer eligible. Refresh the candidate list.");
    }
  }
  const next = value.decision === "approve" ? "approved_pending_arrival"
    : value.decision === "decline" ? "declined" : "cancelled";
  const { data: updated, error: updateError } = await db.from(TABLE).update({
    status: next,
    selected_staff_ids: value.decision === "approve" ? value.staffIds : [],
    reviewed_by_auth_user_id: actor.userId,
    reviewed_at: new Date().toISOString(),
    decision_note: value.reason,
  }).eq("id", request.id).eq("status", "requested").select("id").maybeSingle();
  if (updateError) return failure("Could not save the decision.");
  if (!updated) return failure("Another staff member has already reviewed this request. Refresh the list.");
  await createNotification({
    branchId: request.requesting_branch_id,
    targetWorkspace: "crm",
    type: value.decision === "approve" ? "interbranch_assistance_approved" : "interbranch_assistance_closed",
    title: value.decision === "approve" ? "Assistance request approved" : "Assistance request updated",
    body: value.decision === "approve"
      ? "The lending branch CSR has selected staff. Booking and attendance activation are not yet enabled."
      : `Staff assistance request ${next}.`,
    entityType: "staff_assistance_request",
    entityId: request.id,
    actionHref: "/crm/schedule?tab=assistance",
    priority: "normal",
    dedupeKey: `assistance:${request.id}:${next}`,
  });
  revalidatePath("/crm/schedule");
  return { success: true, data: { status: next } };
}

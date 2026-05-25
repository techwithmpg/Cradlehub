/**
 * CRM Operations Readiness Aggregator — Phase 9C
 *
 * Collects existing readiness signals from all CRM data sources and converts
 * them into a single ReadinessResult using the canonical ReadinessIssue type.
 *
 * Sources used:
 *   1. getCrmSetupHealth()       — setup, service, dispatch, space, daily
 *   2. getCrmTodaySnapshot()     — staff check-in, dispatch, payment signals
 *      (getCrmTodaySnapshot internally calls getCrmAvailabilitySnapshot, so
 *       availability data is obtained once through the today snapshot)
 *
 * Sources deferred to Phase 9E:
 *   - Service provider public/non-public distinction (needs staff_type filter)
 *   - Resource conflict detection (spaces-rules-utils — per-booking compute)
 *   - Schedule coverage issues (schedule-coverage-issues — per-staff detail)
 *   - 14 missing checks identified in CRM_READINESS_AUDIT.md Section E
 *
 * Do NOT modify:
 *   src/lib/actions/online-booking.ts
 *   src/lib/actions/inhouse-booking.ts
 *   src/lib/engine/availability.ts
 *   src/lib/engine/resource-availability.ts
 *   src/lib/bookings/dispatch-conflict.ts
 *   src/lib/bookings/dispatch-slot-filter.ts
 *   supabase/migrations/*
 */

import { createClient } from "@/lib/supabase/server";
import { getCrmSetupHealth, type SetupIssue } from "./crm-setup";
import { getCrmTodaySnapshot } from "./crm-today";
import type { CrmAvailabilitySummary } from "./crm-availability";
import type { DispatchStats } from "./dispatch-queries";
import {
  buildReadinessResult,
  sortReadinessIssues,
  type ReadinessIssue,
  type ReadinessSeverity,
  type ReadinessScope,
  type ReadinessResult,
} from "@/types/readiness";

// ── Severity map ──────────────────────────────────────────────────────────────

/**
 * Maps legacy SetupIssue severity vocab to ReadinessSeverity.
 * "error" and "danger" both map to "critical" per the canonical scale.
 */
function mapSetupSeverity(s: SetupIssue["severity"]): ReadinessSeverity {
  if (s === "error") return "critical";
  if (s === "warning") return "warning";
  return "info";
}

// ── Scope map ─────────────────────────────────────────────────────────────────

const SETUP_SCOPE_MAP: Record<string, ReadinessScope> = {
  "no-schedule": "schedule",
  "no-staff-for-service": "service",
  "no-drivers": "dispatch",
  "no-resources": "space",
  "default-rules": "setup",
  "unassigned-bookings": "daily",
};

function mapSetupScope(issueId: string): ReadinessScope {
  return SETUP_SCOPE_MAP[issueId] ?? "setup";
}

// ── Fix advice derivation ─────────────────────────────────────────────────────

const SETUP_FIX_MAP: Record<string, string> = {
  "no-schedule": "Add at least one weekly schedule row for each service staff member.",
  "no-staff-for-service": "Assign at least one eligible therapist to each active service.",
  "no-drivers": "Add an active driver-type staff member to enable home-service dispatch.",
  "no-resources": "Add at least one active room or resource in Spaces & Rules.",
  "default-rules": "Review and save custom booking rules for this branch.",
  "unassigned-bookings": "Open the bookings queue and assign a therapist to each confirmed booking.",
};

function deriveSetupFix(issueId: string): string {
  return SETUP_FIX_MAP[issueId] ?? "Review and resolve this issue in the relevant settings page.";
}

// ── Deduplication ─────────────────────────────────────────────────────────────

const DEDUPE_SEVERITY_RANK: Record<ReadinessSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
};

/**
 * Deduplicates issues by id, keeping the higher-severity version on collision.
 * Returns a freshly sorted array — does not mutate the input.
 */
function dedupeReadinessIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  const byId = new Map<string, ReadinessIssue>();

  for (const issue of issues) {
    const existing = byId.get(issue.id);
    if (!existing) {
      byId.set(issue.id, issue);
      continue;
    }
    // Keep the entry with higher severity (lower rank number wins)
    const existingRank = DEDUPE_SEVERITY_RANK[existing.severity] ?? 3;
    const newRank = DEDUPE_SEVERITY_RANK[issue.severity] ?? 3;
    if (newRank < existingRank) {
      byId.set(issue.id, issue);
    }
  }

  return sortReadinessIssues([...byId.values()]);
}

// ── Source-failure issue factory ──────────────────────────────────────────────

/**
 * Creates a system-scoped warning issue when a readiness data source fails.
 * Informs operators that some checks are unavailable without exposing raw errors.
 */
function createSourceFailureIssue(params: {
  sourceKey: string;
  title: string;
  problem: string;
  actionHref: string;
  actionLabel: string;
}): ReadinessIssue {
  return {
    id: `system:failure:${params.sourceKey}`,
    scope: "system",
    severity: "warning",
    title: params.title,
    problem: params.problem,
    impact: "Some readiness issues may not appear until the page refreshes.",
    fix: "Refresh the page or check the relevant section directly.",
    actionLabel: params.actionLabel,
    actionHref: params.actionHref,
    source: "getCrmReadiness",
  };
}

// ── Mapper: SetupIssue[] → ReadinessIssue[] ───────────────────────────────────

/**
 * Maps the six SetupIssue records produced by getCrmSetupHealth into the
 * canonical ReadinessIssue shape.
 *
 * Issue id prefixed with "setup:" to avoid collisions with other sources.
 */
function mapSetupIssuesToReadinessIssues(issues: SetupIssue[]): ReadinessIssue[] {
  return issues.map((issue) => ({
    id: `setup:${issue.id}`,
    scope: mapSetupScope(issue.id),
    severity: mapSetupSeverity(issue.severity),
    title: issue.title,
    problem: issue.detail,
    impact: issue.impact,
    fix: deriveSetupFix(issue.id),
    actionLabel: issue.fixLabel,
    actionHref: issue.fixHref,
    source: "getCrmSetupHealth",
  }));
}

// ── Mapper: CrmAvailabilitySummary → ReadinessIssue[] ────────────────────────

/**
 * Maps live availability summary metrics to readiness issues.
 *
 * Covers:
 *   - Scheduled staff not yet checked in (daily / warning)
 *   - Staff with no schedule at all (schedule / warning)
 *   - No drivers ready for dispatch (dispatch / warning)
 *
 * Uses the staffReadiness field from CrmTodaySnapshot to avoid running a
 * separate getCrmAvailabilitySnapshot call in parallel.
 */
function mapStaffReadinessToReadinessIssues(
  summary: CrmAvailabilitySummary
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  // Staff scheduled today but not yet checked in
  if (summary.notCheckedIn > 0) {
    const n = summary.notCheckedIn;
    issues.push({
      id: "availability:not-checked-in",
      scope: "daily",
      severity: "warning",
      title: `${n} scheduled staff ${n === 1 ? "has" : "have"} not checked in`,
      problem: `${n} staff member${n === 1 ? "" : "s"} scheduled today ${n === 1 ? "has" : "have"} not been marked present.`,
      impact: "CRM cannot rely on them for walk-ins, in-house bookings, or dispatch until they check in.",
      fix: "Mark arrived staff as checked in or update their status in Live Availability.",
      actionLabel: "Open Live Availability",
      actionHref: "/crm/availability",
      source: "getCrmAvailabilitySnapshot",
      count: n,
    });
  }

  // Staff with no schedule row — needs attention beyond just check-in
  if (summary.needsAttention > 0) {
    const n = summary.needsAttention;
    issues.push({
      id: "availability:needs-attention",
      scope: "schedule",
      severity: "warning",
      title: `${n} staff ${n === 1 ? "member needs" : "members need"} schedule attention`,
      problem: `${n} active staff member${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} no saved schedule for today.`,
      impact: "They will not appear in online booking and cannot be assigned to sessions without a schedule.",
      fix: "Add individual schedule rows for each affected staff member in Schedule Setup.",
      actionLabel: "Open Schedule Setup",
      actionHref: "/crm/staff-availability",
      source: "getCrmAvailabilitySnapshot",
      count: n,
    });
  }

  // Drivers exist but none are ready — only meaningful if the branch has drivers
  if (summary.driversTotal > 0 && summary.driversReady === 0) {
    issues.push({
      id: "availability:drivers-not-ready",
      scope: "dispatch",
      severity: "warning",
      title: "No drivers are ready for dispatch",
      problem: `This branch has ${summary.driversTotal} driver${summary.driversTotal === 1 ? "" : "s"}, but none are currently checked in and available.`,
      impact: "Home-service trips cannot depart until at least one driver is checked in.",
      fix: "Check in an available driver or confirm their readiness in Live Availability.",
      actionLabel: "Open Dispatch",
      actionHref: "/crm/dispatch",
      source: "getCrmAvailabilitySnapshot",
      count: summary.driversTotal,
    });
  }

  return issues;
}

// ── Mapper: DispatchStats → ReadinessIssue[] ─────────────────────────────────

/**
 * Maps dispatch statistics to readiness issues.
 * Only emits an issue when home-service bookings are awaiting driver assignment.
 */
function mapDispatchStatsToReadinessIssues(stats: DispatchStats): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];

  if (stats.awaitingDispatch > 0) {
    const n = stats.awaitingDispatch;
    issues.push({
      id: "dispatch:awaiting-driver",
      scope: "dispatch",
      severity: "warning",
      title: `${n} home-service booking${n === 1 ? "" : "s"} awaiting driver assignment`,
      problem: `${n} confirmed home-service booking${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} no driver assigned yet.`,
      impact: "Home-service trips cannot depart until a driver is assigned.",
      fix: "Open Dispatch and assign a driver to each pending trip.",
      actionLabel: "Open Dispatch",
      actionHref: "/crm/dispatch",
      source: "getCrmTodaySnapshot",
      count: n,
    });
  }

  return issues;
}

// ── Mapper: payment summary → ReadinessIssue[] ───────────────────────────────

/**
 * Maps daily payment summary data to readiness issues.
 * Payment data may be null if the payment query failed or columns are missing
 * (the schema supports graceful degradation for payment fields).
 */
function mapPaymentSummaryToReadinessIssues(
  payment: { unpaid_count: number } | null
): ReadinessIssue[] {
  if (!payment || payment.unpaid_count === 0) return [];

  const n = payment.unpaid_count;
  return [
    {
      id: "payment:unpaid-bookings",
      scope: "payment",
      severity: "warning",
      title: `${n} booking${n === 1 ? "" : "s"} pending payment review`,
      problem: `${n} active booking${n === 1 ? "" : "s"} ${n === 1 ? "has" : "have"} an unpaid or pending payment status.`,
      impact: "Revenue tracking and booking confirmation may be delayed or inaccurate.",
      fix: "Review payment status in the bookings list and confirm payments where needed.",
      actionLabel: "Review Bookings",
      actionHref: "/crm/bookings",
      source: "getCrmTodaySnapshot",
      count: n,
    },
  ];
}

// ── Phase 9G-1: Daily operations checks ──────────────────────────────────────

/**
 * Check 1 — Staff checked in but not scheduled today ("ghost check-ins").
 *
 * Queries staff_shift_checkins for today's active check-ins at the branch,
 * then cross-references with staff_schedules for today's day_of_week.
 * Staff who checked in but have no schedule row are "ghost" check-ins.
 *
 * Returns null if no such staff exist or if the query fails.
 */
async function getCheckedInNotScheduledIssue(
  branchId: string,
  today: string,
  dayOfWeek: number
): Promise<ReadinessIssue | null> {
  const supabase = await createClient();

  // Get today's active check-ins at this branch.
  const checkinRes = await supabase
    .from("staff_shift_checkins")
    .select("staff_id")
    .eq("branch_id", branchId)
    .eq("shift_date", today)
    .eq("status", "checked_in");

  if (checkinRes.error || !checkinRes.data?.length) return null;

  // Deduplicate staff IDs (a staff may have multiple check-in rows e.g. opening + closing).
  const checkedInIds = [...new Set(checkinRes.data.map((r) => r.staff_id))];
  if (!checkedInIds.length) return null;

  // For those checked-in staff, find which ones have a schedule for today's day_of_week.
  const scheduledRes = await supabase
    .from("staff_schedules")
    .select("staff_id")
    .in("staff_id", checkedInIds)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  const scheduledIds = new Set((scheduledRes.data ?? []).map((r) => r.staff_id));
  const ghostIds = checkedInIds.filter((id) => !scheduledIds.has(id));

  if (ghostIds.length === 0) return null;

  const n = ghostIds.length;
  const plural = n !== 1;
  return {
    id: "daily:checked-in-not-scheduled",
    scope: "daily",
    severity: "warning",
    title: `${n} checked-in staff ${plural ? "are" : "is"} not scheduled today`,
    problem: `${n} staff member${plural ? "s have" : " has"} checked in even though ${plural ? "they are" : "they are"} not in the schedule for today.`,
    impact:
      "CRM may need to confirm whether these staff should be available for walk-ins, in-house bookings, or dispatch.",
    fix: "Review live availability and update the staff schedule or check-in status as appropriate.",
    actionLabel: "Open Live Availability",
    actionHref: "/crm/availability",
    source: "getCrmReadiness",
    entityType: "staff",
    entityIds: ghostIds.slice(0, 10),
    count: n,
  };
}

/**
 * Check 2 — No opening-shift staff configured for today.
 *
 * Gets the branch's active staff IDs, then queries staff_schedules for today's
 * day_of_week.  If staff are scheduled (branch is operating) but none have
 * shift_type = 'opening', emits a warning.  Suppressed on days when no staff
 * are scheduled at all (branch likely closed).
 *
 * Returns null if opening shift exists, if branch has no staff, or if the
 * query fails.
 */
async function getNoOpeningShiftIssue(
  branchId: string,
  dayOfWeek: number
): Promise<ReadinessIssue | null> {
  const supabase = await createClient();

  // Lightweight lookup: just the IDs of active branch staff.
  const staffRes = await supabase
    .from("staff")
    .select("id")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  const staffIds = (staffRes.data ?? []).map((r) => r.id);
  if (!staffIds.length) return null;

  // Get all active schedules for today's day_of_week for this branch's staff.
  const schedulesRes = await supabase
    .from("staff_schedules")
    .select("staff_id, shift_type")
    .in("staff_id", staffIds)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  const schedules = schedulesRes.data ?? [];

  // If no staff are scheduled at all, branch is likely closed today — suppress.
  if (!schedules.length) return null;

  // Check if any scheduled staff has an opening shift.
  const hasOpening = schedules.some((s) => s.shift_type === "opening");
  if (hasOpening) return null;

  return {
    id: "daily:no-opening-shift-today",
    scope: "schedule",
    severity: "warning",
    title: "No opening-shift staff configured for today",
    problem:
      "The system did not find any staff configured for opening-shift duty today.",
    impact:
      "CRM may need to manually confirm who opens the branch before starting operations.",
    fix: "Review the staff schedule and assign opening-shift duty for today, or update the schedule for this day of week.",
    actionLabel: "Open Schedule Setup",
    actionHref: "/crm/staff-availability",
    source: "getCrmReadiness",
  };
}

/**
 * Check 3 — Online booking requests without CRM follow-up after 30+ minutes.
 *
 * Finds online bookings that are still 'pending' (not confirmed, not cancelled)
 * and were created more than 30 minutes ago.  Scoped to today-or-future
 * booking dates so past-date stragglers do not trigger spurious warnings.
 *
 * Returns null if no such bookings exist or if the query fails.
 */
async function getPendingBookingFollowUpIssue(
  branchId: string,
  today: string
): Promise<ReadinessIssue | null> {
  const supabase = await createClient();

  // ISO timestamp 30 minutes ago — bookings created before this need follow-up.
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("branch_id", branchId)
    .eq("type", "online")
    .eq("status", "pending")
    .gte("booking_date", today)
    .lte("created_at", cutoff)
    .limit(20);

  if (error || !data?.length) return null;

  const n = data.length;
  const plural = n !== 1;
  return {
    id: "daily:booking-request-no-follow-up",
    scope: "daily",
    severity: "warning",
    title: `${n} booking request${plural ? "s" : ""} need${plural ? "" : "s"} CRM follow-up`,
    problem: `${n} online booking request${plural ? "s have" : " has"} been waiting more than 30 minutes without CRM follow-up.`,
    impact:
      "Customers may be waiting for confirmation, payment instructions, or staff assignment updates.",
    fix: "Open the bookings queue and process each pending online request.",
    actionLabel: "Open Bookings",
    actionHref: "/crm/bookings",
    source: "getCrmReadiness",
    entityType: "booking",
    entityIds: data.map((r) => r.id),
    count: n,
  };
}

/**
 * getDailyOperationsReadinessIssues
 *
 * Runs the three daily operations checks in parallel.
 * Individual check failures are silently suppressed (the overall aggregator
 * still succeeds with partial results from the remaining checks).
 */
async function getDailyOperationsReadinessIssues(
  branchId: string,
  today: string,
  dayOfWeek: number
): Promise<ReadinessIssue[]> {
  const [ghostResult, openingResult, pendingResult] = await Promise.allSettled([
    getCheckedInNotScheduledIssue(branchId, today, dayOfWeek),
    getNoOpeningShiftIssue(branchId, dayOfWeek),
    getPendingBookingFollowUpIssue(branchId, today),
  ]);

  const issues: ReadinessIssue[] = [];
  if (ghostResult.status === "fulfilled" && ghostResult.value !== null) {
    issues.push(ghostResult.value);
  }
  if (openingResult.status === "fulfilled" && openingResult.value !== null) {
    issues.push(openingResult.value);
  }
  if (pendingResult.status === "fulfilled" && pendingResult.value !== null) {
    issues.push(pendingResult.value);
  }
  return issues;
}

// ── Phase 9G-2: Dispatch missing readiness checks ────────────────────────────

/**
 * Extracts home_service_address from booking metadata (JSONB), safely.
 *
 * Returns the address sub-object if it exists and is a plain object,
 * or null if metadata is missing / malformed.
 */
function extractHomeServiceAddress(
  metadata: unknown
): { full_address?: unknown; lat?: unknown; lng?: unknown } | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  const hsa = m["home_service_address"];
  if (!hsa || typeof hsa !== "object" || Array.isArray(hsa)) return null;
  return hsa as { full_address?: unknown; lat?: unknown; lng?: unknown };
}

/**
 * Check 1 — Assigned driver not checked in today.
 *
 * Finds active home-service bookings for today that already have a driver_id,
 * then cross-references with staff_shift_checkins.  If the assigned driver has
 * not checked in today the booking cannot safely depart.
 *
 * Excludes cancelled / completed / no_show bookings.
 * Returns null if all assigned drivers are checked in or if the query fails.
 */
async function getAssignedDriverNotCheckedInIssue(
  branchId: string,
  today: string
): Promise<ReadinessIssue | null> {
  const supabase = await createClient();

  // Active home-service bookings that already have a driver assigned.
  const { data: bookings, error: bookErr } = await supabase
    .from("bookings")
    .select("id, driver_id")
    .eq("branch_id", branchId)
    .eq("booking_date", today)
    .or("type.eq.home_service,delivery_type.eq.home_service")
    .not("driver_id", "is", null)
    .neq("status", "cancelled")
    .neq("status", "completed")
    .neq("status", "no_show")
    .limit(50);

  if (bookErr || !bookings?.length) return null;

  // TypeScript still sees driver_id as string | null after the .not() filter.
  const bookingsWithDriver = bookings.filter(
    (b): b is typeof b & { driver_id: string } => b.driver_id !== null
  );
  if (!bookingsWithDriver.length) return null;

  // Unique driver IDs across affected bookings.
  const driverIds = [...new Set(bookingsWithDriver.map((b) => b.driver_id))];

  // Which of those drivers are checked in today at this branch?
  const { data: checkins } = await supabase
    .from("staff_shift_checkins")
    .select("staff_id")
    .eq("branch_id", branchId)
    .eq("shift_date", today)
    .eq("status", "checked_in")
    .in("staff_id", driverIds);

  const checkedInIds = new Set((checkins ?? []).map((c) => c.staff_id));

  // Bookings whose assigned driver has NOT checked in.
  const affected = bookingsWithDriver.filter((b) => !checkedInIds.has(b.driver_id));
  if (!affected.length) return null;

  const n = affected.length;
  const plural = n !== 1;
  return {
    id: "dispatch:assigned-driver-not-checked-in",
    scope: "dispatch",
    severity: "critical",
    title: `${n} home-service booking${plural ? "s have" : " has"} an assigned driver who is not checked in`,
    problem: `${n} active home-service trip${plural ? "s have" : " has"} a driver assigned, but that driver has not checked in today.`,
    impact:
      "Trips cannot depart until the driver is checked in. Customers may experience delays or failed service.",
    fix: "Check in the assigned driver in Live Availability, or reassign the trip to a checked-in driver.",
    actionLabel: "Open Dispatch",
    actionHref: "/crm/dispatch",
    source: "getCrmReadiness",
    entityType: "booking",
    entityIds: affected.slice(0, 20).map((b) => b.id),
    count: n,
  };
}

/**
 * Check 2 — Home-service booking missing a delivery address.
 *
 * Queries active home-service bookings for today and inspects the JSONB
 * metadata field for a non-empty home_service_address.full_address value.
 * A booking without an address cannot be dispatched.
 *
 * Returns null if all bookings have an address or if the query fails.
 */
async function getHomeServiceMissingAddressIssue(
  branchId: string,
  today: string
): Promise<ReadinessIssue | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, metadata")
    .eq("branch_id", branchId)
    .eq("booking_date", today)
    .or("type.eq.home_service,delivery_type.eq.home_service")
    .neq("status", "cancelled")
    .neq("status", "completed")
    .neq("status", "no_show")
    .limit(50);

  if (error || !data?.length) return null;

  const missing = data.filter((row) => {
    const hsa = extractHomeServiceAddress(row.metadata);
    const addr = hsa?.full_address;
    return !addr || typeof addr !== "string" || addr.trim() === "";
  });

  if (!missing.length) return null;

  const n = missing.length;
  const plural = n !== 1;
  return {
    id: "dispatch:home-service-missing-address",
    scope: "dispatch",
    severity: "critical",
    title: `${n} home-service booking${plural ? "s are" : " is"} missing a delivery address`,
    problem: `${n} active home-service booking${plural ? "s do" : " does"} not have a delivery address recorded.`,
    impact:
      "Drivers cannot navigate to the customer without a delivery address. The booking cannot be dispatched.",
    fix: "Open each affected booking and confirm or enter the customer's full delivery address.",
    actionLabel: "Open Dispatch",
    actionHref: "/crm/dispatch",
    source: "getCrmReadiness",
    entityType: "booking",
    entityIds: missing.slice(0, 20).map((r) => r.id),
    count: n,
  };
}

/**
 * Check 3 — Home-service booking missing destination coordinates.
 *
 * Same booking scope as Check 2.  Inspects metadata.home_service_address.lat
 * and .lng for valid numeric values.  Missing or non-numeric coordinates
 * prevent drivers from using in-app map navigation.
 *
 * Returns null if all bookings have valid coordinates or if the query fails.
 *
 * Note: Check 4 (active home-service with no driver) is intentionally omitted
 * here — it is already covered by the existing dispatch:awaiting-driver issue
 * emitted via mapDispatchStatsToReadinessIssues / getCrmTodaySnapshot.
 * Duplicating it would show the same problem under two different IDs.
 */
async function getHomeServiceMissingCoordinatesIssue(
  branchId: string,
  today: string
): Promise<ReadinessIssue | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, metadata")
    .eq("branch_id", branchId)
    .eq("booking_date", today)
    .or("type.eq.home_service,delivery_type.eq.home_service")
    .neq("status", "cancelled")
    .neq("status", "completed")
    .neq("status", "no_show")
    .limit(50);

  if (error || !data?.length) return null;

  const missing = data.filter((row) => {
    const hsa = extractHomeServiceAddress(row.metadata);
    // If there is no address sub-object at all, coords are definitely absent.
    if (!hsa) return true;
    const { lat, lng } = hsa;
    const hasLat = typeof lat === "number" && !Number.isNaN(lat);
    const hasLng = typeof lng === "number" && !Number.isNaN(lng);
    return !hasLat || !hasLng;
  });

  if (!missing.length) return null;

  const n = missing.length;
  const plural = n !== 1;
  return {
    id: "dispatch:home-service-missing-destination-coordinates",
    scope: "dispatch",
    severity: "warning",
    title: `${n} home-service booking${plural ? "s are" : " is"} missing GPS coordinates`,
    problem: `${n} active home-service booking${plural ? "s are" : " is"} missing destination latitude/longitude coordinates.`,
    impact:
      "Drivers may be unable to use in-app navigation, leading to delays or missed service locations.",
    fix: "Re-enter the delivery address to trigger coordinate lookup, or manually confirm coordinates in the booking details.",
    actionLabel: "Open Dispatch",
    actionHref: "/crm/dispatch",
    source: "getCrmReadiness",
    entityType: "booking",
    entityIds: missing.slice(0, 20).map((r) => r.id),
    count: n,
  };
}

/**
 * getDispatchMissingReadinessIssues
 *
 * Runs the three dispatch missing-data checks in parallel.
 * Individual check failures are silently suppressed — the coordinator always
 * resolves with whatever partial results are available.
 *
 * Check 4 (no driver assigned) is deliberately excluded: it is already
 * covered by the `dispatch:awaiting-driver` issue from getCrmTodaySnapshot /
 * mapDispatchStatsToReadinessIssues.  Emitting a second issue under a
 * different ID for the same condition would confuse operators.
 */
async function getDispatchMissingReadinessIssues(
  branchId: string,
  today: string
): Promise<ReadinessIssue[]> {
  const [driverCheckinResult, missingAddressResult, missingCoordsResult] =
    await Promise.allSettled([
      getAssignedDriverNotCheckedInIssue(branchId, today),
      getHomeServiceMissingAddressIssue(branchId, today),
      getHomeServiceMissingCoordinatesIssue(branchId, today),
    ]);

  const issues: ReadinessIssue[] = [];
  if (driverCheckinResult.status === "fulfilled" && driverCheckinResult.value !== null) {
    issues.push(driverCheckinResult.value);
  }
  if (missingAddressResult.status === "fulfilled" && missingAddressResult.value !== null) {
    issues.push(missingAddressResult.value);
  }
  if (missingCoordsResult.status === "fulfilled" && missingCoordsResult.value !== null) {
    issues.push(missingCoordsResult.value);
  }
  return issues;
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * getCrmReadinessIssues
 *
 * Runs existing CRM data sources in parallel and maps their results into a
 * deduplicated, sorted list of ReadinessIssue records.
 *
 * Error handling:
 *   - If a source fails, a system-scoped warning issue is emitted in its place.
 *   - The aggregator never throws — partial results are always returned.
 *   - Raw Supabase errors are never surfaced to callers.
 *
 * @param branchId  The branch to check readiness for.
 */
export async function getCrmReadinessIssues(
  branchId: string
): Promise<ReadinessIssue[]> {
  const today = new Date().toISOString().split("T")[0]!;
  // day_of_week matches staff_schedules.day_of_week convention (0 = Sunday).
  const dayOfWeek = new Date(today + "T00:00:00").getDay();
  const allIssues: ReadinessIssue[] = [];

  // Run all four primary source groups in parallel.
  // getCrmTodaySnapshot already calls getCrmAvailabilitySnapshot internally,
  // so availability data is obtained once through the today snapshot to avoid
  // a redundant second call to getCrmAvailabilitySnapshot.
  const [setupResult, todayResult, dailyOpsResult, dispatchMissingResult] =
    await Promise.allSettled([
      getCrmSetupHealth(branchId),
      getCrmTodaySnapshot({ branchId, date: today }),
      getDailyOperationsReadinessIssues(branchId, today, dayOfWeek),
      getDispatchMissingReadinessIssues(branchId, today),
    ]);

  // ── Source 1: Setup health ─────────────────────────────────────────────────
  if (setupResult.status === "fulfilled") {
    allIssues.push(
      ...mapSetupIssuesToReadinessIssues(setupResult.value.issues)
    );
  } else {
    allIssues.push(
      createSourceFailureIssue({
        sourceKey: "setup",
        title: "Setup readiness could not be checked",
        problem: "The readiness engine could not load setup health data. Some configuration issues may not be visible.",
        actionHref: "/crm/setup",
        actionLabel: "Open Setup",
      })
    );
  }

  // ── Source 2: Today snapshot (availability + dispatch + payment) ───────────
  if (todayResult.status === "fulfilled") {
    const snap = todayResult.value;

    // 2a. Staff availability / check-in
    allIssues.push(...mapStaffReadinessToReadinessIssues(snap.staffReadiness));

    // 2b. Dispatch stats
    allIssues.push(...mapDispatchStatsToReadinessIssues(snap.dispatchStats));

    // 2c. Payment summary (payment field may be null if query gracefully failed)
    allIssues.push(...mapPaymentSummaryToReadinessIssues(snap.payment));
  } else {
    // Today snapshot failure covers availability + dispatch + payment
    allIssues.push(
      createSourceFailureIssue({
        sourceKey: "today",
        title: "Daily operational readiness could not be checked",
        problem: "The readiness engine could not load today's operational snapshot. Staff check-in, dispatch, and payment issues may not appear.",
        actionHref: "/crm/today",
        actionLabel: "Open Today",
      })
    );
  }

  // ── Source 3: Daily operations checks (Phase 9G-1) ─────────────────────────
  // getDailyOperationsReadinessIssues uses Promise.allSettled internally so it
  // never rejects — dailyOpsResult is always "fulfilled".
  if (dailyOpsResult.status === "fulfilled") {
    allIssues.push(...dailyOpsResult.value);
  } else {
    allIssues.push(
      createSourceFailureIssue({
        sourceKey: "daily-ops",
        title: "Daily operations checks could not be completed",
        problem: "The readiness engine could not run daily operations checks. Ghost check-in, opening-shift, and booking follow-up warnings may not appear.",
        actionHref: "/crm/today",
        actionLabel: "Open Today",
      })
    );
  }

  // ── Source 4: Dispatch missing checks (Phase 9G-2) ─────────────────────────
  // getDispatchMissingReadinessIssues uses Promise.allSettled internally so it
  // never rejects — dispatchMissingResult is always "fulfilled".
  if (dispatchMissingResult.status === "fulfilled") {
    allIssues.push(...dispatchMissingResult.value);
  } else {
    allIssues.push(
      createSourceFailureIssue({
        sourceKey: "dispatch-missing",
        title: "Dispatch missing-data checks could not be completed",
        problem:
          "The readiness engine could not run dispatch data checks. Missing address, missing coordinates, and driver check-in warnings may not appear.",
        actionHref: "/crm/dispatch",
        actionLabel: "Open Dispatch",
      })
    );
  }

  return dedupeReadinessIssues(allIssues);
}

/**
 * getCrmReadiness
 *
 * Convenience wrapper that returns a full ReadinessResult (issues + status).
 * Use getCrmReadinessIssues if you only need the issue list.
 *
 * @param branchId  The branch to check readiness for.
 */
export async function getCrmReadiness(
  branchId: string
): Promise<ReadinessResult> {
  const issues = await getCrmReadinessIssues(branchId);
  return buildReadinessResult(issues);
}

import type {
  DailyCoverageSnapshot,
  HealthEvaluationResult,
  ScheduleHealthIssue,
  ScheduleHealthStatus,
} from "../types";

// Therapist-type system roles
const THERAPIST_ROLES = new Set(["therapist", "senior_therapist"]);
const DRIVER_ROLES    = new Set(["driver"]);

export function evaluateScheduleHealth(
  snapshot: DailyCoverageSnapshot,
): HealthEvaluationResult {
  const { rules, scheduled_staff, bookings } = snapshot;
  const issues: ScheduleHealthIssue[] = [];

  const allStaff         = scheduled_staff;
  const workingStaff     = allStaff.filter((s) => !s.is_day_off);
  const workingTherapists = workingStaff.filter((s) => THERAPIST_ROLES.has(s.system_role));
  const workingDrivers    = workingStaff.filter((s) => DRIVER_ROLES.has(s.system_role));

  const counts = {
    scheduled_staff:      allStaff.length,
    available_staff:      workingStaff.length,
    scheduled_therapists: allStaff.filter((s) => THERAPIST_ROLES.has(s.system_role)).length,
    available_therapists: workingTherapists.length,
    scheduled_drivers:    allStaff.filter((s) => DRIVER_ROLES.has(s.system_role)).length,
    available_drivers:    workingDrivers.length,
    missing_staff:        0,
    affected_bookings:    0,
  };

  // ── Check minimum coverage ────────────────────────────────
  if (workingStaff.length < rules.min_daily_staff) {
    const deficit = rules.min_daily_staff - workingStaff.length;
    counts.missing_staff += deficit;
    issues.push({
      type:     "understaffed",
      severity: "critical",
      message:  `Only ${workingStaff.length} staff working; minimum is ${rules.min_daily_staff}.`,
    });
  }

  if (workingTherapists.length < rules.min_daily_therapists) {
    issues.push({
      type:     "no_therapist",
      severity: "critical",
      message:  `Only ${workingTherapists.length} therapist(s) working; minimum is ${rules.min_daily_therapists}.`,
      affected_staff_ids: workingTherapists.map((s) => s.staff_id),
    });
  }

  if (rules.min_daily_drivers > 0 && workingDrivers.length < rules.min_daily_drivers) {
    issues.push({
      type:     "no_driver",
      severity: "warning",
      message:  `Only ${workingDrivers.length} driver(s) working; minimum is ${rules.min_daily_drivers}.`,
    });
  }

  // ── Check overtime risk ───────────────────────────────────
  const maxMinutes = rules.max_working_hours_per_day * 60;
  for (const staff of workingStaff) {
    if (staff.total_booked_minutes > maxMinutes * 0.85) {
      issues.push({
        type:              "overtime_risk",
        severity:          "warning",
        message:           `${staff.full_name} has ${Math.round(staff.total_booked_minutes / 60 * 10) / 10}h booked (max ${rules.max_working_hours_per_day}h).`,
        affected_staff_ids: [staff.staff_id],
      });
    }
  }

  // ── Check missing breaks ──────────────────────────────────
  if (rules.auto_breaks_enabled) {
    for (const staff of workingStaff) {
      const hasBreak = staff.existing_blocks.some((b) => b.type === "break");
      if (!hasBreak && staff.total_booked_minutes > 240) {
        issues.push({
          type:              "missing_break",
          severity:          "warning",
          message:           `${staff.full_name} has no break block scheduled.`,
          affected_staff_ids: [staff.staff_id],
        });
      }
    }
  }

  // ── Check affected bookings ───────────────────────────────
  const unbookedServices = bookings.filter((b) => !b.staff_id && b.status === "pending");
  counts.affected_bookings = unbookedServices.length;
  if (unbookedServices.length > 0) {
    issues.push({
      type:                  "understaffed",
      severity:              "warning",
      message:               `${unbookedServices.length} booking(s) have no assigned therapist.`,
      affected_booking_ids:  unbookedServices.map((b) => b.booking_id),
    });
  }

  // ── Too many of same role off on one day ──────────────────
  const roleOffCounts: Record<string, number> = {};
  for (const staff of allStaff.filter((s) => s.is_day_off)) {
    roleOffCounts[staff.system_role] = (roleOffCounts[staff.system_role] ?? 0) + 1;
  }
  for (const [role, count] of Object.entries(roleOffCounts)) {
    if (count > rules.max_same_role_off_per_day) {
      issues.push({
        type:     "too_many_off",
        severity: "warning",
        message:  `${count} ${role}(s) are off today (max per-role limit: ${rules.max_same_role_off_per_day}).`,
      });
    }
  }

  // ── Derive final status ───────────────────────────────────
  let status: ScheduleHealthStatus = "ok";
  if (issues.some((i) => i.severity === "critical")) status = "critical";
  else if (issues.some((i) => i.severity === "warning")) status = "warning";

  const recommendations = buildRecommendations(issues);

  return { status, issues, recommendations, counts };
}

function buildRecommendations(issues: ScheduleHealthIssue[]): string[] {
  const recs: string[] = [];
  const types = new Set(issues.map((i) => i.type));

  if (types.has("understaffed"))   recs.push("Consider calling in a standby staff member or adjusting day-off approvals.");
  if (types.has("no_therapist"))   recs.push("Ensure at least one therapist is available. Review day-off requests.");
  if (types.has("no_driver"))      recs.push("Assign a driver or arrange transport coverage for home-service bookings.");
  if (types.has("overtime_risk"))  recs.push("Redistribute bookings to reduce overtime risk for flagged staff.");
  if (types.has("missing_break"))  recs.push("Schedule break blocks for staff working more than 4 hours.");
  if (types.has("too_many_off"))   recs.push("Stagger day-off requests to maintain role coverage.");

  return recs;
}

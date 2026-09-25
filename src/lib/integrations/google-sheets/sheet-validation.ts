import { parseBookingTime } from "@/lib/bookings/booking-clock-time";
import { bookingBlocksAvailability } from "@/lib/bookings/hold-status";
import {
  addDaysToYmd,
  getBranchBusinessDate,
  getDayOfWeekFromYmd,
  rangesOverlap,
} from "@/lib/engine/slot-time";
import { isOperationalStaff } from "@/lib/staff/operational-staff";
import { isCrmFrontDeskScheduleStaff } from "@/lib/schedule/shift-eligibility";
import {
  resolveScheduleForStaffDay,
  doesDurationFitWithinScheduleWindows,
} from "@/lib/schedule/resolve-staff-schedule";
import { validateBranchServiceEligibility } from "@/lib/services/service-eligibility";
import { sheetDurationMinutes, sheetIssue } from "./sheet-preflight";
import {
  resolveSheetCustomer,
  resolveSheetService,
  resolveSheetStaff,
  staffCanServe,
  type SheetCustomerResolution,
} from "./sheet-resolvers";
import type {
  SheetCapturedRow,
  SheetCheck,
  SheetResolution,
  SheetRowProjectionPlan,
} from "./sheet-ingestion-types";
import type { SheetContextIndexes, SheetService, SheetStaff } from "./sheet-resolution-context";

export type SheetResolvedIntent = {
  service: SheetResolution<SheetService>;
  staff: SheetResolution<SheetStaff>;
  customer: SheetCustomerResolution;
  branchCandidate: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  deliveryType: "in_spa" | null;
};
export function resolveSheetIntent(
  row: SheetCapturedRow,
  plan: SheetRowProjectionPlan,
  indexes: SheetContextIndexes
): SheetResolvedIntent {
  const service = resolveSheetService(row.parsed.service, indexes);
  const staff = resolveSheetStaff(row.parsed.attendant, service, plan.intent === "duty", indexes);
  const customer = resolveSheetCustomer(row.parsed.client, indexes);
  const time = parseBookingTime(row.parsed.time ?? "");
  const branchService = indexes.context.branchServices.find(
    (s) => s.service_id === service.value?.id
  );
  const policy = indexes.context.deliveryPolicy;
  const deliveryType =
    plan.delivery.state === "none" &&
    policy?.approvedBy &&
    !Number.isNaN(Date.parse(policy.approvedAt))
      ? policy.value
      : null;
  return {
    service,
    staff,
    customer,
    branchCandidate: indexes.context.branch?.id ?? null,
    deliveryType,
    startTime: time.ok ? time.value.canonicalTime : null,
    durationMinutes:
      sheetDurationMinutes(row.parsed.hours) ??
      branchService?.custom_duration_minutes ??
      service.value?.duration_minutes ??
      null,
  };
}
function validation(
  code: string,
  field: string,
  passed: boolean | null,
  message: string,
  evidence: Record<string, unknown> = {}
): SheetCheck {
  return { ...sheetIssue(code, field, message, evidence), phase: "validation", passed };
}
export function validateSheetIntent(
  row: SheetCapturedRow,
  plan: SheetRowProjectionPlan,
  resolved: SheetResolvedIntent,
  indexes: SheetContextIndexes,
  now: Date
): SheetCheck[] {
  if (plan.intent === "context" || plan.intent === "aggregate") return [];
  const context = indexes.context;
  if (context.status !== "available")
    return [
      validation(
        "CANONICAL_CONTEXT_UNAVAILABLE",
        "context",
        null,
        "Load authorized branch context and revalidate before any canonical application."
      ),
    ];
  const checks: SheetCheck[] = [
    validation(
      "BRANCH_INVALID",
      "branch",
      context.branch?.is_active === true,
      "Confirm an active authorized branch."
    ),
  ];
  if (plan.intent === "financial") {
    checks.push(
      validation(
        "FINANCIAL_SUBTYPE_UNCONFIRMED",
        "financialSubtype",
        false,
        "Confirm the financial subtype, amount direction, and required account before application."
      )
    );
    return checks;
  }
  if (plan.intent !== "service" && plan.intent !== "duty") return checks;
  const selections =
    plan.intent === "service"
      ? ([
          ["SERVICE_UNKNOWN", "service", resolved.service],
          ["STAFF_AMBIGUOUS", "attendant", resolved.staff],
          ["CUSTOMER_AMBIGUOUS", "client", resolved.customer],
        ] as const)
      : ([["STAFF_AMBIGUOUS", "attendant", resolved.staff]] as const);
  for (const [code, field, resolution] of selections) {
    checks.push({
      ...validation(code, field, resolution.status === "resolved", resolution.reason, {
        method: resolution.method,
        status: resolution.status,
      }),
      phase: "resolution",
      candidates: resolution.candidates.map((candidate) => ({
        id: candidate.id,
        label: "name" in candidate ? candidate.name : candidate.full_name,
      })),
    });
  }
  const staff = resolved.staff.value,
    service = resolved.service.value;
  if (staff) {
    checks.push(
      validation(
        "STAFF_INACTIVE",
        "attendant",
        isOperationalStaff(staff),
        "Confirm active operational staff."
      )
    );
    checks.push(
      validation(
        "STAFF_WRONG_BRANCH",
        "attendant",
        staff.branch_id === context.branch?.id,
        "Confirm the provider's canonical branch assignment."
      )
    );
    if (plan.intent === "duty")
      checks.push(
        validation(
          "DUTY_ROLE_UNCONFIRMED",
          "attendant",
          isCrmFrontDeskScheduleStaff(staff),
          "Confirm eligibility for this operational duty; do not infer a role from a name."
        )
      );
    else if (service)
      checks.push(
        validation(
          "SERVICE_CAPABILITY_MISMATCH",
          "attendant",
          staffCanServe(staff, service.id, indexes),
          "Choose or approve a provider who is explicitly eligible for the selected service.",
          { staffId: staff.id, serviceId: service.id }
        )
      );
  }
  if (plan.intent === "duty") {
    checks.push(
      validation(
        "DUTY_ASSIGNMENT_UNCONFIRMED",
        "dutyType",
        null,
        "Confirm the duty assignment and approved shift/window mapping; a label alone cannot define a shift."
      )
    );
    return checks;
  }
  const delivery = resolved.deliveryType;
  checks.push(
    validation(
      "DELIVERY_UNCONFIRMED",
      "delivery",
      delivery !== null,
      "Confirm delivery type using an approved mapping; fuel/location evidence is not sufficient."
    )
  );
  if (plan.delivery.state !== "none")
    checks.push(
      validation(
        "HOME_SERVICE_LOCATION_MISSING",
        "delivery",
        null,
        "Confirm delivery and a precise destination before Home Service can be applied.",
        { coordinatesNotPresentInSource: true }
      )
    );
  if (service) {
    const branchService = context.branchServices.find(
      (s) => s.service_id === service.id && s.branch_id === context.branch?.id
    );
    const eligibility = validateBranchServiceEligibility({
      service,
      branchService,
      audience: "crm",
      deliveryMode: delivery ?? "any",
      rules: { homeServiceEnabled: context.rules?.home_service_enabled },
    });
    checks.push(
      validation(
        "SERVICE_INELIGIBLE",
        "service",
        eligibility.ok,
        "Confirm active service, branch availability, delivery support and CRM visibility.",
        eligibility.ok ? {} : { reasons: eligibility.reasons }
      )
    );
    const expected = branchService?.custom_duration_minutes ?? service.duration_minutes;
    checks.push(
      validation(
        "DURATION_INCOMPATIBLE",
        "hours",
        resolved.durationMinutes === expected,
        "Confirm the supplied duration against the canonical branch service duration.",
        { expectedMinutes: expected, suppliedMinutes: resolved.durationMinutes }
      )
    );
  }
  const date = row.parsed.businessDate,
    time = resolved.startTime ? parseBookingTime(resolved.startTime) : null;
  if (date && time?.ok && resolved.durationMinutes !== null) {
    const start = time.value.minutesIntoDay;
    const end = start + resolved.durationMinutes;
    checks.push(
      validation(
        "TIME_RANGE_CROSSES_DAY",
        "time",
        end < 1440,
        "Confirm a booking interval that does not cross the canonical day boundary."
      )
    );
    if (context.rules) {
      const businessDate = getBranchBusinessDate(now);
      checks.push(
        validation(
          "BOOKING_DATE_REQUIRES_REVIEW",
          "businessDate",
          date >= businessDate &&
            date <= addDaysToYmd(businessDate, context.rules.max_advance_booking_days),
          "Confirm how this date may be applied; do not bypass current booking date limits.",
          { businessDate, sourceDate: date }
        )
      );
      if (delivery) {
        const first = parseBookingTime(context.rules.in_spa_start_time),
          last = parseBookingTime(context.rules.in_spa_end_time);
        checks.push(
          validation(
            "BRANCH_HOURS_CONFLICT",
            "time",
            first.ok &&
              last.ok &&
              start >= first.value.minutesIntoDay &&
              start <= last.value.minutesIntoDay,
            "Confirm a start time inside canonical branch booking hours."
          )
        );
      }
    } else
      checks.push(
        validation(
          "BRANCH_RULES_UNAVAILABLE",
          "context",
          null,
          "Load canonical branch booking rules before application."
        )
      );
    if (staff) {
      const overrides = indexes.overrides.get(`${staff.id}:${date}`) ?? [];
      const schedule = resolveScheduleForStaffDay({
        staff,
        operational: isOperationalStaff(staff),
        override: overrides[0] ?? null,
        individualRows: indexes.schedules.get(`${staff.id}:${getDayOfWeekFromYmd(date)}`) ?? [],
      });
      const blockMinutes =
        resolved.durationMinutes + (service?.buffer_before ?? 0) + (service?.buffer_after ?? 0);
      checks.push(
        validation(
          "STAFF_SCHEDULE_CONFLICT",
          "attendant",
          overrides.length <= 1 &&
            schedule.isWorking &&
            doesDurationFitWithinScheduleWindows({
              slotStartTime: resolved.startTime!,
              durationMinutes: blockMinutes,
              windows: schedule.windows,
            }),
          "Confirm the resolved provider's schedule. Identity will not be replaced by another free provider.",
          { staffId: staff.id, scheduleState: schedule.state }
        )
      );
      const overlapping = [-1, 0, 1].flatMap((shift) =>
        (indexes.bookings.get(`${staff.id}:${addDaysToYmd(date, shift)}`) ?? []).filter((b) => {
          const from = parseBookingTime(b.start_time),
            to = parseBookingTime(b.end_time);
          if (!bookingBlocksAvailability(b, now)) return false;
          if (!from.ok || !to.ok) return true; // Unknown blocking interval must not pass.
          const a = shift * 1440 + from.value.minutesIntoDay;
          const z =
            shift * 1440 +
            to.value.minutesIntoDay +
            (to.value.minutesIntoDay < from.value.minutesIntoDay ? 1440 : 0);
          return rangesOverlap(start, start + blockMinutes, a, z);
        })
      );
      checks.push(
        validation(
          "CANONICAL_BOOKING_OVERLAP",
          "attendant",
          overlapping.length === 0,
          "Resolve the overlap for the identified provider; do not silently select someone else.",
          { staffId: staff.id, bookingIds: overlapping.map((b) => b.id) }
        )
      );
    }
  }
  // Resource allocation, special setup and delivery dispatch require the future writer's authoritative gate.
  checks.push({
    ...validation(
      "FINAL_APPLICATION_REVALIDATION",
      "application",
      true,
      "The future writer must rerun authorization, resource and booking checks atomically."
    ),
    severity: "low",
  });
  return checks;
}

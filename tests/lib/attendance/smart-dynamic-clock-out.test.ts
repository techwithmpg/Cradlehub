import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  classifyDynamicClockOut,
  parseDynamicClockOutPolicy,
} from "@/lib/attendance/dynamic-clock-out";

const migration = readFileSync(
  resolve("supabase/migrations/20260715021703_attendance_smart_dynamic_clock_out.sql"),
  "utf8"
);
const scanEngine = readFileSync(resolve("src/lib/attendance/scan-engine.ts"), "utf8");
const portalActions = readFileSync(
  resolve("src/app/(dashboard)/staff-portal/actions.ts"),
  "utf8"
);
const portalData = readFileSync(resolve("src/lib/staff-portal/attendance.ts"), "utf8");
const portalUi = readFileSync(
  resolve("src/components/features/staff-portal/staff-attendance-clock-out.tsx"),
  "utf8"
);
const driverPage = readFileSync(
  resolve("src/app/(dashboard)/driver/page.tsx"),
  "utf8"
);
const vercelConfig = readFileSync(resolve("vercel.json"), "utf8");
const hybridMigration = readFileSync(
  resolve("supabase/migrations/20260715012424_attendance_hybrid_closing_automation.sql"),
  "utf8"
);

function section(start: string, end: string): string {
  const from = migration.indexOf(start);
  const to = migration.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return migration.slice(from, to);
}

const resolver = section(
  "create or replace function public.recalculate_attendance_clock_out_policy(",
  "revoke all on function public.resolve_attendance_staff_category"
);
const bookingTrigger = section(
  "create or replace function public.recalculate_attendance_after_booking_event()",
  "drop trigger if exists bookings_recalculate_attendance_clock_out"
);
const portalRpc = section(
  "create or replace function public.commit_attendance_portal_clock_out(",
  "revoke all on function public.commit_attendance_portal_clock_out"
);
const portalAction = portalActions.slice(
  portalActions.indexOf("export async function clockOutFromStaffPortalAction()"),
  portalActions.indexOf("function isMissingStaffProfileColumnError")
);

describe("smart dynamic clock-out — schedule fallback", () => {
  it("1. staff with no service uses scheduled shift end", () => {
    expect(resolver).toContain("v_expected := v_schedule_end");
    expect(resolver).toContain("when v_source_booking_id is null then 'schedule'");
  });

  it("2. overnight schedule resolves the correct business date", () => {
    expect(resolver).toContain("v_scope_start + interval '24 hours'");
    expect(resolver).toContain("booking.end_time <= booking.start_time then interval '1 day'");
  });

  it("3. schedule override replaces ordinary schedule end", () => {
    expect(resolver).toContain("override.created_by is not null");
    expect(resolver).toContain("v_schedule_end := v_override_end");
  });

  it("4. split-shift resolution retains the selected schedule source row", () => {
    expect(resolver).toContain("schedule.id::text = v_checkin.schedule_source_id");
    expect(resolver).toContain("schedule.staff_id = v_checkin.staff_id");
  });
});

describe("smart dynamic clock-out — service-performing staff", () => {
  it("5. therapist final completed service plus buffer sets expected clock-out", () => {
    expect(resolver).toContain("booking.session_completed_at");
    expect(resolver).toContain("v_source_completion + make_interval(mins => v_buffer)");
  });

  it("6. salon service providers share the service strategy", () => {
    expect(resolver).toContain("v_category in ('therapists', 'salon')");
    expect(migration).toContain("'nail_tech', 'nail_technician', 'aesthetician'");
  });

  it("7. actual completion takes priority over scheduled end", () => {
    const order = resolver.indexOf("booking.session_completed_at");
    expect(order).toBeLessThan(resolver.indexOf("booking.session_due_at", order));
  });

  it("8. extended due time takes priority over original end", () => {
    const order = resolver.lastIndexOf("booking.session_due_at");
    expect(order).toBeLessThan(resolver.indexOf("booking.session_started_at +", order));
  });

  it("9. cancelled bookings are excluded", () => {
    expect(resolver.match(/booking\.status not in \('cancelled', 'no_show'\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("10. no-show bookings are excluded", () => {
    expect(resolver).toContain("booking.booking_progress_status, '') <> 'no_show'");
  });

  it("11. reassigned booking is excluded from the previous staff", () => {
    expect(resolver).toContain("booking.staff_id = v_checkin.staff_id");
  });

  it("12. future confirmed booking blocks portal clock-out", () => {
    expect(resolver).toContain("booking.status in ('pending', 'pending_payment', 'pending_crm_confirmation', 'confirmed', 'in_progress')");
    expect(resolver).toContain("v_portal_reason := 'upcoming_assignment'");
  });

  it("13. active service blocks portal clock-out", () => {
    expect(resolver).toContain("'checked_in', 'travel_started', 'arrived', 'session_started'");
    expect(resolver).toContain("v_portal_reason := 'active_assignment'");
  });

  it("14. final early service can release only when configured", () => {
    expect(resolver).toContain("and not v_final_release");
    expect(migration).toContain("final_client_release_enabled boolean");
  });

  it("15. final late service moves expected clock-out after schedule end", () => {
    expect(resolver).toContain("v_expected := v_source_completion + make_interval(mins => v_buffer)");
    expect(resolver).not.toContain("least(v_schedule_end, v_source_completion");
  });
});

describe("smart dynamic clock-out — CRM closing", () => {
  it("16. CRM closing uses the branch final service", () => {
    expect(resolver).toContain("v_category = 'crm_front_desk'");
    expect(resolver).toContain("booking.branch_id = v_checkin.branch_id");
  });

  it("17. CRM excludes cancelled and no-show branch bookings", () => {
    expect(resolver).toContain("booking.delivery_type = 'in_spa'");
    expect(resolver).toContain("booking.status not in ('cancelled', 'no_show')");
  });

  it("18. CRM without branch services falls back to closing schedule", () => {
    expect(resolver).toContain("case when v_source_booking_id is null then 'schedule' else 'crm_closing' end");
  });

  it("19. non-closing CRM follows schedule policy", () => {
    expect(resolver).toContain("lower(coalesce(v_checkin.shift_type, '')) = 'closing'");
  });

  it("20. branch timezone is used for booking and schedule timestamps", () => {
    expect(resolver.match(/at time zone v_timezone/g)?.length).toBeGreaterThanOrEqual(8);
  });
});

describe("smart dynamic clock-out — home service", () => {
  it("21. final completed home service unlocks portal clock-out", () => {
    expect(resolver).toContain("v_source = 'home_service'");
    expect(resolver).toContain("v_portal_method := 'staff_portal_home_service'");
  });

  it("22. incomplete dispatch blocks portal clock-out", () => {
    expect(resolver).toContain("'travel_started', 'arrived'");
    expect(portalRpc).toContain("Complete the active service or dispatch");
  });

  it("23. incomplete service blocks portal clock-out", () => {
    expect(resolver).toContain("booking.session_completed_at is null");
  });

  it("24. another upcoming home assignment blocks clock-out", () => {
    expect(resolver).toContain("and booking.staff_id = v_checkin.staff_id");
    expect(portalRpc).toContain("Another assignment is still scheduled");
  });

  it("25. home service uses completion plus wrap-up buffer", () => {
    expect(resolver).toContain("then v_home_buffer");
    expect(migration).toContain("home_service_wrap_up_buffer_minutes");
  });

  it("26. no return-to-branch buffer is implicitly added", () => {
    expect(resolver).toContain("v_home_buffer");
    expect(resolver).not.toContain("v_home_buffer + v_driver_buffer");
  });

  it("27. staff cannot clock out another therapist", () => {
    expect(portalRpc).toContain("checkin.staff_id = v_staff.id");
  });

  it("28. manipulated booking ID cannot be submitted", () => {
    expect(portalAction).toContain("clockOutFromStaffPortalAction()");
    expect(portalAction).not.toContain("bookingId");
  });

  it("29. unregistered device is rejected", () => {
    expect(portalRpc).toContain("device.device_fingerprint_hash = p_device_fingerprint_hash");
    expect(portalRpc).toContain("'unregistered_device'");
  });
});

describe("smart dynamic clock-out — eligible closing shift", () => {
  it("30. eligible closing staff can use portal clock-out", () => {
    expect(resolver).toContain("v_portal_method := 'staff_portal_closing_shift'");
  });

  it("31. ordinary in-branch staff cannot use portal clock-out", () => {
    expect(resolver).toContain("v_portal_reason := 'use_branch_qr'");
    expect(portalUi).toContain("availability.enabled");
  });

  it("32. closing responsibilities block portal clock-out before the window", () => {
    expect(resolver).toContain("v_portal_reason := 'closing_duties_remain'");
    expect(resolver).toContain("v_now >= v_earliest");
  });

  it("33. branch QR remains the default method", () => {
    expect(scanEngine).toContain('clock_out_method: "qr"');
    expect(portalData).toContain('code: "use_branch_qr"');
  });
});

describe("smart dynamic clock-out — driver", () => {
  it("34. final completed trip unlocks driver portal clock-out", () => {
    expect(resolver).toContain("v_portal_method := 'driver_portal_final_trip'");
    expect(driverPage).toContain("<StaffAttendanceSummary data={attendance} />");
  });

  it("35. remaining assigned trip blocks clock-out", () => {
    expect(resolver).toContain("booking.driver_id = v_checkin.staff_id");
    expect(resolver).toContain("v_has_upcoming");
  });

  it("36. configured driver return buffer is applied", () => {
    expect(resolver).toContain("v_buffer := case when v_source_booking_id is null then 0 else v_driver_buffer end");
  });

  it("37. zero return buffer is supported", () => {
    expect(resolver).toContain("v_driver_buffer integer");
    expect(resolver).toContain("v_settings.crm_closing_buffer_minutes");
    expect(migration).toContain("driver_return_buffer_minutes between 0 and 360");
  });
});

describe("smart dynamic clock-out — classification", () => {
  const window = {
    earliestNormalClockOutAt: "2026-07-15T10:00:00.000Z",
    latestNormalClockOutAt: "2026-07-15T10:20:00.000Z",
  };

  it("38. before earliest normal time is early", () => {
    expect(classifyDynamicClockOut({ ...window, clockOutAt: "2026-07-15T09:59:00.000Z" })).toBe("early");
  });

  it("39. inside dynamic window is normal", () => {
    expect(classifyDynamicClockOut({ ...window, clockOutAt: "2026-07-15T10:10:00.000Z" })).toBe("normal");
  });

  it("40. after latest normal time is overtime", () => {
    expect(classifyDynamicClockOut({ ...window, clockOutAt: "2026-07-15T10:21:00.000Z" })).toBe("overtime");
  });

  it("41. valid early portal clock-out is recorded and flagged", () => {
    expect(portalRpc).toContain("set checked_out_at = v_now");
    expect(portalRpc).toContain("v_exception_type := case when v_classification = 'early'");
  });

  it("42. valid overtime portal clock-out is recorded and flagged", () => {
    expect(portalRpc).toContain("when v_classification = 'overtime' then 'overtime'");
    expect(portalRpc).toContain("insert into public.attendance_exceptions");
  });

  it("43. QR classification uses the dynamic snapshot", () => {
    expect(scanEngine).toContain("recalculateAttendanceClockOutPolicy(");
    expect(scanEngine).toContain("earliestNormalClockOutAt: activeCheckin.earliest_normal_clock_out_at");
  });
});

describe("smart dynamic clock-out — concurrency and idempotency", () => {
  it("44. double portal submission returns one committed result", () => {
    expect(portalRpc).toContain("where event.request_id = p_request_id");
    expect(portalRpc).toContain("return v_existing || jsonb_build_object('replayed', true)");
  });

  it("45. simultaneous QR and portal clock-out share one staff lock", () => {
    expect(portalRpc).toContain("hashtext('attendance_scan_staff')");
    expect(migration).toContain("Serialize assignment mutations with the same per-staff Attendance lock");
  });

  it("46. unchanged recalculation creates no write", () => {
    expect(resolver).toContain("if v_changed and v_checkin.status = 'checked_in'");
    expect(resolver).toContain("is distinct from v_candidate_snapshot");
  });

  it("47. reassignment recalculates old and new staff", () => {
    expect(bookingTrigger).toContain("v_old_staff");
    expect(bookingTrigger).toContain("v_new_staff");
  });

  it("48. scheduler retry remains deduplicated", () => {
    expect(hybridMigration).toContain("on conflict (checkin_id, stage) do nothing");
  });
});

describe("smart dynamic clock-out — security", () => {
  it("49. browser-supplied expected time is ignored", () => {
    expect(portalAction).not.toContain("expectedClockOutAt:");
    expect(portalRpc).toContain("v_policy := public.recalculate_attendance_clock_out_policy");
  });

  it("50. browser-supplied staff identity is ignored", () => {
    expect(portalAction).toContain("p_auth_user_id: user.id");
    expect(portalAction).not.toContain("staffId");
  });

  it("51. cross-branch device access is rejected", () => {
    expect(portalRpc).toContain("device.branch_id = v_checkin.branch_id");
  });

  it("52. closed Attendance cannot be clocked out twice", () => {
    expect(portalRpc).toContain("checkin.status = 'checked_in'");
    expect(portalRpc).toContain("checkin.checked_out_at is null");
  });

  it("53. portal action remains service-role restricted", () => {
    expect(migration).toContain("revoke all on function public.commit_attendance_portal_clock_out(uuid, text, text)");
    expect(migration).toContain("to service_role");
  });
});

describe("smart dynamic clock-out — test mode", () => {
  it("54. test-mode portal clock-out stays isolated", () => {
    expect(portalRpc).toContain("checkin.is_test = coalesce(v_settings.test_mode_enabled, false)");
    expect(portalRpc).toContain("'is_test', v_checkin.is_test");
  });

  it("55. test activity is excluded from live assignment evidence", () => {
    expect(resolver).toContain("v_checkin.is_test and lower(coalesce(");
    expect(resolver).toContain("not v_checkin.is_test and lower(coalesce(");
  });
});

describe("smart dynamic clock-out — Supabase and Vercel", () => {
  it("56. Vercel has no frequent Attendance cron", () => {
    expect(vercelConfig).not.toContain("*/5");
    expect(vercelConfig).not.toContain("/api/attendance");
  });

  it("57. CRM dynamic deadlines retain Supabase processor compatibility", () => {
    expect(resolver).toContain("else 'crm_closing' end");
    expect(hybridMigration).toContain("checkin.attendance_policy_source = 'crm_closing'");
  });

  it("58. scheduled processing queries only due open records", () => {
    expect(hybridMigration).toContain("checkin.status = 'checked_in'");
    expect(hybridMigration).toContain("checkin.clock_out_reminder_at <= $1");
    expect(hybridMigration).toContain("limit $2");
  });

  it("59. no routine five-minute Vercel request is introduced", () => {
    const config = JSON.parse(vercelConfig) as { crons?: Array<{ path: string; schedule: string }> };
    expect(config.crons).toEqual([{ path: "/api/agent/follow-up", schedule: "0 0 * * *" }]);
  });
});

describe("dynamic policy parser", () => {
  it("maps database policy evidence without customer data", () => {
    const parsed = parseDynamicClockOutPolicy({
      checkin_id: "checkin-1",
      attendance_policy_source: "home_service",
      attendance_expected_end_at: "2026-07-15T10:15:00.000Z",
      portal_clock_out_eligible: true,
      portal_eligibility_reason: "final_home_service_complete",
      portal_clock_out_method: "staff_portal_home_service",
      attendance_policy_snapshot: { sourceBookingId: "booking-1" },
    });
    expect(parsed.portalClockOutEligible).toBe(true);
    expect(parsed.portalClockOutMethod).toBe("staff_portal_home_service");
    expect(JSON.stringify(parsed.snapshot)).not.toContain("customer");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const closingMigration = readFileSync(
  resolve("supabase/migrations/20260714180000_attendance_crm_closing_policy.sql"),
  "utf8"
);
const hybridMigration = readFileSync(
  resolve("supabase/migrations/20260715012424_attendance_hybrid_closing_automation.sql"),
  "utf8"
);
const cronOperation = readFileSync(
  resolve("supabase/operations/configure-attendance-closing-cron.sql"),
  "utf8"
);
const scanEngine = readFileSync(resolve("src/lib/attendance/scan-engine.ts"), "utf8");
const worker = readFileSync(
  resolve("src/lib/attendance/closing-interventions.ts"),
  "utf8"
);
const route = readFileSync(
  resolve("src/app/api/attendance/closing-interventions/route.ts"),
  "utf8"
);
const vercelConfig = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
  crons?: Array<{ path: string; schedule: string }>;
};

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

const snapshotTrigger = between(
  closingMigration,
  "create or replace function public.snapshot_attendance_policy()",
  "alter table public.attendance_corrections"
);
const processor = between(
  hybridMigration,
  "create or replace function public.process_due_attendance_closing_interventions(",
  "-- Compatibility wrapper"
);
const reminderQuery = between(
  processor,
  "if v_stage = 'reminder' then",
  "elsif v_stage = 'manager_escalation' then"
);
const escalationQuery = between(
  processor,
  "elsif v_stage = 'manager_escalation' then",
  "else\n    v_due_query"
);
const autoCloseQuery = between(
  processor,
  "else\n    v_due_query",
  "for v_record in execute"
);

describe("Attendance hybrid closing automation — deadline creation", () => {
  it("1. CRM closing clock-in stores all closing deadlines", () => {
    for (const field of [
      "attendance_expected_end_at",
      "earliest_normal_clock_out_at",
      "latest_normal_clock_out_at",
      "clock_out_reminder_at",
      "manager_escalation_at",
      "hard_cutoff_at",
      "provisional_clock_out_at",
    ]) {
      expect(snapshotTrigger).toContain(`new.${field} :=`);
    }
  });

  it("2. CRM ordinary shift remains schedule-based", () => {
    expect(snapshotTrigger).toContain("new.attendance_policy_source := 'schedule'");
    expect(snapshotTrigger).toContain("lower(coalesce(new.shift_type, '')) = 'closing'");
  });

  it("3. therapist closing behavior is unaffected", () => {
    expect(snapshotTrigger).toContain("v_category := 'therapists'");
    expect(snapshotTrigger).toContain("if v_category = 'crm_front_desk'");
  });

  it("4. driver closing behavior is unaffected", () => {
    expect(snapshotTrigger).toContain("v_category := 'drivers'");
    expect(snapshotTrigger).toContain("if v_category = 'crm_front_desk'");
  });

  it("5. utility closing behavior is unaffected", () => {
    expect(snapshotTrigger).toContain("v_category := 'utility'");
    expect(snapshotTrigger).toContain("if v_category = 'crm_front_desk'");
  });

  it("6. salon closing behavior is unaffected", () => {
    expect(snapshotTrigger).toContain("v_category := 'salon'");
    expect(snapshotTrigger).toContain("if v_category = 'crm_front_desk'");
  });

  it("7. managerial closing behavior is unaffected", () => {
    expect(snapshotTrigger).toContain("v_category := 'managers'");
    expect(snapshotTrigger).toContain("if v_category = 'crm_front_desk'");
  });

  it("8. branch timezone is used to create absolute deadlines", () => {
    expect(snapshotTrigger).toContain("v_close_time::text)::timestamp at time zone v_timezone");
    expect(snapshotTrigger).toContain("'timezone', v_timezone");
  });

  it("9. overnight records retain the authoritative Attendance business date", () => {
    expect(snapshotTrigger).toContain(
      "v_business_date := coalesce(new.attendance_business_date, new.shift_date)"
    );
  });
});

describe("Attendance hybrid closing automation — normal clock-out", () => {
  it("10. clock-out before reminder removes the record from eligibility", () => {
    expect(scanEngine).toContain('status: "checked_out"');
    expect(reminderQuery).toContain("checkin.status = 'checked_in'");
  });

  it("11. clock-out at reminder time resolves signals after the atomic commit", () => {
    const commitIndex = scanEngine.indexOf("const committed = await commitAttendanceScanTransaction", 70_000);
    const resolveIndex = scanEngine.indexOf(
      "await resolveClosingInterventionSignals(admin, activeCheckin.id)",
      commitIndex
    );
    expect(resolveIndex).toBeGreaterThan(commitIndex);
    expect(processor).toContain("for update of checkin skip locked");
  });

  it("12. every stage ignores closed records", () => {
    for (const query of [reminderQuery, escalationQuery, autoCloseQuery]) {
      expect(query).toContain("checkin.status = 'checked_in'");
      expect(query).toContain("checkin.checked_out_at is null");
    }
  });

  it("13. a real scan after provisional close reconciles the same record", () => {
    expect(closingMigration).toContain(
      "create or replace function public.reconcile_provisional_attendance_clock_out"
    );
    expect(scanEngine).toContain("return reconcileProvisionalClockOut({");
  });
});

describe("Attendance hybrid closing automation — reminder", () => {
  it("14. a due open closing record creates one reminder", () => {
    expect(reminderQuery).toContain("checkin.clock_out_reminder_at <= $1");
    expect(processor).toContain("v_signal_stage := v_stage");
    expect(processor).toContain("'attendance_clock_out_reminder'");
  });

  it("15. a not-yet-due record is excluded", () => {
    expect(reminderQuery).toContain("checkin.clock_out_reminder_at <= $1");
  });

  it("16. a checked-out record creates no reminder", () => {
    expect(reminderQuery).toContain("checkin.status = 'checked_in'");
    expect(reminderQuery).toContain("checkin.checked_out_at is null");
  });

  it("17. reminder retry creates no duplicate intervention", () => {
    expect(processor).toContain("on conflict (checkin_id, stage) do nothing");
    expect(closingMigration).toContain("unique (checkin_id, stage)");
  });

  it("18. reminder retry creates no duplicate notification", () => {
    expect(processor).toContain("v_intervention.dedupe_key || ':notification'");
    expect(processor).toContain("notification.status in ('unread', 'read')");
  });
});

describe("Attendance hybrid closing automation — manager escalation", () => {
  it("19. a due record creates one manager escalation", () => {
    expect(escalationQuery).toContain("checkin.manager_escalation_at <= $1");
    expect(processor).toContain("'attendance_closing_escalation'");
  });

  it("20. escalation retry creates no duplicate workflow task", () => {
    expect(processor).toContain("v_intervention.dedupe_key || ':task'");
    expect(processor).toContain("task.status in ('open', 'in_progress')");
  });

  it("21. auto-closed records are ignored by escalation", () => {
    expect(escalationQuery).toContain("checkin.provisional_auto_closed_at is null");
  });

  it("22. checked-out records are ignored by escalation", () => {
    expect(escalationQuery).toContain("checkin.status = 'checked_in'");
    expect(escalationQuery).toContain("checkin.checked_out_at is null");
  });
});

describe("Attendance hybrid closing automation — provisional auto-close", () => {
  it("23. a due record receives the existing provisional auto-close", () => {
    expect(autoCloseQuery).toContain("checkin.hard_cutoff_at <= $1");
    expect(processor).toContain("set checked_out_at = provisional_clock_out_at");
    expect(processor).toContain("clock_out_confirmation_required = true");
  });

  it("24. the system auto-close correction audit is created once", () => {
    expect(processor).toContain("correction.correction_type = 'system_auto_close'");
    expect(processor).toContain("where not exists (");
  });

  it("25. the missed-clock-out exception is created once", () => {
    expect(processor).toContain("'missing_clock_out', 'live'");
    expect(processor).toContain("select exception_row.id into v_exception_id");
  });

  it("26. duplicate invocation cannot update the record twice", () => {
    expect(processor).toContain("and provisional_auto_closed_at is null");
    expect(processor).toContain("if v_row_count = 0 then");
  });

  it("27. active-service blocking remains protected and reviewable", () => {
    expect(processor).toContain("booking.booking_progress_status = 'session_started'");
    expect(processor).toContain("v_signal_stage := 'active_service_blocked'");
    expect(processor).toContain("Attendance was left open for review.");
  });

  it("28. an actual later QR scan still uses provisional reconciliation", () => {
    expect(scanEngine).toContain(
      '.rpc("reconcile_provisional_attendance_clock_out", rpcArgs)'
    );
    expect(closingMigration).toContain("actual_clock_out_reconciled_at = v_now");
  });
});

describe("Attendance hybrid closing automation — catch-up and concurrency", () => {
  it("29. catch-up applies missing stages in logical order", () => {
    const reminder = processor.indexOf("v_reminder_summary :=");
    const escalation = processor.indexOf("v_escalation_summary :=");
    const autoClose = processor.indexOf("v_auto_close_summary :=");
    expect(reminder).toBeGreaterThanOrEqual(0);
    expect(escalation).toBeGreaterThan(reminder);
    expect(autoClose).toBeGreaterThan(escalation);
  });

  it("30. completed stages are not repeated", () => {
    expect(processor).toContain("on conflict (checkin_id, stage) do nothing");
    expect(processor).toContain("v_intervention.notification_sent_at is not null");
  });

  it("31. a temporary per-record failure can be retried", () => {
    expect(processor).toContain("exception\n      when others then");
    expect(processor).toContain("v_failed := v_failed + 1");
  });

  it("32. batch size is clamped and applied to every stage", () => {
    expect(processor).toContain("greatest(1, least(coalesce(p_batch_size, 50), 200))");
    expect(processor).toContain("limit $2");
  });

  it("33. overlapping runs skip locked rows and rely on stable dedupe", () => {
    expect(processor.match(/for update of checkin skip locked/g)).toHaveLength(3);
    expect(processor).toContain("on conflict (checkin_id, stage) do nothing");
  });
});

describe("Attendance hybrid closing automation — resource and platform safety", () => {
  it("34. queries target only live checked-in CRM closing records", () => {
    for (const query of [reminderQuery, escalationQuery, autoCloseQuery]) {
      expect(query).toContain("checkin.attendance_policy_source = 'crm_closing'");
      expect(query).toContain("checkin.is_test = false");
    }
  });

  it("35. historical completed records and full Attendance rows are not loaded", () => {
    expect(processor).not.toContain("select checkin.*");
    expect(processor).not.toContain("qr_scan_events");
  });

  it("36. clock-in creates deadline snapshots but no pending interventions", () => {
    expect(snapshotTrigger).toContain("new.clock_out_reminder_at :=");
    expect(snapshotTrigger).not.toContain("insert into public.attendance_closing_interventions");
  });

  it("37. a normal day with no due open row performs zero action writes", () => {
    expect(processor).toContain("v_applied integer := 0");
    expect(processor).toContain("for v_record in execute v_due_query");
    expect(processor).toContain("'applied', v_applied");
  });

  it("38. Vercel contains no frequent or automatic Attendance cron", () => {
    expect(vercelConfig.crons?.some((cron) => cron.path.includes("/api/attendance"))).toBe(
      false
    );
    expect(JSON.stringify(vercelConfig)).not.toContain("*/5");
  });

  it("39. the production Vercel config retains only daily schedules", () => {
    expect(vercelConfig.crons).toEqual([
      { path: "/api/agent/follow-up", schedule: "0 0 * * *" },
    ]);
    expect(cronOperation.match(/select cron\.schedule\(/g)).toHaveLength(4);
    for (const schedule of ["0 15 * * *", "30 15 * * *", "0 16 * * *", "10 16 * * *"]) {
      expect(cronOperation).toContain(`'${schedule}'`);
    }
  });

  it("40. the manual fallback remains server-secret protected", () => {
    expect(route).toContain("process.env.CRON_SECRET");
    expect(route).toContain("bearerToken(request) === secret");
    expect(worker).toContain('"process_due_attendance_closing_interventions"');
    expect(route).not.toContain("NEXT_PUBLIC");
  });
});

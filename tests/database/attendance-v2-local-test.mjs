import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const { Client } = require("../../.tmp/attendance-v2-postgres/node_modules/pg");

// Deliberately never load .env, a DSN, linked-project state, or remote credentials.
const database = `attendance_v2_test_${Date.now()}`;
const config = { host: "127.0.0.1", port: 55439, user: "postgres", database };
const admin = new Client({ ...config, database: "postgres" });
await admin.connect();
const identity = (
  await admin.query(
    "select host(inet_server_addr()) host, inet_server_port() port, current_setting('data_directory') dir, version() version"
  )
).rows[0];
assert.equal(identity.host, "127.0.0.1");
assert.equal(identity.port, 55439);
assert.match(
  identity.dir.replaceAll("\\", "/"),
  /\/web-attendance-v2\/\.tmp\/attendance-v2-pgdata$/
);
assert.match(identity.version, /PostgreSQL 17\./);
await admin.query(`create database ${database}`);
await admin.end();
const db = new Client(config);
await db.connect();
const read = (path) => readFileSync(path, "utf8");
function extract(path, name) {
  const source = read(path);
  const pattern = new RegExp(`create (?:or replace )?function public\\.${name}\\(`, "i");
  const start = source.search(pattern);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n$$;", start) + 4);
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
}
try {
  await db.query("set timezone='UTC'; set statement_timeout='15s'");
  await db.query(read("tests/database/attendance-v2-fixture.sql"));
  const dynamic = "supabase/migrations/20260715021703_attendance_smart_dynamic_clock_out.sql";
  for (const name of [
    "resolve_attendance_staff_category",
    "recalculate_attendance_clock_out_policy",
  ])
    await db.query(extract(dynamic, name));
  const accepted = "supabase/migrations/20260821023717_fix_attendance_function_ambiguity.sql";
  await db.query(extract(accepted, "commit_attendance_scan_transaction"));
  await db.query(extract(accepted, "reconcile_provisional_attendance_clock_out"));
  await db.query(
    extract(
      "supabase/migrations/20260722110000_attendance_correct_times_transaction.sql",
      "correct_attendance_times_transaction"
    )
  );
  // Reproduce the accepted insert invariant with its actual function and trigger.
  const p0 = read("supabase/migrations/20261109120000_attendance_qr_clockin_window_guard.sql");
  const start = p0.indexOf("CREATE FUNCTION public.enforce_qr_clock_in_shift_window()");
  await db.query(
    p0.slice(start, p0.indexOf("$attendance_p0_guard$;", start) + "$attendance_p0_guard$;".length)
  );
  await db.query(
    "create trigger staff_shift_checkins_qr_clock_in_window_guard before insert on staff_shift_checkins for each row execute function enforce_qr_clock_in_shift_window()"
  );
  await db.query(extract("supabase/migrations/20260821034409_repair_attendance_branch_authority.sql", "resolve_effective_attendance_branch"));
  await db.query(read("supabase/migrations/20261116094630_attendance_v2_automation.sql"));
  for (const name of [
    "lock_attendance_for_booking_mutation",
    "recalculate_attendance_after_booking_event",
  ])
    await db.query(extract(dynamic, name));
  await db.query(
    "create trigger bookings_lock_attendance before insert or update or delete on bookings for each row execute function lock_attendance_for_booking_mutation()"
  );
  await db.query(
    "create trigger bookings_recalculate_attendance after insert or update or delete on bookings for each row execute function recalculate_attendance_after_booking_event()"
  );
  // Fixture grants model the existing service-only RPC boundary; no live RLS is claimed.
  await db.query(
    "revoke all on function public.commit_attendance_scan_transaction(text,uuid,uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,boolean,jsonb,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated"
  );
  await db.query(
    "grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role"
  );
  const branch = randomUUID();
  const otherBranch = randomUUID();
  const devices = new Map();
  await db.query("insert into branches(id) values($1),($2)", [branch, otherBranch]);
  await db.query("insert into attendance_settings(branch_id) values($1),($2)", [
    branch,
    otherBranch,
  ]);
  await test("inactive by default; no Cron activation", async () => {
    assert.equal((await db.query("select attendance_v2_enabled() enabled")).rows[0].enabled, false);
    assert.equal(
      (await db.query("select process_due_attendance_v2() result")).rows[0].result.inactive,
      true
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','public.process_due_attendance_v2(timestamptz,integer)','execute') allowed"
        )
      ).rows[0].allowed,
      false
    );
  });
  await db.query("update attendance_v2_private.control set enabled_at='2026-01-01Z'");
  const startAt = "2026-11-16T05:00:00Z",
    endAt = "2026-11-16T12:00:00Z";
  async function staff(role = "staff", type = "therapist") {
    const id = randomUUID();
    await db.query("insert into staff(id,branch_id,system_role,staff_type) values($1,$2,$3,$4)", [
      id,
      branch,
      role,
      type,
    ]);
    return id;
  }
  async function scan(
    id,
    {
      request = randomUUID(),
      arrived = startAt,
      start = startAt,
      end = endAt,
      atBranch = branch,
      update = null,
      checkin = null,
      key = `${id}:2026-11-16`,
      connection = db,
      isTest = false,
    } = {}
  ) {
    const insert = update
      ? null
      : {
          shift_date: "2026-11-16",
          shift_type: "closing",
          shift_instance_key: key,
          checked_in_at: arrived,
          scheduled_start_at: start,
          scheduled_end_at: end,
          schedule_source: "weekly",
          schedule_source_id: "TEST-weekly",
          branch_timezone: "Asia/Manila",
          attendance_business_date: "2026-11-16",
        };
    return (
      await connection.query(
        `select * from commit_attendance_scan_transaction(
      p_request_id=>$1,p_branch_id=>$2,p_qr_point_id=>$3,p_staff_id=>$4,p_device_id=>$5,
      p_is_test=>$11,p_scan_type=>'attendance',p_action=>$6,p_outcome=>'success',p_public_result=>$7::jsonb,
      p_checkin_id=>$8,p_checkin_insert=>$9::jsonb,p_checkin_update=>$10::jsonb)`,
        [
          request,
          atBranch,
          randomUUID(),
          id,
          devices.get(id) ?? (devices.set(id, randomUUID()), devices.get(id)),
          update ? "clock_out" : "clock_in",
          JSON.stringify({
            ok: true,
            outcome: "success",
            title: "TEST",
            message: "TEST",
            attendance: {
              action: update ? "clock_out" : "clock_in",
              staffName: "TEST Staff",
              shiftLabel: "closing",
            },
          }),
          checkin,
          insert ? JSON.stringify(insert) : null,
          update ? JSON.stringify(update) : null,
          isTest,
        ]
      )
    ).rows[0];
  }
  const row = async (id) =>
    (await db.query("select * from staff_shift_checkins where id=$1", [id])).rows[0];
  const notices = async (id) =>
    Number(
      (await db.query("select count(*) n from workspace_notifications where entity_id=$1", [id]))
        .rows[0].n
    );
  const batchDurations = [];
  const processAt = async (at) => {
    const result = (await db.query("select process_due_attendance_v2($1,100) result", [at])).rows[0]
      .result;
    batchDurations.push(result.durationMs);
    return result;
  };
  const earlyStaff = await staff();
  const early = await scan(earlyStaff, { arrived: "2026-11-16T03:54:00Z" });
  await test("11:54 arrival accepted; credit begins at 13:00 with one scan", async () => {
    const r = await row(early.checkin_id);
    assert.equal(r.checked_in_at.toISOString(), "2026-11-16T03:54:00.000Z");
    assert.equal(Date.parse(r.attendance_policy_snapshot.v2.creditedStartAt), Date.parse(startAt));
    assert.equal(r.worked_minutes, 0);
    assert.equal(r.attendance_policy_snapshot.v2.state, "preliminary");
    assert.equal(
      Number(
        (await db.query("select count(*) n from qr_scan_events where staff_id=$1", [earlyStaff]))
          .rows[0].n
      ),
      1
    );
  });
  await scan(earlyStaff, {
    checkin: early.checkin_id,
    update: {
      checked_out_at: endAt,
      status: "checked_out",
      clock_out_method: "qr",
      worked_minutes: 486,
    },
  });
  await test("payroll minutes exclude all 66 early-arrival minutes", async () => {
    const r = await row(early.checkin_id);
    assert.equal(r.worked_minutes, 420);
    assert.equal(r.attendance_policy_snapshot.v2.state, "final");
  });
  await test("verified departure before shift start credits zero", async () => {
    const person = await staff(), s = await scan(person, { arrived: "2026-11-16T03:54Z" });
    await scan(person, { checkin: s.checkin_id, update: { checked_out_at: "2026-11-16T04:30Z", status: "checked_out", clock_out_method: "qr" } });
    const r = await row(s.checkin_id); assert.equal(r.worked_minutes, 0);
    assert.equal(Date.parse(r.attendance_policy_snapshot.v2.actualClockOutAt), Date.parse("2026-11-16T04:30Z"));
  });
  for (const [name, arrived, expected] of [
    ["exact shift start", startAt, 420],
    ["late arrival", "2026-11-16T05:15:00Z", 405],
  ]) {
    await test(name, async () => {
      const id = await staff(),
        s = await scan(id, { arrived });
      await scan(id, {
        checkin: s.checkin_id,
        update: { checked_out_at: endAt, status: "checked_out", clock_out_method: "qr" },
      });
      assert.equal((await row(s.checkin_id)).worked_minutes, expected);
    });
  }
  await test("far-too-early and missing schedule cannot insert", async () => {
    for (const options of [{ arrived: "2026-11-16T02:59:59Z" }, { end: null }]) {
      const id = await staff();
      await assert.rejects(scan(id, options), /attendance_qr_clock_in_/);
      assert.equal(
        Number(
          (await db.query("select count(*) n from staff_shift_checkins where staff_id=$1", [id]))
            .rows[0].n
        ),
        0
      );
    }
  });
  await test("two concurrent clock-ins and request replay reuse one session", async () => {
    const id = await staff(),
      a = new Client(config),
      b = new Client(config);
    await a.connect();
    await b.connect();
    try {
      const results = await Promise.all([scan(id, { connection: a }), scan(id, { connection: b })]);
      assert.equal(results[0].checkin_id, results[1].checkin_id);
      const request = randomUUID(),
        first = await scan(id, { request }),
        again = await scan(id, { request });
      assert.equal(first.scan_event_id, again.scan_event_id);
      assert.equal(again.code, "replayed");
    } finally {
      await a.end();
      await b.end();
    }
  });
  await test("cross-branch open-session conflict retains scan and review audit", async () => {
    const id = await staff();
    await scan(id);
    const conflict = await scan(id, { atBranch: otherBranch, key: `${id}:other` });
    assert.equal(conflict.operation_result.reasonCode, "conflicting_open_checkin");
    assert.ok(conflict.scan_event_id);
    assert.ok(conflict.recovery_issue_id);
    assert.equal(
      Number(
        (await db.query("select count(*) n from staff_shift_checkins where staff_id=$1", [id]))
          .rows[0].n
      ),
      1
    );
  });
  await test("legacy multiple-open conflicts remain unchanged and actionable", async () => {
    const person = await staff();
    await db.query(
      "insert into staff_shift_checkins(staff_id,branch_id,shift_date,checked_in_at,clock_in_method) values($1,$2,'2026-11-16',$3,'manual_review'),($1,$2,'2026-11-15',$3,'manual_review')",
      [person, branch, startAt]
    );
    const conflict = await scan(person);
    assert.equal(conflict.operation_result.reasonCode, "conflicting_open_checkin");
    assert.equal(
      Number(
        (await db.query("select count(*) n from staff_shift_checkins where staff_id=$1", [person]))
          .rows[0].n
      ),
      2
    );
  });
  await test("request replay is bound to staff and device identity", async () => {
    const request = randomUUID(),
      first = await staff(),
      other = await staff();
    await scan(first, { request });
    const mismatch = await scan(other, { request });
    assert.equal(mismatch.success, false);
    assert.equal(mismatch.code, "scan_request_mismatch");
    assert.equal(mismatch.operation_result, null);
  });
  const reminderStaff = await staff(),
    reminder = await scan(reminderStaff);
  await test("first reminder +5, next +10, retry deduplication", async () => {
    await processAt("2026-11-16T12:04Z");
    assert.equal(await notices(reminder.checkin_id), 0);
    await processAt("2026-11-16T12:05Z");
    await processAt("2026-11-16T12:05Z");
    assert.equal(await notices(reminder.checkin_id), 1);
    await processAt("2026-11-16T12:10Z");
    assert.equal(await notices(reminder.checkin_id), 2);
  });
  await test("clock-out atomically stops future and outstanding reminders", async () => {
    await scan(reminderStaff, {
      checkin: reminder.checkin_id,
      update: {
        checked_out_at: "2026-11-16T12:11Z",
        status: "checked_out",
        clock_out_method: "qr",
      },
    });
    await processAt("2026-11-16T12:20Z");
    assert.equal(await notices(reminder.checkin_id), 2);
    assert.equal(
      Number(
        (
          await db.query(
            "select count(*) n from workspace_notifications where entity_id=$1 and status='unread'",
            [reminder.checkin_id]
          )
        ).rows[0].n
      ),
      0
    );
  });
  const provider = await staff(),
    serviceShift = await scan(provider),
    booking = randomUUID();
  await db.query(
    "insert into bookings(id,branch_id,staff_id,booking_date,start_time,end_time,status,booking_progress_status,session_started_at,session_due_at) values($1,$2,$3,'2026-11-16','19:00','21:00','in_progress','session_started','2026-11-16T11:00Z','2026-11-16T13:00Z')",
    [booking, branch, provider]
  );
  await test("active service defers reminders past scheduled end", async () => {
    await processAt("2026-11-16T12:05Z");
    assert.equal(await notices(serviceShift.checkin_id), 0);
    assert.equal((await row(serviceShift.checkin_id)).checked_out_at, null);
  });
  await db.query(
    "update bookings set status='completed',booking_progress_status='completed',session_completed_at='2026-11-16T13:00Z' where id=$1",
    [booking]
  );
  await test("actual completion plus cleanup determines the due deadline", async () => {
    await processAt("2026-11-16T13:19Z");
    assert.equal(await notices(serviceShift.checkin_id), 0);
    await processAt("2026-11-16T13:20Z");
    assert.equal(await notices(serviceShift.checkin_id), 1);
  });
  const driver = await staff("driver", "driver"),
    overnight = await scan(driver, { end: "2026-11-16T17:00Z" });
  await test("legitimate 01:00 overnight driver shift stays open at midnight", async () => {
    await processAt("2026-11-16T16:00Z");
    assert.equal((await row(overnight.checkin_id)).checked_out_at, null);
  });
  const ordinary = await staff(),
    midnight = await scan(ordinary);
  await test("midnight provisional closure preserves unknown actual out and audit", async () => {
    await processAt("2026-11-16T16:00Z");
    const r = await row(midnight.checkin_id);
    assert.equal(r.clock_out_method, "system_auto_close");
    assert.equal(r.clock_out_scan_event_id, null);
    assert.equal(r.attendance_policy_snapshot.v2.actualClockOutAt, null);
    assert.equal(r.attendance_policy_snapshot.v2.state, "preliminary");
    assert.equal(r.worked_minutes, 420);
    await processAt("2026-11-16T16:00Z");
    assert.equal(
      Number(
        (
          await db.query("select count(*) n from attendance_corrections where checkin_id=$1", [
            r.id,
          ])
        ).rows[0].n
      ),
      1
    );
  });
  await test("midnight cannot close an active service", async () => {
    const id = await staff(),
      s = await scan(id);
    await db.query(
      "insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,status,booking_progress_status,session_started_at) values($1,$2,'2026-11-16','23:00','01:00','in_progress','session_started','2026-11-16T15:00Z')",
      [branch, id]
    );
    await processAt("2026-11-16T16:05Z");
    assert.equal((await row(s.checkin_id)).checked_out_at, null);
  });
  await test("late physical scan reconciles provisional record without reopening", async () => {
    await db.query(
      `select * from reconcile_provisional_attendance_clock_out($1,$2,$3,$4,$5,$6,'2026-11-16T16:05Z',$7::jsonb)`,
      [
        randomUUID(),
        midnight.checkin_id,
        branch,
        ordinary,
        randomUUID(),
        randomUUID(),
        JSON.stringify({ ok: true, outcome: "success", title: "TEST", message: "TEST" }),
      ]
    );
    const r = await row(midnight.checkin_id);
    assert.equal(r.status, "checked_out");
    assert.equal(r.worked_minutes, 420);
    assert.ok(r.attendance_policy_snapshot.v2.actualClockOutAt);
    assert.equal(r.attendance_policy_snapshot.v2.state, "review");
  });
  await test("historical missing-end row is not backfilled or fabricated", async () => {
    const id = randomUUID(),
      person = await staff();
    await db.query(
      "insert into staff_shift_checkins(id,staff_id,branch_id,shift_date,checked_in_at,clock_in_method) values($1,$2,$3,'2025-01-01','2025-01-01Z','manual_review')",
      [id, person, branch]
    );
    await processAt("2026-11-17T16:00Z");
    const r = await row(id);
    assert.equal(r.checked_out_at, null);
    assert.equal(r.attendance_policy_snapshot.v2, undefined);
  });
  await test("cross-device retry seconds apart cannot clock out an arrival", async () => {
    const person = await staff(),
      now = new Date(),
      start = new Date(now.getTime() - 60000).toISOString(),
      end = new Date(now.getTime() + 3600000).toISOString();
    const s = await scan(person, { arrived: now.toISOString(), start, end });
    const retry = await scan(person, {
      checkin: s.checkin_id,
      update: {
        checked_out_at: new Date(now.getTime() + 5000).toISOString(),
        status: "checked_out",
        clock_out_method: "qr",
      },
    });
    assert.equal(retry.operation_result.reasonCode, "duplicate_scan");
    assert.equal((await row(s.checkin_id)).checked_out_at, null);
  });
  await test("Home Service completion preserves configured return buffer after closing", async () => {
    const person = await staff("driver", "driver"),
      s = await scan(person);
    await db.query(
      "insert into attendance_staff_category_rules(branch_id,staff_category,effective_from,driver_return_buffer_minutes) values($1,'drivers','2026-01-01Z',30)",
      [branch]
    );
    await db.query(
      "insert into bookings(branch_id,driver_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,completed_at) values($1,$2,'2026-11-16','19:00','22:00','home_service','completed','completed','2026-11-16T14:00Z')",
      [branch, person]
    );
    await processAt("2026-11-16T14:34Z");
    assert.equal(await notices(s.checkin_id), 0);
    assert.equal((await row(s.checkin_id)).checked_out_at, null);
    await processAt("2026-11-16T14:35Z");
    assert.equal(await notices(s.checkin_id), 1);
  });
  await test("CRM cash custody blocks midnight closure until actual closing duty ends", async () => {
    await db.query("update attendance_v2_private.control set owns_closing=true");
    const cashBranch = randomUUID();
    await db.query("insert into branches(id) values($1)", [cashBranch]);
    await db.query("insert into attendance_settings(branch_id) values($1)", [cashBranch]);
    const person = await staff("crm", "csr");
    await db.query("update staff set branch_id=$2 where id=$1", [person, cashBranch]);
    const s = await scan(person, { atBranch: cashBranch }),
      cash = randomUUID();
    await db.query(
      "insert into cash_sessions(id,branch_id,opened_by,current_custodian_id,business_date) values($1,$2,$3,$3,'2026-11-16')",
      [cash, cashBranch, person]
    );
    await processAt("2026-11-16T16:00Z");
    assert.equal((await row(s.checkin_id)).checked_out_at, null);
    assert.equal(await notices(s.checkin_id), 0);
    await db.query(
      "update cash_sessions set status='closed',closed_by=$2,closed_at='2026-11-16T16:15Z' where id=$1",
      [cash, person]
    );
    await processAt("2026-11-16T16:20Z");
    const r = await row(s.checkin_id);
    assert.equal(r.checked_out_at.toISOString(), "2026-11-16T16:15:00.000Z");
    assert.equal(r.attendance_policy_snapshot.v2.actualClockOutAt, null);
  });
  await test("manual correction racing closure preserves the authorized correction", async () => {
    const person = await staff(),
      s = await scan(person),
      manual = new Client(config);
    await manual.connect();
    try {
      await manual.query("begin");
      await manual.query("select id from staff_shift_checkins where id=$1 for update", [
        s.checkin_id,
      ]);
      const automated = processAt("2026-11-16T16:00Z");
      await manual.query(
        "select * from correct_attendance_times_transaction($1,$2,'correct_attendance_times','TEST authorized correction',$3,$4,$5)",
        [branch, person, s.checkin_id, startAt, endAt]
      );
      await manual.query("commit");
      await automated;
      const r = await row(s.checkin_id);
      assert.equal(r.clock_out_method, "manual_review");
      assert.equal(r.provisional_auto_closed_at, null);
      assert.equal(r.worked_minutes, 420);
      assert.equal(r.attendance_policy_snapshot.v2.actualClockOutAt, null);
    } finally {
      await manual.end();
    }
  });
  await test("same-time manual confirmation does not fabricate a physical scan", async () => {
    const person = await staff(),
      s = await scan(person);
    await processAt("2026-11-16T16:00Z");
    await db.query(
      "select * from correct_attendance_times_transaction($1,$2,'set_manual_clock_out','TEST reviewed end',$3,$4,$5)",
      [branch, person, s.checkin_id, startAt, endAt]
    );
    const r = await row(s.checkin_id);
    assert.equal(r.clock_out_method, "manual_review");
    assert.equal(r.provisional_auto_closed_at, null);
    assert.equal(r.attendance_policy_snapshot.v2.state, "final");
    assert.equal(r.attendance_policy_snapshot.v2.actualClockOutAt, null);
  });
  await test("service completion racing midnight preserves the cleanup interval", async () => {
    const person = await staff(),
      s = await scan(person),
      booking = randomUUID(),
      service = new Client(config);
    await service.connect();
    await db.query(
      "insert into bookings(id,branch_id,staff_id,booking_date,start_time,end_time,status,booking_progress_status,session_started_at) values($1,$2,$3,'2026-11-16','23:00','01:00','in_progress','session_started','2026-11-16T15:00Z')",
      [booking, branch, person]
    );
    try {
      await service.query("begin");
      await service.query(
        "update bookings set status='completed',booking_progress_status='completed',session_completed_at='2026-11-16T16:00Z' where id=$1",
        [booking]
      );
      await processAt("2026-11-16T16:00Z");
      assert.equal((await row(s.checkin_id)).checked_out_at, null);
      await service.query("commit");
      await processAt("2026-11-16T16:01Z");
      assert.equal((await row(s.checkin_id)).checked_out_at, null);
      await processAt("2026-11-16T16:15Z");
      assert.equal(
        (await row(s.checkin_id)).checked_out_at.toISOString(),
        "2026-11-16T16:15:00.000Z"
      );
    } finally {
      await service.end();
    }
  });
  await test("two concurrent due processors do not duplicate interval mutations", async () => {
    const person = await staff(),
      s = await scan(person),
      a = new Client(config),
      b = new Client(config);
    await a.connect();
    await b.connect();
    try {
      await Promise.all([
        a.query("select process_due_attendance_v2('2026-11-16T12:05Z',100)"),
        b.query("select process_due_attendance_v2('2026-11-16T12:05Z',100)"),
      ]);
      assert.equal(await notices(s.checkin_id), 1);
    } finally {
      await a.end();
      await b.end();
    }
  });
  await test("legacy CRM Closing reminder ownership remains functional", async () => {
    const legacyBranch = randomUUID();
    await db.query("insert into branches(id) values($1)", [legacyBranch]);
    await db.query("insert into attendance_settings(branch_id) values($1)", [legacyBranch]);
    const person = await staff("crm", "csr"),
      id = randomUUID();
    await db.query("update staff set branch_id=$2 where id=$1", [person, legacyBranch]);
    await db.query(
      "insert into bookings(branch_id,booking_date,start_time,end_time,status,booking_progress_status,session_completed_at) values($1,'2026-11-16','19:00','19:30','completed','completed','2026-11-16T11:30Z')",
      [legacyBranch]
    );
    await db.query(
      `insert into staff_shift_checkins(id,staff_id,branch_id,shift_date,shift_type,checked_in_at,clock_in_method,
      scheduled_start_at,scheduled_end_at,clock_out_reminder_at,attendance_policy_source,attendance_policy_snapshot)
      values($1,$2,$3,'2026-11-16','closing',$4,'manual_review',$4,$5,$5,'crm_closing','{}')`,
      [id, person, legacyBranch, startAt, endAt]
    );
    // The exact legacy eligibility resolver can choose 'schedule' without branch services;
    // its due row is still accepted and processed by the retained reminder stage.
    const result = (
      await db.query(
        "select process_due_attendance_closing_interventions('reminder','2026-11-16T12:15Z',100) r"
      )
    ).rows[0].r;
    assert.equal(result.failed, 0);
    assert.ok((await notices(id)) >= 1, JSON.stringify({ result, row: await row(id) }));
  });
  await test("push failure persists attempt evidence and supports retry", async () => {
    const person = await staff(),
      s = await scan(person);
    await processAt("2026-11-16T12:05Z");
    await db.query("update workspace_notifications set created_at=now() where entity_id=$1", [
      s.checkin_id,
    ]);
    await db.query(
      "update attendance_v2_private.delivery set next_attempt_at=now() where checkin_id=$1",
      [s.checkin_id]
    );
    const claim = (await db.query("select * from claim_attendance_v2_push(50)")).rows.find(
      (x) => x.notification_id
    );
    assert.ok(claim);
    assert.equal(
      (
        await db.query(
          "select finish_attendance_v2_push($1,$2,'{}',false,'TEST_delivery_failure') ok",
          [claim.notification_id, claim.lease_token]
        )
      ).rows[0].ok,
      true
    );
    const delivery = (
      await db.query("select * from attendance_v2_private.delivery where notification_id=$1", [
        claim.notification_id,
      ])
    ).rows[0];
    assert.equal(delivery.state, "failed");
    assert.equal(delivery.attempts, 1);
    assert.equal(delivery.attempt_log.length, 1);
  });
  await test("successful retry resolves a routine issue without deleting its evidence", async () => {
    const retryBranch = randomUUID();
    await db.query("insert into branches(id) values($1)", [retryBranch]);
    await db.query("insert into attendance_settings(branch_id) values($1)", [retryBranch]);
    const person = await staff("crm", "csr");
    await db.query("update staff set branch_id=$2 where id=$1", [person, retryBranch]);
    const s = await scan(person, { atBranch: retryBranch });
    await db.query("alter table cash_session_handovers rename to held_test_cash_handovers");
    try { await processAt("2026-11-16T12:05Z"); }
    finally { await db.query("alter table held_test_cash_handovers rename to cash_session_handovers"); }
    const before = (await db.query("select * from attendance_exceptions where dedupe_key=$1", [`attendance-v2-processing:${s.checkin_id}`])).rows[0];
    assert.equal(before.status, "open");
    await processAt("2026-11-16T12:10Z");
    const after = (await db.query("select * from attendance_exceptions where id=$1", [before.id])).rows[0];
    assert.equal(after.status, "resolved");
    assert.equal(after.metadata.reasonCode, before.metadata.reasonCode);
    assert.equal(after.metadata.automaticResolution, "work_evidence_revalidated");
  });

  await test("training accepts one 120-minute-early scan without enrolling real work", async () => {
    const person = await staff(), s = await scan(person, { arrived: "2026-11-16T03:00Z", isTest: true });
    const r = await row(s.checkin_id);
    assert.equal(r.is_test, true);
    assert.equal(Date.parse(r.attendance_policy_snapshot.v2.creditedStartAt), Date.parse(startAt));
    assert.equal((await db.query("select count(*) n from attendance_v2_private.work where checkin_id=$1", [s.checkin_id])).rows[0].n, "0");
    await processAt("2026-11-16T16:10Z");
    assert.equal((await row(s.checkin_id)).checked_out_at, null);
    assert.equal(await notices(s.checkin_id), 0);
  });
  await test("temporary branch authority receives reminders while home branch differs", async () => {
    const person = await staff();
    await db.query("insert into staff_attendance_branch_assignments(staff_id,branch_id,scope,assignment_type,status,assignment_date) values($1,$2,'business_day','temporary','approved','2026-11-16')", [person,otherBranch]);
    const s = await scan(person, { atBranch: otherBranch });
    await processAt("2026-11-16T12:05Z");
    assert.equal(await notices(s.checkin_id),1);
    await processAt("2026-11-16T16:00Z");
    assert.equal((await row(s.checkin_id)).clock_out_method,"system_auto_close");
  });
  await test("next-day cash closure cannot retroactively authorize prior shift overtime", async () => {
    const person = await staff("crm","csr"), s = await scan(person);
    await db.query("insert into cash_sessions(branch_id,opened_by,closed_by,business_date,status,closed_at) values($1,$2,$2,'2026-11-17','closed','2026-11-17T14:00Z')",[branch,person]);
    await scan(person,{checkin:s.checkin_id,update:{checked_out_at:"2026-11-16T13:00Z",status:"checked_out",clock_out_method:"qr"}});
    await db.query("update staff_shift_checkins set attendance_policy_snapshot=attendance_policy_snapshot||jsonb_build_object('staffCategory','crm_front_desk') where id=$1",[s.checkin_id]);
    const r=await row(s.checkin_id);
    assert.equal(r.worked_minutes,420);
    assert.equal(r.attendance_policy_snapshot.v2.state,"review");
    assert.equal(Date.parse(r.attendance_policy_snapshot.v2.authorizedEndAt),Date.parse(endAt));
  });
  await test("clock-in-only correction retains actual QR clock-out provenance", async () => {
    const person=await staff(),s=await scan(person);
    await scan(person,{checkin:s.checkin_id,update:{checked_out_at:endAt,status:"checked_out",clock_out_method:"qr"}});
    await db.query("select * from correct_attendance_times_transaction($1,$2,'correct_attendance_times','TEST clock-in correction',$3,'2026-11-16T05:05Z',$4)",[branch,person,s.checkin_id,endAt]);
    const r=await row(s.checkin_id);
    assert.equal(r.clock_out_method,"qr");
    assert.equal(Date.parse(r.attendance_policy_snapshot.v2.actualClockOutAt),Date.parse(endAt));
    assert.equal(r.worked_minutes,415);
  });
  await test("new active duties resolve and suppress a failed queued reminder", async () => {
    const person=await staff(),s=await scan(person);
    await processAt("2026-11-16T12:05Z");
    assert.equal(await notices(s.checkin_id),1);
    await db.query("update attendance_v2_private.delivery set state='failed' where checkin_id=$1",[s.checkin_id]);
    await db.query("insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,status,booking_progress_status,session_started_at) values($1,$2,'2026-11-16','20:06','21:00','in_progress','session_started','2026-11-16T12:06Z')",[branch,person]);
    await processAt("2026-11-16T12:06Z");
    assert.equal((await db.query("select status from workspace_notifications where entity_id=$1",[s.checkin_id])).rows[0].status,"resolved");
    assert.equal((await db.query("select state from attendance_v2_private.delivery where checkin_id=$1",[s.checkin_id])).rows[0].state,"suppressed");
  });
  await test("fresh dispatch validation rejects duties started after claim without a worker pass", async () => {
    const person=await staff(),s=await scan(person);
    await processAt("2026-11-16T12:05Z");
    const n=(await db.query("select id from workspace_notifications where entity_id=$1",[s.checkin_id])).rows[0];
    const lease=randomUUID();
    await db.query("update workspace_notifications set created_at=now() where id=$1",[n.id]);
    await db.query("update attendance_v2_private.delivery set state='attempted',lease_token=$2,lease_until=now()+interval '2 minutes' where notification_id=$1",[n.id,lease]);
    // Synthetic current-day active assignment, so this tests the real dispatch-time resolver.
    await db.query("insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,status,booking_progress_status,session_started_at) values($1,$2,(now() at time zone 'Asia/Manila')::date,'00:00','23:59','in_progress','session_started',now())",[branch,person]);
    assert.equal((await db.query("select validate_attendance_v2_push($1,$2) ok",[n.id,lease])).rows[0].ok,false);
    assert.equal((await db.query("select state from attendance_v2_private.delivery where notification_id=$1",[n.id])).rows[0].state,"suppressed");
  });
  await test("reconciliation replay binds branch staff device test mode and checkin", async () => {
    const request=randomUUID(),device=randomUUID();
    await db.query("insert into qr_scan_events(request_id,staff_id,branch_id,device_id,checkin_id,is_test,operation_result) values($1,$2,$3,$4,$5,false,jsonb_build_object('ok',true))",[request,ordinary,branch,device,midnight.checkin_id]);
    const args=[request,midnight.checkin_id,branch,ordinary,randomUUID(),device,"2026-11-16T16:05Z",false];
    const call=async(values)=>(await db.query("select * from reconcile_provisional_attendance_clock_out($1,$2,$3,$4,$5,$6,$7,'{}',p_is_test=>$8)",values)).rows[0];
    assert.equal((await call(args)).code,"replayed");
    for(const index of [1,2,3,5,7]) {
      const wrong=[...args];wrong[index]=index===7?true:randomUUID();
      assert.equal((await call(wrong)).code,"scan_request_mismatch");
    }
  });

  await test("next-day cash handover and custody do not extend an older session", async () => {
    const person=await staff("crm","csr"),cash=randomUUID(),isolated=randomUUID();
    await db.query("insert into branches(id) values($1)",[isolated]);
    await db.query("insert into attendance_settings(branch_id) values($1)",[isolated]);
    await db.query("update staff set branch_id=$2 where id=$1",[person,isolated]);
    const s=await scan(person,{atBranch:isolated});
    await db.query("insert into cash_sessions(id,branch_id,opened_by,current_custodian_id,business_date) values($1,$2,$3,$3,'2026-11-17')",[cash,isolated,person]);
    await db.query("insert into cash_session_handovers(cash_session_id,branch_id,outgoing_custodian_id,created_at) values($1,$2,$3,'2026-11-17T08:00Z')",[cash,isolated,person]);
    await processAt("2026-11-17T08:05Z");
    const r=await row(s.checkin_id);
    assert.equal(r.clock_out_method,"system_auto_close");
    assert.equal(Date.parse(r.attendance_policy_snapshot.v2.authorizedEndAt),Date.parse(endAt));
    assert.equal(r.worked_minutes,420);
  });
  await test("dispatch accepts current overdue duty then rejects newly verified cash completion", async () => {
    const now=new Date(), end=new Date(now.getTime()-6*60000).toISOString(), start=new Date(now.getTime()-7*3600000).toISOString();
    const person=await staff("crm","csr"),cashBranch=randomUUID();
    await db.query("insert into branches(id) values($1)",[cashBranch]);
    await db.query("insert into attendance_settings(branch_id) values($1)",[cashBranch]);
    await db.query("update staff set branch_id=$2 where id=$1",[person,cashBranch]);
    const s=await scan(person,{start,end,arrived:start,atBranch:cashBranch});
    await processAt(now.toISOString());
    const n=(await db.query("select id from workspace_notifications where entity_id=$1",[s.checkin_id])).rows[0];
    assert.ok(n);
    const lease=randomUUID();
    await db.query("update attendance_v2_private.delivery set state='attempted',lease_token=$2,lease_until=now()+interval '2 minutes' where notification_id=$1",[n.id,lease]);
    assert.equal((await db.query("select validate_attendance_v2_push($1,$2) ok",[n.id,lease])).rows[0].ok,true);
    await db.query("insert into cash_sessions(branch_id,opened_by,closed_by,business_date,status,closed_at) values($1,$2,$2,'2026-11-16','closed',now()-interval '1 minute')",[cashBranch,person]);
    assert.equal((await db.query("select validate_attendance_v2_push($1,$2) ok",[n.id,lease])).rows[0].ok,false);
    assert.equal((await db.query("select state from attendance_v2_private.delivery where notification_id=$1",[n.id])).rows[0].state,"suppressed");
  });
  process.stdout.write(
    `LOCAL TEST ${database}: ${passed} integration scenarios passed; max bounded batch ${Math.max(...batchDurations).toFixed(2)} ms. Exact policy/scan/lifecycle SQL on PostgreSQL 17.11; synthetic schema, no Supabase/PostgREST parity claim.\n`
  );
} finally {
  await db.end();
}

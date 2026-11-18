import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = resolve(import.meta.dirname, "../..");
const isWin = process.platform === "win32";
const postgresBinaryName = isWin ? "postgres.exe" : "postgres";
const embeddedPkg = isWin
  ? "@embedded-postgres/windows-x64"
  : process.platform === "darwin"
    ? process.arch === "arm64"
      ? "@embedded-postgres/darwin-arm64"
      : "@embedded-postgres/darwin-x64"
    : process.arch === "arm64"
      ? "@embedded-postgres/linux-arm64"
      : "@embedded-postgres/linux-x64";
const candidatePgRoots = [
  process.env.ATTENDANCE_TEST_PG_ROOT,
  resolve(repoRoot, ".tmp/attendance-v2-postgres"),
  resolve(repoRoot, "../web-attendance-v2/.tmp/attendance-v2-postgres"),
  repoRoot,
].filter(Boolean);
const postgresRoot = candidatePgRoots.find(
  (dir) =>
    existsSync(resolve(dir, "node_modules/pg")) &&
    existsSync(resolve(dir, "node_modules", embeddedPkg, "native/bin", postgresBinaryName))
);
if (!postgresRoot) {
  throw new Error(
    `Local embedded PostgreSQL harness not found (checked ATTENDANCE_TEST_PG_ROOT and ${candidatePgRoots.join(", ")}). Set ATTENDANCE_TEST_PG_ROOT or install pg + ${embeddedPkg}.`
  );
}
const { Client } = require(resolve(postgresRoot, "node_modules/pg"));
const binDir = resolve(postgresRoot, "node_modules", embeddedPkg, "native/bin");
const initdbBin = resolve(binDir, isWin ? "initdb.exe" : "initdb");
const pgCtlBin = resolve(binDir, isWin ? "pg_ctl.exe" : "pg_ctl");
const pgDataDir = resolve(repoRoot, ".tmp/lifecycle-pgdata");
const pgLogFile = resolve(repoRoot, ".tmp/lifecycle-pg.log");
const pgPort = 55442;

assert.ok(existsSync(resolve(binDir, postgresBinaryName)), "Local embedded PostgreSQL binaries must exist");

rmSync(pgDataDir, { recursive: true, force: true });
mkdirSync(dirname(pgDataDir), { recursive: true });

execFileSync(
  initdbBin,
  ["-D", pgDataDir, "-U", "postgres", "-A", "trust", "-E", "UTF8"],
  { stdio: "ignore" }
);
execFileSync(
  pgCtlBin,
  ["-D", pgDataDir, "-l", pgLogFile, "-o", `-h 127.0.0.1 -p ${pgPort}`, "start"],
  { stdio: "ignore" }
);

const database = `attendance_lifecycle_test_${Date.now()}`;
const baseConfig = { host: "127.0.0.1", port: pgPort, user: "postgres" };
const admin = new Client({ ...baseConfig, database: "postgres" });
await admin.connect();
const identity = (
  await admin.query(
    "select host(inet_server_addr()) host, inet_server_port() port, current_setting('data_directory') dir, version() version"
  )
).rows[0];
assert.equal(identity.host, "127.0.0.1");
assert.equal(identity.port, pgPort);
assert.match(identity.version, /PostgreSQL 17\./);
await admin.query(`create database ${database}`);
await admin.end();

const dbConfig = { ...baseConfig, database };
const db = new Client(dbConfig);
await db.connect();

const read = (rel) => readFileSync(resolve(repoRoot, rel), "utf8");
void spawn;
function extract(path, name) {
  const source = read(path);
  const pattern = new RegExp(`create (?:or replace )?function public\\.${name}\\(`, "i");
  const start = source.search(pattern);
  assert.ok(start >= 0, `Missing function ${name} in ${path}`);
  const endMarker = source.indexOf("\n$$;", start);
  const altEnd = source.indexOf("\n$function$;", start);
  const idx = endMarker >= 0 ? endMarker + 4 : altEnd + "\n$function$;".length;
  return source.slice(start, idx);
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  process.stdout.write(`PASS ${name}\n`);
}

try {
  await db.query("set timezone='UTC'; set statement_timeout='15s'");
  await db.query(read("tests/database/attendance-v2-fixture.sql"));
  await db.query("alter table public.staff add column if not exists nickname text");
  await db.query(
    "alter table public.staff_devices add column if not exists device_fingerprint_hash text, add column if not exists status text default 'active', add column if not exists trusted_after timestamptz default '2026-01-01Z', add column if not exists revoked_at timestamptz"
  );

  const dynamic = "supabase/migrations/20260715021703_attendance_smart_dynamic_clock_out.sql";
  for (const fn of [
    "resolve_attendance_staff_category",
    "recalculate_attendance_clock_out_policy",
    "write_attendance_portal_audit",
    "commit_attendance_portal_clock_out",
  ]) {
    await db.query(extract(dynamic, fn));
  }
  const accepted = "supabase/migrations/20260821023717_fix_attendance_function_ambiguity.sql";
  await db.query(extract(accepted, "commit_attendance_scan_transaction"));
  await db.query(extract(accepted, "reconcile_provisional_attendance_clock_out"));
  await db.query(
    extract(
      "supabase/migrations/20260722110000_attendance_correct_times_transaction.sql",
      "correct_attendance_times_transaction"
    )
  );
  await db.query(
    extract(
      "supabase/migrations/20260721190000_attendance_stale_recovery_transaction.sql",
      "recover_stale_attendance_and_clock_in"
    )
  );
  const p0 = read("supabase/migrations/20261109120000_attendance_qr_clockin_window_guard.sql");
  const start = p0.indexOf("CREATE FUNCTION public.enforce_qr_clock_in_shift_window()");
  await db.query(
    p0.slice(start, p0.indexOf("$attendance_p0_guard$;", start) + "$attendance_p0_guard$;".length)
  );
  await db.query(
    "create trigger staff_shift_checkins_qr_clock_in_window_guard before insert on staff_shift_checkins for each row execute function enforce_qr_clock_in_shift_window()"
  );
  await db.query(
    extract(
      "supabase/migrations/20260821034409_repair_attendance_branch_authority.sql",
      "resolve_effective_attendance_branch"
    )
  );
  await db.query(read("supabase/migrations/20261116094630_attendance_v2_automation.sql"));
  await db.query(read("supabase/migrations/20261118163000_attendance_lifecycle_correction.sql"));

  for (const fn of [
    "lock_attendance_for_booking_mutation",
    "recalculate_attendance_after_booking_event",
  ]) {
    await db.query(extract(dynamic, fn));
  }
  await db.query(
    "create trigger bookings_lock_attendance before insert or update or delete on bookings for each row execute function lock_attendance_for_booking_mutation()"
  );
  await db.query(
    "create trigger bookings_recalculate_attendance after insert or update or delete on bookings for each row execute function recalculate_attendance_after_booking_event()"
  );
  await db.query(
    "grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role"
  );

  const branch = randomUUID();
  const otherBranch = randomUUID();
  await db.query("insert into branches(id) values($1),($2)", [branch, otherBranch]);
  await db.query("insert into attendance_settings(branch_id) values($1),($2)", [
    branch,
    otherBranch,
  ]);
  await db.query("update attendance_v2_private.control set enabled_at='2026-01-01Z', owns_closing=true");

  const startAt = "2026-11-16T05:00:00Z";
  const endAt = "2026-11-16T12:00:00Z";
  async function createStaff({ role = "staff", type = "therapist" } = {}) {
    const id = randomUUID();
    const authUserId = randomUUID();
    const deviceId = randomUUID();
    const rawCred = `dev-${id}`;
    const fpHash = createHash("sha256").update(rawCred).digest("hex");
    await db.query(
      "insert into staff(id,branch_id,system_role,staff_type,auth_user_id,nickname) values($1,$2,$3,$4,$5,'TEST')",
      [id, branch, role, type, authUserId]
    );
    await db.query(
      "insert into staff_devices(id,staff_id,branch_id,device_fingerprint_hash,status,trusted_after) values($1,$2,$3,$4,'active','2026-01-01Z')",
      [deviceId, id, branch, fpHash]
    );
    return { id, authUserId, deviceId, fpHash };
  }

  async function scanIn(
    s,
    {
      arrived = startAt,
      start = startAt,
      end = endAt,
      atBranch = branch,
      shiftDate = "2026-11-16",
      shiftType = "single",
      request = randomUUID(),
      connection = db,
    } = {}
  ) {
    return (
      await connection.query(
        `select * from commit_attendance_scan_transaction(
          p_request_id=>$1, p_branch_id=>$2, p_qr_point_id=>$3, p_staff_id=>$4, p_device_id=>$5,
          p_is_test=>false, p_scan_type=>'attendance', p_action=>'clock_in', p_outcome=>'success',
          p_public_result=>$6::jsonb, p_checkin_insert=>$7::jsonb
        )`,
        [
          request,
          atBranch,
          randomUUID(),
          s.id,
          s.deviceId,
          JSON.stringify({ ok: true, outcome: "success", title: "TEST", message: "TEST" }),
          JSON.stringify({
            shift_date: shiftDate,
            shift_type: shiftType,
            shift_instance_key: `${s.id}:${shiftDate}:${shiftType}`,
            checked_in_at: arrived,
            scheduled_start_at: start,
            scheduled_end_at: end,
            schedule_source: "weekly",
            schedule_source_id: "TEST-weekly",
            branch_timezone: "Asia/Manila",
            attendance_business_date: shiftDate,
          }),
        ]
      )
    ).rows[0];
  }

  const getRow = async (id) =>
    (await db.query("select * from staff_shift_checkins where id=$1", [id])).rows[0];
  const getNotices = async (id) =>
    (await db.query("select * from workspace_notifications where entity_id=$1 order by created_at asc", [id]))
      .rows;
  const processAt = async (at) =>
    (await db.query("select process_due_attendance_v2($1, 100) r", [at])).rows[0].r;

  await test("stale recovery attributes exception strictly to prior stale checkin & leaves today clean", async () => {
    const s = await createStaff();
    const day1 = await scanIn(s, {
      shiftDate: "2026-11-17",
      arrived: "2026-11-17T06:00:00Z",
      start: "2026-11-17T06:00:00Z",
      end: "2026-11-17T14:00:00Z",
    });
    const day1Before = await getRow(day1.checkin_id);

    // Next day arrives 100 minutes early (120m one-scan policy!) while recovering Day 1
    const rec = (
      await db.query(
        `select * from public.recover_stale_attendance_and_clock_in(
          p_stale_checkin_id=>$1, p_staff_id=>$2, p_current_branch_id=>$3, p_qr_point_id=>$4,
          p_is_test=>false, p_recovery_clock_out_at=>'2026-11-17T14:00:00Z',
          p_current_checkin=>$5::jsonb, p_request_id=>$6, p_device_id=>$7,
          p_public_result=>'{"ok":true}'::jsonb,
          p_exception=>$8::jsonb
        )`,
        [
          day1.checkin_id,
          s.id,
          branch,
          randomUUID(),
          JSON.stringify({
            shift_date: "2026-11-18",
            shift_type: "single",
            shift_instance_key: `${s.id}:2026-11-18:single`,
            checked_in_at: "2026-11-18T04:20:00Z",
            scheduled_start_at: "2026-11-18T06:00:00Z",
            scheduled_end_at: "2026-11-18T14:00:00Z",
            schedule_source: "weekly",
            schedule_source_id: "TEST-weekly",
            branch_timezone: "Asia/Manila",
            attendance_business_date: "2026-11-18",
            exception_state: "none",
          }),
          randomUUID(),
          s.deviceId,
          JSON.stringify({
            exception_type: "missed_checkout",
            severity: "warning",
            message: "TEST stale recovered",
            metadata: { internalExceptionType: "stale_open_checkin" },
            dedupe_key: `${s.id}|${day1.checkin_id}|stale_open_checkin|live`,
          }),
        ]
      )
    ).rows[0];

    assert.equal(rec.success, true);
    const day1After = await getRow(day1.checkin_id);
    const day2 = await getRow(rec.current_checkin_id);

    assert.equal(day1After.clock_in_scan_event_id, day1Before.clock_in_scan_event_id);
    assert.equal(day1After.clock_out_method, "system_auto_close");
    assert.ok(day1After.provisional_auto_closed_at);
    assert.equal(day1After.clock_out_confirmation_required, true);
    assert.equal(day1After.exception_state, "open");

    // Today's session is clean and starts crediting at scheduled_start_at (one scan!)
    assert.equal(day2.exception_state, "none");
    assert.equal(day2.checked_in_at.toISOString(), "2026-11-18T04:20:00.000Z");
    assert.equal(
      Date.parse(day2.attendance_policy_snapshot.v2.creditedStartAt),
      Date.parse("2026-11-18T06:00:00.000Z")
    );

    const excs = (
      await db.query("select * from attendance_exceptions where staff_id=$1", [s.id])
    ).rows;
    assert.equal(excs.length, 1);
    assert.equal(excs[0].checkin_id, day1.checkin_id);
    assert.deepEqual(excs[0].related_checkin_ids, [day1.checkin_id]);
    assert.equal(excs[0].metadata.staleBusinessDate, "2026-11-17");
    assert.equal(excs[0].metadata.staleShiftDate, "2026-11-17");
    assert.equal(excs[0].metadata.recoveredByCurrentCheckinId, day2.id);
  });

  await test("120-minute window rejects 121 minutes early and accepts 120 minutes early", async () => {
    const s = await createStaff();
    await assert.rejects(
      scanIn(s, { arrived: "2026-11-16T02:59:59Z" }),
      /attendance_qr_clock_in_outside_shift_window/
    );
    const okScan = await scanIn(s, { arrived: "2026-11-16T03:00:00Z" });
    const row = await getRow(okScan.checkin_id);
    assert.equal(
      Date.parse(row.attendance_policy_snapshot.v2.creditedStartAt),
      Date.parse(startAt)
    );
  });

  await test("standard shift reminds at +20m (not +5m or +19m), deduplicates, repeats +15m, and cancels on QR clock-out", async () => {
    const s = await createStaff();
    const scan = await scanIn(s);
    await processAt("2026-11-16T12:05:00Z");
    assert.equal((await getNotices(scan.checkin_id)).length, 0);
    await processAt("2026-11-16T12:19:59Z");
    assert.equal((await getNotices(scan.checkin_id)).length, 0);

    await processAt("2026-11-16T12:20:00Z");
    await processAt("2026-11-16T12:20:00Z"); // retry at same instant must dedupe
    let allNotices = await getNotices(scan.checkin_id);
    assert.equal(allNotices.length, 1);
    assert.equal(allNotices[0].metadata.reminderKind, "shift_end");
    assert.equal(allNotices[0].metadata.delayMinutes, 20);
    assert.equal(allNotices[0].action_href, "/staff/attendance");

    await processAt("2026-11-16T12:35:00Z");
    allNotices = await getNotices(scan.checkin_id);
    assert.equal(allNotices.length, 2);
    assert.equal(allNotices[0].status, "resolved"); // older open notice retired cleanly
    assert.equal(allNotices[1].status, "unread");

    await db.query(
      `select * from commit_attendance_scan_transaction(
        p_request_id=>$1, p_branch_id=>$2, p_qr_point_id=>$3, p_staff_id=>$4, p_device_id=>$5,
        p_is_test=>false, p_scan_type=>'attendance', p_action=>'clock_out', p_outcome=>'success',
        p_public_result=>'{"ok":true}'::jsonb, p_checkin_id=>$6,
        p_checkin_update=>$7::jsonb
      )`,
      [
        randomUUID(),
        branch,
        randomUUID(),
        s.id,
        s.deviceId,
        scan.checkin_id,
        JSON.stringify({
          checked_out_at: "2026-11-16T12:36:00Z",
          status: "checked_out",
          clock_out_method: "qr",
        }),
      ]
    );
    await processAt("2026-11-16T12:55:00Z");
    allNotices = await getNotices(scan.checkin_id);
    assert.equal(allNotices.length, 2);
    assert.equal(allNotices.filter((n) => n.status === "unread").length, 0);
  });

  await test("final home-service therapist with buffer reminds at +10m, explains manual Clock out, does NOT auto-clock-out, and reuses commit_attendance_portal_clock_out", async () => {
    const isolated = randomUUID();
    await db.query("insert into branches(id) values($1)", [isolated]);
    await db.query("insert into attendance_settings(branch_id) values($1)", [isolated]);
    await db.query(
      "insert into attendance_staff_category_rules(branch_id,staff_category,effective_from,home_service_wrap_up_buffer_minutes,final_client_release_enabled) values($1,'therapists','2026-01-01Z',15,true)",
      [isolated]
    );
    const s = await createStaff();
    await db.query("update staff set branch_id=$2 where id=$1", [s.id, isolated]);
    await db.query("update staff_devices set branch_id=$2 where id=$1", [s.deviceId, isolated]);

    // Scheduled 13:00-22:00 Manila (05:00Z-14:00Z); final home service finishes at 19:00 Manila (11:00Z) + 15m buffer = 11:15Z
    const scan = (
      await db.query(
        `select * from commit_attendance_scan_transaction(
          p_request_id=>$1, p_branch_id=>$2, p_qr_point_id=>$3, p_staff_id=>$4, p_device_id=>$5,
          p_is_test=>false, p_scan_type=>'attendance', p_action=>'clock_in', p_outcome=>'success',
          p_public_result=>'{"ok":true}'::jsonb, p_checkin_insert=>$6::jsonb
        )`,
        [
          randomUUID(),
          isolated,
          randomUUID(),
          s.id,
          s.deviceId,
          JSON.stringify({
            shift_date: "2026-11-16",
            shift_type: "single",
            shift_instance_key: `${s.id}:2026-11-16:hs`,
            checked_in_at: startAt,
            scheduled_start_at: startAt,
            scheduled_end_at: "2026-11-16T14:00:00Z",
            schedule_source: "weekly",
            schedule_source_id: "TEST-hs",
            branch_timezone: "Asia/Manila",
            attendance_business_date: "2026-11-16",
          }),
        ]
      )
    ).rows[0];

    await db.query(
      "insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,session_completed_at) values($1,$2,'2026-11-16','18:00','19:00','home_service','completed','completed','2026-11-16T11:00:00Z')",
      [isolated, s.id]
    );

    // Buffer ends 11:15Z -> +9m (11:24Z) must NOT remind yet
    await processAt("2026-11-16T11:24:00Z");
    assert.equal((await getNotices(scan.checkin_id)).length, 0);

    // +10m (11:25Z) reminds once; service completion NEVER auto-clocks out!
    await processAt("2026-11-16T11:25:00Z");
    const noticeRows = await getNotices(scan.checkin_id);
    assert.equal(noticeRows.length, 1);
    assert.equal(noticeRows[0].metadata.reminderKind, "final_home_service");
    assert.equal(noticeRows[0].metadata.delayMinutes, 10);
    assert.equal(noticeRows[0].metadata.portalClockOutEligible, true);
    assert.match(noticeRows[0].body, /Clock out/);
    assert.equal((await getRow(scan.checkin_id)).checked_out_at, null);

    // Subsequent active assignment inserted before clock-out immediately suppresses reminder via trigger & due check
    const nextBookingId = randomUUID();
    await db.query(
      "insert into bookings(id,branch_id,staff_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,session_started_at) values($1,$2,$3,'2026-11-16','19:30','20:30','in_spa','in_progress','session_started','2026-11-16T11:25:30Z')",
      [nextBookingId, isolated, s.id]
    );
    assert.equal((await getNotices(scan.checkin_id))[0].status, "resolved");

    // Once active booking completes and portal clock-out eligibility opens (real-time shift), commit_attendance_portal_clock_out closes & suppresses reminders!
    const now = new Date();
    const todayYmd = (await db.query("select (now() at time zone 'Asia/Manila')::date d")).rows[0].d
      .toISOString()
      .slice(0, 10);
    const sLive = await createStaff();
    await db.query("update staff set branch_id=$2 where id=$1", [sLive.id, isolated]);
    await db.query("update staff_devices set branch_id=$2 where id=$1", [sLive.deviceId, isolated]);
    const liveStart = new Date(now.getTime() - 6 * 3600_000).toISOString();
    const liveEnd = new Date(now.getTime() + 2 * 3600_000).toISOString();
    const liveCompletedAt = new Date(now.getTime() - 26 * 60_000).toISOString();
    const liveScan = await scanIn(sLive, {
      atBranch: isolated,
      shiftDate: todayYmd,
      arrived: liveStart,
      start: liveStart,
      end: liveEnd,
    });
    await db.query(
      "insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,session_completed_at) values($1,$2,$3,'08:00','09:00','home_service','completed','completed',$4)",
      [isolated, sLive.id, todayYmd, liveCompletedAt]
    );
    // Completed 26m ago + 15m buffer = 11m ago (>= +10m!)
    await processAt(now.toISOString());
    const openNotice = (await getNotices(liveScan.checkin_id)).find((n) => n.status === "unread");
    assert.ok(openNotice);

    const portalResult = (
      await db.query("select public.commit_attendance_portal_clock_out($1,$2,$3) r", [
        sLive.authUserId,
        sLive.fpHash,
        randomUUID(),
      ])
    ).rows[0].r;
    assert.equal(portalResult.ok, true);
    assert.equal(portalResult.clock_out_method, "staff_portal_home_service");

    const closed = await getRow(liveScan.checkin_id);
    assert.equal(closed.status, "checked_out");
    assert.equal(closed.clock_out_method, "staff_portal_home_service");
    assert.equal((await getNotices(liveScan.checkin_id)).filter((n) => n.status === "unread").length, 0);
    assert.equal(
      (
        await db.query(
          "select count(*) n from attendance_v2_private.delivery where checkin_id=$1 and state <> 'suppressed'",
          [liveScan.checkin_id]
        )
      ).rows[0].n,
      "0"
    );
  });

  await test("live dispatch validation suppresses stale push when new booking appears or staff clocks out", async () => {
    const now = new Date();
    const s = await createStaff();
    const startIso = new Date(now.getTime() - 9 * 3600_000).toISOString();
    const endIso = new Date(now.getTime() - 25 * 60_000).toISOString();
    const todayYmd = (
      await db.query("select (now() at time zone 'Asia/Manila')::date d")
    ).rows[0].d
      .toISOString()
      .slice(0, 10);
    const scan = await scanIn(s, {
      shiftDate: todayYmd,
      arrived: startIso,
      start: startIso,
      end: endIso,
    });
    await processAt(now.toISOString());
    const n = (await getNotices(scan.checkin_id))[0];
    assert.ok(n);
    const claimed = (await db.query("select * from claim_attendance_v2_push(20)")).rows.find(
      (row) => row.notification_id === n.id
    );
    assert.ok(claimed);
    assert.equal(
      (await db.query("select validate_attendance_v2_push($1,$2) ok", [n.id, claimed.lease_token])).rows[0]
        .ok,
      true
    );

    // Inject active in_progress booking inside branch business day [06:00..+24h) -> validate must reject and suppress!
    await db.query(
      "insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,status,booking_progress_status,session_started_at) values($1,$2,$3,'08:00','23:59','in_progress','session_started',now())",
      [branch, s.id, todayYmd]
    );
    assert.equal(
      (await db.query("select validate_attendance_v2_push($1,$2) ok", [n.id, claimed.lease_token])).rows[0]
        .ok,
      false
    );
    assert.equal(
      (
        await db.query(
          "select state from attendance_v2_private.delivery where notification_id=$1",
          [n.id]
        )
      ).rows[0].state,
      "suppressed"
    );
  });

  await test("overnight shift (17:00-01:30) waits past midnight AND sends +20m reminder before morning provisional auto-close", async () => {
    const s = await createStaff();
    // 17:00 Manila = 09:00Z on Nov 16; 01:30 Manila next day = 17:30Z on Nov 16; Manila midnight = 16:00Z
    const scan = await scanIn(s, {
      shiftDate: "2026-11-16",
      shiftType: "closing",
      arrived: "2026-11-16T07:30:00Z", // 90m early!
      start: "2026-11-16T09:00:00Z",
      end: "2026-11-16T17:30:00Z",
    });

    await processAt("2026-11-16T16:05:00Z"); // 00:05 Manila -> stays open
    assert.equal((await getRow(scan.checkin_id)).checked_out_at, null);

    await processAt("2026-11-16T17:35:00Z"); // 01:35 Manila (+5m) -> must NOT close or remind yet
    assert.equal((await getRow(scan.checkin_id)).checked_out_at, null);
    assert.equal((await getNotices(scan.checkin_id)).length, 0);

    await processAt("2026-11-16T17:50:00Z"); // 01:50 Manila (+20m) -> reminds once, still stays open!
    assert.equal((await getRow(scan.checkin_id)).checked_out_at, null);
    assert.equal((await getNotices(scan.checkin_id)).length, 1);

    await processAt("2026-11-16T22:00:00Z"); // 06:00 Manila boundary -> provisional system_auto_close!
    const closed = await getRow(scan.checkin_id);
    assert.equal(closed.clock_out_method, "system_auto_close");
    assert.equal(closed.checked_out_at.toISOString(), "2026-11-16T17:30:00.000Z");
    assert.equal(closed.worked_minutes, 510);
    assert.equal(closed.attendance_policy_snapshot.v2.state, "preliminary");
    assert.equal(closed.attendance_policy_snapshot.v2.actualClockOutAt, null);
  });

  await test("concurrent due processors and concurrent QR scans preserve single state and zero duplicate alerts", async () => {
    const s = await createStaff();
    const c1 = new Client(dbConfig);
    const c2 = new Client(dbConfig);
    await c1.connect();
    await c2.connect();
    try {
      const [r1, r2] = await Promise.all([
        scanIn(s, { connection: c1 }),
        scanIn(s, { connection: c2 }),
      ]);
      assert.equal(r1.checkin_id, r2.checkin_id);
      await Promise.all([
        c1.query("select process_due_attendance_v2('2026-11-16T12:20:00Z', 100)"),
        c2.query("select process_due_attendance_v2('2026-11-16T12:20:00Z', 100)"),
      ]);
      assert.equal((await getNotices(r1.checkin_id)).length, 1);
    } finally {
      await c1.end();
      await c2.end();
    }
  });

  await test("driver final home-service trip preserves return buffer +10m reminder and never auto-finalizes completion", async () => {
    const drvBranch = randomUUID();
    await db.query("insert into branches(id) values($1)", [drvBranch]);
    await db.query("insert into attendance_settings(branch_id) values($1)", [drvBranch]);
    await db.query(
      "insert into attendance_staff_category_rules(branch_id,staff_category,effective_from,driver_return_buffer_minutes) values($1,'drivers','2026-01-01Z',30)",
      [drvBranch]
    );
    const d = await createStaff({ role: "driver", type: "driver" });
    await db.query("update staff set branch_id=$2 where id=$1", [d.id, drvBranch]);
    await db.query("update staff_devices set branch_id=$2 where id=$1", [d.deviceId, drvBranch]);

    const scan = await scanIn(d, { atBranch: drvBranch });
    await db.query(
      "insert into bookings(branch_id,driver_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,completed_at) values($1,$2,'2026-11-16','19:00','22:00','home_service','completed','completed','2026-11-16T14:00:00Z')",
      [drvBranch, d.id]
    );

    // Return buffer ends 14:30Z -> +9m (14:39Z) must NOT remind yet; +10m (14:40Z) reminds once; never auto-closes on completion
    await processAt("2026-11-16T14:39:00Z");
    assert.equal((await getNotices(scan.checkin_id)).length, 0);
    await processAt("2026-11-16T14:40:00Z");
    const noticeList = await getNotices(scan.checkin_id);
    assert.equal(noticeList.length, 1);
    assert.equal(noticeList[0].metadata.reminderKind, "final_home_service");
    assert.equal(noticeList[0].metadata.delayMinutes, 10);
    assert.equal(noticeList[0].metadata.portalClockOutMethod, "driver_portal_final_trip");
    const openRow = await getRow(scan.checkin_id);
    assert.equal(openRow.checked_out_at, null);
    assert.equal(openRow.attendance_policy_snapshot.v2.state, "preliminary");
  });

  await test("push delivery preserves failure attempt evidence and suppresses expired offline notices", async () => {
    const s = await createStaff();
    const scan = await scanIn(s);
    await processAt("2026-11-16T12:20:00Z");
    const n = (await getNotices(scan.checkin_id))[0];
    assert.ok(n);

    // Offline window (>5m old notice) must be suppressed on claim without blasting a stale push
    const claims = (await db.query("select * from claim_attendance_v2_push(50)")).rows;
    assert.equal(claims.some((r) => r.notification_id === n.id), false);
    const suppressedRow = (
      await db.query("select * from attendance_v2_private.delivery where notification_id=$1", [n.id])
    ).rows[0];
    assert.equal(suppressedRow.state, "suppressed");
    assert.equal(suppressedRow.last_error, "interval_expired_or_resolved");

    // Fresh failed push retains attempt_log evidence across retry
    const n2Id = n.id;
    await db.query("update workspace_notifications set created_at=now(), status='unread' where id=$1", [n2Id]);
    await db.query(
      "update attendance_v2_private.delivery set state='queued', next_attempt_at=now(), attempt_log='[]'::jsonb where notification_id=$1",
      [n2Id]
    );
    const freshClaim = (await db.query("select * from claim_attendance_v2_push(50)")).rows.find(
      (r) => r.notification_id === n2Id
    );
    assert.ok(freshClaim);
    await db.query(
      "select finish_attendance_v2_push($1,$2,'{}',false,'provider_timeout')",
      [freshClaim.notification_id, freshClaim.lease_token]
    );
    const failedRow = (
      await db.query("select * from attendance_v2_private.delivery where notification_id=$1", [n2Id])
    ).rows[0];
    assert.equal(failedRow.state, "failed");
    assert.equal(failedRow.attempts, 1);
    assert.equal(failedRow.attempt_log.length, 1);
    assert.equal(failedRow.attempt_log[0].error, "provider_timeout");
  });

  await test("late day shift near midnight emits +20m reminder before morning provisional auto-close", async () => {
    const s = await createStaff();
    // 15:00-23:50 Manila -> scheduled_end_at 15:50Z (< midnight 16:00Z), reminder 1 due at 16:10Z
    const scan = await scanIn(s, {
      shiftDate: "2026-11-16",
      arrived: "2026-11-16T07:00:00Z",
      start: "2026-11-16T07:00:00Z",
      end: "2026-11-16T15:50:00Z",
    });

    await processAt("2026-11-16T16:10:00Z");
    const afterFirst = await getRow(scan.checkin_id);
    assert.equal(afterFirst.status, "checked_in");
    assert.equal(afterFirst.provisional_auto_closed_at, null);
    assert.equal((await getNotices(scan.checkin_id)).length, 1);

    await processAt("2026-11-16T22:00:00Z");
    const closedRow = await getRow(scan.checkin_id);
    assert.equal(closedRow.status, "checked_out");
    assert.equal(closedRow.clock_out_method, "system_auto_close");
  });

  await test("final home-service early completion obeys final_client_release_enabled flag and guard_credit shrink", async () => {
    const heldBranch = randomUUID();
    const relBranch = randomUUID();
    await db.query("insert into branches(id) values($1),($2)", [heldBranch, relBranch]);
    await db.query("insert into attendance_settings(branch_id) values($1),($2)", [heldBranch, relBranch]);
    await db.query(
      `insert into attendance_staff_category_rules(branch_id,staff_category,effective_from,home_service_wrap_up_buffer_minutes,final_client_release_enabled)
       values($1,'therapists','2026-01-01Z',20,false),($2,'therapists','2026-01-01Z',20,true)`,
      [heldBranch, relBranch]
    );

    const held = await createStaff({ role: "staff", type: "therapist" });
    await db.query("update staff set branch_id=$2 where id=$1", [held.id, heldBranch]);
    await db.query("update staff_devices set branch_id=$2 where id=$1", [held.deviceId, heldBranch]);
    const heldScan = await scanIn(held, {
      atBranch: heldBranch,
      arrived: "2026-11-16T02:00:00Z",
      start: "2026-11-16T02:00:00Z",
      end: "2026-11-16T11:00:00Z",
    });
    await db.query(
      "insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,session_completed_at) values($1,$2,'2026-11-16','13:00','15:00','home_service','completed','completed','2026-11-16T07:00:00Z')",
      [heldBranch, held.id]
    );
    await db.query("select recalculate_attendance_clock_out_policy($1, '2026-11-16T07:00:00Z')", [
      heldScan.checkin_id,
    ]);

    await processAt("2026-11-16T07:35:00Z");
    assert.equal((await getNotices(heldScan.checkin_id)).length, 0);
    await processAt("2026-11-16T11:20:00Z");
    const heldNotices = await getNotices(heldScan.checkin_id);
    assert.equal(heldNotices.length, 1);
    assert.equal(heldNotices[0].metadata.reminderKind, "shift_end");

    const rel = await createStaff({ role: "staff", type: "therapist" });
    await db.query("update staff set branch_id=$2 where id=$1", [rel.id, relBranch]);
    await db.query("update staff_devices set branch_id=$2 where id=$1", [rel.deviceId, relBranch]);
    const relScan = await scanIn(rel, {
      atBranch: relBranch,
      arrived: "2026-11-16T02:00:00Z",
      start: "2026-11-16T02:00:00Z",
      end: "2026-11-16T11:00:00Z",
    });
    await db.query(
      "insert into bookings(branch_id,staff_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status,session_completed_at) values($1,$2,'2026-11-16','13:00','15:00','home_service','completed','completed','2026-11-16T07:00:00Z')",
      [relBranch, rel.id]
    );
    await db.query("select recalculate_attendance_clock_out_policy($1, '2026-11-16T07:00:00Z')", [
      relScan.checkin_id,
    ]);

    await processAt("2026-11-16T07:29:00Z");
    assert.equal((await getNotices(relScan.checkin_id)).length, 0);
    await processAt("2026-11-16T07:30:00Z");
    const relNotices = await getNotices(relScan.checkin_id);
    assert.equal(relNotices.length, 1);
    assert.equal(relNotices[0].metadata.reminderKind, "final_home_service");
    assert.equal(relNotices[0].metadata.delayMinutes, 10);
  });

  await test("crm_front_desk closing shift defers while cash session open and reminds +20m after handover", async () => {
    const csr = await createStaff({ role: "csr", type: "csr" });
    const otherCsr = await createStaff({ role: "csr", type: "csr" });
    const cashId = randomUUID();
    const scan = await scanIn(csr, {
      shiftType: "closing",
      arrived: "2026-11-16T04:00:00Z",
      start: "2026-11-16T04:00:00Z",
      end: "2026-11-16T12:00:00Z",
    });
    await db.query(
      "insert into cash_sessions(id,branch_id,opened_by,current_custodian_id,business_date,status) values($1,$2,$3,$3,'2026-11-16','open')",
      [cashId, branch, csr.id]
    );

    // Open cash session blocks closing reminder past +20m
    await processAt("2026-11-16T12:25:00Z");
    assert.equal((await getNotices(scan.checkin_id)).length, 0);

    // Handover at 12:30Z transfers custody -> reminder at 12:50Z (+20m), not 12:49Z
    await db.query("update cash_sessions set current_custodian_id=$2 where id=$1", [cashId, otherCsr.id]);
    await db.query(
      "insert into cash_session_handovers(cash_session_id,branch_id,outgoing_custodian_id,created_at) values($1,$2,$3,'2026-11-16T12:30:00Z')",
      [cashId, branch, csr.id]
    );

    await processAt("2026-11-16T12:49:00Z");
    assert.equal((await getNotices(scan.checkin_id)).length, 0);
    await processAt("2026-11-16T12:50:00Z");
    const csrNotices = await getNotices(scan.checkin_id);
    assert.equal(csrNotices.length, 1);
    assert.equal(csrNotices[0].metadata.delayMinutes, 20);
  });

  await test("brief booking added and cancelled inside same 15m interval re-emits reminder and stale recovery replay is idempotent", async () => {
    const s = await createStaff();
    const scan = await scanIn(s);
    await processAt("2026-11-16T12:20:00Z");
    const first = await getNotices(scan.checkin_id);
    assert.equal(first.length, 1);
    assert.equal(first[0].status, "unread");

    const tempBookingId = randomUUID();
    await db.query(
      "insert into bookings(id,branch_id,staff_id,booking_date,start_time,end_time,delivery_type,status,booking_progress_status) values($1,$2,$3,'2026-11-16','20:30','21:30','in_spa','confirmed','not_started')",
      [tempBookingId, branch, s.id]
    );
    await db.query("select recalculate_attendance_clock_out_policy($1, '2026-11-16T12:23:00Z')", [
      scan.checkin_id,
    ]);
    await processAt("2026-11-16T12:23:00Z");
    const suppressed = await getNotices(scan.checkin_id);
    assert.equal(suppressed[0].status, "resolved");

    // Cancelling the temporary booking within the same interval must re-emit immediately without waiting +15m
    await db.query("update bookings set status='cancelled' where id=$1", [tempBookingId]);
    await db.query("select recalculate_attendance_clock_out_policy($1, '2026-11-16T12:25:00Z')", [
      scan.checkin_id,
    ]);
    await processAt("2026-11-16T12:25:00Z");
    const reemitted = await getNotices(scan.checkin_id);
    assert.equal(reemitted.length, 2);
    assert.equal(reemitted[1].status, "unread");

    // Verify p_request_id replay idempotency on recover_stale_attendance_and_clock_in
    const stale = await createStaff();
    const staleDay1 = await scanIn(stale, {
      shiftDate: "2026-11-17",
      arrived: "2026-11-17T06:00:00Z",
      start: "2026-11-17T06:00:00Z",
      end: "2026-11-17T14:00:00Z",
    });
    const replayReq = randomUUID();
    const qrPt = randomUUID();
    const callRecovery = async () =>
      (
        await db.query(
          `select * from public.recover_stale_attendance_and_clock_in(
            p_stale_checkin_id=>$1, p_staff_id=>$2, p_current_branch_id=>$3, p_qr_point_id=>$4,
            p_is_test=>false, p_recovery_clock_out_at=>'2026-11-17T14:00:00Z',
            p_current_checkin=>$5::jsonb, p_request_id=>$6, p_device_id=>$7,
            p_public_result=>'{"ok":true}'::jsonb,
            p_exception=>$8::jsonb
          )`,
          [
            staleDay1.checkin_id,
            stale.id,
            branch,
            qrPt,
            JSON.stringify({
              shift_date: "2026-11-18",
              shift_type: "single",
              shift_instance_key: `${stale.id}:2026-11-18:single`,
              checked_in_at: "2026-11-18T06:00:00Z",
              scheduled_start_at: "2026-11-18T06:00:00Z",
              scheduled_end_at: "2026-11-18T14:00:00Z",
              schedule_source: "weekly",
              schedule_source_id: "TEST-weekly",
              branch_timezone: "Asia/Manila",
              attendance_business_date: "2026-11-18",
            }),
            replayReq,
            stale.deviceId,
            JSON.stringify({
              exception_type: "missed_checkout",
              severity: "warning",
              message: "Replay check",
              metadata: { internalExceptionType: "stale_open_checkin" },
              dedupe_key: `${stale.id}|${staleDay1.checkin_id}|stale_open_checkin|live`,
            }),
          ]
        )
      ).rows[0];
    const r1 = await callRecovery();
    const r2 = await callRecovery();
    assert.equal(r1.code, "committed");
    assert.equal(r2.code, "replayed");
    assert.equal(r2.checkin_id, r1.checkin_id);
    const excCount = (
      await db.query("select count(*)::int c from attendance_exceptions where checkin_id=$1", [staleDay1.checkin_id])
    ).rows[0].c;
    assert.equal(excCount, 1);
  });

  process.stdout.write(`LOCAL POSTGRES 17.11 SUITE: ${passed} lifecycle integration scenarios passed.\n`);
} finally {
  await db.end().catch(() => undefined);
  try {
    execFileSync(pgCtlBin, ["-D", pgDataDir, "stop", "-m", "immediate"], {
      stdio: "ignore",
    });
  } catch {
    // ignore if already stopped
  }
  rmSync(pgDataDir, { recursive: true, force: true });
}

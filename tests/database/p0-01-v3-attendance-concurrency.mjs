import { spawn } from "node:child_process";

const CONTAINER = "cradlehub-p0-attendance-test";
const DB = "cradlehub_p0_v3_test";

function runPsql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        CONTAINER,
        "psql",
        "-U",
        "postgres",
        "-d",
        DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
        "-F",
        "\t",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`psql exited with ${code}: ${stderr || stdout}`));
      } else {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
    child.stdin.write(sql);
    child.stdin.end();
  });
}

async function main() {
  // Safety gate: verify air-gapped NetworkMode=none container & disposable DB
  const { stdout: dbCheck } = await runPsql("SELECT current_database();");
  if (dbCheck !== DB) {
    throw new Error(`Refusing concurrency test outside ${DB} (got ${dbCheck})`);
  }

  // Seed a disposable concurrency test branch + staff + schedule
  const setupSql = `
    WITH b AS (
      INSERT INTO public.branches(name) VALUES ('Concurrency Spa') RETURNING id
    ),
    s AS (
      INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
      SELECT id, 'Asia/Manila', '06:00:00' FROM b
    ),
    q AS (
      INSERT INTO public.qr_points(branch_id) SELECT id FROM b RETURNING id, branch_id
    ),
    st AS (
      INSERT INTO public.staff(branch_id, full_name)
      SELECT id, 'Concurrent Therapist' FROM b RETURNING id, branch_id
    ),
    dev AS (
      INSERT INTO public.staff_devices(staff_id, branch_id)
      SELECT st.id, st.branch_id FROM st RETURNING id
    ),
    bdate AS (
      SELECT (
        (now() AT TIME ZONE 'Asia/Manila')::date
        - CASE WHEN (now() AT TIME ZONE 'Asia/Manila')::time < time '06:00:00' THEN 1 ELSE 0 END
      ) AS d
    ),
    sched AS (
      INSERT INTO public.staff_schedules(staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order)
      SELECT st.id, extract(dow FROM bdate.d)::smallint, 'single', '09:00:00', '18:00:00', true, 1
      FROM st, bdate
      RETURNING id
    )
    SELECT b.id, q.id, st.id, dev.id, sched.id, bdate.d::text
    FROM b, q, st, dev, sched, bdate;
  `;

  const { stdout: seedLine } = await runPsql(setupSql);
  const [branchId, qrId, staffId, deviceId, schedId, bdate] = seedLine.split("\t");
  const shiftKey = `${staffId}|${branchId}|${bdate}|single|window:1|09:00:00|18:00:00|weekly|${schedId}`;

  const buildScanCallSql = (reqId) => `
    SELECT code,
           coalesce(operation_result->>'outcome', ''),
           coalesce(operation_result->>'reasonCode', ''),
           coalesce(checkin_id::text, ''),
           coalesce(scan_event_id::text, '')
    FROM public.commit_attendance_scan_transaction(
      p_request_id => '${reqId}',
      p_branch_id => '${branchId}'::uuid,
      p_qr_point_id => '${qrId}'::uuid,
      p_staff_id => '${staffId}'::uuid,
      p_device_id => '${deviceId}'::uuid,
      p_scan_type => 'attendance',
      p_action => 'clock_in',
      p_outcome => 'success',
      p_reason_code => 'scheduled_clock_in',
      p_public_result => '{"ok":true,"outcome":"success","title":"Clock in","message":"Clock in","attendance":{"action":"clock_in"}}'::jsonb,
      p_checkin_insert => jsonb_build_object(
        'shift_date', '${bdate}',
        'shift_type', 'single',
        'shift_instance_key', '${shiftKey}',
        'checked_in_at', now(),
        'status', 'checked_in',
        'schedule_source', 'weekly',
        'schedule_source_id', '${schedId}',
        'attendance_business_date', '${bdate}'
      )
    );
  `;

  // 14a: Two simultaneous initial clock-in scans with distinct request_ids
  const [initA, initB] = await Promise.all([
    runPsql(buildScanCallSql(`conc-init-a-${staffId}`)),
    runPsql(buildScanCallSql(`conc-init-b-${staffId}`)),
  ]);

  const rowsInit = [initA.stdout.split("\t"), initB.stdout.split("\t")];
  const outcomesInit = rowsInit.map((r) => r[1]).sort();
  if (outcomesInit[0] !== "noop" || outcomesInit[1] !== "success") {
    throw new Error(
      `FAIL [Scenario 14a]: Expected exactly 1 success + 1 noop on simultaneous initial clock-ins, got: ${JSON.stringify(rowsInit)}`
    );
  }
  const checkinId = rowsInit[0][3];

  const { stdout: openCountAfterInit } = await runPsql(
    `SELECT count(*) FROM public.staff_shift_checkins WHERE staff_id = '${staffId}'::uuid;`
  );
  if (openCountAfterInit !== "1") {
    throw new Error(`FAIL [Scenario 14a]: Expected 1 checkin row, got ${openCountAfterInit}`);
  }

  // Clock out the single open session
  await runPsql(`
    SELECT code FROM public.commit_attendance_scan_transaction(
      p_request_id => 'conc-clock-out-${staffId}',
      p_branch_id => '${branchId}'::uuid,
      p_qr_point_id => '${qrId}'::uuid,
      p_staff_id => '${staffId}'::uuid,
      p_device_id => '${deviceId}'::uuid,
      p_scan_type => 'attendance',
      p_action => 'clock_out',
      p_outcome => 'success',
      p_public_result => '{"ok":true,"outcome":"success","title":"Clock out","message":"Clock out"}'::jsonb,
      p_checkin_id => '${checkinId}'::uuid,
      p_checkin_update => jsonb_build_object(
        'checked_out_at', now(),
        'status', 'checked_out',
        'worked_minutes', 480
      )
    );
  `);

  // 14b: Four simultaneous post-completion rescans with distinct request_ids
  const postScans = await Promise.all([
    runPsql(buildScanCallSql(`conc-post-1-${staffId}`)),
    runPsql(buildScanCallSql(`conc-post-2-${staffId}`)),
    runPsql(buildScanCallSql(`conc-post-3-${staffId}`)),
    runPsql(buildScanCallSql(`conc-post-4-${staffId}`)),
  ]);

  for (const res of postScans) {
    const [, outcome, reasonCode, returnedCheckinId] = res.stdout.split("\t");
    if (
      outcome !== "noop" ||
      reasonCode !== "already_checked_out" ||
      returnedCheckinId !== checkinId
    ) {
      throw new Error(
        `FAIL [Scenario 14b]: Post-completion concurrent scan did not return noop: ${res.stdout}`
      );
    }
  }

  // 14c: Two simultaneous replays of the SAME request_id
  const [replayA, replayB] = await Promise.all([
    runPsql(buildScanCallSql(`conc-replay-same-${staffId}`)),
    runPsql(buildScanCallSql(`conc-replay-same-${staffId}`)),
  ]);
  const codesReplay = [replayA.stdout.split("\t")[0], replayB.stdout.split("\t")[0]].sort();
  if (codesReplay[0] !== "committed" || codesReplay[1] !== "replayed") {
    throw new Error(
      `FAIL [Scenario 14c]: Expected 1 committed + 1 replayed on identical request_id race, got: ${JSON.stringify(codesReplay)}`
    );
  }

  // Verify final DB counts: still ONLY 1 staff_shift_checkins row, 0 exceptions, 8 distinct qr_scan_events rows (2 init + 1 out + 4 post + 1 shared replay)
  const { stdout: summary } = await runPsql(`
    SELECT
      (SELECT count(*) FROM public.staff_shift_checkins WHERE staff_id = '${staffId}'::uuid),
      (SELECT count(*) FROM public.attendance_exceptions WHERE staff_id = '${staffId}'::uuid),
      (SELECT count(*) FROM public.qr_scan_events WHERE staff_id = '${staffId}'::uuid);
  `);
  const [finalCheckins, finalExceptions, finalEvents] = summary.split("\t");

  // Clean up concurrency test rows inside cradlehub_p0_v3_test
  await runPsql(`DELETE FROM public.branches WHERE id = '${branchId}'::uuid;`);

  if (finalCheckins !== "1" || finalExceptions !== "0" || finalEvents !== "8") {
    throw new Error(
      `FAIL [Scenario 14 counts]: Expected checkins=1, exceptions=0, events=8; got checkins=${finalCheckins}, exceptions=${finalExceptions}, events=${finalEvents}`
    );
  }

  console.log(
    JSON.stringify(
      {
        scenario14a_parallelInitialClockIn: outcomesInit,
        scenario14b_parallelPostCheckoutRescans: postScans.map((p) =>
          p.stdout.split("\t").slice(1, 3)
        ),
        scenario14c_parallelSameRequestIdReplay: codesReplay,
        finalCounts: {
          staff_shift_checkins: Number(finalCheckins),
          attendance_exceptions: Number(finalExceptions),
          qr_scan_events: Number(finalEvents),
        },
        verdict:
          "PASS [Scenario 14]: Parallel initial clock-ins, parallel post-checkout rescans, and parallel identical request_id replays serialized atomically with zero duplicate sessions.",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
        "-qAt",
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
  const { stdout: dbCheck } = await runPsql("SELECT current_database();");
  if (dbCheck !== DB) {
    throw new Error(`Refusing concurrency test outside ${DB} (got ${dbCheck})`);
  }

  const setupSql = `
    WITH b AS (
      INSERT INTO public.branches(name) VALUES ('V3.1 Clock-Out Concurrency Spa') RETURNING id
    ),
    s AS (
      INSERT INTO public.attendance_settings(branch_id, timezone, attendance_day_boundary)
      SELECT id, 'Asia/Manila', '06:00:00' FROM b
    ),
    q AS (
      INSERT INTO public.qr_points(branch_id) SELECT id FROM b RETURNING id
    ),
    st AS (
      INSERT INTO public.staff(branch_id, full_name)
      SELECT id, 'Concurrent Clock-Out Therapist' FROM b RETURNING id
    ),
    dev AS (
      INSERT INTO public.staff_devices(staff_id, branch_id)
      SELECT st.id, b.id FROM st, b RETURNING id
    ),
    bdate AS (
      SELECT (
        (now() AT TIME ZONE 'Asia/Manila')::date
        - CASE WHEN (now() AT TIME ZONE 'Asia/Manila')::time < time '06:00:00' THEN 1 ELSE 0 END
      ) AS d
    ),
    c1 AS (
      INSERT INTO public.staff_shift_checkins(
        staff_id, branch_id, shift_date, shift_type, shift_instance_key,
        checked_in_at, status, attendance_business_date, late_minutes, is_test
      )
      SELECT st.id, b.id, bdate.d, 'single', 'conc-out-1',
             now() - interval '8 hours', 'checked_in', bdate.d, 15, false
      FROM st, b, bdate
      RETURNING id
    )
    SELECT b.id, q.id, st.id, dev.id, bdate.d::text, c1.id
    FROM b, q, st, dev, bdate, c1;
  `;

  const { stdout: seedLine } = await runPsql(setupSql);
  const [branchId, qrId, staffId, deviceId, bdate, checkin1Id] = seedLine.split("\t");

  const buildValidClockOutSql = (reqId, checkinId) => `
    SELECT success, code, coalesce(checkin_id::text, ''), coalesce(scan_event_id::text, '')
    FROM public.commit_attendance_scan_transaction(
      p_request_id => '${reqId}',
      p_branch_id => '${branchId}'::uuid,
      p_qr_point_id => '${qrId}'::uuid,
      p_staff_id => '${staffId}'::uuid,
      p_device_id => '${deviceId}'::uuid,
      p_scan_type => 'attendance',
      p_action => 'clock_out',
      p_outcome => 'success',
      p_reason_code => 'clock_out',
      p_metadata => jsonb_build_object('scannedAt', now()),
      p_public_result => '{"ok":true,"outcome":"success","title":"Clock out","message":"Clock out","attendance":{"action":"clock_out","workedMinutes":480}}'::jsonb,
      p_checkin_id => '${checkinId}'::uuid,
      p_checkin_update => jsonb_build_object(
        'checked_out_at', now(),
        'status', 'checked_out',
        'clock_out_method', 'qr',
        'worked_minutes', 480
      )
    );
  `;

  try {
    // H8a: Two simultaneous valid clock-out requests with DISTINCT request_ids
    const [outA, outB] = await Promise.all([
      runPsql(buildValidClockOutSql(`v31-conc-out-a-${checkin1Id}`, checkin1Id)),
      runPsql(buildValidClockOutSql(`v31-conc-out-b-${checkin1Id}`, checkin1Id)),
    ]);

    const codesDistinct = [outA.stdout.split("\t")[1], outB.stdout.split("\t")[1]].sort();
    if (codesDistinct[0] !== "checkin_not_open" || codesDistinct[1] !== "committed") {
      throw new Error(
        `FAIL [H8a]: Expected 1 committed + 1 checkin_not_open on parallel distinct clock-outs, got: ${JSON.stringify(codesDistinct)}`
      );
    }

    const { stdout: c1Row } = await runPsql(`
      SELECT status, worked_minutes, late_minutes, attendance_business_date::text, clock_out_scan_event_id IS NOT NULL
      FROM public.staff_shift_checkins WHERE id = '${checkin1Id}'::uuid;
    `);
    const [c1Status, c1Worked, c1Late, c1Bdate, c1HasOutEvent] = c1Row.split("\t");
    if (
      c1Status !== "checked_out" ||
      c1Worked !== "480" ||
      c1Late !== "15" ||
      c1Bdate !== bdate ||
      c1HasOutEvent !== "t"
    ) {
      throw new Error(`FAIL [H8a row]: Unexpected completed row state: ${c1Row}`);
    }

    // H8b: Two simultaneous clock-out requests with the SAME request_id on a fresh open check-in
    const { stdout: checkin2Id } = await runPsql(`
      INSERT INTO public.staff_shift_checkins(
        staff_id, branch_id, shift_date, shift_type, shift_instance_key,
        checked_in_at, status, attendance_business_date, is_test
      ) VALUES (
        '${staffId}'::uuid, '${branchId}'::uuid, '${bdate}'::date, 'single', 'conc-out-2',
        now() - interval '8 hours', 'checked_in', '${bdate}'::date, false
      ) RETURNING id;
    `);

    const [sameA, sameB] = await Promise.all([
      runPsql(buildValidClockOutSql(`v31-conc-same-${checkin2Id}`, checkin2Id)),
      runPsql(buildValidClockOutSql(`v31-conc-same-${checkin2Id}`, checkin2Id)),
    ]);
    const codesSame = [sameA.stdout.split("\t")[1], sameB.stdout.split("\t")[1]].sort();
    if (codesSame[0] !== "committed" || codesSame[1] !== "replayed") {
      throw new Error(
        `FAIL [H8b]: Expected 1 committed + 1 replayed on identical request_id clock-out race, got: ${JSON.stringify(codesSame)}`
      );
    }

    // H8c: Parallel hostile clock-out attempts (NULL staff, future checkout, forged business date)
    // racing against a legitimate staff clock-out on a third open check-in
    const { stdout: checkin3Id } = await runPsql(`
      INSERT INTO public.staff_shift_checkins(
        staff_id, branch_id, shift_date, shift_type, shift_instance_key,
        checked_in_at, status, attendance_business_date, is_test
      ) VALUES (
        '${staffId}'::uuid, '${branchId}'::uuid, '${bdate}'::date, 'single', 'conc-out-3',
        now() - interval '8 hours', 'checked_in', null, false
      ) RETURNING id;
    `);

    const hostileNullStaffSql = `
      SELECT success, code FROM public.commit_attendance_scan_transaction(
        p_request_id => 'v31-hostile-null-${checkin3Id}',
        p_branch_id => '${branchId}'::uuid,
        p_qr_point_id => '${qrId}'::uuid,
        p_staff_id => null,
        p_device_id => null,
        p_scan_type => 'attendance',
        p_action => 'clock_out',
        p_outcome => 'success',
        p_public_result => '{"ok":true,"outcome":"success"}'::jsonb,
        p_checkin_id => '${checkin3Id}'::uuid,
        p_checkin_update => jsonb_build_object('checked_out_at', now(), 'status', 'checked_out', 'worked_minutes', 99999)
      );
    `;
    const hostileFutureSql = `
      SELECT success, code FROM public.commit_attendance_scan_transaction(
        p_request_id => 'v31-hostile-future-${checkin3Id}',
        p_branch_id => '${branchId}'::uuid,
        p_qr_point_id => '${qrId}'::uuid,
        p_staff_id => '${staffId}'::uuid,
        p_device_id => '${deviceId}'::uuid,
        p_scan_type => 'attendance',
        p_action => 'clock_out',
        p_outcome => 'success',
        p_public_result => '{"ok":true,"outcome":"success"}'::jsonb,
        p_checkin_id => '${checkin3Id}'::uuid,
        p_checkin_update => jsonb_build_object('checked_out_at', now() + interval '7 days', 'status', 'checked_out', 'clock_out_method', 'qr')
      );
    `;
    const hostileBdateSql = `
      SELECT success, code FROM public.commit_attendance_scan_transaction(
        p_request_id => 'v31-hostile-bdate-${checkin3Id}',
        p_branch_id => '${branchId}'::uuid,
        p_qr_point_id => '${qrId}'::uuid,
        p_staff_id => '${staffId}'::uuid,
        p_device_id => '${deviceId}'::uuid,
        p_scan_type => 'attendance',
        p_action => 'clock_out',
        p_outcome => 'success',
        p_public_result => '{"ok":true,"outcome":"success"}'::jsonb,
        p_checkin_id => '${checkin3Id}'::uuid,
        p_checkin_update => jsonb_build_object('attendance_business_date', '2099-12-31', 'checked_out_at', now(), 'status', 'checked_out', 'clock_out_method', 'qr')
      );
    `;

    const [hNull, hFuture, hBdate, legit] = await Promise.all([
      runPsql(hostileNullStaffSql),
      runPsql(hostileFutureSql),
      runPsql(hostileBdateSql),
      runPsql(buildValidClockOutSql(`v31-legit-${checkin3Id}`, checkin3Id)),
    ]);

    if (hNull.stdout.split("\t")[1] !== "invalid_checkin_update") {
      throw new Error(`FAIL [H8c null staff]: ${hNull.stdout}`);
    }
    if (!["invalid_checkout_timestamp", "checkin_not_open"].includes(hFuture.stdout.split("\t")[1])) {
      throw new Error(`FAIL [H8c future]: ${hFuture.stdout}`);
    }
    if (!["invalid_business_date", "checkin_not_open"].includes(hBdate.stdout.split("\t")[1])) {
      throw new Error(`FAIL [H8c bdate]: ${hBdate.stdout}`);
    }
    if (legit.stdout.split("\t")[1] !== "committed") {
      throw new Error(`FAIL [H8c legit]: Expected legitimate clock-out to commit, got ${legit.stdout}`);
    }

    const { stdout: c3Row } = await runPsql(`
      SELECT status, worked_minutes, attendance_business_date::text
      FROM public.staff_shift_checkins WHERE id = '${checkin3Id}'::uuid;
    `);
    if (c3Row !== `checked_out\t480\t${bdate}`) {
      throw new Error(`FAIL [H8c row]: Expected checked_out/480/${bdate}, got ${c3Row}`);
    }

    console.log(
      JSON.stringify(
        {
          h8a_parallelDistinctClockOuts: codesDistinct,
          h8b_parallelSameRequestIdClockOuts: codesSame,
          h8c_hostileVsLegitimateRace: {
            nullStaff: hNull.stdout.split("\t")[1],
            futureCheckout: hFuture.stdout.split("\t")[1],
            forgedBusinessDate: hBdate.stdout.split("\t")[1],
            legitimateClockOut: legit.stdout.split("\t")[1],
            resultingRow: { status: "checked_out", worked_minutes: 480, attendance_business_date: bdate },
          },
          verdict:
            "PASS [H8]: Concurrent clock-out requests serialize atomically without conflicting updates, duplicate closes, or hostile overrides.",
        },
        null,
        2
      )
    );
  } finally {
    await runPsql(`DELETE FROM public.branches WHERE id = '${branchId}'::uuid;`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

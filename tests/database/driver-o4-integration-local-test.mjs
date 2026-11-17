import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PG_MODULE_PATH = "E:/cradlehub/.worktrees/web-attendance-v2/.tmp/attendance-v2-postgres/node_modules/pg";
const PG_BIN_DIR =
  "E:/cradlehub/.worktrees/web-attendance-v2/.tmp/attendance-v2-postgres/node_modules/@embedded-postgres/windows-x64/native/bin";

const { Client } = require(PG_MODULE_PATH);
const ROOT = process.cwd();
const TMP_CLUSTER = path.join(ROOT, ".tmp", `pg-o4-test-${process.pid}`);

async function freePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 55444;
      srv.close(() => resolve(port));
    });
  });
}

function readSql(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

async function waitForPostgres(port, dbName) {
  const deadline = Date.now() + 20_000;
  let lastErr = null;
  while (Date.now() < deadline) {
    const client = new Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      database: dbName,
    });
    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      return;
    } catch (err) {
      lastErr = err;
      await client.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw lastErr ?? new Error("PostgreSQL failed to start within timeout.");
}

async function withSession(poolConfig, claims, fn) {
  const client = new Client(poolConfig);
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)",
      [JSON.stringify(claims), claims.sub ?? ""]
    );
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

async function expectError(promise, substring) {
  try {
    await promise;
  } catch (err) {
    const msg = String(err?.message ?? err);
    assert.ok(
      msg.includes(substring),
      `Expected error containing "${substring}", got "${msg}"`
    );
    return;
  }
  assert.fail(`Expected failure containing "${substring}" but succeeded.`);
}

async function main() {
  if (!fs.existsSync(path.join(PG_BIN_DIR, "initdb.exe"))) {
    throw new Error(`Missing local PostgreSQL binary at ${PG_BIN_DIR}`);
  }

  fs.rmSync(TMP_CLUSTER, { recursive: true, force: true });
  fs.mkdirSync(TMP_CLUSTER, { recursive: true });

  const port = await freePort();
  const dataDir = path.join(TMP_CLUSTER, "data");
  const pwFile = path.join(TMP_CLUSTER, "pw.txt");
  fs.writeFileSync(pwFile, "postgres\n", "utf8");

  execFileSync(
    path.join(PG_BIN_DIR, "initdb.exe"),
    ["-D", dataDir, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--locale=C"],
    { stdio: "ignore" }
  );

  const logFd = fs.openSync(path.join(TMP_CLUSTER, "pg.log"), "w");
  const pgProc = spawn(
    path.join(PG_BIN_DIR, "postgres.exe"),
    ["-D", dataDir, "-p", String(port), "-k", TMP_CLUSTER],
    { stdio: ["ignore", logFd, logFd], windowsHide: true }
  );

  const dbConfig = {
    host: "127.0.0.1",
    port,
    user: "postgres",
    database: "postgres",
  };

  try {
    await waitForPostgres(port, "postgres");
    const admin = new Client(dbConfig);
    await admin.connect();

    try {
      await admin.query(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then
            create role anon nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then
            create role authenticated nologin;
          end if;
          if not exists (select 1 from pg_roles where rolname = 'service_role') then
            create role service_role nologin bypassrls;
          end if;
        end $$;
        grant usage on schema public to anon, authenticated, service_role;
      `);
      await admin.query(readSql("tests/database/driver-unified-fixture.sql"));
      await admin.query(`
        alter table public.bookings
          add column if not exists end_time time default '11:30:00',
          add column if not exists home_service_tracking_status text default 'awaiting_driver',
          add column if not exists travel_started_at timestamptz,
          add column if not exists arrived_at timestamptz,
          add column if not exists session_started_at timestamptz,
          add column if not exists session_due_at timestamptz;
        alter table public.staff
          add column if not exists nickname text;
        alter table public.staff_location_snapshots
          add column if not exists metadata jsonb default '{}'::jsonb;
        alter table public.bookings alter column session_completion_source type text;
      `);

      await admin.query(readSql("supabase/operations/driver-unified-journeys.sql"));
      await admin.query(readSql("supabase/operations/driver-o4-journeys.sql"));

      const BRANCH_ID = "10000000-0000-4000-8000-000000000001";
      const OTHER_BRANCH_ID = "10000000-0000-4000-8000-000000000002";
      const CRM_AUTH = "20000000-0000-4000-8000-000000000001";
      const DRV_A_AUTH = "20000000-0000-4000-8000-000000000002";
      const DRV_B_AUTH = "20000000-0000-4000-8000-000000000003";
      const TH1_AUTH = "20000000-0000-4000-8000-000000000004";
      const OTHER_CRM_AUTH = "20000000-0000-4000-8000-000000000005";

      const CRM_ID = "30000000-0000-4000-8000-000000000001";
      const DRV_A_ID = "30000000-0000-4000-8000-000000000002";
      const DRV_B_ID = "30000000-0000-4000-8000-000000000003";
      const TH1_ID = "30000000-0000-4000-8000-000000000004";
      const TH2_ID = "30000000-0000-4000-8000-000000000005";
      const TH3_ID = "30000000-0000-4000-8000-000000000006";
      const OTHER_CRM_ID = "30000000-0000-4000-8000-000000000007";

      const CUST_ID = "40000000-0000-4000-8000-000000000001";
      const B1_ID = "50000000-0000-4000-8000-000000000001";
      const B2_ID = "50000000-0000-4000-8000-000000000002";
      const B3_ID = "50000000-0000-4000-8000-000000000003";
      const B4_ID = "50000000-0000-4000-8000-000000000004";
      const VJ_OUT_ID = "60000000-0000-4000-8000-000000000001";
      const SESS_A = "70000000-0000-4000-8000-000000000001";

      await admin.query(`
        insert into public.branches(id, name, latitude, longitude) values
          ('${BRANCH_ID}', 'Bacolod Main', 10.6765, 122.9509),
          ('${OTHER_BRANCH_ID}', 'Talisay Branch', 10.7375, 122.9675);

        insert into public.customers(id, full_name) values ('${CUST_ID}', 'Dawn Navarro');

        insert into public.staff(id, auth_user_id, branch_id, full_name, nickname, system_role, staff_type, is_active) values
          ('${CRM_ID}', '${CRM_AUTH}', '${BRANCH_ID}', 'CRM Dispatcher', 'CRM', 'crm', 'staff', true),
          ('${DRV_A_ID}', '${DRV_A_AUTH}', '${BRANCH_ID}', 'Driver Alpha', 'Driver A', 'driver', 'driver', true),
          ('${DRV_B_ID}', '${DRV_B_AUTH}', '${BRANCH_ID}', 'Driver Bravo', 'Driver B', 'driver', 'driver', true),
          ('${TH1_ID}', '${TH1_AUTH}', '${BRANCH_ID}', 'Therapist One', 'T1', 'therapist', 'therapist', true),
          ('${TH2_ID}', gen_random_uuid(), '${BRANCH_ID}', 'Therapist Two', 'T2', 'therapist', 'therapist', true),
          ('${TH3_ID}', gen_random_uuid(), '${BRANCH_ID}', 'Therapist Three', 'T3', 'therapist', 'therapist', true),
          ('${OTHER_CRM_ID}', '${OTHER_CRM_AUTH}', '${OTHER_BRANCH_ID}', 'Other CRM', 'OtherCRM', 'crm', 'staff', true);

        insert into auth.sessions(id, user_id) values ('${SESS_A}', '${DRV_A_AUTH}');

        insert into public.bookings(
          id, branch_id, staff_id, customer_id, driver_id, booking_date, start_time, end_time,
          status, booking_progress_status, delivery_type, home_service_tracking_status, metadata
        ) values
          ('${B1_ID}', '${BRANCH_ID}', '${TH1_ID}', '${CUST_ID}', null, '2026-11-17', '10:00:00', '11:00:00',
           'confirmed', 'confirmed', 'home_service', 'awaiting_driver',
           '{"home_service_address":{"lat":10.6800,"lng":122.9550,"full_address":"Mandalagan, Bacolod","barangay":"Mandalagan"}}'::jsonb),
          ('${B2_ID}', '${BRANCH_ID}', '${TH2_ID}', '${CUST_ID}', null, '2026-11-17', '10:15:00', '11:15:00',
           'confirmed', 'confirmed', 'home_service', 'awaiting_driver',
           '{"home_service_address":{"lat":10.6850,"lng":122.9600,"full_address":"Bata, Bacolod","barangay":"Bata"}}'::jsonb),
          ('${B3_ID}', '${BRANCH_ID}', '${TH3_ID}', '${CUST_ID}', null, '2026-11-17', '10:30:00', '11:30:00',
           'confirmed', 'confirmed', 'home_service', 'awaiting_driver',
           '{"home_service_address":{"lat":10.6900,"lng":122.9650,"full_address":"Banago, Bacolod","barangay":"Banago"}}'::jsonb),
          ('${B4_ID}', '${BRANCH_ID}', '${TH1_ID}', '${CUST_ID}', '${DRV_A_ID}', '2026-11-17', '14:00:00', '15:00:00',
           'confirmed', 'confirmed', 'home_service', 'ready',
           '{"home_service_address":{"lat":10.6800,"lng":122.9550,"full_address":"Manual Single Stop"}}'::jsonb);

        update driver_unified_private.control set enabled = true where id;
      `);

      // Test 1: Security & RLS grants
      await expectError(
        withSession(dbConfig, { sub: DRV_A_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_o4_commit_plan($1, $2)", [BRANCH_ID, { snapshotId: "s1", bookingUpdates: [] }])
        ),
        "crm_authorization_required"
      );

      await expectError(
        withSession(dbConfig, { sub: OTHER_CRM_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_o4_commit_plan($1, $2)", [BRANCH_ID, { snapshotId: "s1", bookingUpdates: [] }])
        ),
        "branch_scope_mismatch"
      );

      // Anon cannot call any O4 function
      await expectError(
        (async () => {
          const anon = new Client(dbConfig);
          await anon.connect();
          try {
            await anon.query("begin");
            await anon.query("set local role anon");
            await anon.query("select public.driver_o4_commit_plan($1, $2)", [BRANCH_ID, {}]);
          } finally {
            await anon.query("rollback").catch(() => {});
            await anon.end();
          }
        })(),
        "permission denied"
      );

      // Test 2: Commit rejects unapproved not_required
      await expectError(
        withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_o4_commit_plan($1, $2)", [
            BRANCH_ID,
            {
              snapshotId: "snap-invalid",
              bookingUpdates: [
                {
                  bookingId: B2_ID,
                  deliveryDriverId: DRV_A_ID,
                  collectionDecision: "not_required",
                },
              ],
            },
          ])
        ),
        "independent_departure_requires_approval_metadata"
      );

      // Test 3: Atomic commit of pooled delivery (B1: split Driver A->Driver B, B2: not_required approved, B3: undecided)
      const commitRes = await withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
        c.query("select public.driver_o4_commit_plan($1, $2) as res", [
          BRANCH_ID,
          {
            snapshotId: "snap-o4-e2e-1",
            bookingUpdates: [
              {
                bookingId: B1_ID,
                vehicleJourneyId: VJ_OUT_ID,
                deliveryDriverId: DRV_A_ID,
                collectionDriverId: DRV_B_ID,
                stopOrder: 1,
                collectionDecision: "required",
                collectionApprovalMetadata: { source: "schedule", reasonCode: "NEXT_BOOKING_REQUIRES_TRANSPORT" },
                returnDestination: { lat: 10.6765, lng: 122.9509, label: "Bacolod Main Branch" },
              },
              {
                bookingId: B2_ID,
                vehicleJourneyId: VJ_OUT_ID,
                deliveryDriverId: DRV_A_ID,
                collectionDriverId: null,
                stopOrder: 2,
                collectionDecision: "not_required",
                collectionApprovalMetadata: {
                  approvedBy: CRM_ID,
                  approvedAt: "2026-11-17T08:00:00+08:00",
                  source: "crm_manual_override",
                  reasonCode: "APPROVED_INDEPENDENT_DEPARTURE",
                },
              },
              {
                bookingId: B3_ID,
                vehicleJourneyId: VJ_OUT_ID,
                deliveryDriverId: DRV_A_ID,
                collectionDriverId: DRV_B_ID,
                stopOrder: 3,
                collectionDecision: "undecided",
                collectionApprovalMetadata: { reasonCode: "SCHEDULE_INCOMPLETE" },
              },
            ],
          },
        ])
      );
      assert.equal(commitRes.rows[0].res.ok, true);
      assert.equal(commitRes.rows[0].res.committedCount, 3);

      // Test 4: Verify Driver A and Driver B snapshots
      const snapA = await withSession(dbConfig, { sub: DRV_A_AUTH, role: "authenticated" }, (c) =>
        c.query("select public.driver_unified_snapshot(null) as rows")
      );
      const pooledA = snapA.rows[0].rows.filter((r) => r.vehicleJourneyId === VJ_OUT_ID);
      assert.equal(pooledA.length, 3);
      assert.deepEqual(
        pooledA.map((r) => [r.bookingId, r.stopOrder]),
        [
          [B1_ID, 1],
          [B2_ID, 2],
          [B3_ID, 3],
        ]
      );

      const snapB = await withSession(dbConfig, { sub: DRV_B_AUTH, role: "authenticated" }, (c) =>
        c.query("select public.driver_unified_snapshot(null) as rows")
      );
      assert.equal(snapB.rows[0].rows.filter((r) => r.bookingId === B1_ID).length, 1);

      // Driver B CANNOT start delivery leg owned by Driver A!
      const b1Rev = pooledA[0].revision;
      await expectError(
        withSession(dbConfig, { sub: DRV_B_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_unified_event($1)", [
            {
              bookingId: B1_ID,
              requestId: "80000000-0000-4000-8000-000000000001",
              expectedRevision: b1Rev,
              action: "start",
            },
          ])
        ),
        "booking_not_assigned_to_driver"
      );

      // Test 5: Geofence & duplicate requestId & pooled execution by Driver A
      const nowIso = () => new Date().toISOString();
      await withSession(dbConfig, { sub: DRV_A_AUTH, role: "authenticated" }, async (c) => {
        // Start pooled B1 & B2 pickup concurrently (allowed because same vehicleJourneyId!)
        const r1 = await c.query("select public.driver_unified_event($1) as j", [
          { bookingId: B1_ID, requestId: "81000000-0000-4000-8000-000000000001", expectedRevision: 1, action: "start" },
        ]);
        assert.equal(r1.rows[0].j.stage, "pickup_enroute");

        // Duplicate requestId replays cached response identically without advancing revision
        const r1Dup = await c.query("select public.driver_unified_event($1) as j", [
          { bookingId: B1_ID, requestId: "81000000-0000-4000-8000-000000000001", expectedRevision: 1, action: "start" },
        ]);
        assert.equal(r1Dup.rows[0].j.revision, r1.rows[0].j.revision);

        const r2 = await c.query("select public.driver_unified_event($1) as j", [
          { bookingId: B2_ID, requestId: "81000000-0000-4000-8000-000000000002", expectedRevision: 1, action: "start" },
        ]);
        assert.equal(r2.rows[0].j.stage, "pickup_enroute");
      });

      // Stale revision rejected
      await expectError(
        withSession(dbConfig, { sub: DRV_A_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_unified_event($1)", [
            { bookingId: B1_ID, requestId: "81000000-0000-4000-8000-000000000003", expectedRevision: 1, action: "gps_arrival", point: { lat: 10.6765, lng: 122.9509, accuracyMeters: 8, observedAt: nowIso() } },
          ])
        ),
        "stale_revision"
      );

      // Far away GPS (>250m) rejected
      await expectError(
        withSession(dbConfig, { sub: DRV_A_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_unified_event($1)", [
            { bookingId: B1_ID, requestId: "81000000-0000-4000-8000-000000000004", expectedRevision: 2, action: "gps_arrival", point: { lat: 10.75, lng: 123.05, accuracyMeters: 8, observedAt: nowIso() } },
          ])
        ),
        "arrival_outside_destination_geofence"
      );

      // Test 6: Advance B1, B2, B3 delivery through customer_arrived
      await withSession(dbConfig, { sub: DRV_A_AUTH, role: "authenticated" }, async (c) => {
        // Complete delivery for B1 (rev 2->6)
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "82000000-0000-4000-8000-000000000001", expectedRevision: 2, action: "gps_arrival", point: { lat: 10.6765, lng: 122.9509, accuracyMeters: 10, observedAt: nowIso() } }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "82000000-0000-4000-8000-000000000002", expectedRevision: 3, action: "board" }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "82000000-0000-4000-8000-000000000003", expectedRevision: 4, action: "start" }]);
        const arrivedB1 = await c.query("select public.driver_unified_event($1) as j", [{ bookingId: B1_ID, requestId: "82000000-0000-4000-8000-000000000004", expectedRevision: 5, action: "gps_arrival", point: { lat: 10.6800, lng: 122.9550, accuracyMeters: 12, observedAt: nowIso() } }]);
        assert.equal(arrivedB1.rows[0].j.stage, "customer_arrived");

        // Mid-delivery B2 still at pickup_enroute
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B2_ID, requestId: "82000000-0000-4000-8000-000000000005", expectedRevision: 2, action: "gps_arrival", point: { lat: 10.6765, lng: 122.9509, accuracyMeters: 10, observedAt: nowIso() } }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B2_ID, requestId: "82000000-0000-4000-8000-000000000006", expectedRevision: 3, action: "board" }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B2_ID, requestId: "82000000-0000-4000-8000-000000000007", expectedRevision: 4, action: "start" }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B2_ID, requestId: "82000000-0000-4000-8000-000000000008", expectedRevision: 5, action: "gps_arrival", point: { lat: 10.6850, lng: 122.9600, accuracyMeters: 12, observedAt: nowIso() } }]);
      });

      // Mid-leg lock protection: cannot reassign B1 delivery driver away from Driver A
      await expectError(
        withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_o4_commit_plan($1, $2)", [
            BRANCH_ID,
            {
              snapshotId: "snap-reassign-locked",
              bookingUpdates: [{ bookingId: B1_ID, deliveryDriverId: DRV_B_ID, collectionDecision: "required" }],
            },
          ])
        ),
        "locked_delivery_leg_cannot_reassign"
      );

      // Guard direct booking travel overwrite
      await expectError(
        admin.query(`update public.bookings set home_service_tracking_status = 'in_route' where id = '${B3_ID}'`),
        "unified_journey_controls_booking_travel"
      );

      // Test 7: Staff Portal session start & conditional service completion -> collection_ready
      await admin.query(`
        update public.bookings
        set booking_progress_status = 'session_started', status = 'in_progress', session_started_at = now()
        where id in ('${B1_ID}', '${B2_ID}');
      `);
      const activeCheck = await admin.query(
        `select stage from driver_unified_private.journeys where booking_id = '${B1_ID}'`
      );
      assert.equal(activeCheck.rows[0].stage, "service_active");

      await admin.query(`
        update public.bookings
        set booking_progress_status = 'completed', status = 'completed',
            session_completed_at = now(), session_completion_source = 'manual'
        where id in ('${B1_ID}', '${B2_ID}', '${B3_ID}');
      `);

      await withSession(dbConfig, { sub: TH1_AUTH, role: "authenticated" }, async (c) => {
        const cr1 = await c.query("select public.driver_unified_collection_ready($1) as ok", [B1_ID]);
        assert.equal(cr1.rows[0].ok, true);
      });
      await withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, async (c) => {
        await c.query("select public.driver_unified_collection_ready($1)", [B2_ID]);
        await c.query("select public.driver_unified_collection_ready($1)", [B3_ID]);
      });

      const stagesAfterComp = await admin.query(`
        select j.booking_id, j.stage, j.driver_id, j.reason, b.driver_id as booking_driver
        from driver_unified_private.journeys j
        join public.bookings b on b.id = j.booking_id
        where j.booking_id in ('${B1_ID}', '${B2_ID}', '${B3_ID}')
        order by j.stop_order
      `);
      assert.equal(stagesAfterComp.rows[0].stage, "collection_pending");
      assert.equal(stagesAfterComp.rows[0].driver_id, DRV_B_ID);
      assert.equal(stagesAfterComp.rows[0].booking_driver, DRV_B_ID);
      assert.equal(stagesAfterComp.rows[1].stage, "complete"); // not_required approved
      assert.equal(stagesAfterComp.rows[1].reason, "collection_not_required_approved");
      assert.equal(stagesAfterComp.rows[2].stage, "review"); // undecided!

      // Verify push queued for DRV_B on B1 ONLY, NOT on B2 or B3 collection
      const pushes = await admin.query(`
        select booking_id, staff_id, kind from driver_unified_private.push where kind = 'collection_ready'
      `);
      assert.equal(pushes.rows.length, 1);
      assert.equal(pushes.rows[0].booking_id, B1_ID);
      assert.equal(pushes.rows[0].staff_id, DRV_B_ID);

      // CRM resolves B3 undecided -> required with DRV_B
      await withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
        c.query("select public.driver_o4_set_collection_decision($1, $2, $3, $4)", [
          B3_ID,
          "required",
          DRV_B_ID,
          { source: "crm_dispatch", reasonCode: "CONFIRMED_RETURN_TO_BRANCH" },
        ])
      );
      const b3After = await admin.query(`select stage, driver_id from driver_unified_private.journeys where booking_id = '${B3_ID}'`);
      assert.equal(b3After.rows[0].stage, "collection_pending");
      assert.equal(b3After.rows[0].driver_id, DRV_B_ID);

      // Test 8: Driver B collects B1 & returns to branch -> complete
      const snapBReady = await withSession(dbConfig, { sub: DRV_B_AUTH, role: "authenticated" }, (c) =>
        c.query("select public.driver_unified_snapshot($1) as rows", [B1_ID])
      );
      const b1CurRev = snapBReady.rows[0].rows[0].revision;

      await withSession(dbConfig, { sub: DRV_B_AUTH, role: "authenticated" }, async (c) => {
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "83000000-0000-4000-8000-000000000001", expectedRevision: b1CurRev, action: "start" }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "83000000-0000-4000-8000-000000000002", expectedRevision: b1CurRev + 1, action: "gps_arrival", point: { lat: 10.6800, lng: 122.9550, accuracyMeters: 10, observedAt: nowIso() } }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "83000000-0000-4000-8000-000000000003", expectedRevision: b1CurRev + 2, action: "board" }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "83000000-0000-4000-8000-000000000004", expectedRevision: b1CurRev + 3, action: "start" }]);
        await c.query("select public.driver_unified_event($1)", [{ bookingId: B1_ID, requestId: "83000000-0000-4000-8000-000000000005", expectedRevision: b1CurRev + 4, action: "gps_arrival", point: { lat: 10.6765, lng: 122.9509, accuracyMeters: 10, observedAt: nowIso() } }]);
        const done = await c.query("select public.driver_unified_event($1) as j", [{ bookingId: B1_ID, requestId: "83000000-0000-4000-8000-000000000006", expectedRevision: b1CurRev + 5, action: "finish_return" }]);
        assert.equal(done.rows[0].j.stage, "complete");
      });

      // Verify dispatch projection returns driverName & collectionDriverName cleanly
      const disp = await withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
        c.query("select public.driver_unified_dispatch($1) as rows", [BRANCH_ID])
      );
      const dispB1 = disp.rows[0].rows.find((x) => x.journey.bookingId === B1_ID);
      assert.equal(dispB1.journey.stage, "complete");
      assert.equal(dispB1.collectionDriverName, "Driver B");

      // Test 9: Concurrent commit race serialization
      const [c1, c2] = await Promise.all([
        withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_o4_commit_plan($1, $2) as res", [
            BRANCH_ID,
            { snapshotId: "race-1", bookingUpdates: [{ bookingId: B4_ID, deliveryDriverId: DRV_A_ID, collectionDriverId: DRV_A_ID, collectionDecision: "required" }] },
          ])
        ),
        withSession(dbConfig, { sub: CRM_AUTH, role: "authenticated" }, (c) =>
          c.query("select public.driver_o4_commit_plan($1, $2) as res", [
            BRANCH_ID,
            { snapshotId: "race-2", bookingUpdates: [{ bookingId: B4_ID, deliveryDriverId: DRV_B_ID, collectionDriverId: DRV_B_ID, collectionDecision: "required" }] },
          ])
        ),
      ]);
      assert.equal(c1.rows[0].res.ok, true);
      assert.equal(c2.rows[0].res.ok, true);
      const finalB4 = await admin.query(`select driver_id, optimizer_snapshot_id from driver_unified_private.journeys where booking_id = '${B4_ID}'`);
      assert.ok(["race-1", "race-2"].includes(finalB4.rows[0].optimizer_snapshot_id));

      console.log("ALL_O4_SQL_TESTS_PASSED");
    } finally {
      await admin.end().catch(() => {});
    }
  } finally {
    try {
      execFileSync(path.join(PG_BIN_DIR, "pg_ctl.exe"), ["-D", dataDir, "stop", "-m", "immediate"], {
        stdio: "ignore",
      });
    } catch {}
    try {
      pgProc.kill("SIGKILL");
    } catch {}
    fs.closeSync(logFd);
    fs.rmSync(TMP_CLUSTER, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("O4 SQL integration test failed:", err);
  process.exit(1);
});

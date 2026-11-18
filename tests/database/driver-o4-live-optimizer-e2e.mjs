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
const LOCAL_PYTHON_EXE = path.join(
  process.cwd(),
  "services",
  "driver-optimizer",
  ".venv",
  "Scripts",
  "python.exe"
);
const SHARED_PYTHON_EXE =
  "C:/Users/eleur/.gemini/antigravity/worktrees/cradlehub/driver_optimizer_ortools/services/driver-optimizer/.venv/Scripts/python.exe";
const PYTHON_EXE = fs.existsSync(LOCAL_PYTHON_EXE) ? LOCAL_PYTHON_EXE : SHARED_PYTHON_EXE;

const { Client } = require(PG_MODULE_PATH);
const ROOT = process.cwd();
const TMP_CLUSTER = path.join(ROOT, ".tmp", `pg-o4-live-e2e-${process.pid}`);

async function freePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 55455;
      srv.close(() => resolve(port));
    });
  });
}

function readSql(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

async function waitForHealth(url) {
  const deadline = Date.now() + 20_000;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return await res.json();
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw lastErr ?? new Error(`Optimizer server at ${url} did not become healthy.`);
}

async function waitForPostgres(port) {
  const deadline = Date.now() + 20_000;
  let lastErr = null;
  while (Date.now() < deadline) {
    const client = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
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
  throw lastErr ?? new Error("PostgreSQL did not become ready.");
}

async function withSession(poolConfig, sub, fn) {
  const client = new Client(poolConfig);
  await client.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)",
      [JSON.stringify({ sub, role: "authenticated" }), sub]
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

async function main() {
  if (!fs.existsSync(PYTHON_EXE)) throw new Error(`Missing Python venv at ${PYTHON_EXE}`);
  if (!fs.existsSync(path.join(PG_BIN_DIR, "initdb.exe"))) throw new Error("Missing PG binary.");

  fs.rmSync(TMP_CLUSTER, { recursive: true, force: true });
  fs.mkdirSync(TMP_CLUSTER, { recursive: true });

  const pgPort = await freePort();
  const optPort = await freePort();
  const dataDir = path.join(TMP_CLUSTER, "data");

  execFileSync(
    path.join(PG_BIN_DIR, "initdb.exe"),
    ["-D", dataDir, "-U", "postgres", "-A", "trust", "--encoding=UTF8", "--locale=C"],
    { stdio: "ignore" }
  );

  const pgLogFd = fs.openSync(path.join(TMP_CLUSTER, "pg.log"), "w");
  const optLogFd = fs.openSync(path.join(TMP_CLUSTER, "optimizer.log"), "w");
  const pgProc = spawn(path.join(PG_BIN_DIR, "postgres.exe"), ["-D", dataDir, "-p", String(pgPort)], {
    stdio: ["ignore", pgLogFd, pgLogFd],
    windowsHide: true,
  });
  const optProc = spawn(
    PYTHON_EXE,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(optPort)],
    {
      cwd: path.join(ROOT, "services", "driver-optimizer"),
      stdio: ["ignore", optLogFd, optLogFd],
      windowsHide: true,
    }
  );

  const dbConfig = { host: "127.0.0.1", port: pgPort, user: "postgres", database: "postgres" };
  const optUrl = `http://127.0.0.1:${optPort}`;

  try {
    const [health] = await Promise.all([waitForHealth(optUrl), waitForPostgres(pgPort)]);
    assert.equal(health.status, "ok");

    const admin = new Client(dbConfig);
    await admin.connect();

    try {
      await admin.query(`
        do $$
        begin
          if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
          if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
          if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
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
        alter table public.staff add column if not exists nickname text;
        alter table public.staff_location_snapshots add column if not exists metadata jsonb default '{}'::jsonb;
        alter table public.bookings alter column session_completion_source type text;
      `);
      await admin.query(readSql("supabase/operations/driver-unified-journeys.sql"));
      await admin.query(readSql("supabase/operations/driver-o4-journeys.sql"));

      const BRANCH_ID = "10000000-0000-4000-8000-000000000001";
      const CRM_AUTH = "20000000-0000-4000-8000-000000000001";
      const DRV_A_AUTH = "20000000-0000-4000-8000-000000000002";
      const DRV_B_AUTH = "20000000-0000-4000-8000-000000000003";
      const TH1_AUTH = "20000000-0000-4000-8000-000000000004";
      const CRM_ID = "30000000-0000-4000-8000-000000000001";
      const DRV_A_ID = "30000000-0000-4000-8000-000000000002";
      const DRV_B_ID = "30000000-0000-4000-8000-000000000003";
      const TH1_ID = "30000000-0000-4000-8000-000000000004";
      const TH2_ID = "30000000-0000-4000-8000-000000000005";
      const CUST_ID = "40000000-0000-4000-8000-000000000001";
      const B1 = "50000000-0000-4000-8000-000000000001";
      const B2 = "50000000-0000-4000-8000-000000000002";
      const B3 = "50000000-0000-4000-8000-000000000003";

      const todayRes = await admin.query(
        "select to_char((now() at time zone 'Asia/Manila')::date, 'YYYY-MM-DD') as d"
      );
      const planningDate = todayRes.rows[0].d;

      await admin.query(`
        insert into public.branches(id, name, latitude, longitude)
        values ('${BRANCH_ID}', 'Bacolod Main', 10.6765, 122.9509);
        insert into public.customers(id, full_name) values ('${CUST_ID}', 'Maria Santos');
        insert into public.staff(id, auth_user_id, branch_id, full_name, nickname, system_role, staff_type, is_active) values
          ('${CRM_ID}', '${CRM_AUTH}', '${BRANCH_ID}', 'CRM Dispatcher', 'CRM', 'crm', 'staff', true),
          ('${DRV_A_ID}', '${DRV_A_AUTH}', '${BRANCH_ID}', 'Driver A', 'Driver A', 'driver', 'driver', true),
          ('${DRV_B_ID}', '${DRV_B_AUTH}', '${BRANCH_ID}', 'Driver B', 'Driver B', 'driver', 'driver', true),
          ('${TH1_ID}', '${TH1_AUTH}', '${BRANCH_ID}', 'Therapist 1', 'T1', 'therapist', 'therapist', true),
          ('${TH2_ID}', gen_random_uuid(), '${BRANCH_ID}', 'Therapist 2', 'T2', 'therapist', 'therapist', true);
        insert into public.staff_shift_checkins(staff_id, branch_id, status, checked_out_at, is_test) values
          ('${DRV_A_ID}', '${BRANCH_ID}', 'checked_in', null, false),
          ('${DRV_B_ID}', '${BRANCH_ID}', 'checked_in', null, false);
        insert into public.bookings(
          id, branch_id, staff_id, customer_id, booking_date, start_time, end_time,
          status, booking_progress_status, delivery_type, home_service_tracking_status, metadata
        ) values
          ('${B1}', '${BRANCH_ID}', '${TH1_ID}', '${CUST_ID}', '${planningDate}', '10:00:00', '11:00:00',
           'confirmed', 'confirmed', 'home_service', 'awaiting_driver',
           '{"home_service_address":{"lat":10.6805,"lng":122.9550,"full_address":"Mandalagan"}}'::jsonb),
          ('${B2}', '${BRANCH_ID}', '${TH2_ID}', '${CUST_ID}', '${planningDate}', '10:10:00', '11:10:00',
           'confirmed', 'confirmed', 'home_service', 'awaiting_driver',
           '{"home_service_address":{"lat":10.6850,"lng":122.9600,"full_address":"Bata"}}'::jsonb),
          ('${B3}', '${BRANCH_ID}', '${TH2_ID}', '${CUST_ID}', '${planningDate}', '14:00:00', '15:00:00',
           'confirmed', 'confirmed', 'home_service', 'awaiting_driver',
           '{"home_service_address":{"lat":10.6900,"lng":122.9650,"full_address":"Banago"},"driver_collection":{"decision":"not_required","source":"schedule","approvedBy":"${CRM_ID}","approvedAt":"${planningDate}T08:00:00+08:00","reasonCode":"APPROVED_INDEPENDENT_DEPARTURE"}}'::jsonb);
        update driver_unified_private.control set enabled = true where id;
      `);

      // Stage B: Real HTTP call to live Python Google OR-Tools FastAPI service
      const optReq = {
        snapshot_id: "live-o4-e2e",
        planning_date: planningDate,
        timezone: "Asia/Manila",
        horizon_end_minute: 1440,
        drivers: [
          {
            driver_id: DRV_A_ID,
            name: "Driver A",
            branch_id: BRANCH_ID,
            allowed_branch_ids: [BRANCH_ID],
            start_location_id: `branch:${BRANCH_ID}`,
            return_to_location_id: `branch:${BRANCH_ID}`,
            shift_start_minute: 480,
            shift_end_minute: 1200,
            vehicle_capacity: 4,
            vehicle_type: "mpv",
          },
          {
            driver_id: DRV_B_ID,
            name: "Driver B",
            branch_id: BRANCH_ID,
            allowed_branch_ids: [BRANCH_ID],
            start_location_id: `branch:${BRANCH_ID}`,
            return_to_location_id: `branch:${BRANCH_ID}`,
            shift_start_minute: 480,
            shift_end_minute: 1200,
            vehicle_capacity: 4,
            vehicle_type: "mpv",
          },
        ],
        therapists: [
          {
            therapist_id: TH1_ID,
            name: "Therapist 1",
            booking_id: B1,
            branch_id: BRANCH_ID,
            pickup_location_id: `branch:${BRANCH_ID}`,
            customer_location_id: `customer:${B1}`,
            required_arrival_minute: 600,
            estimated_service_end_minute: 660,
            permitted_return_location_id: `branch:${BRANCH_ID}`,
            is_final_appointment: true,
          },
          {
            therapist_id: TH2_ID,
            name: "Therapist 2",
            booking_id: B2,
            branch_id: BRANCH_ID,
            pickup_location_id: `branch:${BRANCH_ID}`,
            customer_location_id: `customer:${B2}`,
            required_arrival_minute: 610,
            estimated_service_end_minute: 670,
            permitted_return_location_id: `branch:${BRANCH_ID}`,
            is_final_appointment: false,
            next_assignment: {
              booking_id: B3,
              assignment_type: "home_service",
              location_id: `customer:${B3}`,
              earliest_start_minute: 840,
              required_arrival_minute: 840,
              requires_company_transport: true,
            },
          },
          {
            therapist_id: TH2_ID,
            name: "Therapist 2",
            booking_id: B3,
            branch_id: BRANCH_ID,
            pickup_location_id: `branch:${BRANCH_ID}`,
            customer_location_id: `customer:${B3}`,
            required_arrival_minute: 840,
            estimated_service_end_minute: 900,
            permitted_return_location_id: `branch:${BRANCH_ID}`,
            is_final_appointment: true,
            return_arrangement: {
              disposition: "not_required",
              independent_departure_approved: true,
              approval_source: "schedule",
              approved_by: CRM_ID,
              approved_at: "2026-11-17T08:00:00Z",
              reason_code: "APPROVED_INDEPENDENT_DEPARTURE",
            },
          },
        ],
        transport_obligations: [
          {
            obligation_id: `del:${B1}`,
            booking_id: B1,
            therapist_id: TH1_ID,
            branch_id: BRANCH_ID,
            leg_type: "delivery",
            pickup_location_id: `branch:${BRANCH_ID}`,
            dropoff_location_id: `customer:${B1}`,
            pickup_window: { earliest_minute: 520, latest_minute: 590 },
            dropoff_window: { earliest_minute: 550, latest_minute: 600 },
            target_arrival_minute: 600,
            passenger_count: 1,
          },
          {
            obligation_id: `col:${B1}`,
            booking_id: B1,
            therapist_id: TH1_ID,
            branch_id: BRANCH_ID,
            leg_type: "collection",
            pickup_location_id: `customer:${B1}`,
            dropoff_location_id: `branch:${BRANCH_ID}`,
            pickup_window: { earliest_minute: 660, latest_minute: 720 },
            dropoff_window: { earliest_minute: 675, latest_minute: 760 },
            expected_ready_minute: 660,
            passenger_count: 1,
            linked_delivery_obligation_id: `del:${B1}`,
          },
          {
            obligation_id: `del:${B2}`,
            booking_id: B2,
            therapist_id: TH2_ID,
            branch_id: BRANCH_ID,
            leg_type: "delivery",
            pickup_location_id: `branch:${BRANCH_ID}`,
            dropoff_location_id: `customer:${B2}`,
            pickup_window: { earliest_minute: 530, latest_minute: 600 },
            dropoff_window: { earliest_minute: 560, latest_minute: 610 },
            target_arrival_minute: 610,
            passenger_count: 1,
          },
          {
            obligation_id: `col:${B2}`,
            booking_id: B2,
            therapist_id: TH2_ID,
            branch_id: BRANCH_ID,
            leg_type: "collection",
            pickup_location_id: `customer:${B2}`,
            dropoff_location_id: `branch:${BRANCH_ID}`,
            pickup_window: { earliest_minute: 670, latest_minute: 730 },
            dropoff_window: { earliest_minute: 685, latest_minute: 770 },
            expected_ready_minute: 670,
            passenger_count: 1,
            linked_delivery_obligation_id: `del:${B2}`,
          },
          {
            obligation_id: `del:${B3}`,
            booking_id: B3,
            therapist_id: TH2_ID,
            branch_id: BRANCH_ID,
            leg_type: "delivery",
            pickup_location_id: `branch:${BRANCH_ID}`,
            dropoff_location_id: `customer:${B3}`,
            pickup_window: { earliest_minute: 760, latest_minute: 830 },
            dropoff_window: { earliest_minute: 790, latest_minute: 840 },
            target_arrival_minute: 840,
            passenger_count: 1,
            require_collection_coverage: false,
          },
        ],
        travel_info: {
          locations: [
            { location_id: `branch:${BRANCH_ID}`, label: "Bacolod Main", lat: 10.6765, lng: 122.9509, location_type: "branch", branch_id: BRANCH_ID },
            { location_id: `customer:${B1}`, label: "Mandalagan", lat: 10.6805, lng: 122.955, location_type: "customer", branch_id: BRANCH_ID },
            { location_id: `customer:${B2}`, label: "Bata", lat: 10.685, lng: 122.96, location_type: "customer", branch_id: BRANCH_ID },
            { location_id: `customer:${B3}`, label: "Banago", lat: 10.69, lng: 122.965, location_type: "customer", branch_id: BRANCH_ID },
          ],
          travel_time_minutes: [
            [0, 8, 12, 16],
            [8, 0, 6, 10],
            [12, 6, 0, 5],
            [16, 10, 5, 0],
          ],
          travel_distance_km: [
            [0, 3.0, 4.5, 6.0],
            [3.0, 0, 2.0, 3.5],
            [4.5, 2.0, 0, 1.8],
            [6.0, 3.5, 1.8, 0],
          ],
          matrix_version: "e2e-synthetic-verified",
        },
        config: { solver_time_limit_seconds: 5, deterministic_seed: 42 },
      };

      const httpRes = await fetch(`${optUrl}/v1/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optReq),
      });
      assert.equal(httpRes.status, 200);
      const plan = await httpRes.json();
      assert.equal(plan.feasibility_status, "feasible");
      assert.equal(plan.all_obligations_served, true);
      assert.equal(plan.collection_plan_safe, true);

      // Verify OR-Tools honored independent departure for B3
      const b3Return = plan.return_decisions.find((d) => d.booking_id === B3);
      assert.equal(b3Return.requirement, "not_required");

      // Map live OR-Tools assignments -> public.driver_o4_commit_plan
      const routeUuidByDriver = new Map();
      const stopOrderByBooking = new Map();
      const delDriverByBooking = new Map();
      const colDriverByBooking = new Map();
      for (const route of plan.routes) {
        if (!routeUuidByDriver.has(route.driver_id)) routeUuidByDriver.set(route.driver_id, crypto.randomUUID());
        let order = 0;
        for (const s of route.stops) {
          if (s.leg_type === "delivery" && s.stop_type === "dropoff" && s.booking_id) {
            order += 1;
            stopOrderByBooking.set(s.booking_id, order);
            delDriverByBooking.set(s.booking_id, route.driver_id);
          } else if (s.leg_type === "collection" && s.stop_type === "pickup" && s.booking_id) {
            colDriverByBooking.set(s.booking_id, route.driver_id);
          }
        }
      }

      const bookingUpdates = [B1, B2, B3].map((bid) => {
        const ret = plan.return_decisions.find((d) => d.booking_id === bid);
        const delDriver = delDriverByBooking.get(bid) ?? DRV_A_ID;
        const colDriver = ret.requirement === "not_required" ? null : (colDriverByBooking.get(bid) ?? delDriver);
        return {
          bookingId: bid,
          vehicleJourneyId: routeUuidByDriver.get(delDriver),
          deliveryDriverId: delDriver,
          collectionDriverId: colDriver,
          stopOrder: stopOrderByBooking.get(bid) ?? 1,
          collectionDecision: ret.requirement,
          collectionApprovalMetadata: {
            source: ret.approval_source ?? ret.decision_source,
            approvedBy: ret.approved_by,
            approvedAt: ret.approved_at,
            reasonCode: ret.reason_code,
          },
        };
      });

      // Stage C: Atomic Postgres commit from live OR-Tools result
      const commit = await withSession(dbConfig, CRM_AUTH, (c) =>
        c.query("select public.driver_o4_commit_plan($1, $2) as res", [
          BRANCH_ID,
          { snapshotId: plan.snapshot_id, bookingUpdates },
        ])
      );
      assert.equal(commit.rows[0].res.ok, true);
      assert.equal(commit.rows[0].res.committedCount, 3);

      // Delayed auto_due safety check: if B1 only hits auto_due, collection_ready returns false
      await admin.query(`
        update public.bookings
        set booking_progress_status = 'completed', status = 'completed',
            session_completed_at = now(), session_completion_source = 'auto_due'
        where id = '${B1}';
      `);
      const autoDueAttempt = await withSession(dbConfig, TH1_AUTH, (c) =>
        c.query("select public.driver_unified_collection_ready($1) as ready", [B1])
      );
      assert.equal(autoDueAttempt.rows[0].ready, false);

      // Reset B1 -> delivered + confirmed service manual completion -> collection_ready returns true!
      await admin.query(`
        update public.bookings
        set session_completion_source = 'manual'
        where id = '${B1}';
      `);
      const confirmedReady = await withSession(dbConfig, TH1_AUTH, (c) =>
        c.query("select public.driver_unified_collection_ready($1) as ready", [B1])
      );
      assert.equal(confirmedReady.rows[0].ready, true);

      // Verify B3 manual service completion moves directly to complete without pickup push
      await admin.query(`
        update public.bookings
        set booking_progress_status = 'completed', status = 'completed',
            session_completed_at = now(), session_completion_source = 'manual'
        where id = '${B3}';
      `);
      await withSession(dbConfig, CRM_AUTH, (c) =>
        c.query("select public.driver_unified_collection_ready($1)", [B3])
      );
      const b3Row = await admin.query(
        `select stage, reason from driver_unified_private.journeys where booking_id = '${B3}'`
      );
      assert.equal(b3Row.rows[0].stage, "complete");
      assert.equal(b3Row.rows[0].reason, "collection_not_required_approved");

      console.log("LIVE_PYTHON_O1_POSTGRES_O4_E2E_PASSED");
    } finally {
      await admin.end().catch(() => {});
    }
  } finally {
    try {
      execFileSync(path.join(PG_BIN_DIR, "pg_ctl.exe"), ["-D", dataDir, "stop", "-m", "immediate"], {
        stdio: "ignore",
      });
    } catch {}
    try { pgProc.kill("SIGKILL"); } catch {}
    try { optProc.kill("SIGKILL"); } catch {}
    fs.closeSync(pgLogFd);
    fs.closeSync(optLogFd);
    fs.rmSync(TMP_CLUSTER, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Live Python+Postgres O4 E2E failed:", err);
  process.exit(1);
});

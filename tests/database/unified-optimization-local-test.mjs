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
const TMP_CLUSTER = path.join(ROOT, ".tmp", `pg-unified-test-${process.pid}`);

async function freePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 55466;
      srv.close(() => resolve(port));
    });
  });
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
        create extension if not exists btree_gist;
        create table public.branches(
          id uuid primary key,
          name text not null,
          latitude double precision,
          longitude double precision
        );
        create table public.branch_resources(
          id uuid primary key,
          branch_id uuid not null references public.branches(id),
          name text not null,
          resource_type text not null,
          capacity integer not null default 1,
          is_active boolean not null default true
        );
        create table public.staff(
          id uuid primary key,
          branch_id uuid not null references public.branches(id),
          full_name text not null,
          system_role text not null,
          tier integer not null default 1,
          is_active boolean not null default true
        );
        create table public.bookings(
          id uuid primary key,
          branch_id uuid not null references public.branches(id),
          staff_id uuid references public.staff(id),
          resource_id uuid references public.branch_resources(id),
          booking_date date not null,
          start_time time not null,
          end_time time not null,
          delivery_type text not null,
          status text not null default 'confirmed',
          booking_progress_status text not null default 'confirmed',
          driver_id uuid,
          session_due_at timestamptz,
          metadata jsonb not null default '{}'::jsonb
        );
        create table public.workflow_tasks(
          id uuid primary key default gen_random_uuid(),
          branch_id uuid not null references public.branches(id),
          task_type text not null,
          title text not null,
          description text,
          status text not null default 'open',
          related_entity_type text,
          related_entity_id uuid,
          dedupe_key text unique,
          metadata jsonb not null default '{}'::jsonb,
          completed_at timestamptz,
          created_at timestamptz not null default now()
        );
        create table public.workspace_notifications(
          id uuid primary key default gen_random_uuid(),
          branch_id uuid not null references public.branches(id),
          target_workspace text not null,
          type text not null,
          title text not null,
          message text not null,
          action_href text,
          resolved_at timestamptz,
          check (action_href is null or action_href ~ '^/(owner|manager|crm|staff-portal|driver|utility)(/|$)')
        );
      `);

      const MAIN_ID = "10000000-0000-4000-8000-000000000001";
      const SM_ID = "10000000-0000-4000-8000-000000000002";
      const ROOM1 = "20000000-0000-4000-8000-000000000001";
      const ROOM2 = "20000000-0000-4000-8000-000000000002";
      const TH1 = "30000000-0000-4000-8000-000000000001";
      const TH2 = "30000000-0000-4000-8000-000000000002";
      const TH_SM = "30000000-0000-4000-8000-000000000003";
      const DRV1 = "30000000-0000-4000-8000-000000000004";
      const B_HOME = "40000000-0000-4000-8000-000000000001";
      const B_SPA_CONFLICT = "40000000-0000-4000-8000-000000000002";
      const planningDate = new Date().toISOString().slice(0, 10);

      await admin.query(`
        insert into public.branches(id, name, latitude, longitude) values
          ('${MAIN_ID}', 'Main Spa', 10.6765, 122.9509),
          ('${SM_ID}', 'SM Branch', 10.6710, 122.9440);
        -- Main Spa has registered rooms; SM Branch intentionally has 0 registered rooms
        insert into public.branch_resources(id, branch_id, name, resource_type, capacity) values
          ('${ROOM1}', '${MAIN_ID}', 'Couple Suite 1', 'couple_suite', 2),
          ('${ROOM2}', '${MAIN_ID}', 'VIP Room 2', 'single_room', 1);
        insert into public.staff(id, branch_id, full_name, system_role, tier) values
          ('${TH1}', '${MAIN_ID}', 'Therapist One', 'therapist', 1),
          ('${TH2}', '${MAIN_ID}', 'Therapist Two', 'therapist', 2),
          ('${TH_SM}', '${SM_ID}', 'SM Therapist', 'therapist', 1),
          ('${DRV1}', '${MAIN_ID}', 'Driver One', 'driver', 1);
        -- Active room_turnover blocks ROOM1 while TH1 also has a home_service ending at 11:00 followed by an 11:15 in_spa booking (travel gap < dynamic buffer)
        insert into public.workflow_tasks(branch_id, task_type, title, status, related_entity_type, related_entity_id, dedupe_key) values
          ('${MAIN_ID}', 'room_turnover', 'Turnover Couple Suite 1', 'open', 'branch_resource', '${ROOM1}', 'turnover:${ROOM1}');
        insert into public.bookings(id, branch_id, staff_id, resource_id, booking_date, start_time, end_time, delivery_type, driver_id, session_due_at, metadata) values
          ('${B_HOME}', '${MAIN_ID}', '${TH1}', null, '${planningDate}', '10:00:00', '11:00:00', 'home_service', null, now() - interval '15 minutes', '{"home_service_address":{"lat":10.6950,"lng":122.9700,"full_address":"Bata"}}'::jsonb),
          ('${B_SPA_CONFLICT}', '${MAIN_ID}', '${TH1}', '${ROOM2}', '${planningDate}', '11:15:00', '12:15:00', 'in_spa', null, null, '{}'::jsonb);
      `);

      // Test 1A: Live Python /v1/onsite/solve reports unconstrained_no_resources honestly for SM Branch (0 rooms)
      const onsiteSmRes = await fetch(`${optUrl}/v1/onsite/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "assign_order",
          branch_id: SM_ID,
          date: planningDate,
          requested_start_minute: 600,
          therapists: [{
            staff_id: TH_SM,
            name: "SM Therapist",
            home_branch_id: SM_ID,
            checked_in: true,
            qualified_service_ids: ["svc-sm"],
            shift_windows: [{ start_minute: 600, end_minute: 1200 }],
          }],
          resources: [],
          requirements: [{
            line_id: "line-sm-1",
            attendee_id: "att-sm-1",
            service_id: "svc-sm",
            service_name: "Swedish",
            duration_minutes: 60,
            buffer_before_minutes: 10,
            buffer_after_minutes: 10,
            requires_room: true,
          }],
        }),
      });
      assert.equal(onsiteSmRes.status, 200);
      const onsiteSm = await onsiteSmRes.json();
      assert.equal(onsiteSm.feasible, true);
      assert.equal(onsiteSm.room_constraint_mode, "unconstrained_no_resources");

      // Test 1B: Main Spa enforces active room_turnover on ROOM1 -> routes guest to clean ROOM2
      const onsiteMainRes = await fetch(`${optUrl}/v1/onsite/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "assign_order",
          branch_id: MAIN_ID,
          date: planningDate,
          requested_start_minute: 600,
          therapists: [{
            staff_id: TH2,
            name: "Therapist Two",
            home_branch_id: MAIN_ID,
            checked_in: true,
            qualified_service_ids: ["svc-main"],
            shift_windows: [{ start_minute: 600, end_minute: 1200 }],
          }],
          resources: [
            { resource_id: ROOM1, name: "Couple Suite 1", resource_type: "couple_suite", capacity: 2, active_turnover_until_minute: 735, busy_windows: [] },
            { resource_id: ROOM2, name: "VIP Room 2", resource_type: "single_room", capacity: 1, busy_windows: [] },
          ],
          requirements: [{
            line_id: "line-main-1",
            attendee_id: "att-main-1",
            service_id: "svc-main",
            service_name: "Aromatherapy",
            duration_minutes: 60,
            buffer_before_minutes: 10,
            buffer_after_minutes: 10,
            requires_room: true,
          }],
        }),
      });
      assert.equal(onsiteMainRes.status, 200);
      const onsiteMain = await onsiteMainRes.json();
      assert.equal(onsiteMain.feasible, true);
      assert.equal(onsiteMain.room_constraint_mode, "enforced");
      assert.equal(onsiteMain.assignments[0].resource_id, ROOM2);

      // Test 2: Live Python /v1/unified/evaluate detects cross-mode collision, turnover collision, unassigned driver & overrun risk
      const evalRes = await fetch(`${optUrl}/v1/unified/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: MAIN_ID,
          branch_name: "Main Spa",
          date: planningDate,
          now_minute: 700,
          source_snapshot_version: "local-pg-test-v1",
          rules: {
            travel_buffer_minutes: 30,
            scheduling_home_buffer_minutes: 60,
            room_reset_buffer_minutes: 10,
          },
          therapists: [{
            staff_id: TH1,
            name: "Therapist One",
            home_branch_id: MAIN_ID,
            checked_in: true,
            qualified_service_ids: ["svc-main"],
            shift_windows: [{ start_minute: 540, end_minute: 1200 }],
          }, {
            staff_id: TH2,
            name: "Therapist Two",
            home_branch_id: MAIN_ID,
            checked_in: true,
            qualified_service_ids: ["svc-main"],
            shift_windows: [{ start_minute: 540, end_minute: 1200 }],
          }],
          drivers: [{
            driver_id: DRV1,
            name: "Driver One",
            home_branch_id: MAIN_ID,
            shift_windows: [{ start_minute: 540, end_minute: 1200 }],
            checked_in: true,
          }],
          resources: [
            { resource_id: ROOM1, name: "Couple Suite 1", resource_type: "couple_suite", capacity: 2, busy_windows: [] },
            { resource_id: ROOM2, name: "VIP Room 2", resource_type: "single_room", capacity: 1, busy_windows: [] },
          ],
          room_turnovers: [{
            task_id: `turnover:${ROOM1}`,
            resource_id: ROOM1,
            resource_name: "Couple Suite 1",
            status: "open",
            started_minute: 660,
            expected_ready_minute: 735,
          }],
          assistance_requests: [],
          bookings: [
            {
              booking_id: B_HOME,
              customer_name: "Home Guest",
              service_id: "svc-main",
              delivery_type: "home_service",
              status: "in_progress",
              tracking_status: "in_route",
              therapist_id: TH1,
              driver_id: null,
              start_minute: 600,
              end_minute: 660,
              session_started_minute: 600,
              session_due_minute: 675,
              live_eta_minutes: 25.0,
              has_valid_customer_location: true,
            },
            {
              booking_id: B_SPA_CONFLICT,
              customer_name: "Spa Guest",
              service_id: "svc-main",
              delivery_type: "in_spa",
              status: "confirmed",
              therapist_id: TH1,
              resource_id: ROOM1,
              start_minute: 675,
              end_minute: 735,
            },
            {
              booking_id: "40000000-0000-4000-8000-000000000003",
              customer_name: "Upcoming Home Guest",
              service_id: "svc-main",
              delivery_type: "home_service",
              status: "confirmed",
              therapist_id: TH2,
              driver_id: null,
              start_minute: 760,
              end_minute: 820,
              has_valid_customer_location: true,
            },
          ],
        }),
      });
      assert.equal(evalRes.status, 200);
      const evalJson = await evalRes.json();
      const kinds = new Set(evalJson.conflicts_and_opportunities.map((i) => i.issue_type));
      assert.ok(kinds.has("home_service_to_onsite_collision"), `Expected home_service_to_onsite_collision in ${[...kinds].join(",")}`);
      assert.ok(kinds.has("room_turnover_collision"), `Expected room_turnover_collision in ${[...kinds].join(",")}`);
      assert.ok(kinds.has("driver_unassigned_risk"), `Expected driver_unassigned_risk in ${[...kinds].join(",")}`);
      assert.ok(kinds.has("session_overrun_ripple"), `Expected session_overrun_ripple in ${[...kinds].join(",")}`);

      // Test 3: Idempotent workflow_tasks upsert + workspace_notifications valid CHECK href + auto-resolve when turnover completes
      const topInsights = evalJson.conflicts_and_opportunities.slice(0, 3);
      for (const ins of topInsights) {
        const title = ins.recommended_actions?.[0]?.label ?? ins.issue_type;
        const recommendationText = ins.recommended_actions?.[0]?.description ?? ins.predicted_impact;
        await admin.query(
          `insert into public.workflow_tasks(branch_id, task_type, title, description, status, dedupe_key)
           values ($1, 'ops_recommendation', $2, $3, 'open', $4)
           on conflict (dedupe_key) do nothing`,
          [MAIN_ID, title, recommendationText, ins.dedupe_key]
        );
        await admin.query(
          `insert into public.workspace_notifications(branch_id, target_workspace, type, title, message, action_href)
           values ($1, 'crm', 'ops_recommendation', $2, $3, '/crm/dispatch')`,
          [MAIN_ID, title, recommendationText]
        );
      }

      // Reject invalid /staff/driver notification href via CHECK constraint (catching earlier regression!)
      await assert.rejects(
        admin.query(
          `insert into public.workspace_notifications(branch_id, target_workspace, type, title, message, action_href)
           values ($1, 'driver', 'ops_recommendation', 'Bad Href', 'Test', '/staff/driver')`,
          [MAIN_ID]
        )
      );

      // Re-run deduplicated upsert -> count must stay 3
      const beforeDedupe = await admin.query(`select count(*)::int as c from public.workflow_tasks where task_type = 'ops_recommendation' and status = 'open'`);
      assert.equal(beforeDedupe.rows[0].c, topInsights.length);
      for (const ins of topInsights) {
        const title = ins.recommended_actions?.[0]?.label ?? ins.issue_type;
        const recommendationText = ins.recommended_actions?.[0]?.description ?? ins.predicted_impact;
        await admin.query(
          `insert into public.workflow_tasks(branch_id, task_type, title, description, status, dedupe_key)
           values ($1, 'ops_recommendation', $2, $3, 'open', $4)
           on conflict (dedupe_key) do nothing`,
          [MAIN_ID, title, recommendationText, ins.dedupe_key]
        );
      }
      const afterDedupe = await admin.query(`select count(*)::int as c from public.workflow_tasks where task_type = 'ops_recommendation' and status = 'open'`);
      assert.equal(afterDedupe.rows[0].c, topInsights.length);

      // Complete turnover task & verify Room 1 becomes available + auto-resolve simulation
      await admin.query(`update public.workflow_tasks set status = 'completed', completed_at = now() where dedupe_key = 'turnover:${ROOM1}'`);
      await admin.query(`update public.workflow_tasks set status = 'completed', completed_at = now() where task_type = 'ops_recommendation' and status = 'open'`);
      const resolvedCount = await admin.query(`select count(*)::int as c from public.workflow_tasks where status = 'completed' and completed_at is not null`);
      assert.equal(resolvedCount.rows[0].c, 4);

      console.log("UNIFIED_LOCAL_POSTGRES_AND_SOLVER_PASSED");
    } finally {
      await admin.end().catch(() => {});
    }
  } finally {
    try {
      execFileSync(path.join(PG_BIN_DIR, "pg_ctl.exe"), ["-D", dataDir, "stop", "-m", "immediate"], { stdio: "ignore" });
    } catch {}
    try { pgProc.kill("SIGKILL"); } catch {}
    try { optProc.kill("SIGKILL"); } catch {}
    fs.closeSync(pgLogFd);
    fs.closeSync(optLogFd);
    fs.rmSync(TMP_CLUSTER, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Unified local Postgres integration test failed:", err);
  process.exit(1);
});

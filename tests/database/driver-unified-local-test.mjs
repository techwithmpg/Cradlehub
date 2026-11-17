import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
const read = (p) => readFileSync(p, "utf8"),
  hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const manifestPath = "tests/database/driver-unified-local-approval.json";
const approved = process.argv
  .find((x) => x.startsWith("--approved-manifest-sha256="))
  ?.split("=")[1];
if (!process.argv.includes("--approved-local-test") || approved !== hash(manifestPath))
  throw new Error(
    "STOP: separate owner approval of the exact LOCAL TEST manifest is required before connecting."
  );
const manifest = JSON.parse(read(manifestPath));
assert.equal(
  manifest.target,
  "LOCAL TEST 127.0.0.1:55439 / disposable driver_unified_test_* database"
);
for (const [path, digest] of Object.entries(manifest.files))
  assert.equal(hash(path), digest, "Approval artifact changed: " + path);
// Deliberately no dotenv, DSN, linked project, remote credentials or CLI db push.
const require = createRequire(import.meta.url);
const {
  Client,
} = require("E:/cradlehub/.worktrees/web-attendance-v2/.tmp/attendance-v2-postgres/node_modules/pg");
const database = `driver_unified_test_${Date.now()}`;
assert.match(database, /^driver_unified_test_[0-9]+$/);
const config = {
  host: "127.0.0.1",
  port: 55439,
  user: "postgres",
  database,
  connectionTimeoutMillis: 5000,
};
const admin = new Client({ ...config, database: "postgres" });
await admin.connect();
const identity = (
  await admin.query(
    "select host(inet_server_addr()) host,inet_server_port() port,current_setting('data_directory') dir,version() version"
  )
).rows[0];
assert.equal(identity.host, "127.0.0.1");
assert.equal(identity.port, 55439);
assert.match(
  identity.dir.replaceAll("\\", "/"),
  /\/web-attendance-v2\/\.tmp\/attendance-v2-pgdata$/
);
assert.match(identity.version, /PostgreSQL 17\./);
for (const role of ["anon", "authenticated", "service_role"])
  assert.equal(
    (await admin.query("select exists(select 1 from pg_roles where rolname=$1) ok", [role])).rows[0]
      .ok,
    true
  );
await admin.query(`create database ${database}`);
console.log(
  "LOCAL TEST identity verified; new synthetic database created. No Supabase parity is implied."
);
const db = new Client(config);
await db.connect();
let passed = 0;
function extract(path, name) {
  const source = read(path),
    pattern = new RegExp(`create (?:or replace )?function public\\.${name}\\(`, "i"),
    start = source.search(pattern);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n$$;", start) + 4);
}
const ids = Object.fromEntries(
  [
    "branch",
    "otherBranch",
    "driver",
    "provider",
    "crm",
    "otherDriver",
    "driverAuth",
    "providerAuth",
    "crmAuth",
    "otherAuth",
    "session",
    "booking",
    "customer",
  ].map((k) => [k, randomUUID()])
);
async function as(user, run, client = db) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [user, JSON.stringify({ session_id: ids.session })]
    );
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
async function test(name, run) {
  await run();
  passed++;
  console.log("PASS " + name);
}
const snapshot = () =>
  as(
    ids.driverAuth,
    async (c) => (await c.query("select public.driver_unified_snapshot(null) value")).rows[0].value
  );
let j;
const request = (action, point) => ({
  bookingId: ids.booking,
  requestId: randomUUID(),
  expectedRevision: j?.revision ?? 0,
  action,
  ...(point ? { point } : {}),
});
const event = (payload) =>
  as(
    ids.driverAuth,
    async (c) =>
      (await c.query("select public.driver_unified_event($1::jsonb) value", [payload])).rows[0]
        .value
  );
const point = (lat = 10, lng = 120) => ({
  lat,
  lng,
  accuracyMeters: 5,
  observedAt: new Date().toISOString(),
});
try {
  await db.query("set statement_timeout='15s'");
  await db.query(read("tests/database/driver-unified-fixture.sql"));
  await db.query(
    extract(
      "supabase/migrations/20261011020713_p0_booking_security_forward.sql",
      "update_booking_progress"
    )
  );
  await db.query(read("supabase/migrations/20261013003850_staff_pwa_progress_actor_guard.sql"));
  await db.query(
    "revoke all on function public.update_booking_progress(uuid,text) from public,anon,authenticated"
  );
  await db.query(read("supabase/operations/driver-unified-journeys.sql"));
  await db.query(
    "insert into branches(id,name,latitude,longitude) values($1,'LOCAL TEST branch',10,120),($2,'Other TEST branch',11,121)",
    [ids.branch, ids.otherBranch]
  );
  for (const [id, auth, role, type, branch] of [
    [ids.driver, ids.driverAuth, "driver", "driver", ids.branch],
    [ids.provider, ids.providerAuth, "service_staff", "therapist", ids.branch],
    [ids.crm, ids.crmAuth, "crm", "csr", ids.branch],
    [ids.otherDriver, ids.otherAuth, "driver", "driver", ids.otherBranch],
  ])
    await db.query(
      "insert into staff(id,auth_user_id,system_role,staff_type,branch_id,full_name) values($1,$2,$3,$4,$5,'Synthetic TEST staff')",
      [id, auth, role, type, branch]
    );
  await db.query("insert into customers values($1,'Synthetic TEST customer')", [ids.customer]);
  await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    ids.session,
    ids.driverAuth,
  ]);
  await db.query(
    "insert into bookings(id,branch_id,driver_id,staff_id,customer_id,metadata) values($1,$2,$3,$4,$5,$6)",
    [
      ids.booking,
      ids.branch,
      ids.driver,
      ids.provider,
      ids.customer,
      {
        home_service_address: {
          lat: 10.01,
          lng: 120.01,
          full_address: "Synthetic TEST destination",
        },
      },
    ]
  );
  await test("installed contract defaults inactive", () => assert.rejects(snapshot, /inactive/));
  await db.query("update driver_unified_private.control set enabled=true");
  await test("driver cannot read private registry", () =>
    assert.rejects(
      as(ids.driverAuth, (c) => c.query("select * from driver_unified_private.devices")),
      /permission denied/
    ));
  await test("cross-branch actor sees no assignments", async () =>
    assert.deepEqual(
      await as(
        ids.otherAuth,
        async (c) =>
          (await c.query("select public.driver_unified_snapshot(null) value")).rows[0].value
      ),
      []
    ));
  await test("snapshot identifies pickup without starting", async () => {
    j = (await snapshot())[0];
    assert.equal(j.stage, "pickup_pending");
    assert.equal(j.leg, "pickup");
  });
  await test("off-shift start rejected atomically", () =>
    assert.rejects(event(request("start")), /active_shift_required/));
  await db.query("insert into staff_shift_checkins(staff_id,branch_id) values($1,$2)", [
    ids.driver,
    ids.branch,
  ]);
  const first = request("start");
  await test("pickup start and identical retry are idempotent", async () => {
    j = await event(first);
    assert.equal(j.stage, "pickup_enroute");
    assert.deepEqual(await event(first), j);
  });
  await test("request ID cannot change payload", () =>
    assert.rejects(event({ ...first, action: "board" }), /request_identity_mismatch/));
  await test("boarding before arrival rejected", () =>
    assert.rejects(event(request("board")), /invalid_journey_transition/));
  await test("inaccurate GPS rejected", () =>
    assert.rejects(
      event(request("gps_arrival", { ...point(), accuracyMeters: 51 })),
      /gps_evidence_invalid/
    ));
  await test("far GPS cannot establish arrival", () =>
    assert.rejects(event(request("gps_arrival", point(11, 121))), /outside_arrival_boundary/));
  await test("pickup GPS arrival is not boarding", async () => {
    j = await event(request("gps_arrival", point()));
    assert.equal(j.stage, "pickup_arrived");
  });
  await test("explicit boarding opens delivery", async () => {
    j = await event(request("board"));
    assert.equal(j.stage, "delivery_pending");
  });
  await test("legacy canonical writer cannot bypass driver GPS arrival", () =>
    assert.rejects(
      db.query("select public.advance_staff_booking_progress($1,'travel_started',$2)", [
        ids.booking,
        ids.driver,
      ]),
      /unified_journey_transition_required/
    ));
  await test("delivery start uses the accepted canonical booking writer", async () => {
    j = await event(request("start"));
    assert.equal(j.stage, "delivery_enroute");
    assert.equal(
      (await db.query("select booking_progress_status from bookings where id=$1", [ids.booking]))
        .rows[0].booking_progress_status,
      "travel_started"
    );
  });
  await test("customer GPS arrival uses the canonical arrived transition", async () => {
    j = await event(request("gps_arrival", point(10.01, 120.01)));
    assert.equal(j.stage, "customer_arrived");
  });
  await test("therapist service start remains authoritative", async () => {
    await db.query("select public.update_booking_progress($1,'session_started')", [ids.booking]);
    j = (await snapshot())[0];
    assert.equal(j.stage, "service_active");
  });
  await test("service completion creates readiness, never collection", async () => {
    await db.query("select public.update_booking_progress($1,'completed')", [ids.booking]);
    j = (await snapshot())[0];
    assert.equal(j.stage, "collection_pending");
  });
  await test("CRM reads completed-service collection separately", async () => {
    const rows = await as(
      ids.crmAuth,
      async (c) =>
        (await c.query("select public.driver_unified_dispatch($1) value", [ids.branch])).rows[0]
          .value
    );
    assert.equal(rows[0].journey.stage, "collection_pending");
  });
  await test("driver cannot request CRM branch projection", () =>
    assert.rejects(
      as(ids.driverAuth, (c) => c.query("select public.driver_unified_dispatch($1)", [ids.branch])),
      /dispatch_branch_forbidden/
    ));
  await test("collection requires a fresh return and explicit boarding", async () => {
    j = await event(request("start"));
    assert.equal(j.stage, "collection_enroute");
    j = await event(request("gps_arrival", point(10.01, 120.01)));
    assert.equal(j.stage, "collection_arrived");
    j = await event(request("board"));
    assert.equal(j.stage, "return_pending");
  });
  await test("branch return and explicit drop-off finish transport", async () => {
    j = await event(request("start"));
    j = await event(request("gps_arrival", point()));
    assert.equal(j.stage, "return_arrived");
    j = await event(request("finish_return"));
    assert.equal(j.stage, "complete");
    assert.deepEqual(await snapshot(), []);
  });
  await test("native token is session owned and revocable", async () => {
    const device = {
      installationId: randomUUID(),
      token: "SYNTHETIC_TEST_TOKEN_".repeat(8),
      enabled: true,
    };
    await as(ids.driverAuth, (c) => c.query("select public.driver_native_register($1)", [device]));
    assert.equal(
      (await db.query("select count(*)::int n from driver_unified_private.devices")).rows[0].n,
      1
    );
    await as(ids.driverAuth, (c) => c.query("select public.driver_native_revoke_session()"));
    assert.equal(
      (await db.query("select count(*)::int n from driver_unified_private.devices")).rows[0].n,
      0
    );
  });
  console.log(
    `LOCAL TEST: ${passed} scenarios passed. Supabase Auth/PostgREST/RLS deployment parity and device evidence remain separate gates.`
  );
} finally {
  await db.end();
  // Only this runner's newly created disposable database is eligible for cleanup.
  assert.match(database, /^driver_unified_test_[0-9]+$/);
  await admin.query(`drop database ${database}`);
  await admin.end();
}

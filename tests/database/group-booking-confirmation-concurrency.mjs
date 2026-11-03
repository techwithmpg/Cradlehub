// Requires the disposable LOCAL TEST fixture and forward migration. Two real
// PostgreSQL sessions compete for five rooms, then verify exactly one whole
// group was confirmed. Never accepts a database URL or remote target.
import { spawn } from "node:child_process";
import { join } from "node:path";

const psql = join(
  process.cwd(),
  ".tmp",
  "postgresql-17.11-5-windows-x64-binaries",
  "pgsql",
  "bin",
  "psql.exe"
);
const branch = "00000000-0000-4000-8000-000000000001";
const guard = `DO $$ BEGIN IF current_database() <> 'group_booking_test' OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() IS DISTINCT FROM 55434 THEN RAISE EXCEPTION 'LOCAL TEST target guard failed'; END IF; END $$;`;

function run(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, [
      "-X",
      "-q",
      "-A",
      "-t",
      "-h",
      "127.0.0.1",
      "-p",
      "55434",
      "-U",
      "postgres",
      "-d",
      "group_booking_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `${guard} ${sql}`,
    ]);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(output.trim()))
    );
  });
}

const bookingId = (key) =>
  `(SELECT b.id FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id WHERE o.idempotency_key = '${key}' LIMIT 1)`;
const confirm = (key) =>
  `SELECT public.confirm_online_booking_order_atomic(${bookingId(key)}, '${branch}');`;
const winner = run(`BEGIN; ${confirm("race-a")} SELECT pg_sleep(2); COMMIT;`);
await new Promise((resolve) => setTimeout(resolve, 200));
const competitor = run(
  `DO $$ BEGIN PERFORM public.confirm_online_booking_order_atomic(${bookingId("race-b")}, '${branch}'); EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'BOOKING_ROOM_CAPACITY_UNAVAILABLE' THEN RAISE; END IF; END $$;`
);
const [winnerResult, competitorResult] = await Promise.all([winner, competitor]);
const counts = await run(
  `SELECT o.idempotency_key, count(*) FILTER (WHERE b.status = 'confirmed'), count(*) FILTER (WHERE b.status = 'pending_crm_confirmation'), count(b.resource_id) FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id WHERE o.idempotency_key IN ('race-a', 'race-b') GROUP BY o.idempotency_key ORDER BY o.idempotency_key;`
);
if (!counts.includes("race-a|5|0|5") || !counts.includes("race-b|0|5|0")) {
  throw new Error(
    `Concurrent capacity invariant failed: ${counts}\n${winnerResult}\n${competitorResult}`
  );
}
console.log(`CONCURRENT_CONFIRMATION_LOCAL_TEST_PASS\n${counts}`);

const createSql =
  "SELECT public.test_make_order('race-idempotency', 5, 90, current_date + 600, 2)->>'idempotency_status';";
const creationResults = await Promise.all([run(createSql), run(createSql)]);
const creationCounts = await run(
  "SELECT count(DISTINCT o.id), count(b.id) FROM public.booking_orders o JOIN public.bookings b ON b.order_id = o.id WHERE o.idempotency_key = 'race-idempotency';"
);
if (
  creationResults.filter((result) => result.includes("created")).length !== 1 ||
  creationResults.filter((result) => result.includes("replayed")).length !== 1 ||
  creationCounts !== "1|10"
) {
  throw new Error(
    `Concurrent idempotency invariant failed: ${creationResults.join(" / ")} / ${creationCounts}`
  );
}
console.log(`CONCURRENT_IDEMPOTENCY_LOCAL_TEST_PASS\n${creationCounts}`);

await run(
  "SELECT public.test_make_order('config-race', 5, 95, current_date + 700)->>'idempotency_status';"
);
const configWriter = run(
  "BEGIN; UPDATE public.branch_resources SET is_active = false WHERE branch_id = '00000000-0000-4000-8000-000000000001'; SELECT pg_sleep(2); COMMIT;"
);
await new Promise((resolve) => setTimeout(resolve, 200));
const confirmationDuringEdit = run(
  `DO $$ BEGIN PERFORM public.confirm_online_booking_order_atomic(${bookingId("config-race")}, '${branch}'); EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'BOOKING_ROOM_CAPACITY_UNAVAILABLE' THEN RAISE; END IF; END $$;`
);
await Promise.all([configWriter, confirmationDuringEdit]);
const configCounts = await run(
  "SELECT count(*) FILTER (WHERE b.status = 'pending_crm_confirmation'), count(b.resource_id) FROM public.bookings b JOIN public.booking_orders o ON o.id = b.order_id WHERE o.idempotency_key = 'config-race';"
);
if (configCounts !== "5|0")
  throw new Error(`Configuration race partially confirmed a group: ${configCounts}`);
await run(
  "UPDATE public.branch_resources SET is_active = (sort_order <= 5) WHERE branch_id = '00000000-0000-4000-8000-000000000001';"
);
console.log(`CONCURRENT_RESOURCE_EDIT_LOCAL_TEST_PASS\n${configCounts}`);

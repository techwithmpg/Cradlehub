// Isolated TEST harness. Explicit loopback cluster; never loads .env or remote URLs.
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const root = resolve(__dirname, "../..");
const bin = resolve(root, ".tmp/postgresql-17.11-5-windows-x64-binaries/pgsql/bin");
const db = "discount_test_" + Date.now();
const args = ["-h", "127.0.0.1", "-p", "55439", "-U", "postgres"];
function run(exe, a) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
  const r = spawnSync(resolve(bin, exe + ".exe"), a, { encoding: "utf8", env });
  if (r.status !== 0) throw Error(r.stderr || r.stdout);
  return r.stdout + r.stderr;
}
function table(file, name) {
  const s = readFileSync(resolve(root, file), "utf8");
  const m = s.match(
    new RegExp("CREATE TABLE IF NOT EXISTS public\\." + name + " \\([\\s\\S]*?^\\);", "m")
  );
  if (!m) throw Error(name);
  return m[0];
}
function fn(file, name) {
  const s = readFileSync(resolve(root, file), "utf8");
  const start = s.indexOf("CREATE OR REPLACE FUNCTION public." + name + "(");
  const match = s.slice(start).match(/^[\s\S]*?^\$[A-Za-z0-9_]*\$;/m);
  if (start < 0 || !match) throw Error(name);
  return match[0];
}
const cf2 = "supabase/migrations/20260927120000_cf2_financial_foundation.sql";
const cf3 = "supabase/migrations/20260927130000_cf3_order_payables_allocations.sql";
const accepted = "supabase/migrations/20261003081900_p1_expired_booking_financial_safety.sql";
const bootstrap = `
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE branches(id uuid PRIMARY KEY);
CREATE TABLE staff(id uuid PRIMARY KEY,auth_user_id uuid,branch_id uuid,system_role text,is_active boolean);
CREATE TABLE customers(id uuid PRIMARY KEY,full_name text,loyalty_tier text);
CREATE TABLE services(id uuid PRIMARY KEY,name text);
CREATE TABLE booking_orders(id uuid PRIMARY KEY,branch_id uuid,organizer_customer_id uuid,booking_date date,metadata jsonb,currency text);
CREATE TABLE booking_attendees(id uuid PRIMARY KEY,booking_order_id uuid,customer_id uuid,display_name text);
CREATE TABLE bookings(id uuid PRIMARY KEY,order_id uuid,branch_id uuid,customer_id uuid,attendee_id uuid,service_id uuid,
status text,delivery_type text,metadata jsonb,amount_paid numeric DEFAULT 0,payment_status text,payment_method text,payment_reference text);
CREATE TABLE cash_sessions(id uuid PRIMARY KEY,cash_drawer_account_id uuid,branch_id uuid,status text);
`;
const sql = [
  bootstrap,
  ...["financial_accounts", "financial_transactions", "financial_account_movements"].map((n) =>
    table(cf2, n)
  ),
  ...["order_payable_items", "financial_order_allocations"].map((n) => table(cf3, n)),
  fn(cf3, "derive_order_payment_state"),
  fn(accepted, "reconcile_closed_booking_service_charge"),
  fn(accepted, "post_order_payment_atomic"),
  readFileSync(
    resolve(root, "supabase/migrations/20261102114848_recipient_discount_checkout.sql"),
    "utf8"
  ),
  readFileSync(resolve(root, "tests/database/discount-checkout-test.sql"), "utf8"),
].join("\n");
mkdirSync(resolve(root, ".tmp/discount-test"), { recursive: true });
const path = resolve(root, ".tmp/discount-test/run.sql");
writeFileSync(path, sql);
run("createdb", [...args, db]);
process.stdout.write("TARGET TEST: 127.0.0.1:55439/" + db + "\n");
process.stdout.write(run("psql", [...args, "-d", db, "-v", "ON_ERROR_STOP=1", "-f", path]));
console.log(
  "PASS: exact accepted financial table definitions/functions with synthetic identity, booking and cash-session fixtures. Full production schema/triggers not represented."
);
async function concurrencyTests() {
  const quote = (x) => "'" + String(x).replaceAll("'", "''") + "'";
  const query = (sql) =>
    run("psql", [...args, "-d", db, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql]).trim();
  const facts = JSON.parse(
    query(
      "SELECT json_build_object('branch',s.branch_id,'user',s.auth_user_id,'customer',(SELECT id FROM customers WHERE loyalty_tier='vip' LIMIT 1),'service',(SELECT id FROM services LIMIT 1),'account',(SELECT id FROM financial_accounts WHERE account_type='gcash' LIMIT 1)) FROM staff s LIMIT 1"
    )
  );
  const parallel = (sql) =>
    new Promise((resolveResult) => {
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (key.startsWith("PG")) delete env[key];
      const child = spawn(
        resolve(bin, "psql.exe"),
        [...args, "-d", db, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql],
        { env }
      );
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (code) => resolveResult({ code, output }));
      child.on("error", (error) => resolveResult({ code: 1, output: String(error) }));
    });
  for (const sameKey of [true, false]) {
    const order = randomUUID(),
      booking = randomUUID(),
      key = randomUUID();
    query(
      `INSERT INTO booking_orders VALUES(${quote(order)},${quote(facts.branch)},${quote(facts.customer)},current_date,'{"total_amount":1000}','PHP'); INSERT INTO bookings(id,order_id,branch_id,customer_id,service_id,status,delivery_type,metadata) VALUES(${quote(booking)},${quote(order)},${quote(facts.branch)},${quote(facts.customer)},${quote(facts.service)},'completed','in_spa','{"price_paid":1000}');`
    );
    const selections = JSON.stringify([{ bookingId: booking, category: "vip", attested: true }]);
    const auth = `SET LOCAL request.jwt.claim.sub=${quote(facts.user)};`;
    const quoted = JSON.parse(
      query(
        `BEGIN;${auth}SELECT public.quote_order_discounts(${quote(order)},${quote(selections)});COMMIT;`
      )
    );
    const payments = JSON.stringify([
      { amount: 200, payment_method: "gcash", financial_account_id: facts.account },
    ]);
    const command = (k) =>
      `BEGIN;${auth}SELECT public.post_order_payment_with_discounts_atomic(${quote(order)},${quote(k)},${quote(payments)},${quote(selections)},${quote(quoted.version)});SELECT pg_sleep(0.3);COMMIT;`;
    const results = await Promise.all([
      parallel(command(key)),
      parallel(command(sameKey ? key : randomUUID())),
    ]);
    const successes = results.filter((result) => result.code === 0).length;
    if (successes !== (sameKey ? 2 : 1))
      throw Error("Concurrency result unexpected: " + JSON.stringify(results));
    if (
      sameKey &&
      results.filter((result) => result.output.includes('"is_idempotent_replay": true')).length !==
        1
    )
      throw Error("Concurrent replay missing");
    if (
      !sameKey &&
      !results.some(
        (result) =>
          result.output.includes("EXISTING_ADJUSTMENT_REQUIRES_REVIEW") ||
          result.output.includes("STALE_DISCOUNT_QUOTE")
      )
    )
      throw Error("Stale concurrent request was not rejected");
    const counts = JSON.parse(
      query(
        `SELECT json_build_object('audits',(SELECT count(*) FROM order_discount_audits WHERE order_id=${quote(order)}),'discounts',(SELECT count(*) FROM order_payable_items WHERE order_id=${quote(order)} AND charge_type='discount'),'paid',(SELECT sum(amount) FROM financial_order_allocations WHERE order_id=${quote(order)}))`
      )
    );
    if (counts.audits !== 1 || counts.discounts !== 1 || Number(counts.paid) !== 200)
      throw Error("Concurrent duplicate side effect: " + JSON.stringify(counts));
    console.log(
      "PASS: parallel " +
        (sameKey ? "same-key replay" : "different-key stale rejection") +
        " — one audit, one discount, one 200.00 allocation"
    );
  }
}
concurrencyTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

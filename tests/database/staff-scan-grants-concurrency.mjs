import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const host = process.env.PGHOST;
const database = process.env.PGDATABASE;
if ((host !== "127.0.0.1" && host !== "localhost") || !database?.endsWith("_test")) {
  throw new Error("A classified loopback LOCAL TEST PostgreSQL target is required.");
}

const psql = process.env.PSQL_PATH || "psql";
const args = ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-d", database];
const claim = `select public.claim_staff_scan_grant(
  'parallel', '00000000-0000-0000-0000-000000000001', 'att_main',
  '00000000-0000-0000-0000-000000000011')`;

function query(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(psql, [...args, "-c", sql], { env: process.env, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`LOCAL TEST psql failed: ${stderr}`));
      else resolve(stdout);
    });
  });
}

const first = query(`begin; ${claim}; select pg_sleep(2); commit;`);
await new Promise((resolve) => setTimeout(resolve, 300));
const second = query(claim);
const outputs = await Promise.all([first, second]);
const claims = outputs.flatMap((output) => output.match(/00000000-0000-0000-0000-000000000011/g) ?? []);
assert.equal(claims.length, 1, "exactly one parallel claim must return the operation ID");
assert.equal((await query(claim)).includes("00000000-0000-0000-0000-000000000011"), false,
  "a consumed token must reject replay");
assert.match(await query("select count(*) from public.staff_shift_checkins"), /(^|\n)1(\r?\n|$)/);
assert.match(await query("select count(*) from public.qr_scan_events"), /(^|\n)1(\r?\n|$)/);
process.stdout.write("scanner grant LOCAL TEST parallel/replay and attendance counts passed\n");

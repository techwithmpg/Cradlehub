import { createClient } from "@supabase/supabase-js";
import {
  commandExists,
  loadLocalEnv,
  parsePoolerUrl,
  runSupabase,
  safeError,
  statusLine,
} from "./_shared.mjs";

loadLocalEnv();

const criticalTables = [
  "branches",
  "staff",
  "staff_schedules",
  "schedule_overrides",
  "staff_group_schedule_rules",
  "staff_schedule_group_members",
  "bookings",
  "attendance_events",
  "attendance_sessions",
  "staff_devices",
  "device_activation_tokens",
  "attendance_qr_points",
];

let failed = false;
let warned = false;

const sqlProbe = runSupabase(
  [
    "db",
    "query",
    "select current_database(), current_user, now(), (select count(*) from supabase_migrations.schema_migrations) as migration_count;",
    "--linked",
    "--dns-resolver",
    "https",
    "--output",
    "table",
  ],
  { timeoutMs: 45000 },
);

if (sqlProbe.ok) {
  statusLine("Linked SQL probe", "PASS");
} else {
  warned = true;
  statusLine("Linked SQL probe", "WARNING", safeError(sqlProbe));
}

const pooler = parsePoolerUrl();
if (pooler.present && pooler.valid && pooler.tls) {
  if (commandExists("psql")) statusLine("psql fallback", "PASS", "available for read-only pooler verification");
  else {
    warned = true;
    statusLine("psql fallback", "WARNING", "psql is not installed; emergency transactional fallback remains documented only");
  }
} else {
  warned = true;
  statusLine("Pooler fallback", "WARNING", "SUPABASE_DB_POOLER_URL is missing or invalid");
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of criticalTables) {
    const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      failed = true;
      statusLine(`Table ${table}`, "FAIL", error.message);
    } else {
      statusLine(`Table ${table}`, "PASS");
    }
  }
} else {
  failed = true;
  statusLine("Service-role REST verify", "FAIL", "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
}

if (failed) {
  console.log("Remote schema changed: no");
  process.exit(1);
}

if (warned) process.exitCode = 2;

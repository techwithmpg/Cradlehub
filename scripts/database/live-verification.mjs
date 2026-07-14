import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  configuredProjectRef,
  getLinkedProjectRef,
  loadLocalEnv,
  redact,
  runSupabase,
} from "./_shared.mjs";

const DEFAULT_TIMEOUT_MS = 15_000;
const READ_ONLY_SQL = /^(select|with|show|explain)\b/i;

export const LIVE_VERIFICATION_TABLES = [
  "branches",
  "staff",
  "customers",
  "bookings",
  "booking_events",
  "staff_schedules",
  "schedule_overrides",
  "branch_resources",
  "staff_devices",
  "qr_points",
  "qr_scan_events",
  "staff_shift_checkins",
  "attendance_exceptions",
  "workspace_notifications",
  "workflow_tasks",
  "daily_cash_reconciliations",
];

export function createQaRunId() {
  return `qa-live-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
}

export function identifyQaRecord(record, qaRunId) {
  if (!record || !qaRunId) return false;
  const metadata = record.metadata;
  return Boolean(
    record.qa_run_id === qaRunId ||
    record.notes === `QA_RUN:${qaRunId}` ||
    (metadata && typeof metadata === "object" && metadata.qa_run_id === qaRunId)
  );
}

export function queryLiveDatabaseReadOnly(sql, options = {}) {
  const normalized = sql.trim().replace(/;+$/, "");
  if (!READ_ONLY_SQL.test(normalized)) {
    throw new Error("Live verification rejected a non-read-only SQL statement.");
  }

  const result = runSupabase(
    ["db", "query", normalized, "--linked", "--dns-resolver", "https", "--output", "json", "--agent=no"],
    { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
  );
  if (!result.ok) throw new Error(sanitizeVerificationError(result));
  return parseCliJson(result.stdout);
}

export function queryPoolerReadOnly(sql, options = {}) {
  const normalized = sql.trim().replace(/;+$/, "");
  if (!READ_ONLY_SQL.test(normalized)) {
    throw new Error("Live verification rejected a non-read-only SQL statement.");
  }
  const configuredUrl = process.env.SUPABASE_DB_POOLER_URL;
  if (!configuredUrl) throw new Error("Supabase pooler URL is missing.");
  const poolerUrl = new URL(configuredUrl);
  if (options.port) poolerUrl.port = String(options.port);
  poolerUrl.searchParams.set("sslmode", "require");
  const result = runSupabase(
    ["db", "query", normalized, "--db-url", poolerUrl.toString(), "--output", "json", "--agent=no"],
    { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
  );
  if (!result.ok) throw new Error(sanitizeVerificationError(result));
  return parseCliJson(result.stdout);
}

export async function verifyLiveDatabaseConnection(options = {}) {
  loadLocalEnv();
  const configuredRef = configuredProjectRef();
  const linkedRef = getLinkedProjectRef();
  if (!configuredRef || !linkedRef || configuredRef !== linkedRef) {
    throw new Error("Configured and linked Supabase project identities do not match.");
  }

  const [database] = queryLiveDatabaseReadOnly(
    "select current_database() as database_name, current_setting('server_version') as postgres_version, now() as database_time, (select count(*) from information_schema.tables where table_schema = 'public') as public_table_count, (select count(*) from supabase_migrations.schema_migrations) as migration_count",
    options,
  );
  const rest = await verifyRestTables(options);
  const rls = await verifyAnonRlsBehavior(options);
  return { projectRef: linkedRef, database, rest, rls };
}

export async function verifyRestTables(options = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Required server-side Supabase verification variables are missing.");

  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: withTimeoutFetch(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) },
  });
  const results = [];
  for (const table of LIVE_VERIFICATION_TABLES) {
    const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
    results.push({ table, readable: !error, count: error ? null : count, error: error?.message ?? null });
  }
  return results;
}

export function verifyTableExists(results, table) {
  return results.some((result) => result.table === table && result.readable);
}

export async function verifyAnonRlsBehavior(options = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Required browser-safe Supabase variables are missing.");
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: withTimeoutFetch(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) },
  });
  const publicResult = await client.from("branches").select("id", { count: "exact", head: true });
  const privateResult = await client.from("staff").select("id", { count: "exact", head: true });
  return {
    publicBranchesReadable: !publicResult.error,
    privateStaffRowsVisible: !privateResult.error && (privateResult.count ?? 0) > 0,
  };
}

export async function waitForDatabaseCondition(check, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for the live database condition.");
}

export function compareUiAndDatabaseState(uiValue, databaseValue) {
  return { matches: Object.is(uiValue, databaseValue), uiValue, databaseValue };
}

export function produceSanitizedVerificationReport(value) {
  return JSON.parse(redact(JSON.stringify(value)));
}

export function sanitizeVerificationError(result) {
  const source = [result.error, result.stderr, result.stdout].filter(Boolean).join(" ");
  if (/timed?\s*out|timeout/i.test(source)) return "Live database connection timed out.";
  if (/password|authentication|sasl|scram/i.test(source)) return "Live database authentication failed.";
  if (/network|connect|dns|resolve|unreachable/i.test(source)) return "Live database network connection failed.";
  return `Live database query failed: ${redact(source).split(/\r?\n/)[0] || "unknown error"}`;
}

function parseCliJson(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("Live database returned an unreadable response.");
  return JSON.parse(output.slice(start, end + 1));
}

function withTimeoutFetch(timeoutMs) {
  return (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

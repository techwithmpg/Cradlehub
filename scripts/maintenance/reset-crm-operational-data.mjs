#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  configuredProjectRef,
  getLinkedProjectRef,
  loadLocalEnv,
  redact,
  repoRoot,
  runSupabase,
  safeError,
} from "../database/_shared.mjs";

export const PREVIEW_DOC_PATH = "docs/maintenance/crm-operational-reset-preview.md";
export const RESET_BACKUP_ROOT = "maintenance-backups/crm-operational-reset";
export const ADVISORY_LOCK_NAME = "cradlehub.crm_operational_reset";

export const PROTECTED_TABLES = [
  "auth.users",
  "public.staff",
  "public.staff_schedules",
  "public.staff_group_schedule_rules",
  "public.staff_schedule_groups",
  "public.staff_scheduling_preferences",
  "public.attendance_settings",
  "public.branches",
  "public.services",
  "public.branch_services",
  "public.branch_resources",
  "public.qr_points",
];

export const RESET_TABLE_PLAN = [
  { table: "bookings", action: "delete", timestampColumn: "created_at" },
  { table: "booking_events", action: "delete", timestampColumn: "created_at" },
  { table: "booking_payment_logs", action: "delete", timestampColumn: "created_at" },
  { table: "customer_tracking_links", action: "delete", timestampColumn: "created_at" },
  { table: "staff_location_snapshots", action: "delete", timestampColumn: "recorded_at" },
  { table: "attendance_corrections", action: "delete", timestampColumn: "created_at" },
  { table: "attendance_exceptions", action: "delete", timestampColumn: "created_at" },
  { table: "qr_scan_events", action: "delete", timestampColumn: "created_at" },
  { table: "staff_shift_checkins", action: "delete", timestampColumn: "created_at" },
  { table: "schedule_overrides", action: "delete", timestampColumn: "created_at" },
  { table: "blocked_times", action: "delete", timestampColumn: "created_at" },
  { table: "device_activation_tokens", action: "delete expired/used/revoked", timestampColumn: "created_at" },
  { table: "staff_devices", action: "delete non-active only", timestampColumn: "created_at" },
  { table: "waitlist_requests", action: "preserve row, clear converted booking link", timestampColumn: "updated_at" },
  { table: "staff_branch_change_requests", action: "preserve row, clear scan link", timestampColumn: "updated_at" },
  { table: "staff_schedules", action: "preserve", timestampColumn: "created_at" },
];

function utcDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function expectedConfirmationToken({ projectRef, branch, date = new Date() }) {
  if (!projectRef) throw new Error("Project ref is required to build a confirmation token.");
  return `RESET-CRM-${projectRef}-${branch}-${utcDateStamp(date)}`;
}

export function shouldPreserveStaffDevice(device) {
  return device?.status === "active" && !device?.revoked_at;
}

export function shouldDeleteStaffDevice(device) {
  return !shouldPreserveStaffDevice(device);
}

export function shouldDeleteActivationToken(token, now = new Date()) {
  if (!token) return false;
  if (token.used_at || token.revoked_at) return true;
  if (!token.expires_at) return false;
  const expiresAt = new Date(token.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt < now.getTime();
}

export function parseArgs(argv) {
  const parsed = {
    mode: "dry-run",
    branch: "all",
    confirmation: "",
  };
  let sawMode = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      if (sawMode && parsed.mode !== "dry-run") {
        throw new Error("Use only one of --dry-run or --apply.");
      }
      parsed.mode = "dry-run";
      sawMode = true;
    } else if (arg === "--apply") {
      if (sawMode && parsed.mode !== "apply") {
        throw new Error("Use only one of --dry-run or --apply.");
      }
      parsed.mode = "apply";
      sawMode = true;
    } else if (arg.startsWith("--branch=")) {
      parsed.branch = arg.slice("--branch=".length).trim() || "all";
    } else if (arg.startsWith("--confirmation=")) {
      parsed.confirmation = arg.slice("--confirmation=".length).trim();
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

export function validateApplyRequest({ mode, confirmation, expectedToken }) {
  if (mode !== "apply") return;
  if (!confirmation || confirmation !== expectedToken) {
    throw new Error(
      `Apply mode requires --confirmation=${expectedToken}. Run --dry-run first and get explicit approval before applying.`
    );
  }
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function targetBranchWhere(branch) {
  return branch === "all" ? "true" : `id = ${sqlLiteral(branch)}`;
}

function targetScopeCtes(branch) {
  return `
target_branches as (
  select id, name
  from public.branches
  where ${targetBranchWhere(branch)}
),
target_staff as (
  select id, branch_id
  from public.staff
  where branch_id in (select id from target_branches)
),
target_bookings as (
  select *
  from public.bookings
  where branch_id in (select id from target_branches)
),
target_checkins as (
  select *
  from public.staff_shift_checkins
  where branch_id in (select id from target_branches)
),
target_scan_events as (
  select *
  from public.qr_scan_events
  where branch_id in (select id from target_branches)
     or booking_id in (select id from target_bookings)
     or checkin_id in (select id from target_checkins)
),
invalid_staff_devices as (
  select *
  from public.staff_devices
  where branch_id in (select id from target_branches)
    and (status <> 'active' or revoked_at is not null)
),
active_staff_devices as (
  select *
  from public.staff_devices
  where branch_id in (select id from target_branches)
    and status = 'active'
    and revoked_at is null
),
expired_or_closed_tokens as (
  select *
  from public.device_activation_tokens
  where branch_id in (select id from target_branches)
    and (expires_at < now() or used_at is not null or revoked_at is not null)
),
target_schedule_overrides as (
  select so.*
  from public.schedule_overrides so
  join target_staff ts on ts.id = so.staff_id
),
target_blocked_times as (
  select bt.*
  from public.blocked_times bt
  join target_staff ts on ts.id = bt.staff_id
),
target_staff_schedules as (
  select ss.*
  from public.staff_schedules ss
  join target_staff ts on ts.id = ss.staff_id
)
`;
}

export function buildDryRunSql({ branch }) {
  return `
with ${targetScopeCtes(branch)}
select jsonb_build_object(
  'generated_at', now(),
  'branch_scope', ${sqlLiteral(branch)},
  'database', current_database(),
  'database_user', current_user,
  'table_stats', (
    select coalesce(jsonb_agg(to_jsonb(stats) order by stats.sort_order), '[]'::jsonb)
    from (
      select 10 as sort_order, 'bookings'::text as table_name, 'delete'::text as planned_action, count(*)::bigint as row_count, min(created_at)::text as earliest_at, max(created_at)::text as latest_at from target_bookings
      union all select 20, 'booking_events', 'delete', count(*)::bigint, min(be.created_at)::text, max(be.created_at)::text from public.booking_events be join target_bookings b on b.id = be.booking_id
      union all select 30, 'booking_payment_logs', 'delete', count(*)::bigint, min(bpl.created_at)::text, max(bpl.created_at)::text from public.booking_payment_logs bpl join target_bookings b on b.id = bpl.booking_id
      union all select 40, 'customer_tracking_links', 'delete booking links', count(*)::bigint, min(created_at)::text, max(created_at)::text from public.customer_tracking_links where branch_id in (select id from target_branches) or booking_id in (select id from target_bookings)
      union all select 50, 'staff_location_snapshots', 'delete booking links', count(*)::bigint, min(recorded_at)::text, max(recorded_at)::text from public.staff_location_snapshots where branch_id in (select id from target_branches) or booking_id in (select id from target_bookings)
      union all select 60, 'waitlist_requests', 'preserve row, clear converted_to_booking_id', count(*)::bigint, min(updated_at)::text, max(updated_at)::text from public.waitlist_requests where branch_id in (select id from target_branches) and converted_to_booking_id in (select id from target_bookings)
      union all select 70, 'attendance_corrections', 'delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from public.attendance_corrections where branch_id in (select id from target_branches)
      union all select 80, 'attendance_exceptions', 'delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from public.attendance_exceptions where branch_id in (select id from target_branches)
      union all select 90, 'staff_branch_change_requests', 'preserve row, clear scan_event_id', count(*)::bigint, min(updated_at)::text, max(updated_at)::text from public.staff_branch_change_requests where (current_branch_id in (select id from target_branches) or requested_branch_id in (select id from target_branches)) and scan_event_id in (select id from target_scan_events)
      union all select 100, 'qr_scan_events', 'delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from target_scan_events
      union all select 110, 'staff_shift_checkins', 'delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from target_checkins
      union all select 120, 'open_attendance', 'included in staff_shift_checkins delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from target_checkins where status = 'checked_in' or checked_out_at is null
      union all select 130, 'schedule_overrides', 'delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from target_schedule_overrides
      union all select 140, 'blocked_times', 'delete', count(*)::bigint, min(created_at)::text, max(created_at)::text from target_blocked_times
      union all select 150, 'device_activation_tokens', 'delete expired/used/revoked only', count(*)::bigint, min(created_at)::text, max(created_at)::text from expired_or_closed_tokens
      union all select 160, 'staff_devices_invalid', 'delete non-active only', count(*)::bigint, min(created_at)::text, max(created_at)::text from invalid_staff_devices
      union all select 170, 'staff_devices_active', 'preserve', count(*)::bigint, min(created_at)::text, max(created_at)::text from active_staff_devices
      union all select 180, 'staff_schedules', 'preserve', count(*)::bigint, min(created_at)::text, max(created_at)::text from target_staff_schedules
    ) stats
  ),
  'branch_breakdown', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'branch_id', tb.id,
      'branch_name', tb.name,
      'bookings', (select count(*) from target_bookings b where b.branch_id = tb.id),
      'booking_events', (select count(*) from public.booking_events be join target_bookings b on b.id = be.booking_id where b.branch_id = tb.id),
      'scan_events', (select count(*) from target_scan_events q where q.branch_id = tb.id),
      'open_attendance', (select count(*) from target_checkins c where c.branch_id = tb.id and (c.status = 'checked_in' or c.checked_out_at is null)),
      'active_devices_preserved', (select count(*) from active_staff_devices d where d.branch_id = tb.id),
      'invalid_devices', (select count(*) from invalid_staff_devices d where d.branch_id = tb.id),
      'expired_tokens', (select count(*) from expired_or_closed_tokens t where t.branch_id = tb.id),
      'schedule_overrides', (select count(*) from target_schedule_overrides so join target_staff ts on ts.id = so.staff_id where ts.branch_id = tb.id),
      'blocked_times', (select count(*) from target_blocked_times bt join target_staff ts on ts.id = bt.staff_id where ts.branch_id = tb.id)
    ) order by tb.name), '[]'::jsonb)
    from target_branches tb
  ),
  'dependencies', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'constraint', c.conname,
      'table', c.conrelid::regclass::text,
      'references', c.confrelid::regclass::text,
      'definition', pg_get_constraintdef(c.oid)
    ) order by c.conrelid::regclass::text, c.conname), '[]'::jsonb)
    from pg_constraint c
    where c.contype = 'f'
      and (
        c.confrelid in (
          'public.bookings'::regclass,
          'public.qr_scan_events'::regclass,
          'public.staff_shift_checkins'::regclass,
          'public.staff_devices'::regclass
        )
        or c.conrelid in (
          'public.bookings'::regclass,
          'public.booking_events'::regclass,
          'public.booking_payment_logs'::regclass,
          'public.customer_tracking_links'::regclass,
          'public.staff_location_snapshots'::regclass,
          'public.waitlist_requests'::regclass,
          'public.attendance_corrections'::regclass,
          'public.attendance_exceptions'::regclass,
          'public.qr_scan_events'::regclass,
          'public.staff_shift_checkins'::regclass,
          'public.device_activation_tokens'::regclass,
          'public.staff_devices'::regclass,
          'public.staff_branch_change_requests'::regclass
        )
      )
  ),
  'protected_tables', ${sqlJsonArray(PROTECTED_TABLES)},
  'reset_table_plan', ${sqlJsonArray(RESET_TABLE_PLAN)}
) as preview;
`;
}

export function buildApplySql({ branch }) {
  return `
begin;
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtext(${sqlLiteral(ADVISORY_LOCK_NAME)}));

create temp table crm_reset_target_branches on commit drop as
  select id, name
  from public.branches
  where ${targetBranchWhere(branch)};

create temp table crm_reset_target_staff on commit drop as
  select id, branch_id
  from public.staff
  where branch_id in (select id from crm_reset_target_branches);

create temp table crm_reset_target_bookings on commit drop as
  select id
  from public.bookings
  where branch_id in (select id from crm_reset_target_branches);

create temp table crm_reset_target_checkins on commit drop as
  select id
  from public.staff_shift_checkins
  where branch_id in (select id from crm_reset_target_branches);

create temp table crm_reset_target_scan_events on commit drop as
  select id
  from public.qr_scan_events
  where branch_id in (select id from crm_reset_target_branches)
     or booking_id in (select id from crm_reset_target_bookings)
     or checkin_id in (select id from crm_reset_target_checkins);

create temp table crm_reset_invalid_devices on commit drop as
  select id
  from public.staff_devices
  where branch_id in (select id from crm_reset_target_branches)
    and (status <> 'active' or revoked_at is not null);

create temp table crm_reset_tokens on commit drop as
  select id
  from public.device_activation_tokens
  where branch_id in (select id from crm_reset_target_branches)
    and (expires_at < now() or used_at is not null or revoked_at is not null);

update public.bookings
set session_start_scan_event_id = null
where id in (select id from crm_reset_target_bookings)
  and session_start_scan_event_id in (select id from crm_reset_target_scan_events);

update public.staff_shift_checkins
set clock_in_scan_event_id = null,
    clock_out_scan_event_id = null
where id in (select id from crm_reset_target_checkins);

update public.waitlist_requests
set converted_to_booking_id = null,
    updated_at = now()
where branch_id in (select id from crm_reset_target_branches)
  and converted_to_booking_id in (select id from crm_reset_target_bookings);

update public.staff_branch_change_requests
set scan_event_id = null,
    updated_at = now()
where (current_branch_id in (select id from crm_reset_target_branches)
    or requested_branch_id in (select id from crm_reset_target_branches))
  and scan_event_id in (select id from crm_reset_target_scan_events);

delete from public.customer_tracking_links
where branch_id in (select id from crm_reset_target_branches)
   or booking_id in (select id from crm_reset_target_bookings);

delete from public.staff_location_snapshots
where branch_id in (select id from crm_reset_target_branches)
   or booking_id in (select id from crm_reset_target_bookings);

delete from public.booking_payment_logs
where booking_id in (select id from crm_reset_target_bookings);

delete from public.booking_events
where booking_id in (select id from crm_reset_target_bookings);

delete from public.attendance_corrections
where branch_id in (select id from crm_reset_target_branches);

delete from public.attendance_exceptions
where branch_id in (select id from crm_reset_target_branches);

delete from public.qr_scan_events
where id in (select id from crm_reset_target_scan_events);

delete from public.staff_shift_checkins
where id in (select id from crm_reset_target_checkins);

delete from public.bookings
where id in (select id from crm_reset_target_bookings);

delete from public.schedule_overrides
where staff_id in (select id from crm_reset_target_staff);

delete from public.blocked_times
where staff_id in (select id from crm_reset_target_staff);

delete from public.device_activation_tokens
where id in (select id from crm_reset_tokens)
   or revoke_previous_device_id in (select id from crm_reset_invalid_devices)
   or used_by_device_id in (select id from crm_reset_invalid_devices);

delete from public.staff_devices
where id in (select id from crm_reset_invalid_devices);

commit;
`;
}

function sqlJsonArray(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function stripSqlStrings(sql) {
  return sql.replace(/'(?:''|[^'])*'/g, "''");
}

export function hasSqlMutation(sql) {
  return /\b(create|delete|drop|insert|truncate|update|alter)\b/i.test(stripSqlStrings(sql));
}

export function assertNoProtectedDeletes(sql) {
  const stripped = stripSqlStrings(sql).toLowerCase();
  for (const table of PROTECTED_TABLES) {
    const shortName = table.replace(/^public\./, "").toLowerCase();
    const destructivePattern = new RegExp(
      `\\b(delete\\s+from|truncate\\s+table|drop\\s+table)\\s+(public\\.)?${shortName}\\b`,
      "i"
    );
    if (destructivePattern.test(stripped)) {
      throw new Error(`Protected table appears in destructive SQL: ${table}`);
    }
  }
}

function parseCliJson(stdout) {
  const start = stdout.indexOf("{");
  if (start === -1) throw new Error("Supabase CLI did not return JSON.");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < stdout.length; index += 1) {
    const char = stdout[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return JSON.parse(stdout.slice(start, index + 1));
    }
  }

  throw new Error("Supabase CLI JSON output was incomplete.");
}

function runLinkedSql(sql, { timeoutMs = 120000 } = {}) {
  const tempDir = join(repoRoot, ".tmp", "maintenance");
  mkdirSync(tempDir, { recursive: true });
  const filePath = join(tempDir, `crm-operational-reset-${process.pid}-${Date.now()}.sql`);
  writeFileSync(filePath, sql, "utf8");

  try {
    const result = runSupabase(
      [
        "db",
        "query",
        "--file",
        filePath,
        "--linked",
        "--dns-resolver",
        "https",
        "--output",
        "json",
      ],
      { timeoutMs }
    );
    if (!result.ok) {
      throw new Error(safeError(result));
    }
    return parseCliJson(result.stdout);
  } finally {
    rmSync(filePath, { force: true });
  }
}

function decodeJwtPayload(jwt) {
  const [, payload] = String(jwt).split(".");
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function assertServiceRoleEnv(env = process.env) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  const payload = decodeJwtPayload(env.SUPABASE_SERVICE_ROLE_KEY);
  if (payload?.role !== "service_role") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a service-role key.");
  }
}

export function validateProjectIdentity() {
  const linkedProjectRef = getLinkedProjectRef();
  const projectRef = configuredProjectRef();

  if (!linkedProjectRef) {
    throw new Error("No linked Supabase project found. Run pnpm db:doctor or pnpm db:link first.");
  }
  if (!projectRef) {
    throw new Error("No Supabase project ref found in SUPABASE_PROJECT_REF, linked metadata, or NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (projectRef !== linkedProjectRef) {
    throw new Error(`Configured project ref ${projectRef} does not match linked project ${linkedProjectRef}.`);
  }

  return { projectRef, linkedProjectRef };
}

function normalizePreview(rows) {
  const preview = rows?.rows?.[0]?.preview;
  if (!preview || typeof preview !== "object") {
    throw new Error("Dry-run query did not return a preview payload.");
  }
  return preview;
}

function tableValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function markdownTable(headers, rows) {
  const headerLine = `| ${headers.map(tableValue).join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map((row) => `| ${row.map(tableValue).join(" | ")} |`);
  return [headerLine, dividerLine, ...rowLines].join("\n");
}

export function buildPreviewMarkdown(preview, context) {
  const tableStats = preview.table_stats ?? [];
  const branchBreakdown = preview.branch_breakdown ?? [];
  const dependencies = preview.dependencies ?? [];
  const applyCommand = `node scripts/maintenance/reset-crm-operational-data.mjs --apply --branch=${context.branch} --confirmation=${context.confirmationToken}`;

  return `# CRM Operational Reset Preview

Generated: ${tableValue(preview.generated_at)}
Project: ${context.projectRef}
Branch scope: ${context.branch}
Mode: dry-run only

No operational data has been changed. Do not run apply without explicit owner approval.

## Rows Affected

${markdownTable(
  ["Table / bucket", "Planned action", "Rows", "Earliest", "Latest"],
  tableStats.map((row) => [
    row.table_name,
    row.planned_action,
    row.row_count,
    row.earliest_at,
    row.latest_at,
  ])
)}

## Branch Breakdown

${markdownTable(
  [
    "Branch",
    "Bookings",
    "Booking events",
    "Scan events",
    "Open attendance",
    "Active devices preserved",
    "Invalid devices",
    "Expired tokens",
    "Schedule overrides",
    "Blocked times",
  ],
  branchBreakdown.map((row) => [
    row.branch_name ?? row.branch_id,
    row.bookings,
    row.booking_events,
    row.scan_events,
    row.open_attendance,
    row.active_devices_preserved,
    row.invalid_devices,
    row.expired_tokens,
    row.schedule_overrides,
    row.blocked_times,
  ])
)}

## Dependencies Inspected

${markdownTable(
  ["Table", "References", "Constraint", "Definition"],
  dependencies.map((row) => [
    row.table,
    row.references,
    row.constraint,
    row.definition,
  ])
)}

## Preserved By Design

${PROTECTED_TABLES.map((table) => `- ${table}`).join("\n")}
- Active rows in public.staff_devices
- Weekly staff schedules in public.staff_schedules
- Auth users and staff identity records

## Apply Gate

Applying the reset would require this exact command after explicit approval:

\`\`\`powershell
${applyCommand}
\`\`\`

The apply path exports backups to \`${RESET_BACKUP_ROOT}/<timestamp>/\`, takes the \`${ADVISORY_LOCK_NAME}\` advisory lock, and runs in one transaction.
`;
}

function writePreview(preview, context) {
  const docPath = join(repoRoot, PREVIEW_DOC_PATH);
  mkdirSync(join(repoRoot, "docs", "maintenance"), { recursive: true });
  writeFileSync(docPath, buildPreviewMarkdown(preview, context), "utf8");
  return docPath;
}

function backupQueries(branch) {
  const ctes = `with ${targetScopeCtes(branch)}`;
  return [
    ["bookings", `${ctes} select * from target_bookings order by created_at, id;`],
    ["booking_events", `${ctes} select be.* from public.booking_events be join target_bookings b on b.id = be.booking_id order by be.created_at, be.id;`],
    ["booking_payment_logs", `${ctes} select bpl.* from public.booking_payment_logs bpl join target_bookings b on b.id = bpl.booking_id order by bpl.created_at, bpl.id;`],
    ["customer_tracking_links", `${ctes} select * from public.customer_tracking_links where branch_id in (select id from target_branches) or booking_id in (select id from target_bookings) order by created_at, id;`],
    ["staff_location_snapshots", `${ctes} select * from public.staff_location_snapshots where branch_id in (select id from target_branches) or booking_id in (select id from target_bookings) order by recorded_at, id;`],
    ["waitlist_requests", `${ctes} select * from public.waitlist_requests where branch_id in (select id from target_branches) and converted_to_booking_id in (select id from target_bookings) order by updated_at, id;`],
    ["attendance_corrections", `${ctes} select * from public.attendance_corrections where branch_id in (select id from target_branches) order by created_at, id;`],
    ["attendance_exceptions", `${ctes} select * from public.attendance_exceptions where branch_id in (select id from target_branches) order by created_at, id;`],
    ["staff_branch_change_requests", `${ctes} select * from public.staff_branch_change_requests where (current_branch_id in (select id from target_branches) or requested_branch_id in (select id from target_branches)) and scan_event_id in (select id from target_scan_events) order by updated_at, id;`],
    ["qr_scan_events", `${ctes} select * from target_scan_events order by created_at, id;`],
    ["staff_shift_checkins", `${ctes} select * from target_checkins order by created_at, id;`],
    ["schedule_overrides", `${ctes} select * from target_schedule_overrides order by created_at, id;`],
    ["blocked_times", `${ctes} select * from target_blocked_times order by created_at, id;`],
    ["device_activation_tokens", `${ctes} select * from expired_or_closed_tokens order by created_at, id;`],
    ["staff_devices_invalid", `${ctes} select * from invalid_staff_devices order by created_at, id;`],
  ];
}

function exportBackups({ branch }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(repoRoot, RESET_BACKUP_ROOT, stamp);
  mkdirSync(backupDir, { recursive: true });

  for (const [name, sql] of backupQueries(branch)) {
    const result = runLinkedSql(sql);
    writeFileSync(join(backupDir, `${name}.json`), JSON.stringify(result.rows ?? [], null, 2), "utf8");
  }

  return backupDir;
}

function printHelp() {
  console.log(`Usage:
  node scripts/maintenance/reset-crm-operational-data.mjs --dry-run [--branch=<branch-id|all>]
  node scripts/maintenance/reset-crm-operational-data.mjs --apply --branch=<branch-id|all> --confirmation=<token>

Dry-run writes ${PREVIEW_DOC_PATH}. Apply requires explicit approval, service-role env, project identity match, backup export, and the exact confirmation token.`);
}

function cliMain() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  assertServiceRoleEnv();
  const { projectRef } = validateProjectIdentity();
  const confirmationToken = expectedConfirmationToken({
    projectRef,
    branch: args.branch,
  });

  validateApplyRequest({
    mode: args.mode,
    confirmation: args.confirmation,
    expectedToken: confirmationToken,
  });

  const dryRunSql = buildDryRunSql({ branch: args.branch });
  if (hasSqlMutation(dryRunSql)) {
    throw new Error("Dry-run SQL unexpectedly contains a mutating statement.");
  }

  const preview = normalizePreview(runLinkedSql(dryRunSql));
  const docPath = writePreview(preview, {
    branch: args.branch,
    projectRef,
    confirmationToken,
  });

  console.log(`Dry-run preview written: ${docPath}`);
  console.log(`Rows affected buckets: ${(preview.table_stats ?? []).length}`);
  console.log(`Branches inspected: ${(preview.branch_breakdown ?? []).length}`);

  if (args.mode === "dry-run") {
    console.log("No reset applied. Explicit approval is required before --apply.");
    console.log(`Apply command after approval: node scripts/maintenance/reset-crm-operational-data.mjs --apply --branch=${args.branch} --confirmation=${confirmationToken}`);
    return;
  }

  const applySql = buildApplySql({ branch: args.branch });
  assertNoProtectedDeletes(applySql);
  const backupDir = exportBackups({ branch: args.branch });
  writeFileSync(join(backupDir, "apply.sql"), applySql, "utf8");
  runLinkedSql(applySql, { timeoutMs: 180000 });
  console.log(`Reset applied. Backups written to ${backupDir}`);
}

const isCli = process.argv[1]
  ? import.meta.url === pathToFileURL(fileURLToPath(pathToFileURL(process.argv[1]))).href
  : false;

if (isCli) {
  try {
    cliMain();
  } catch (error) {
    console.error(redact(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

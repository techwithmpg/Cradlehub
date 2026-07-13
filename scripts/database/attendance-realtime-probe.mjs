import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./_shared.mjs";

loadLocalEnv();

const branchId = process.argv[2]?.trim();
if (!branchId) {
  console.error("Usage: node scripts/database/attendance-realtime-probe.mjs <branch-id>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Attendance Realtime probe requires the Supabase URL and service-role key.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const channel = supabase.channel(`attendance-realtime-probe-${Date.now()}`);
let completed = false;

async function finish(code, result) {
  if (completed) return;
  completed = true;
  clearTimeout(timeout);
  console.log(JSON.stringify(result));
  await supabase.removeChannel(channel);
  process.exit(code);
}

const timeout = setTimeout(() => {
  void finish(1, { ready: true, received: false, reason: "timeout" });
}, 30_000);

channel
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "qr_scan_events",
      filter: `branch_id=eq.${branchId}`,
    },
    (payload) => {
      const row = payload.new ?? {};
      void finish(0, {
        ready: true,
        received: true,
        scanType: row.scan_type ?? null,
        action: row.action ?? null,
        outcome: row.outcome ?? null,
        reasonCode: row.reason_code ?? null,
        hasStaff: Boolean(row.staff_id),
      });
    }
  )
  .subscribe((status) => {
    if (status === "SUBSCRIBED") console.log(JSON.stringify({ ready: true }));
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      void finish(1, { ready: false, received: false, reason: status.toLowerCase() });
    }
  });

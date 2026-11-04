// Extract the exact accepted function/trigger definitions into an isolated TEST
// fixture. This does not replay historical migrations or connect to a database.
import { readFileSync, writeFileSync } from "node:fs";

function functionSql(path, name) {
  const source = readFileSync(path, "utf8");
  const marker = `create or replace function public.${name}(`;
  const start = source.toLowerCase().indexOf(marker.toLowerCase());
  if (start < 0) throw new Error(`${name} not found in ${path}`);
  const end = source.indexOf("\n$$;", start);
  if (end < 0) throw new Error(`${name} body did not end in ${path}`);
  return source.slice(start, end + "\n$$;".length);
}

const bkg3 = "supabase/migrations/20260927080000_bkg3_booking_order_atomic.sql";
const guard = "supabase/migrations/20260716090000_crm_onsite_booking_integrity_guards.sql";
const current = "supabase/migrations/20261011020713_p0_booking_security_forward.sql";
const schedule = "supabase/migrations/20260713035024_schedule_update_integration_repair.sql";
const guardSource = readFileSync(guard, "utf8");
const triggerStart = guardSource.indexOf("CREATE TRIGGER trg_guard_booking_assignment_overlap");
const triggerEnd = guardSource.indexOf(";", triggerStart);
if (triggerStart < 0 || triggerEnd < 0) throw new Error("booking overlap trigger not found");

writeFileSync(
  ".tmp/group-booking-accepted-functions.sql",
  [
    functionSql(bkg3, "derive_booking_order_status"),
    functionSql(schedule, "staff_metadata_flag"),
    functionSql(schedule, "staff_is_operational"),
    functionSql(current, "crm_booking_row_blocks_availability"),
    functionSql(guard, "guard_booking_assignment_overlap"),
    guardSource.slice(triggerStart, triggerEnd + 1),
    functionSql(current, "create_booking_order_atomic"),
    functionSql(current, "confirm_online_booking_order_atomic"),
  ].join("\n\n") + "\n"
);
console.log("Extracted accepted booking functions and overlap trigger for LOCAL TEST.");

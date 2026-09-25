import "server-only";
import { createClient } from "@/lib/supabase/server";
import { canAccessCrmWorkspace } from "@/lib/auth/crm-permissions";
import { addDaysToYmd } from "@/lib/engine/slot-time";
import { normalizeBranchServiceRow } from "@/lib/services/service-eligibility";
import {
  unavailableSheetContext,
  type SheetContext,
  type SheetContextNeeds,
} from "./sheet-resolution-context";

/** Cookie-authenticated read adapter. No admin client, RPC, mutation or per-row queries. */
export async function loadSheetContext(
  needs: SheetContextNeeds,
  target: NonNullable<SheetContext["target"]>
): Promise<SheetContext> {
  if (!["LOCAL", "TEST", "STAGING", "PRODUCTION"].includes(target))
    throw new Error("An identified database target is required.");
  const dates = [...needs.dates].sort();
  if (!dates.length || dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)))
    throw new Error("Valid batch business dates are required.");
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Authenticated CRM access is required.");
  const { data: actor, error: actorError } = await client
    .from("staff")
    .select("id, branch_id, system_role")
    .eq("auth_user_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (actorError || !actor?.branch_id || !canAccessCrmWorkspace(actor.system_role))
    throw new Error("CRM branch access is required.");
  const branchId = actor.branch_id;
  // Pagination is per collection, never per Sheet row. A failed page is never an empty success.
  async function all<T>(
    query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await query(offset, offset + 499);
      if (result.error)
        throw new Error("Canonical read context is unavailable; no rows were applied.");
      rows.push(...(result.data ?? []));
      if (!result.data || result.data.length < 500) return rows;
    }
  }
  async function chunks<T>(ids: string[], read: (group: string[]) => Promise<T[]>): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; offset < ids.length; offset += 200)
      rows.push(...(await read(ids.slice(offset, offset + 200))));
    return rows;
  }
  const from = addDaysToYmd(dates[0]!, -1),
    to = addDaysToYmd(dates.at(-1)!, 1);
  const [branches, staff, branchServices, rules, bookingRows, customerLinks] = await Promise.all([
    all((a, b) =>
      client.from("branches").select("id, is_active").eq("id", branchId).order("id").range(a, b)
    ),
    all((a, b) =>
      client
        .from("staff")
        .select(
          "id, full_name, nickname, branch_id, is_active, staff_type, system_role, archived_at, merged_into_staff_id, metadata"
        )
        .eq("branch_id", branchId)
        .order("id")
        .range(a, b)
    ),
    all((a, b) =>
      client
        .from("branch_services")
        .select(
          "service_id, branch_id, is_active, available_in_spa, available_home_service, visibility, booking_visibility, custom_duration_minutes"
        )
        .eq("branch_id", branchId)
        .order("service_id")
        .range(a, b)
    ),
    all((a, b) =>
      client
        .from("branch_booking_rules")
        .select(
          "home_service_enabled, in_spa_start_time, in_spa_end_time, home_service_start_time, home_service_end_time, max_advance_booking_days"
        )
        .eq("branch_id", branchId)
        .order("id")
        .range(a, b)
    ),
    all((a, b) =>
      client
        .from("bookings")
        .select("id, staff_id, booking_date, start_time, end_time, status, hold_expires_at")
        .eq("branch_id", branchId)
        .gte("booking_date", from)
        .lte("booking_date", to)
        .order("id")
        .range(a, b)
    ),
    all((a, b) =>
      client
        .from("bookings")
        .select("id, customer_id")
        .eq("branch_id", branchId)
        .not("customer_id", "is", null)
        .order("id")
        .range(a, b)
    ),
  ]);
  const staffIds = staff.map((s) => s.id);
  const serviceIds = [...new Set(branchServices.map((s) => s.service_id))];
  const customerIds = [
    ...new Set(customerLinks.flatMap((b) => (b.customer_id ? [b.customer_id] : []))),
  ];
  const [services, capabilities, schedules, overrides, customers] = await Promise.all([
    chunks(serviceIds, (ids) =>
      all((a, b) =>
        client
          .from("services")
          .select("id, name, is_active, duration_minutes, buffer_before, buffer_after")
          .in("id", ids)
          .order("id")
          .range(a, b)
      )
    ),
    chunks(staffIds, (ids) =>
      all((a, b) =>
        client
          .from("staff_services")
          .select("staff_id, service_id")
          .in("staff_id", ids)
          .order("staff_id")
          .order("service_id")
          .range(a, b)
      )
    ),
    chunks(staffIds, (ids) =>
      all((a, b) =>
        client
          .from("staff_schedules")
          .select(
            "id, staff_id, day_of_week, shift_type, start_time, end_time, is_active, window_order, ends_next_day"
          )
          .in("staff_id", ids)
          .order("id")
          .range(a, b)
      )
    ),
    chunks(staffIds, (ids) =>
      all((a, b) =>
        client
          .from("schedule_overrides")
          .select(
            "id, staff_id, override_date, shift_type, start_time, end_time, is_day_off, ends_next_day"
          )
          .in("staff_id", ids)
          .gte("override_date", from)
          .lte("override_date", to)
          .order("id")
          .range(a, b)
      )
    ),
    chunks(customerIds, (ids) =>
      all((a, b) =>
        client
          .from("customers")
          .select("id, full_name, phone, email")
          .in("id", ids)
          .order("id")
          .range(a, b)
      )
    ),
  ]);
  return {
    ...unavailableSheetContext(""),
    status: "available",
    target,
    unavailableReason: null,
    branch: branches[0] ?? null,
    staff,
    services,
    branchServices: branchServices.map(normalizeBranchServiceRow),
    capabilities,
    schedules,
    overrides,
    customers,
    bookings: bookingRows.flatMap((b) => (b.staff_id ? [{ ...b, staff_id: b.staff_id }] : [])),
    rules: rules[0] ?? null,
  };
}

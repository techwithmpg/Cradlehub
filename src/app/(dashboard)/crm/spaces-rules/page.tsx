import { redirect } from "next/navigation";
import { SpacesRulesWorkspace } from "@/components/features/spaces-rules/spaces-rules-workspace";
import { getBranchWithFullDetail } from "@/lib/queries/branches";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getStaffAdminName } from "@/lib/staff/display-name";

// ── Auth ───────────────────────────────────────────────────────────────────────

const CRM_SPACES_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
]);

async function getCRMContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("id, branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId: mock.branch_id as string,
      branchName: mock.branches.name as string,
      role: "crm",
    };
  }

  if (!me?.branch_id) redirect("/login");
  if (!CRM_SPACES_ROLES.has(me.system_role as string)) redirect("/crm");

  return {
    branchId: me.branch_id as string,
    branchName:
      (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role: me.system_role as string,
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function CRMSpacesRulesPage() {
  const { branchId, branchName, role } = await getCRMContext();
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  const [detail, rules, bookingsResult] = await Promise.all([
    getBranchWithFullDetail(branchId),
    getBranchBookingRulesOrDefault(branchId),
    supabase
      .from("bookings")
      .select(
        `id, start_time, end_time, status, type, resource_id, staff_id, service_id,
        customers ( full_name ),
        services ( name ),
        staff!staff_id ( full_name, nickname )`
      )
      .eq("branch_id", branchId)
      .eq("booking_date", today)
      .not("status", "in", '("cancelled","no_show")'),
  ]);

  const bookings = (bookingsResult.data ?? []).map((b: unknown) => {
    const row = b as Record<string, unknown>;
    const customers = row.customers as
      | { full_name: string }
      | { full_name: string }[]
      | null;
    const services = row.services as
      | { name: string }
      | { name: string }[]
      | null;
    const staff = row.staff as
      | { full_name: string; nickname?: string | null }
      | { full_name: string; nickname?: string | null }[]
      | null;

    const first = <T,>(v: T | T[] | null): T | null => {
      if (!v) return null;
      return Array.isArray(v) ? (v[0] ?? null) : v;
    };

    return {
      id: String(row.id),
      start_time: String(row.start_time),
      end_time: String(row.end_time),
      status: String(row.status),
      type: String(row.type),
      resource_id: row.resource_id ? String(row.resource_id) : null,
      staff_id: row.staff_id ? String(row.staff_id) : null,
      service_id: row.service_id ? String(row.service_id) : null,
      customer_name: first(customers)?.full_name ?? null,
      service_name: first(services)?.name ?? null,
      staff_name: first(staff) ? getStaffAdminName(first(staff)!) : null,
    };
  });

  // ── Permission flags ─────────────────────────────────────────────────────────
  // CRM can manage resources for operational purposes
  const canManageResources = CRM_SPACES_ROLES.has(role);

  // CRM cannot edit booking rules — read-only view
  const canEditRules = ["owner", "manager", "assistant_manager", "store_manager"].includes(role);

  return (
    <SpacesRulesWorkspace
      workspaceContext="crm"
      viewerRole={role}
      branchId={branchId}
      branchName={branchName}
      branches={[{ id: branchId, name: branchName }]}
      resources={detail.resources}
      rules={rules}
      bookings={bookings}
      canSwitchBranch={false}
      canManageResources={canManageResources}
      canEditRules={canEditRules}
    />
  );
}

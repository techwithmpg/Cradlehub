import { redirect } from "next/navigation";
import { SpacesRulesWorkspace } from "@/components/features/spaces-rules/spaces-rules-workspace";
import { getAllBranches } from "@/lib/queries/branches";
import { getBranchWithFullDetail } from "@/lib/queries/branches";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { createClient } from "@/lib/supabase/server";

async function getOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || me.system_role !== "owner") redirect("/login");
}

export default async function OwnerSpacesRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  await getOwnerContext();

  const params = await searchParams;
  const [branches] = await Promise.all([getAllBranches()]);

  const selectedBranchId =
    params.branchId && branches.some((b) => b.id === params.branchId)
      ? params.branchId
      : branches[0]?.id ?? "";

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);

  if (branches.length === 0) {
    return (
      <div
        className="cs-card"
        style={{
          padding: "3rem 1.5rem",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 12 }}>🏢</div>
        <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
          No branches configured
        </div>
        <div>Create a branch first to manage spaces and rules.</div>
      </div>
    );
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0]!;

  const [detail, rules, bookingsResult] = await Promise.all([
    selectedBranchId
      ? getBranchWithFullDetail(selectedBranchId)
      : Promise.resolve({ branch: null, services: [], staff: [], resources: [] }),
    selectedBranchId
      ? getBranchBookingRulesOrDefault(selectedBranchId)
      : Promise.resolve({
          branchId: selectedBranchId,
          inSpaStartTime: "10:00",
          inSpaEndTime: "22:30",
          homeServiceEnabled: true,
          homeServiceStartTime: "14:30",
          homeServiceEndTime: "22:00",
          travelBufferMins: 30,
          maxAdvanceBookingDays: 30,
          homeServiceDriverCapacity: 1,
        }),
    selectedBranchId
      ? supabase
          .from("bookings")
          .select(
            `id, start_time, end_time, status, type, resource_id, staff_id, service_id,
            customers ( full_name ),
            services ( name ),
            staff ( full_name )`
          )
          .eq("branch_id", selectedBranchId)
          .eq("booking_date", today)
          .not("status", "in", '("cancelled","no_show")')
      : Promise.resolve({ data: [] }),
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
      | { full_name: string }
      | { full_name: string }[]
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
      staff_name: first(staff)?.full_name ?? null,
    };
  });

  return (
    <SpacesRulesWorkspace
      workspaceContext="owner"
      viewerRole="owner"
      branchId={selectedBranchId}
      branchName={selectedBranch?.name ?? ""}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
      resources={detail.resources}
      rules={rules}
      bookings={bookings}
      canSwitchBranch={true}
      canManageResources={true}
      canEditRules={true}
    />
  );
}

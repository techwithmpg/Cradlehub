import { redirect } from "next/navigation";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { isDevAuthBypassEnabled, getDevBypassLayoutStaff } from "@/lib/dev-bypass";
import { getCrmSetupHealth } from "@/lib/queries/crm-setup";
import { getBranchServicesForManagement } from "@/lib/queries/branches";
import { getBranchStaffAndServiceAssignments } from "@/lib/queries/crm-services";
import { getBranchWithFullDetail } from "@/lib/queries/branches";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { getStaffAdminName } from "@/lib/staff/display-name";
import { canManageCrmSetup, canManageResources } from "@/lib/auth/crm-permissions";
import { canonicalizeSystemRole } from "@/constants/staff";
import { SetupHealthContent } from "@/components/features/setup-center/setup-health-content";
import { CrmSetupWorkspace } from "@/components/features/crm/setup/crm-setup-workspace";
import type { SetupTab } from "@/components/features/crm/setup/crm-setup-workspace";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import type { ConflictBooking } from "@/components/features/spaces-rules/spaces-rules-utils";
import { getBranchBusinessDate } from "@/lib/engine/slot-time";

// ── Auth ────────────────────────────────────────────────────────────────────

type PageContext = {
  branchId: string;
  branchName: string;
  role: string;
};

async function getPageContext(): Promise<PageContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("branch_id, branches(name), system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me && isDevAuthBypassEnabled()) {
    const mock = getDevBypassLayoutStaff();
    return {
      branchId:   mock.branch_id as string,
      branchName: (mock.branches as { name: string }).name,
      role:       mock.system_role as string,
    };
  }

  const role = me ? canonicalizeSystemRole(me.system_role as string) : "";
  if (!me || !canManageCrmSetup(role) || !me.branch_id) {
    redirect("/crm");
  }

  return {
    branchId:   me.branch_id as string,
    branchName: (me.branches as { name: string } | null)?.name ?? "Your Branch",
    role,
  };
}

// ── Tab resolver ─────────────────────────────────────────────────────────────

function resolveTab(raw: string | undefined): SetupTab {
  if (!raw) return "health";
  switch (raw) {
    case "health":                           return "health";
    case "services":
    case "customization":
    case "assignments":                      return "services";
    case "providers":
    case "staff":
    case "capabilities":                     return "providers";
    case "spaces":
    case "spaces-rules":
    case "overview":                         return "spaces";
    case "booking_rules":
    case "rules":                            return "booking_rules";
    case "staff_readiness":                  return "staff_readiness";
    case "public_readiness":
    case "readiness":
    case "issues":
    case "public":                           return "public_readiness";
    default:                                 return "health";
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isActiveBranchService(s: ServiceLite): s is ActiveBranchService {
  return s.is_active && s.services !== null;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CrmSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ branchId, branchName, role }, params] = await Promise.all([
    getPageContext(),
    searchParams,
  ]);

  const initialTab = resolveTab(params.tab);

  const supabase = await createClient();
  const today = getBranchBusinessDate();

  // ── Phase 1: parallel data fetching ────────────────────────────────────────
  const [
    healthResult,
    servicesResult,
    branchDetailResult,
    rulesResult,
    bookingsResult,
  ] = await Promise.allSettled([
    getCrmSetupHealth(branchId),
    getBranchServicesForManagement(branchId),
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

  // ── Health ──────────────────────────────────────────────────────────────────
  if (healthResult.status === "rejected") {
    return (
      <CrmOperationalPageShell
        title="Admin & Setup"
        description="Configure services, providers, spaces, and booking readiness."
        context={`${branchName} · ${role}`}
      >
        <Alert variant="destructive">
          <AlertTitle>Could not load setup data</AlertTitle>
          <AlertDescription>
            Failed to run the setup health check. Please refresh the page.
          </AlertDescription>
        </Alert>
      </CrmOperationalPageShell>
    );
  }
  const health = healthResult.value;

  // ── Services data ───────────────────────────────────────────────────────────
  const rawServices = servicesResult.status === "fulfilled"
    ? (servicesResult.value as ServiceLite[])
    : [];
  const activeServices = rawServices.filter(isActiveBranchService);
  const activeServiceIds = activeServices.map(
    (s) => s.service_id ?? s.services.id
  );

  // Phase 2: staff assignments (depends on activeServiceIds)
  let providerStaff: Awaited<ReturnType<typeof getBranchStaffAndServiceAssignments>>["staff"] = [];
  let providerAssignments: Awaited<ReturnType<typeof getBranchStaffAndServiceAssignments>>["assignments"] = [];

  try {
    const pa = await getBranchStaffAndServiceAssignments(branchId, activeServiceIds);
    providerStaff = pa.staff;
    providerAssignments = pa.assignments;
  } catch {
    // non-fatal — services tabs can render without assignment data
  }

  // ── Spaces data ─────────────────────────────────────────────────────────────
  const branchDetail = branchDetailResult.status === "fulfilled"
    ? branchDetailResult.value
    : { resources: [] as Awaited<ReturnType<typeof getBranchWithFullDetail>>["resources"] };
  const rules = rulesResult.status === "fulfilled"
    ? rulesResult.value
    : { id: null } as unknown as Awaited<ReturnType<typeof getBranchBookingRulesOrDefault>>;

  // Transform bookings for SpacesRulesWorkspace
  const first = <T,>(v: T | T[] | null): T | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  };

  const bookings: ConflictBooking[] =
    bookingsResult.status === "fulfilled" && bookingsResult.value.data
      ? (bookingsResult.value.data as unknown[]).map((b) => {
          const row = b as Record<string, unknown>;
          const customers = row.customers as { full_name: string } | { full_name: string }[] | null;
          const services  = row.services  as { name: string }       | { name: string }[]       | null;
          const staff     = row.staff     as { full_name: string; nickname?: string | null }
                                          | { full_name: string; nickname?: string | null }[]
                                          | null;
          return {
            id:          String(row.id),
            start_time:  String(row.start_time),
            end_time:    String(row.end_time),
            status:      String(row.status),
            type:        String(row.type),
            resource_id: row.resource_id ? String(row.resource_id) : null,
            staff_id:    row.staff_id    ? String(row.staff_id)    : null,
            service_id:  row.service_id  ? String(row.service_id)  : null,
            customer_name: first(customers)?.full_name ?? null,
            service_name:  first(services)?.name       ?? null,
            staff_name:    first(staff) ? getStaffAdminName(first(staff)!) : null,
          };
        })
      : [];

  const canManageResourceRows = canManageResources(role);
  const canEditRules = canManageCrmSetup(role);

  return (
    <CrmOperationalPageShell
      title="Admin & Setup"
      description="Configure services, providers, spaces, and booking readiness."
      context={`${branchName} · ${role}`}
    >
      <CrmSetupWorkspace
        initialTab={initialTab}
        health={health}
        /* SetupHealthContent is a Server Component — passed as a pre-rendered slot */
        healthSlot={<SetupHealthContent data={health} />}
        servicesData={{
          branchId,
          branchName,
          services:           rawServices,
          allServices:        [],   // unused by CrmServicesWorkspace currently
          loadError:          servicesResult.status === "rejected" ? "Could not load services." : null,
          providerStaff,
          providerAssignments,
          reviewerSystemRole: role,
        }}
        spacesData={{
          workspaceContext:   "crm",
          viewerRole:         role,
          branchId,
          branchName,
          branches:           [{ id: branchId, name: branchName }],
          resources:          branchDetail.resources,
          rules,
          bookings,
          canSwitchBranch:    false,
          canManageResources: canManageResourceRows,
          canEditRules,
        }}
      />

      <div className="border-t border-[var(--cs-border-soft)] pt-3 text-[0.6875rem] text-[var(--cs-text-muted)]">
        {branchName} · Health check runs on every page load against live data
      </div>
    </CrmOperationalPageShell>
  );
}

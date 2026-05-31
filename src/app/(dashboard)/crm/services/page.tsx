import { redirect } from "next/navigation";
import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { CrmServicesWorkspace } from "@/components/features/crm/services/crm-services-workspace";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getBranchServicesForManagement } from "@/lib/queries/branches";
import { getBranchStaffAndServiceAssignments } from "@/lib/queries/crm-services";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import { createClient } from "@/lib/supabase/server";

// ── Auth helpers ───────────────────────────────────────────────────────────────

type BranchRelation = { name: string } | Array<{ name: string }> | null;
type StaffContext = {
  system_role: string;
  branch_id: string | null;
  branches: BranchRelation;
};

const CRM_SERVICE_ROLES = new Set([
  "owner", "manager", "assistant_manager", "store_manager",
  "crm", "csr_head", "csr_staff", "csr",
]);

function firstBranchName(branches: BranchRelation) {
  if (!branches) return "your assigned branch";
  return Array.isArray(branches)
    ? (branches[0]?.name ?? "your assigned branch")
    : branches.name;
}

function isActiveBranchService(s: ServiceLite): s is ActiveBranchService {
  return s.is_active && s.services !== null;
}

// ── Data queries ───────────────────────────────────────────────────────────────

async function getAllActiveServices(): Promise<GlobalService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []) as GlobalService[];
}

async function getCrmServicesPageData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { status: "unauthorized" as const };

  const { data: staff, error: staffError } = await supabase
    .from("staff")
    .select("system_role, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError) {
    console.error("[crm/services] staff lookup failed", {
      message: staffError.message,
      code: staffError.code,
    });
    return { status: "unauthorized" as const };
  }

  const me =
    (staff as StaffContext | null) ??
    (isDevAuthBypassEnabled()
      ? {
          system_role: getDevBypassLayoutStaff().system_role,
          branch_id: getDevBypassLayoutStaff().branch_id,
          branches: getDevBypassLayoutStaff().branches,
        }
      : null);

  if (!me || !CRM_SERVICE_ROLES.has(me.system_role)) {
    return { status: "unauthorized" as const };
  }

  if (!me.branch_id) {
    return {
      status: "missing_branch" as const,
      branchName: firstBranchName(me.branches),
    };
  }

  const branchId = me.branch_id;

  const [servicesResult, allServicesResult] = await Promise.allSettled([
    getBranchServicesForManagement(branchId),
    getAllActiveServices(),
  ]);

  let services: ServiceLite[] = [];
  let loadError: string | null = null;

  if (servicesResult.status === "fulfilled") {
    services = servicesResult.value as ServiceLite[];
  } else {
    loadError = "Unable to load branch services.";
    console.error("[crm/services] branch services query failed", {
      branchId,
      error: servicesResult.reason instanceof Error
        ? servicesResult.reason.message
        : String(servicesResult.reason),
    });
  }

  let allServices: GlobalService[] = [];
  if (allServicesResult.status === "fulfilled") {
    allServices = allServicesResult.value;
  } else {
    console.error("[crm/services] catalog services query failed", {
      branchId,
      error: allServicesResult.reason instanceof Error
        ? allServicesResult.reason.message
        : String(allServicesResult.reason),
    });
  }

  const activeServices = services.filter(isActiveBranchService);
  const activeServiceIds = activeServices.map(
    (s) => s.service_id ?? s.services.id
  );

  let providerStaff: Awaited<ReturnType<typeof getBranchStaffAndServiceAssignments>>["staff"] = [];
  let providerAssignments: Awaited<ReturnType<typeof getBranchStaffAndServiceAssignments>>["assignments"] = [];

  try {
    const pa = await getBranchStaffAndServiceAssignments(branchId, activeServiceIds);
    providerStaff = pa.staff;
    providerAssignments = pa.assignments;
  } catch (err) {
    console.error("[crm/services] provider assignment fetch failed", {
      branchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    status: "ready" as const,
    branchId,
    branchName: firstBranchName(me.branches),
    reviewerSystemRole: me.system_role,
    services,
    allServices,
    loadError,
    activeServices,
    providerStaff,
    providerAssignments,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CrmServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [result, params] = await Promise.all([
    getCrmServicesPageData(),
    searchParams,
  ]);

  if (result.status === "unauthorized") redirect("/crm");

  const initialTab = ((): "services" | "customization" | "providers" | "readiness_issues" => {
    if (params.tab === "services" || params.tab === "assignments") return "services";
    if (params.tab === "customization") return "customization";
    if (params.tab === "providers" || params.tab === "staff" || params.tab === "capabilities") return "providers";
    if (params.tab === "readiness" || params.tab === "issues") return "readiness_issues";
    return "services";
  })();

  return (
    <section className="space-y-5">
      <PageHeader
        title="Services"
        description="Manage and customize your services for in-spa and home-service."
        icon="✨"
      />

      {result.status === "missing_branch" ? (
        <Alert variant="destructive">
          <AlertTitle>Could not resolve your assigned branch.</AlertTitle>
          <AlertDescription>
            Your profile is not linked to an active branch. Contact your manager
            or owner to assign you to a branch.
          </AlertDescription>
        </Alert>
      ) : (
        <CrmServicesWorkspace
          branchId={result.branchId}
          branchName={result.branchName}
          services={result.services}
          allServices={result.allServices}
          loadError={result.loadError}
          activeServices={result.activeServices}
          providerStaff={result.providerStaff}
          providerAssignments={result.providerAssignments}
          reviewerSystemRole={result.reviewerSystemRole}
          initialTab={initialTab}
        />
      )}
    </section>
  );
}

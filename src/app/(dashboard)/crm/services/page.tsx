import { redirect } from "next/navigation";
import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { ServicesOfferedTab } from "@/components/features/manager-settings/services-offered-tab";
import { getDevBypassLayoutStaff, isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { getBranchServicesForManagement } from "@/lib/queries/branches";
import { createClient } from "@/lib/supabase/server";

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

type BranchRelation = { name: string } | Array<{ name: string }> | null;
type StaffContext = {
  system_role: string;
  branch_id: string | null;
  branches: BranchRelation;
};

// All roles that may manage services from the CRM workspace.
// Tighten this list when the system goes live.
const CRM_SERVICE_ROLES = new Set([
  "owner",
  "manager",
  "assistant_manager",
  "store_manager",
  "crm",
  "csr_head",
]);

function firstBranchName(branches: BranchRelation) {
  if (!branches) return "your assigned branch";
  return Array.isArray(branches)
    ? (branches[0]?.name ?? "your assigned branch")
    : branches.name;
}

async function getCrmServicesPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const [servicesResult, allServicesResult] = await Promise.allSettled([
    getBranchServicesForManagement(me.branch_id),
    getAllActiveServices(),
  ]);

  let services: ServiceLite[] = [];
  let loadError: string | null = null;
  if (servicesResult.status === "fulfilled") {
    services = servicesResult.value as ServiceLite[];
  } else {
    loadError = "Unable to load branch services.";
    console.error("[crm/services] branch services query failed", {
      branchId: me.branch_id,
      error:
        servicesResult.reason instanceof Error
          ? servicesResult.reason.message
          : String(servicesResult.reason),
    });
  }

  let allServices: GlobalService[] = [];
  if (allServicesResult.status === "fulfilled") {
    allServices = allServicesResult.value;
  } else {
    console.error("[crm/services] catalog services query failed", {
      branchId: me.branch_id,
      error:
        allServicesResult.reason instanceof Error
          ? allServicesResult.reason.message
          : String(allServicesResult.reason),
    });
  }

  return {
    status: "ready" as const,
    branchId: me.branch_id,
    branchName: firstBranchName(me.branches),
    services,
    allServices,
    loadError,
  };
}

export default async function CrmServicesPage() {
  const result = await getCrmServicesPageData();

  if (result.status === "unauthorized") redirect("/crm");

  return (
    <section className="space-y-5">
      <PageHeader
        title="Services"
        description="Manage the service menu for your branch."
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
        <ServicesOfferedTab
          branchId={result.branchId}
          services={result.services}
          allServices={result.allServices}
          loadError={result.loadError}
        />
      )}
    </section>
  );
}

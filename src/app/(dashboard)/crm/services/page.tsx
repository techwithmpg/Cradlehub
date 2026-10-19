import { redirect } from "next/navigation";
import { CrmOperationalPageShell } from "@/components/features/crm/operational/crm-operational-page-shell";
import { CrmServicesWorkspace } from "@/components/features/crm/services/crm-services-workspace";
import { OwnerAddServiceAction } from "@/components/features/crm/services/owner-add-service-action";
import { getFrontDeskContext } from "@/lib/queries/crm-context";
import { getBranchStaffAndServiceAssignments } from "@/lib/queries/crm-services";
import { getBranchBookingRulesOrDefault } from "@/lib/queries/branch-booking-rules";
import { getBranchAssignableServices, getBranchServiceCatalog } from "@/lib/services/service-catalog";
import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { ActiveBranchService } from "@/components/features/manager-settings/types";
import { getAllCategories } from "@/lib/queries/services";
import { getAllBranches } from "@/lib/queries/branches";

export default async function CrmServicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [context, params] = await Promise.all([getFrontDeskContext(), searchParams]);
  if (!context.capabilities.canManageCrmSetup) redirect("/crm");

  // Preserve existing links to supporting service views. The catalog and its
  // provider editor are the primary operational workspace.
  if (["providers", "staff", "capabilities"].includes(params.tab ?? "")) {
    redirect("/crm/setup?tab=providers");
  }
  if (["issues", "readiness_issues", "readiness", "public", "public_readiness"].includes(params.tab ?? "")) {
    redirect("/crm/setup?tab=public_readiness");
  }

  const { branchId, branchName, role } = context;
  const [servicesResult, assignableResult, rulesResult] = await Promise.allSettled([
    getBranchServiceCatalog(branchId, {
      audience: "management",
      includeInactiveBranchRows: true,
      includeUnavailableDeliveryModes: true,
    }),
    getBranchAssignableServices(branchId),
    getBranchBookingRulesOrDefault(branchId),
  ]);

  const services = servicesResult.status === "fulfilled" ? servicesResult.value as ServiceLite[] : [];
  const activeServices = services.filter((service): service is ActiveBranchService => service.is_active && service.services !== null);
  const homeServiceEnabled = rulesResult.status === "fulfilled" && rulesResult.value.homeServiceEnabled;
  const assignableServices = assignableResult.status === "fulfilled"
    ? assignableResult.value as ServiceLite[]
    : activeServices.filter((service) =>
        (service.available_in_spa ?? true) || (homeServiceEnabled && (service.available_home_service ?? false))
      );

  const serviceIds = assignableServices.map((service) => {
    const nested = Array.isArray(service.services) ? service.services[0] : service.services;
    return service.service_id ?? nested?.id ?? null;
  }).filter((id): id is string => id !== null);

  const assignmentResult = await Promise.allSettled([
    getBranchStaffAndServiceAssignments(branchId, serviceIds),
  ]);
  const assignmentData = assignmentResult[0]?.status === "fulfilled" ? assignmentResult[0].value : null;
  const ownerOptions = role === "owner"
    ? await Promise.all([getAllCategories(), getAllBranches()])
    : null;
  const loadError = servicesResult.status === "rejected"
    ? "Could not load services."
    : !assignmentData
      ? "Could not load provider assignments."
      : null;

  return (
    <CrmOperationalPageShell
      title="Services & Providers"
      description="Manage services, provider coverage, and service setup."
      context={`${branchName} · ${role}`}
      actions={ownerOptions ? <OwnerAddServiceAction
        categories={ownerOptions[0].map(({ id, name }) => ({ id, name }))}
        branches={ownerOptions[1].map(({ id, name }) => ({ id, name }))}
      /> : undefined}
    >
      <CrmServicesWorkspace
        branchId={branchId}
        branchName={branchName}
        services={services}
        assignableServices={assignableServices}
        allServices={[]}
        loadError={loadError}
        providerStaff={assignmentData?.staff ?? []}
        providerAssignments={assignmentData?.assignments ?? []}
        homeServiceEnabled={homeServiceEnabled}
        reviewerSystemRole={role}
        initialTab="services"
        compactNavigation
      />
    </CrmOperationalPageShell>
  );
}

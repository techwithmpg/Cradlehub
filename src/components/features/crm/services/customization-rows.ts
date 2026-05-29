import type { ServiceLite } from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { StaffForServicePanel, ServiceAssignmentRow } from "@/lib/queries/crm-services";
import { isValidProvider } from "./crm-therapist-assignment-tab";

export type CustomizationRow = {
  branchServiceId: string;
  serviceId: string;
  name: string;
  category: string | null;
  description: string | null;
  duration: number;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  isInSpa: boolean;
  isHomeService: boolean;
  visibility: string;
  deliveryMode: "in_spa" | "home_service" | "both" | "hidden";
  assignedProviders: StaffForServicePanel[];
  providerCount: number;
  isReady: boolean;
  readinessIssues: string[];
};

export function buildCustomizationRows(
  services: ServiceLite[],
  staff: StaffForServicePanel[],
  assignments: ServiceAssignmentRow[]
): CustomizationRow[] {
  const assignMap = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = assignMap.get(a.service_id) ?? new Set<string>();
    set.add(a.staff_id);
    assignMap.set(a.service_id, set);
  }

  const staffById = new Map(staff.map((s) => [s.id, s]));

  return services.map((svc) => {
    const serviceId = svc.service_id ?? svc.services?.id ?? svc.id;
    const assignedIds = assignMap.get(serviceId) ?? new Set<string>();
    const assignedProviders = Array.from(assignedIds)
      .map((id) => staffById.get(id))
      .filter((s): s is StaffForServicePanel => s !== undefined && isValidProvider(s));

    const isActive = svc.is_active;
    const isInSpa = svc.available_in_spa ?? true;
    const isHomeService = svc.available_home_service ?? false;

    let deliveryMode: CustomizationRow["deliveryMode"] = "hidden";
    if (isActive) {
      if (isInSpa && isHomeService) deliveryMode = "both";
      else if (isInSpa) deliveryMode = "in_spa";
      else if (isHomeService) deliveryMode = "home_service";
      else deliveryMode = "hidden";
    }

    // Schema: visibility IN ('public', 'internal', 'hidden') — use visibility column directly.
    // booking_visibility is a legacy column name that may not exist in this schema.
    const visibility = svc.visibility ?? "public";

    const readinessIssues: string[] = [];
    if (!isActive) readinessIssues.push("Service is inactive");
    if (assignedProviders.length === 0) readinessIssues.push("Missing provider");
    if (visibility !== "public") readinessIssues.push("Not public");

    const isReady =
      isActive &&
      assignedProviders.length > 0 &&
      visibility === "public";

    const catRel = svc.services?.service_categories;
    const category =
      catRel === null || catRel === undefined
        ? null
        : Array.isArray(catRel)
        ? (catRel[0]?.name ?? null)
        : catRel.name ?? null;

    return {
      branchServiceId: svc.id,
      serviceId,
      name: svc.public_title?.trim() || svc.services?.name || "Unnamed Service",
      category,
      description: svc.public_description?.trim() || svc.services?.description || null,
      duration: svc.custom_duration_minutes ?? svc.services?.duration_minutes ?? 0,
      price: svc.custom_price ?? svc.services?.price ?? 0,
      imageUrl: svc.custom_image_url ?? (svc.services as Record<string, unknown> | null | undefined)?.image_url as string | null ?? null,
      isActive,
      isInSpa,
      isHomeService,
      visibility,
      deliveryMode,
      assignedProviders,
      providerCount: assignedProviders.length,
      isReady,
      readinessIssues,
    };
  });
}

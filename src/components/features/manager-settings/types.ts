import type {
  GlobalService,
  ServiceLite,
} from "@/app/(dashboard)/owner/branches/[branchId]/branch-services-panel";
import type { BranchBookingRules } from "@/lib/bookings/booking-rules-config";
import type { SchedulingRules } from "@/lib/scheduling/types";

export type ManagerSettingsTab =
  | "overview"
  | "booking"
  | "services"
  | "scheduling"
  | "advanced";

export type ManagerSettingsWarningSeverity = "warning" | "critical";

export type ManagerSettingsWarning = {
  id: string;
  title: string;
  description: string;
  severity: ManagerSettingsWarningSeverity;
};

export type ActiveBranchService = ServiceLite & {
  services: NonNullable<ServiceLite["services"]>;
};

export type ManagerSettingsMetrics = {
  activeServicesCount: number;
  inSpaEligibleCount: number;
  homeServiceEligibleCount: number;
  publicServicesCount: number;
  activeServices: ActiveBranchService[];
  healthScore: number;
  warnings: ManagerSettingsWarning[];
};

export type ManagerSettingsWorkspaceProps = {
  branchId: string;
  bookingRules: BranchBookingRules;
  services: ServiceLite[];
  allServices: GlobalService[];
  schedulingRules: SchedulingRules;
};

export const MANAGER_SETTINGS_TABS: Array<{
  id: ManagerSettingsTab;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "booking", label: "Booking Rules" },
  { id: "services", label: "Services Offered" },
  { id: "scheduling", label: "Scheduling Automation" },
  { id: "advanced", label: "Advanced / Safety" },
];

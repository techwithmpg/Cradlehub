/**
 * Shared types for the CRM Services & Therapist Setup components.
 * Imported by both server components (panel) and client components (assignment card).
 */

import type { StaffForServicePanel } from "@/lib/queries/crm-services";

export type ServiceRow = {
  /** branch_services.id */
  branchServiceId: string;
  /** global services.id (used in staff_services) */
  serviceId: string;
  name: string;
  category: string | null;
  isInSpa: boolean;
  isHomeService: boolean;
  /** "public" | "csr_only" | "vip" */
  visibility: string;
  /** Staff assigned to this service who are valid providers */
  assignedProviders: StaffForServicePanel[];
  /**
   * Valid service-provider staff at this branch who are NOT yet assigned.
   * Populated from the full branch staff list filtered by SERVICE_STAFF_TYPES
   * and HARD_EXCLUDED_SYSTEM_ROLES.
   */
  assignableProviders: StaffForServicePanel[];
  /** public + 0 valid providers → online booking cannot show therapists */
  isCritical: boolean;
  /** any visibility + 0 valid providers */
  isWarning: boolean;
};

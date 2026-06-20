import type { ServiceAssignmentRow } from "@/lib/queries/crm-services";

export function replaceStaffServiceAssignmentRows(
  currentRows: ServiceAssignmentRow[],
  staffId: string,
  serviceIds: string[]
): ServiceAssignmentRow[] {
  const retainedRows = currentRows.filter((row) => row.staff_id !== staffId);
  const replacementRows = Array.from(new Set(serviceIds)).map((serviceId) => ({
    staff_id: staffId,
    service_id: serviceId,
  }));

  return [...retainedRows, ...replacementRows];
}

import type { AttendanceQrPoint } from "@/lib/attendance/types";

export function getSelectedQrPoints(
  points: readonly AttendanceQrPoint[],
  selectedIds: ReadonlySet<string>,
  selectedQr: AttendanceQrPoint | null
): AttendanceQrPoint[] {
  const selected = points.filter((point) => selectedIds.has(point.id));
  if (selected.length > 0) return selected;
  return selectedQr ? [selectedQr] : [];
}

export function getActiveRoomQrPoints(points: readonly AttendanceQrPoint[]): AttendanceQrPoint[] {
  return points
    .filter((point) => {
      if (!point.is_active || point.resource_is_active === false || !point.resource_id)
        return false;
      if (point.resource_type === "room") return true;
      return point.resource_type === null && point.point_type === "room";
    })
    .sort((left, right) => {
      const leftName = left.resource_name ?? left.label;
      const rightName = right.resource_name ?? right.label;
      return leftName.localeCompare(rightName, undefined, { numeric: true, sensitivity: "base" });
    });
}

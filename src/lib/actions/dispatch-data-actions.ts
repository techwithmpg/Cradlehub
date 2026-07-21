"use server";

import { getAttendanceActionContext } from "@/lib/attendance/queries";
import { getDispatchData, type DispatchData } from "@/lib/queries/dispatch-queries";

export async function refreshDispatchDataAction(
  date: string
): Promise<{ success: true; data: DispatchData } | { success: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: "Dispatch date is invalid." };
  }

  const context = await getAttendanceActionContext();
  if (!context) return { success: false, error: "Dispatch access is no longer available." };

  try {
    return {
      success: true,
      data: await getDispatchData({ branchId: context.branchId, date }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Dispatch data could not be refreshed.",
    };
  }
}

import { z } from "zod";
import {
  withDesktopStaffContext,
  desktopStaffJson,
  desktopStaffFailure,
  mapServiceCodeToHttpStatus,
} from "@/lib/staff/desktop-staff-contract";
import { deactivateStaffService } from "@/lib/staff/staff-mutation-service";

export async function POST(request: Request, route: { params: Promise<{ staffId: string }> }) {
  return withDesktopStaffContext(request, async ({ actor }) => {
    const params = await route.params;
    const parsedStaffId = z.guid("Invalid staff ID").safeParse(params.staffId);
    if (!parsedStaffId.success) {
      return desktopStaffFailure("INVALID_INPUT", "Invalid staff ID.", 400);
    }

    const result = await deactivateStaffService({
      actor,
      staffId: parsedStaffId.data,
    });

    if (!result.ok) {
      return desktopStaffFailure(
        result.code,
        result.error,
        mapServiceCodeToHttpStatus(result.code)
      );
    }

    return desktopStaffJson({ ok: true, data: result.data });
  });
}

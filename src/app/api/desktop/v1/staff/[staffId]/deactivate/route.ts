import { z } from "zod";
import {
  withDesktopStaffContext,
  desktopStaffJson,
  desktopStaffFailure,
  mapServiceCodeToHttpStatus,
} from "@/lib/staff/desktop-staff-contract";
import { deactivateStaffService } from "@/lib/staff/staff-mutation-service";

const deactivateBodySchema = z.object({}).strict();

export async function POST(request: Request, route: { params: Promise<{ staffId: string }> }) {
  return withDesktopStaffContext(request, async ({ actor }) => {
    const params = await route.params;
    const parsedStaffId = z.guid("Invalid staff ID").safeParse(params.staffId);
    if (!parsedStaffId.success) {
      return desktopStaffFailure("INVALID_INPUT", "Invalid staff ID.", 400);
    }

    const rawText = await request.text().catch(() => "");
    let rawBody: unknown = {};
    if (rawText.trim().length > 0) {
      try {
        rawBody = JSON.parse(rawText);
      } catch {
        return desktopStaffFailure("INVALID_INPUT", "Malformed JSON request body.", 400);
      }
    }

    const parsedBody = deactivateBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return desktopStaffFailure(
        "INVALID_INPUT",
        parsedBody.error.issues[0]?.message ?? "Invalid deactivation request body.",
        400
      );
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

import { z } from "zod";
import {
  withDesktopStaffContext,
  desktopStaffJson,
  desktopStaffFailure,
  mapServiceCodeToHttpStatus,
} from "@/lib/staff/desktop-staff-contract";
import { updateStaffProfileService } from "@/lib/staff/staff-mutation-service";
import { STAFF_TYPES } from "@/constants/staff";

const optionalNickname = z.preprocess(
  (val) => (typeof val === "string" && val.trim().length > 0 ? val.trim() : null),
  z.string().max(80, "Nickname must be 80 characters or fewer").nullable().optional()
);

const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Name required").max(100).optional(),
  nickname: optionalNickname,
  phone: z.string().min(7, "Phone too short").max(20, "Phone too long").optional(),
  tier: z.enum(["senior", "mid", "junior", "head", "n/a"]).optional(),
  staffType: z.enum(STAFF_TYPES).optional(),
  isHead: z.boolean().optional(),
});

export async function PATCH(request: Request, route: { params: Promise<{ staffId: string }> }) {
  return withDesktopStaffContext(request, async ({ actor }) => {
    const params = await route.params;
    const parsedStaffId = z.guid("Invalid staff ID").safeParse(params.staffId);
    if (!parsedStaffId.success) {
      return desktopStaffFailure("INVALID_INPUT", "Invalid staff ID.", 400);
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = updateProfileSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return desktopStaffFailure(
        "INVALID_INPUT",
        parsedBody.error.issues[0]?.message ?? "Invalid profile parameters.",
        400
      );
    }

    const result = await updateStaffProfileService({
      actor,
      staffId: parsedStaffId.data,
      input: parsedBody.data,
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

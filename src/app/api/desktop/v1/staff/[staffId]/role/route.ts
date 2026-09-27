import { z } from "zod";
import {
  withDesktopStaffContext,
  desktopStaffJson,
  desktopStaffFailure,
  mapServiceCodeToHttpStatus,
} from "@/lib/staff/desktop-staff-contract";
import { assignStaffRoleService } from "@/lib/staff/staff-mutation-service";
import { SYSTEM_ROLES, canonicalizeSystemRole } from "@/constants/staff";

const systemRoleInputSchema = z
  .string()
  .refine(
    (role) => SYSTEM_ROLES.includes(role as (typeof SYSTEM_ROLES)[number]),
    "Invalid system role"
  )
  .transform((role) => canonicalizeSystemRole(role));

const assignRoleSchema = z.object({
  systemRole: systemRoleInputSchema,
});

export async function POST(request: Request, route: { params: Promise<{ staffId: string }> }) {
  return withDesktopStaffContext(request, async ({ actor }) => {
    const params = await route.params;
    const parsedStaffId = z.guid("Invalid staff ID").safeParse(params.staffId);
    if (!parsedStaffId.success) {
      return desktopStaffFailure("INVALID_INPUT", "Invalid staff ID.", 400);
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = assignRoleSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return desktopStaffFailure(
        "INVALID_INPUT",
        parsedBody.error.issues[0]?.message ?? "Invalid system role.",
        400
      );
    }

    const result = await assignStaffRoleService({
      actor,
      staffId: parsedStaffId.data,
      input: {
        systemRole: parsedBody.data.systemRole,
      },
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

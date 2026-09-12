import { z } from "zod";
import {
  withDesktopStaffContext,
  desktopStaffJson,
  desktopStaffFailure,
  mapServiceCodeToHttpStatus,
} from "@/lib/staff/desktop-staff-contract";
import { approveStaffOnboardingRequest } from "@/lib/staff/staff-onboarding-service";
import { SYSTEM_ROLES, canonicalizeSystemRole } from "@/constants/staff";

const systemRoleInputSchema = z
  .string()
  .refine(
    (role) => SYSTEM_ROLES.includes(role as (typeof SYSTEM_ROLES)[number]),
    "Invalid system role"
  )
  .transform((role) => canonicalizeSystemRole(role));

const approveBodySchema = z.object({
  branchId: z.guid("Invalid branch ID"),
  systemRole: systemRoleInputSchema,
  tier: z.enum(["senior", "mid", "junior", "head", "n/a"]),
  serviceIds: z.array(z.guid("Invalid service ID")).optional(),
});

export async function POST(request: Request, route: { params: Promise<{ requestId: string }> }) {
  return withDesktopStaffContext(request, async ({ actor }) => {
    const params = await route.params;
    const parsedRequestId = z.guid("Invalid request ID").safeParse(params.requestId);
    if (!parsedRequestId.success) {
      return desktopStaffFailure("INVALID_INPUT", "Invalid onboarding request ID.", 400);
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = approveBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return desktopStaffFailure(
        "INVALID_INPUT",
        parsedBody.error.issues[0]?.message ?? "Invalid approval parameters.",
        400
      );
    }

    const result = await approveStaffOnboardingRequest({
      actor,
      requestId: parsedRequestId.data,
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

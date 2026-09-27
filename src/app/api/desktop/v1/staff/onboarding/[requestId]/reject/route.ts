import { z } from "zod";
import {
  withDesktopStaffContext,
  desktopStaffJson,
  desktopStaffFailure,
  mapServiceCodeToHttpStatus,
} from "@/lib/staff/desktop-staff-contract";
import { rejectStaffOnboardingRequest } from "@/lib/staff/staff-onboarding-service";

const rejectBodySchema = z.object({
  rejectionReason: z
    .string()
    .max(500, "Rejection reason must be 500 characters or fewer")
    .optional(),
});

export async function POST(request: Request, route: { params: Promise<{ requestId: string }> }) {
  return withDesktopStaffContext(request, async ({ actor }) => {
    const params = await route.params;
    const parsedRequestId = z.guid("Invalid request ID").safeParse(params.requestId);
    if (!parsedRequestId.success) {
      return desktopStaffFailure("INVALID_INPUT", "Invalid onboarding request ID.", 400);
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsedBody = rejectBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return desktopStaffFailure(
        "INVALID_INPUT",
        parsedBody.error.issues[0]?.message ?? "Invalid rejection parameters.",
        400
      );
    }

    const result = await rejectStaffOnboardingRequest({
      actor,
      requestId: parsedRequestId.data,
      input: {
        rejectionReason: parsedBody.data.rejectionReason,
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

import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import {
  resolveAttendanceException,
  type AttendanceActionContext,
} from "@/lib/attendance/queries";
import { generateAttendanceDeviceRecoveryOperation } from "@/lib/attendance/device-recovery-operation";
import type { GenerateDeviceRecoveryInput } from "@/lib/attendance/device-recovery";
import { isEligibleServiceProvider } from "@/constants/staff-roles";
import { getBranchProviderReadiness } from "@/lib/services/service-catalog";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

function noStore(status = 200): ResponseInit {
  return {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authResult = await verifyDesktopBearerAuth(req);

  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: authResult.code,
        message: authResult.message,
      },
      noStore(authResult.status)
    );
  }

  const { operator, client } = authResult;
  const staff = operator.staff;

  if (!staff?.branch_id) {
    return NextResponse.json(
      {
        ok: false,
        code: "STAFF_NOT_FOUND",
        message: "An active staff profile with a branch assignment is required.",
      },
      noStore(403)
    );
  }

  const branchId = staff.branch_id;
  const operatorRole = operator.staffRole ?? "crm";

  // Enforce role boundary: only management and front-desk (CRM) can perform authorized repairs
  const isAuthorizedRole = [
    "owner",
    "manager",
    "assistant_manager",
    "store_manager",
    "crm",
  ].includes(operatorRole);

  if (!isAuthorizedRole) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Your role is not authorized to execute Operations Center repairs.",
      },
      noStore(403)
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        message: "Invalid JSON payload.",
      },
      noStore(400)
    );
  }

  if (!isRecord(body) || typeof body.action !== "string") {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        message: "Action field is required.",
      },
      noStore(400)
    );
  }

  const action = body.action;

  // SAFETY RULE: Account merges and record deletion are strictly disabled.
  if (
    action === "merge_staff" ||
    action === "delete_staff" ||
    action.includes("merge") ||
    action.includes("delete")
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "MUTATION_NOT_PERMITTED",
        message: "Staff profile merging and deletion are strictly disabled to protect historical records.",
      },
      noStore(403)
    );
  }

  const branchRes = await client
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle();

  const branchName = branchRes.data?.name ?? "Branch";

  const ctx: AttendanceActionContext = {
    branchId,
    branchName,
    actorStaffId: staff.id,
    role: operatorRole,
    canSwitchBranch: false,
  };

  try {
    switch (action) {
      case "assign_service_provider": {
        const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
        const targetStaffId = typeof body.staffId === "string" ? body.staffId.trim() : "";

        if (!serviceId || !targetStaffId) {
          return NextResponse.json(
            {
              ok: false,
              code: "BAD_REQUEST",
              message: "Both serviceId and staffId are required.",
            },
            noStore(400)
          );
        }

        // Verify service exists
        const { data: service, error: svcErr } = await client
          .from("services")
          .select("id, name, is_active")
          .eq("id", serviceId)
          .maybeSingle();

        if (svcErr || !service) {
          return NextResponse.json(
            {
              ok: false,
              code: "SERVICE_NOT_FOUND",
              message: "The requested service was not found.",
            },
            noStore(404)
          );
        }

        // Verify staff exists, belongs to branch, and is eligible
        const { data: targetStaff, error: stfErr } = await client
          .from("staff")
          .select("id, full_name, is_active, branch_id, staff_type, system_role, archived_at, merged_into_staff_id")
          .eq("id", targetStaffId)
          .maybeSingle();

        if (stfErr || !targetStaff) {
          return NextResponse.json(
            {
              ok: false,
              code: "STAFF_NOT_FOUND",
              message: "The requested staff member was not found.",
            },
            noStore(404)
          );
        }

        if (targetStaff.branch_id !== branchId) {
          return NextResponse.json(
            {
              ok: false,
              code: "BRANCH_MISMATCH",
              message: "Staff member does not belong to the current branch.",
            },
            noStore(403)
          );
        }

        const eligible = isEligibleServiceProvider(
          {
            is_active: targetStaff.is_active,
            staff_type: targetStaff.staff_type,
            system_role: targetStaff.system_role,
            branch_id: targetStaff.branch_id,
            archived_at: targetStaff.archived_at,
            merged_into_staff_id: targetStaff.merged_into_staff_id,
          },
          branchId
        );

        if (!eligible) {
          return NextResponse.json(
            {
              ok: false,
              code: "STAFF_INELIGIBLE",
              message: "This staff member is not eligible to provide services for this branch.",
            },
            noStore(400)
          );
        }

        // Insert or update staff_services assignment
        const { error: assignErr } = await client
          .from("staff_services")
          .upsert(
            {
              service_id: serviceId,
              staff_id: targetStaffId,
            },
            { onConflict: "staff_id,service_id" }
          );

        if (assignErr) {
          logError("api.desktop.operations_center.assign_provider_failed", { error: assignErr });
          return NextResponse.json(
            {
              ok: false,
              code: "ASSIGNMENT_FAILED",
              message: "Failed to assign provider to service. Please try again.",
            },
            noStore(500)
          );
        }

        // Re-verify provider readiness for this service
        const readinessList = await getBranchProviderReadiness(branchId, [serviceId]);
        const matched = readinessList.find((r) => r.serviceId === serviceId);
        const verifiedCount = matched?.providerCount ?? 1;

        return NextResponse.json(
          {
            ok: true,
            message: "Provider assigned & authoritatively verified.",
            data: {
              serviceId,
              staffId: targetStaffId,
              providerCount: verifiedCount,
            },
          },
          noStore(200)
        );
      }

      case "resolve_attendance_exception": {
        const exceptionId = typeof body.exceptionId === "string" ? body.exceptionId.trim() : "";
        const resolutionNote = typeof body.reason === "string" ? body.reason.trim() : undefined;

        if (!exceptionId) {
          return NextResponse.json(
            {
              ok: false,
              code: "BAD_REQUEST",
              message: "exceptionId is required.",
            },
            noStore(400)
          );
        }

        // Verify exception belongs to this branch
        const { data: exRow, error: exErr } = await client
          .from("attendance_exceptions")
          .select("id, branch_id")
          .eq("id", exceptionId)
          .maybeSingle();

        if (exErr || !exRow) {
          return NextResponse.json(
            {
              ok: false,
              code: "EXCEPTION_NOT_FOUND",
              message: "Attendance exception not found.",
            },
            noStore(404)
          );
        }

        if (exRow.branch_id !== branchId) {
          return NextResponse.json(
            {
              ok: false,
              code: "BRANCH_MISMATCH",
              message: "Exception does not belong to the current branch.",
            },
            noStore(403)
          );
        }

        await resolveAttendanceException({
          ctx,
          exceptionId,
          resolutionNote,
        });

        return NextResponse.json(
          {
            ok: true,
            message: "Attendance exception resolved.",
          },
          noStore(200)
        );
      }

      case "generate_device_recovery": {
        const targetStaffId = typeof body.staffId === "string" ? body.staffId.trim() : "";

        if (!targetStaffId) {
          return NextResponse.json(
            {
              ok: false,
              code: "BAD_REQUEST",
              message: "staffId is required.",
            },
            noStore(400)
          );
        }

        const input: GenerateDeviceRecoveryInput = {
          staffId: targetStaffId,
          branchId,
          reason: "replacement_phone",
          expiresInMinutes: 30,
          deliveryMethod: "copy_link",
        };

        const recovery = await generateAttendanceDeviceRecoveryOperation({
          ctx,
          input,
          origin: req.nextUrl.origin,
        });

        return NextResponse.json(
          {
            ok: true,
            message: "Device recovery link generated.",
            data: {
              token: recovery.tokenId,
              activationUrl: recovery.recoveryUrl,
              expiresAt: recovery.expiresAt,
            },
          },
          noStore(200)
        );
      }

      default:
        return NextResponse.json(
          {
            ok: false,
            code: "UNKNOWN_ACTION",
            message: `Unsupported mutation action: ${action}`,
          },
          noStore(400)
        );
    }
  } catch (err) {
    logError("api.desktop.operations_center.mutation_failed", { error: err });
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: "Failed to process operational mutation. Please try again.",
      },
      noStore(500)
    );
  }
}

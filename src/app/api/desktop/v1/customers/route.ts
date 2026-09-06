import { NextRequest, NextResponse } from "next/server";
import { verifyDesktopBearerAuth } from "@/lib/auth/desktop-bearer-auth";
import { executeDesktopCustomerList } from "@/lib/customers/desktop-customer-engine";
import { logError } from "@/lib/logger";

function mapDomainCodeToHttpStatus(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "STAFF_NOT_FOUND":
    case "CRM_PERMISSION_DENIED":
    case "CRM_BRANCH_FORBIDDEN":
      return 403;
    case "CUSTOMER_NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
    case "BRANCH_REQUIRED":
    case "BRANCH_NOT_FOUND":
    case "BRANCH_MISSING":
      return 400;
    case "SERVER_CONFIG_ERROR":
    case "SERVER_DATABASE_ERROR":
    default:
      return 500;
  }
}

export async function GET(req: NextRequest) {
  // 1. Verify Bearer token & authenticated staff context
  const authResult = await verifyDesktopBearerAuth(req);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: authResult.code,
        message: authResult.message,
      },
      {
        status: authResult.status,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  // 2. Parse query parameters
  const { searchParams } = req.nextUrl;
  const tab = searchParams.get("tab");
  const q = searchParams.get("q");
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");
  const branchId = searchParams.get("branchId");

  // 3. Delegate to the server-only desktop customer engine
  try {
    const result = await executeDesktopCustomerList(
      {
        tab,
        q,
        page,
        pageSize,
        branchId,
      },
      authResult.operator
    );

    if (!result.ok) {
      const status = mapDomainCodeToHttpStatus(result.code);
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: result.message,
        },
        {
          status,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logError("api.desktop.v1.customers.list.failed", { error: err });
    return NextResponse.json(
      {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Could not load customers. Please try again.",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}

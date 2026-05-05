import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { canCrmAccessPath, canCsrAccessPath, isCsr } from "@/lib/permissions";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";

/** Maps system_role → default dashboard workspace prefix */
const ROLE_WORKSPACE: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  assistant_manager: "/manager",
  store_manager: "/manager",
  crm: "/crm",
  csr: "/crm",
  csr_head: "/crm",
  csr_staff: "/crm",
  staff: "/staff-portal",
};

/** Job-function overrides for system_role = staff */
const STAFF_TYPE_WORKSPACE: Record<string, string> = {
  driver: "/driver",
  utility: "/utility",
};

const PROTECTED_PREFIXES = [
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/driver",
  "/utility",
  "/dev",
];

function resolveWorkspace(systemRole: string, staffType: string | null): string {
  if (systemRole === "owner") return "/owner";
  if (systemRole === "manager") return "/manager";
  if (systemRole === "assistant_manager") return "/manager";
  if (systemRole === "store_manager") return "/manager";
  if (systemRole === "crm") return "/crm";
  if (systemRole === "csr" || systemRole === "csr_head" || systemRole === "csr_staff") {
    return "/crm";
  }
  if (systemRole === "staff" && staffType) {
    return STAFF_TYPE_WORKSPACE[staffType] ?? "/staff-portal";
  }
  return ROLE_WORKSPACE[systemRole] ?? "/";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const devBypass = isDevAuthBypassEnabled();

  // Always refresh the session token
  const response = await updateSession(request);

  // Only enforce auth on dashboard routes
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return response;

  // Verify user is authenticated
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Dev-only bypass: let authenticated developers open all protected modules
  // even without a staff record (useful for local development/testing).
  if (devBypass) {
    return response;
  }

  // Get the user's role from the staff table
  const { data: staffRecord, error: staffError } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError) {
    console.error("Proxy staff lookup failed", {
      pathname,
      userId: user.id,
      email: user.email,
      message: staffError.message,
      code: staffError.code,
      details: staffError.details,
    });

    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!staffRecord) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Owner can access all workspaces for oversight/testing.
  if (staffRecord.system_role === "owner") {
    return response;
  }

  // CRM role can access CRM routes and booking-list operations pages only.
  if (staffRecord.system_role === "crm") {
    if (!canCrmAccessPath(pathname)) {
      return NextResponse.redirect(new URL("/crm", request.url));
    }
    return response;
  }

  // CSR roles have restricted cross-workspace access
  if (isCsr(staffRecord.system_role)) {
    if (!canCsrAccessPath(staffRecord.system_role, pathname)) {
      // Redirect to their default workspace
      return NextResponse.redirect(new URL("/crm", request.url));
    }
    return response;
  }

  const correctWorkspace = resolveWorkspace(staffRecord.system_role, null);

  // Redirect to the right workspace if they're at the wrong one
  if (correctWorkspace && !pathname.startsWith(correctWorkspace)) {
    return NextResponse.redirect(new URL(correctWorkspace, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};


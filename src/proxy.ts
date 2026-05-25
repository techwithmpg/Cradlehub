import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { canCrmAccessPath, canCsrAccessPath, isCsr } from "@/lib/permissions";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";

/** Maps system_role → default dashboard workspace prefix */
function resolveWorkspace(systemRole: string): string {
  if (systemRole === "owner") return "/owner";

  if (
    systemRole === "manager" ||
    systemRole === "assistant_manager" ||
    systemRole === "store_manager"
  ) {
    return "/manager";
  }

  if (
    systemRole === "crm" ||
    systemRole === "csr" ||
    systemRole === "csr_head" ||
    systemRole === "csr_staff"
  ) {
    return "/crm";
  }

  if (
    systemRole === "staff" ||
    systemRole === "service_head" ||
    systemRole === "service_staff"
  ) {
    return "/staff-portal";
  }

  if (systemRole === "driver") return "/driver";
  if (systemRole === "utility") return "/utility";

  return "/";
}

const PROTECTED_PREFIXES = [
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/driver",
  "/utility",
  "/dev",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const devBypass = isDevAuthBypassEnabled();

  // API routes are never in the protected dashboard prefixes and manage their
  // own auth via the request-scoped Supabase client. Skip the session refresh
  // (a Supabase network call) so timeouts here don't block every API request.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

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
    logError("proxy.staff_lookup_failed", { pathname, userId: user.id, error: staffError });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!staffRecord) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const systemRole = staffRecord.system_role;
  if (process.env.NODE_ENV === "development") {
    console.debug("[proxy] workspace route", { pathname, systemRole });
  }

  // Owner can access all workspaces for oversight/testing.
  if (systemRole === "owner") {
    return response;
  }

  // CRM role can access CRM routes and booking-list operations pages only.
  if (systemRole === "crm") {
    if (!canCrmAccessPath(pathname)) {
      return NextResponse.redirect(new URL("/crm", request.url));
    }
    return response;
  }

  // CSR roles have restricted cross-workspace access
  if (isCsr(systemRole)) {
    if (!canCsrAccessPath(systemRole, pathname)) {
      return NextResponse.redirect(new URL("/crm", request.url));
    }
    return response;
  }

  const correctWorkspace = resolveWorkspace(systemRole);

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

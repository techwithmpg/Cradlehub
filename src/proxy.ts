import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { canCrmAccessPath, canCsrAccessPath, isCsr } from "@/lib/permissions";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import {
  buildWorkspaceAccessFromStaffProfile,
  getWorkspaceSwitchDestination,
  hasWorkspaceAccess,
  type WorkspaceAccess,
  type WorkspaceStaffProfile,
} from "@/lib/auth/workspace-access";

const PROTECTED_PREFIXES = [
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/driver",
  "/utility",
  "/dev",
  "/select-workspace",
];

function canAccessProtectedPath(
  pathname: string,
  role: string,
  workspaces: readonly WorkspaceAccess[]
): boolean {
  if (pathname.startsWith("/select-workspace")) return workspaces.length > 0;

  if (pathname.startsWith("/crm")) {
    if (!hasWorkspaceAccess(workspaces, "crm")) return false;
    if (isCsr(role)) return canCsrAccessPath(role, pathname);
    if (role === "crm") return canCrmAccessPath(pathname);
    return true;
  }

  if (pathname.startsWith("/staff-portal")) {
    return hasWorkspaceAccess(workspaces, "staff_portal");
  }

  if (pathname.startsWith("/driver")) {
    return hasWorkspaceAccess(workspaces, "driver");
  }

  if (pathname.startsWith("/utility")) {
    return hasWorkspaceAccess(workspaces, "utility");
  }

  if (pathname.startsWith("/owner")) {
    return hasWorkspaceAccess(workspaces, "owner");
  }

  if (pathname.startsWith("/manager")) {
    return hasWorkspaceAccess(workspaces, "manager");
  }

  if (pathname.startsWith("/dev")) {
    return hasWorkspaceAccess(workspaces, "owner");
  }

  return true;
}

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

  const { data: staffRecord, error: staffError } = await supabase
    .from("staff")
    .select("id, full_name, system_role, staff_type, branch_id, branches(name)")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staffError) {
    logError("proxy.staff_lookup_failed", { pathname, userId: user.id, error: staffError });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!staffRecord) {
    return NextResponse.redirect(new URL("/account/setup", request.url));
  }

  const systemRole = staffRecord.system_role;
  const workspaces = buildWorkspaceAccessFromStaffProfile(staffRecord as WorkspaceStaffProfile);
  if (workspaces.length === 0) {
    return NextResponse.redirect(new URL("/account/setup", request.url));
  }

  if (!canAccessProtectedPath(pathname, systemRole, workspaces)) {
    return NextResponse.redirect(new URL(getWorkspaceSwitchDestination(workspaces), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

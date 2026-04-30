import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

/** Maps system_role → default dashboard workspace prefix */
const ROLE_WORKSPACE: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  crm: "/crm",
  staff: "/staff-portal",
};

/** Job-function overrides for system_role = staff */
const STAFF_TYPE_WORKSPACE: Record<string, string> = {
  driver: "/driver",
  utility: "/utility",
};

const PROTECTED_PREFIXES = ["/owner", "/manager", "/crm", "/staff-portal", "/driver", "/utility", "/dev"];

function resolveWorkspace(systemRole: string, staffType: string | null): string {
  if (systemRole === "owner") return "/owner";
  if (systemRole === "manager") return "/manager";
  if (systemRole === "crm") return "/crm";
  if (systemRole === "staff" && staffType) {
    return STAFF_TYPE_WORKSPACE[staffType] ?? "/staff-portal";
  }
  return ROLE_WORKSPACE[systemRole] ?? "/";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const devAllowAllModules =
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_ALLOW_ALL_MODULES === "true";

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
  if (devAllowAllModules) {
    return response;
  }

  // Get the user's role and job function from the staff table
  const { data: staffRecord } = await supabase
    .from("staff")
    .select("system_role, staff_type")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!staffRecord) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Owner can access all workspaces for oversight/testing.
  if (staffRecord.system_role === "owner") {
    return response;
  }

  const correctWorkspace = resolveWorkspace(staffRecord.system_role, staffRecord.staff_type);

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

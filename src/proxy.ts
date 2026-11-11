import { type NextRequest, NextResponse } from "next/server";
import { updateSession, isSupabaseConfigured } from "@/lib/supabase/middleware";
import { isDevAuthBypassEnabled } from "@/lib/dev-bypass";
import { logError } from "@/lib/logger";
import {
  buildWorkspaceAccessFromStaffProfile,
  canAccessWorkspacePath,
  getWorkspaceSwitchDestination,
  type WorkspaceStaffProfile,
} from "@/lib/auth/workspace-access";

const PROTECTED_PREFIXES = [
  "/owner",
  "/marketing",
  "/manager",
  "/crm",
  "/staff-portal",
  "/staff",
  "/driver",
  "/utility",
  "/scan",
  "/dev",
  "/select-workspace",
];

type CachedProxyStaff = {
  staffRecord: {
    id: string;
    full_name: string;
    nickname: string | null;
    system_role: string;
    staff_type: string | null;
    branch_id: string;
    avatar_url: string | null;
    branches: { name: string } | { name: string }[] | null;
  };
  expiresAt: number;
};

const proxyStaffCache = new Map<string, CachedProxyStaff>();
const PROXY_STAFF_TTL_MS = 30_000;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/staff") {
    return NextResponse.redirect(new URL(`/staff/${request.nextUrl.search}`, request.url), 308);
  }
  if (pathname !== "/" && pathname !== "/staff/" && pathname.endsWith("/")) {
    const url = new URL(request.url);
    url.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(url, 308);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-cradle-staff-pwa-route");
  requestHeaders.delete("x-cradle-verified-user-id");
  requestHeaders.delete("x-cradle-verified-staff-json");

  const isStaffPwaRoute = pathname === "/staff/" || pathname.startsWith("/staff/");
  if (isStaffPwaRoute) requestHeaders.set("x-cradle-staff-pwa-route", "1");

  const devBypass = isDevAuthBypassEnabled();
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // Skip session refresh for API routes and Next.js Server Action POSTs (which authenticate inside their own handlers)
  if (pathname.startsWith("/api/") || request.headers.has("next-action")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production" && isProtected) {
      logError("proxy.supabase_not_configured", { pathname });
      return NextResponse.redirect(new URL("/login?error=configuration", request.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Single session check + user resolution
  const { supabaseResponse: response, supabase, user } = await updateSession(request, requestHeaders);

  if (!isProtected || pathname === "/staff/login") return response;

  if (!user || !supabase) {
    return NextResponse.redirect(new URL(isStaffPwaRoute ? "/staff/login" : "/login", request.url));
  }

  requestHeaders.set("x-cradle-verified-user-id", user.id);

  if (devBypass) {
    const nextRes = NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.getAll().forEach((c) => nextRes.cookies.set(c));
    return nextRes;
  }

  const now = Date.now();
  const cached = proxyStaffCache.get(user.id);
  let staffRecord = cached && cached.expiresAt > now ? cached.staffRecord : null;

  if (!staffRecord) {
    const { data, error: staffError } = await supabase
      .from("staff")
      .select("id, full_name, nickname, system_role, staff_type, branch_id, avatar_url, branches(name)")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (staffError) {
      logError("proxy.staff_lookup_failed", { pathname, userId: user.id, error: staffError });
      return NextResponse.redirect(new URL(isStaffPwaRoute ? "/staff/login" : "/login", request.url));
    }

    if (data) {
      staffRecord = data as CachedProxyStaff["staffRecord"];
      proxyStaffCache.set(user.id, {
        staffRecord,
        expiresAt: now + PROXY_STAFF_TTL_MS,
      });
    }
  }

  if (!staffRecord) {
    return NextResponse.redirect(new URL("/account/setup", request.url));
  }

  const systemRole = staffRecord.system_role;
  const workspaces = buildWorkspaceAccessFromStaffProfile(staffRecord as WorkspaceStaffProfile);
  if (workspaces.length === 0) {
    return NextResponse.redirect(new URL("/account/setup", request.url));
  }

  if (!canAccessWorkspacePath(pathname, systemRole, workspaces, staffRecord.staff_type)) {
    return NextResponse.redirect(new URL(getWorkspaceSwitchDestination(workspaces), request.url));
  }

  // Forward verified user + staff context to Server Components so layouts/pages do 0 extra auth/staff queries
  requestHeaders.set("x-cradle-verified-staff-json", encodeURIComponent(JSON.stringify(staffRecord)));
  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
  return finalResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

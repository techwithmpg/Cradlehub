import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

/** Maps system_role → dashboard workspace prefix */
const ROLE_WORKSPACE: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  crm: "/crm",
  staff: "/staff-portal",
};

const PROTECTED_PREFIXES = ["/owner", "/manager", "/crm", "/staff-portal"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Get the user's role from the staff table
  const { data: staffRecord } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!staffRecord) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const correctWorkspace = ROLE_WORKSPACE[staffRecord.system_role];

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

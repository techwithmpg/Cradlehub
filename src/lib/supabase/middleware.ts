import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

type CachedAuthSession = {
  user: User;
  expiresAt: number;
};

const verifiedSessionCache = new Map<string, CachedAuthSession>();
const SESSION_CACHE_TTL_MS = 30_000;

function getSessionCacheKey(request: NextRequest): string | null {
  const authCookies = request.cookies
    .getAll()
    .filter((c) => c.name.includes("-auth-token") && !c.name.includes("code-verifier"))
    .map((c) => `${c.name}=${c.value}`)
    .join(";");
  return authCookies.length > 0 ? authCookies : null;
}

export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers
) {
  const headersToForward = requestHeaders ?? new Headers(request.headers);
  let supabaseResponse = NextResponse.next({
    request: { headers: headersToForward },
  });

  if (!isSupabaseConfigured()) {
    return { supabaseResponse, supabase: null, user: null as User | null };
  }

  let cookiesWereRefreshed = false;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesWereRefreshed = true;
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: headersToForward },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const cacheKey = getSessionCacheKey(request);
  const now = Date.now();
  if (cacheKey) {
    const cached = verifiedSessionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return { supabaseResponse, supabase, user: cached.user };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && cacheKey && !cookiesWereRefreshed) {
    if (verifiedSessionCache.size > 200) {
      verifiedSessionCache.clear();
    }
    verifiedSessionCache.set(cacheKey, {
      user,
      expiresAt: now + SESSION_CACHE_TTL_MS,
    });
  }

  return { supabaseResponse, supabase, user };
}

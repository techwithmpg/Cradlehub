const DEFAULT_SITE_ORIGIN = "http://localhost:3000";
export const DEFAULT_AUTH_REDIRECT_PATH = "/select-workspace";
export const PASSWORD_RESET_PATH = "/reset-password";
export const PASSWORD_RECOVERY_SESSION_COOKIE = "cradle_password_recovery";

const AUTH_CALLBACK_PATH = "/auth/callback";
const ALLOWED_REDIRECT_PREFIXES = [
  PASSWORD_RESET_PATH,
  DEFAULT_AUTH_REDIRECT_PATH,
  "/account/setup",
  "/owner",
  "/manager",
  "/crm",
  "/staff-portal",
  "/driver",
  "/utility",
] as const;

type HeadersLike = {
  get(name: string): string | null;
};

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isAllowedRedirectPath(pathname: string): boolean {
  if (pathname === AUTH_CALLBACK_PATH || pathname.startsWith(`${AUTH_CALLBACK_PATH}/`)) {
    return false;
  }

  return ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function sanitizeAuthRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT_PATH
): string {
  const raw = value?.trim();
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    decoded.includes("\r") ||
    decoded.includes("\n")
  ) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(decoded, "https://cradlehub.local");
  } catch {
    return fallback;
  }

  if (!isAllowedRedirectPath(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveRequestOrigin(
  headers: HeadersLike,
  fallback = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_ORIGIN
): string {
  const origin = normalizeOrigin(headers.get("origin"));
  if (origin) return origin;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const protocol = headers.get("x-forwarded-proto") ?? "https";
    const forwardedOrigin = normalizeOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  return normalizeOrigin(fallback) ?? DEFAULT_SITE_ORIGIN;
}

export function buildAuthCallbackRedirectUrl(origin: string, nextPath = PASSWORD_RESET_PATH): string {
  const url = new URL(AUTH_CALLBACK_PATH, origin);
  url.searchParams.set("next", sanitizeAuthRedirectPath(nextPath, PASSWORD_RESET_PATH));
  return url.toString();
}

export function getPublicAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    const appUrl = configuredUrl.replace(/\/+$/, "");

    if (process.env.NODE_ENV === "production") {
      const hostname = new URL(appUrl).hostname;

      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
        throw new Error("NEXT_PUBLIC_APP_URL must not be localhost in production.");
      }
    }

    return appUrl;
  }

  if (process.env.NODE_ENV === "development") {
    return DEFAULT_SITE_ORIGIN;
  }

  throw new Error("NEXT_PUBLIC_APP_URL is not configured.");
}

export function buildPasswordResetRedirectUrl(): string {
  return `${getPublicAppUrl()}${PASSWORD_RESET_PATH}`;
}

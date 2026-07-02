const LOCALHOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

function normalizeConfiguredUrl(value: string): string {
  return value.startsWith("http") ? value : `https://${value}`;
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return LOCALHOST_PATTERN.test(url.host);
  } catch {
    return false;
  }
}

export function getAppBaseUrl(params?: {
  origin?: string | null;
  configuredUrl?: string | null;
  nodeEnv?: string;
}): string {
  const configured =
    params?.configuredUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    null;

  const candidate = configured ? normalizeConfiguredUrl(configured) : params?.origin ?? "http://localhost:3000";
  const env = params?.nodeEnv ?? process.env.NODE_ENV;

  if (env === "production" && isLocalhostUrl(candidate)) {
    throw new Error("Production QR links require a public app URL.");
  }

  return candidate.replace(/\/+$/, "");
}

export function buildScanUrl(publicCode: string, origin?: string | null): string {
  return `${getAppBaseUrl({ origin })}/scan/${encodeURIComponent(publicCode)}`;
}

export function buildActivationUrl(token: string, origin?: string | null): string {
  return `${getAppBaseUrl({ origin })}/scan/activate/${encodeURIComponent(token)}`;
}

export function maskPublicCode(publicCode: string): string {
  if (publicCode.length <= 8) return "****";
  return `${publicCode.slice(0, 4)}...${publicCode.slice(-4)}`;
}

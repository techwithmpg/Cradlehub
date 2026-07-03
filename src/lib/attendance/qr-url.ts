const LOCALHOST_PATTERN = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;
const PRODUCTION_URL_ERROR = "Production QR links require a public app URL.";

function normalizeConfiguredUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(normalized);
    return normalized.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function firstConfiguredUrl(
  values: Array<string | null | undefined>,
  options?: { nodeEnv?: string }
): string | null {
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeConfiguredUrl(value);
    if (normalized && options?.nodeEnv === "production" && isLocalhostUrl(normalized)) continue;
    if (normalized) return normalized;
  }
  return null;
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
  const env = params?.nodeEnv ?? process.env.NODE_ENV;
  const configured = firstConfiguredUrl([
    params?.configuredUrl,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ], { nodeEnv: env });
  const origin = params?.origin ? normalizeConfiguredUrl(params.origin) : null;
  const publicOrigin = origin && (env !== "production" || !isLocalhostUrl(origin)) ? origin : null;
  const candidate = configured ?? publicOrigin ?? (env !== "production" ? "http://localhost:3000" : null);

  if (!candidate) {
    throw new Error(PRODUCTION_URL_ERROR);
  }

  return candidate;
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

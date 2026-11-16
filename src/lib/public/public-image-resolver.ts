/**
 * Canonical, browser-safe hybrid image resolution helpers shared across
 * services, Boutique, branches, brand marks, and public site sections.
 */

export const DEFAULT_PUBLIC_IMAGE_CACHE_CONTROL = "31536000";

export type HybridImageSourceTier =
  | "override"
  | "database"
  | "manifest_fallback"
  | "default_fallback";

export type HybridImageCandidate = {
  value: unknown;
  tier: Exclude<HybridImageSourceTier, "default_fallback">;
};

export type ResolvedHybridImage = {
  url: string;
  tier: HybridImageSourceTier;
};

/**
 * Validates that an image URL is either a safe app-relative path (`/images/...`)
 * or an explicit `http:`/`https:` URL without whitespace, backslashes, or protocol-relative ambiguity.
 */
export function normalizeSafeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 1000 || /[\s\\]/.test(trimmed)) return null;
  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("//") ? null : trimmed;
  }

  if (typeof URL === "function") {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
      if (parsed.username || parsed.password) return null;
      return trimmed;
    } catch {
      return null;
    }
  }

  // Fallback for test environments where global `URL` is stubbed with a plain object
  // (e.g. `{ ...URL, createObjectURL }`) rather than a constructor.
  const match = /^https?:\/\/([^/?#]+)(?:[/?#].*)?$/i.exec(trimmed);
  if (!match || !match[1] || match[1].includes("@")) return null;
  return trimmed;
}

/**
 * Resolves the first valid URL from prioritized hybrid candidates, falling back
 * deterministically to `defaultUrl` when no candidate is valid or available.
 */
export function resolveHybridImage(
  candidates: readonly HybridImageCandidate[],
  defaultUrl: string,
  isAvailable: (url: string, tier: HybridImageCandidate["tier"]) => boolean = () => true
): ResolvedHybridImage {
  for (const candidate of candidates) {
    const safeUrl = normalizeSafeImageUrl(candidate.value);
    if (!safeUrl) continue;
    if (!isAvailable(safeUrl, candidate.tier)) continue;
    return { url: safeUrl, tier: candidate.tier };
  }
  return { url: defaultUrl, tier: "default_fallback" };
}

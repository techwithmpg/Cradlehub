import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

const assetPresenceCache = new Map<string, boolean>();

/**
 * Checks whether a local `/...` image asset exists under `public/` on the server.
 * Skipped during Vitest unit runs so tests with synthetic local fixture paths stay deterministic.
 */
export function publicAssetExistsOnServer(urlOrPath: string): boolean {
  if (!urlOrPath.startsWith("/")) return true;
  if (process.env.VITEST) return true;

  const cleanPath = urlOrPath.split("?")[0]?.split("#")[0] ?? "";
  if (!cleanPath.startsWith("/")) return false;

  const cached = assetPresenceCache.get(cleanPath);
  if (cached !== undefined) return cached;

  const exists = existsSync(join(process.cwd(), "public", cleanPath.replace(/^\/+/, "")));
  assetPresenceCache.set(cleanPath, exists);
  return exists;
}

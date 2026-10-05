import "server-only";

import { createLocalAdcSheetTokenProvider } from "./sheet-adc-token-provider";
import { createVercelWifSheetTokenProvider } from "./sheet-vercel-wif-token-provider";
import type { SheetTokenProvider } from "./sheet-reader";

/** Unrecognized or deployed non-production environments have no Sheet credential path. */
export function selectSheetTokenProvider(
  env: NodeJS.ProcessEnv = process.env
): SheetTokenProvider | null {
  if (env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.NODE_ENV === "production") {
    return createVercelWifSheetTokenProvider();
  }
  if (!env.VERCEL && !env.VERCEL_ENV && env.NODE_ENV === "development") {
    return createLocalAdcSheetTokenProvider();
  }
  return null;
}

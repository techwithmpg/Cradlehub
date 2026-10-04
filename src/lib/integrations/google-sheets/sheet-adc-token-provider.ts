import "server-only";

import { GoogleAuth, Impersonated } from "google-auth-library";
import type { SheetTokenProvider } from "./sheet-reader";

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const EXPECTED_READER =
  "cradlehub-sheet-reader@cradle-massage-wellness-maps.iam.gserviceaccount.com";

/** Local Stage 1B diagnostics only. Never expose this provider through a route. */
export function createLocalAdcSheetTokenProvider(): SheetTokenProvider {
  return {
    async getAccessToken(): Promise<string> {
      if (process.env.NODE_ENV === "production") throw new Error("AUTH_NOT_CONFIGURED");

      try {
        const auth = new GoogleAuth({ scopes: [SHEETS_READONLY_SCOPE] });
        const client = await auth.getClient();
        // Reject user, compute, key-based, and unexpected impersonation credentials.
        if (!(client instanceof Impersonated) || client.getTargetPrincipal() !== EXPECTED_READER) {
          throw new Error("AUTH_NOT_CONFIGURED");
        }
        const token = (await client.getAccessToken()).token;
        if (!token) throw new Error("AUTH_NOT_CONFIGURED");
        return token;
      } catch {
        // ADC or Google errors may contain credential details; expose only a controlled state.
        throw new Error("AUTH_NOT_CONFIGURED");
      }
    },
  };
}

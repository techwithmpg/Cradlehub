import "server-only";

import { getVercelOidcToken, verifyVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient } from "google-auth-library";
import type { SheetTokenProvider } from "./sheet-reader";

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const LOCAL_READER = "cradlehub-sheet-reader@cradle-massage-wellness-maps.iam.gserviceaccount.com";
const TOKEN_LIFETIME_SECONDS = 600;

type Environment = NodeJS.ProcessEnv;

interface ProductionSheetAuthConfig {
  audience: string;
  stsAudience: string;
  serviceAccountEmail: string;
  issuer: string;
  subject: string;
  teamId: string;
  projectId: string;
}

function required(env: Environment, name: string, pattern: RegExp): string {
  const value = env[name];
  if (!value || !pattern.test(value)) throw new Error("AUTH_NOT_CONFIGURED");
  return value;
}

/** Identifiers are server configuration, never request parameters or credential JSON. */
export function productionSheetAuthConfig(
  env: Environment = process.env
): ProductionSheetAuthConfig {
  const number = required(env, "CRADLE_SHEET_WIF_PROJECT_NUMBER", /^[1-9][0-9]{5,20}$/);
  const pool = required(env, "CRADLE_SHEET_WIF_POOL_ID", /^[a-z][a-z0-9-]{3,31}$/);
  const provider = required(env, "CRADLE_SHEET_WIF_PROVIDER_ID", /^[a-z][a-z0-9-]{3,31}$/);
  const serviceAccountEmail = required(
    env,
    "CRADLE_SHEET_WIF_SERVICE_ACCOUNT_EMAIL",
    /^[a-z][a-z0-9-]{4,29}@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/
  );
  const teamId = required(env, "CRADLE_SHEET_WIF_VERCEL_TEAM_ID", /^team_[A-Za-z0-9]+$/);
  const projectId = required(env, "CRADLE_SHEET_WIF_VERCEL_PROJECT_ID", /^prj_[A-Za-z0-9]+$/);
  const issuer = required(
    env,
    "CRADLE_SHEET_WIF_VERCEL_ISSUER",
    /^https:\/\/oidc\.vercel\.com(?:\/[a-z0-9-]+)?$/
  );
  const subject = required(
    env,
    "CRADLE_SHEET_WIF_VERCEL_SUBJECT",
    /^owner:[a-z0-9-]+:project:[a-z0-9_-]+:environment:production$/
  );
  if (serviceAccountEmail === LOCAL_READER || env.VERCEL_PROJECT_ID !== projectId) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }
  const resource = `projects/${number}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`;
  return {
    audience: `https://iam.googleapis.com/${resource}`,
    stsAudience: `//iam.googleapis.com/${resource}`,
    serviceAccountEmail,
    issuer,
    subject,
    teamId,
    projectId,
  };
}

export function createVercelWifSheetTokenProvider(): SheetTokenProvider {
  return {
    async getAccessToken(): Promise<string> {
      try {
        if (
          process.env.VERCEL !== "1" ||
          process.env.VERCEL_ENV !== "production" ||
          process.env.NODE_ENV !== "production" ||
          process.env.VERCEL_OIDC_TOKEN ||
          process.env.VERCEL_OIDC_TOKEN_FILE
        ) {
          throw new Error("AUTH_NOT_CONFIGURED");
        }
        const config = productionSheetAuthConfig();
        // Acquire inside the authorized request; never at import or build time.
        const assertion = await getVercelOidcToken({ audience: config.audience });
        const verified = await verifyVercelOidcToken(assertion, {
          audience: config.audience,
          issuer: config.issuer,
          ownerId: config.teamId,
          projectId: config.projectId,
          environment: "production",
        });
        if (verified.payload.sub !== config.subject) throw new Error("AUTH_NOT_CONFIGURED");

        const client = ExternalAccountClient.fromJSON({
          type: "external_account",
          audience: config.stsAudience,
          subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
          token_url: "https://sts.googleapis.com/v1/token",
          service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
          service_account_impersonation: { token_lifetime_seconds: TOKEN_LIFETIME_SECONDS },
          scopes: [SHEETS_READONLY_SCOPE],
          subject_token_supplier: { getSubjectToken: async () => assertion },
        });
        if (!client || client.getServiceAccountEmail() !== config.serviceAccountEmail) {
          throw new Error("AUTH_NOT_CONFIGURED");
        }
        const token = (await client.getAccessToken()).token;
        if (!token) throw new Error("AUTH_NOT_CONFIGURED");
        return token;
      } catch {
        // Provider and Google errors can contain assertions, tokens, or account identifiers.
        throw new Error("AUTH_UNAVAILABLE");
      }
    },
  };
}

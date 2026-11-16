import "server-only";
import { createPrivateKey, createSign } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
const account = z.object({
  project_id: z.string().regex(/^[a-z][a-z0-9-]+$/),
  client_email: z.email(),
  private_key: z.string().min(80),
});
function configuration() {
  if (
    process.env.CRADLEHUB_DRIVER_NATIVE_PUSH_ENABLED !== "true" ||
    process.env.CRADLEHUB_DRIVER_JOURNEYS_ENABLED !== "true"
  )
    return null;
  try {
    const parsed = account.parse(
      JSON.parse(process.env.CRADLEHUB_DRIVER_FCM_SERVICE_ACCOUNT_JSON ?? "null")
    );
    if (createPrivateKey(parsed.private_key).asymmetricKeyType !== "rsa") return null;
    return parsed;
  } catch {
    return null;
  }
}
export function nativeDriverPushReady() {
  return configuration() !== null;
}
let cached: { identity: string; token: string; until: number } | null = null;
async function accessToken(config: z.infer<typeof account>) {
  const identity = config.project_id + config.client_email;
  if (cached?.identity === identity && cached.until > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const encode = (x: unknown) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const unsigned =
    encode({ alg: "RS256", typ: "JWT" }) +
    "." +
    encode({
      iss: config.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const jwt =
    unsigned +
    "." +
    createSign("RSA-SHA256").update(unsigned).end().sign(config.private_key, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== "string")
    throw new Error("driver_fcm_auth_failed");
  cached = {
    identity,
    token: body.access_token,
    until: Date.now() + Math.min(3000, Number(body.expires_in) || 3000) * 1000,
  };
  return cached.token;
}
/** Explicit staff-level channel policy: active native enrollment takes priority
 * over browser OS push; durable in-app notices remain unchanged. */
export async function preferredNativeDriverIds(ids: string[]): Promise<Set<string>> {
  if (!configuration() || !ids.length) return new Set();
  const result = await createAdminClient().rpc(
    "driver_native_preferred" as never,
    { p_staff_ids: ids } as never
  );
  if (result.error || !Array.isArray(result.data))
    throw new Error("driver_push_preference_unavailable");
  return new Set(result.data as string[]);
}
const jobSchema = z.object({
  id: z.guid(),
  bookingId: z.guid(),
  staffId: z.guid(),
  lease: z.guid(),
  kind: z.string(),
  alreadyAccepted: z.boolean().optional(),
  devices: z.array(z.object({ id: z.guid(), token: z.string(), tokenHash: z.string() })),
});
export async function processDriverNativePush() {
  const config = configuration();
  if (!config) return { inactive: true };
  const admin = createAdminClient();
  const claim = await admin.rpc("driver_native_claim" as never, { p_limit: 5 } as never);
  if (claim.error) throw new Error("driver_push_claim_failed");
  const jobs = jobSchema.array().parse(claim.data);
  let providerAccepted = 0,
    failed = 0;
  let bearer: string | null = null;
  const deadline = Date.now() + 40000;
  for (const job of jobs) {
    const accepted: string[] = [];
    const invalid: { id: string; hash: string }[] = [];
    let error: string | null = null;
    for (const device of job.devices.slice(0, 10)) {
      if (Date.now() >= deadline) {
        error = "delivery_budget_exceeded";
        break;
      }
      try {
        bearer ??= await accessToken(config);
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${config.project_id}/messages:send`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
            body: JSON.stringify({
              message: {
                token: device.token,
                data: {
                  type: "driver_update",
                  bookingId: job.bookingId,
                  kind: job.kind,
                  notificationId: job.id,
                },
                android: { priority: "high", ttl: "300s" },
              },
            }),
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          }
        );
        if (response.ok) accepted.push(device.id);
        else {
          error = "fcm_rejected";
          if (response.status === 401) {
            cached = null;
            bearer = null;
          }
          const result = await response.json().catch(() => null);
          if (
            result?.error?.details?.some(
              (d: { errorCode?: string }) => d.errorCode === "UNREGISTERED"
            )
          )
            invalid.push({ id: device.id, hash: device.tokenHash });
        }
      } catch {
        error = "fcm_transport_failed";
      }
    }
    const complete =
      error === null &&
      (accepted.length > 0 || job.alreadyAccepted === true) &&
      job.devices.length <= 10;
    if (!complete && !error) error = "no_registered_native_device";
    const finish = await admin.rpc(
      "driver_native_finish" as never,
      {
        p_id: job.id,
        p_lease: job.lease,
        p_accepted: accepted,
        p_invalid: invalid,
        p_complete: complete,
        p_error: error,
      } as never
    );
    if (finish.error || finish.data !== true || !complete) failed++;
    else providerAccepted++;
  }
  return { claimed: jobs.length, providerAccepted, failed };
}

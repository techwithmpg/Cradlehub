import "server-only";

/**
 * Restricted server-side Twilio REST client. Uses the official Messages API
 * directly to avoid adding an unlocked dependency. No client/browser use.
 *
 * We poll statuses via the authenticated Messages GET API rather than exposing
 * a public status callback endpoint requiring additional signature validation.
 */
export type TwilioMessageState =
  | "accepted" | "queued" | "sending" | "sent" | "delivered"
  | "failed" | "undelivered" | "scheduled" | "canceled";

export type TwilioDelivery = {
  sid: string;
  state: TwilioMessageState;
  errorCode: string | null;
};

export class TwilioRejected extends Error {
  constructor(readonly providerCode: string | null) {
    super("Twilio rejected SMS submission");
  }
}

function config(): { account: string; token: string; service: string } {
  const account = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";
  if (!/^AC[0-9a-f]{32}$/i.test(account) ||
      !/^MG[0-9a-f]{32}$/i.test(service) || token.length < 12) {
    throw new Error("Customer SMS Twilio configuration is incomplete");
  }
  return { account, token, service };
}

export function assertTwilioConfigured(): void {
  config();
}

function state(value: unknown): TwilioMessageState {
  if (typeof value === "string" && [
    "accepted", "queued", "sending", "sent", "delivered", "failed",
    "undelivered", "scheduled", "canceled",
  ].includes(value)) return value as TwilioMessageState;
  throw new Error("Unknown Twilio message state");
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams
): Promise<TwilioDelivery> {
  const { account, token } = config();
  const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" +
    encodeURIComponent(account) + "/Messages" + path, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(account + ":" + token).toString("base64"),
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  // Never log this response: it may contain the recipient and SMS text.
  const parsed: unknown = await response.json().catch(() => null);
  const message = (parsed && typeof parsed === "object"
    ? parsed : {}) as Record<string, unknown>;
  if (!response.ok) {
    const code = message.code;
    throw new TwilioRejected(
      typeof code === "number" || typeof code === "string" ? String(code) : null
    );
  }
  const sid = message.sid;
  if (typeof sid !== "string" || !/^(SM|MM)[0-9a-f]{32}$/i.test(sid)) {
    throw new Error("Twilio response missing valid message SID; outcome unknown");
  }
  const code = message.error_code;
  return {
    sid,
    state: state(message.status),
    errorCode: code === null || code === undefined ? null : String(code),
  };
}

export async function sendTwilioSms(to: string, body: string): Promise<TwilioDelivery> {
  const { service } = config();
  if (!/^\+639\d{9}$/.test(to)) throw new Error("Unsupported SMS destination");
  if (body.length < 10 || body.length > 320) throw new Error("SMS template length invalid");
  const form = new URLSearchParams({
    To: to,
    MessagingServiceSid: service,
    Body: body,
  });
  return request("POST", ".json", form);
}

export async function readTwilioSms(sid: string): Promise<TwilioDelivery> {
  if (!/^(SM|MM)[0-9a-f]{32}$/i.test(sid)) throw new Error("Invalid Twilio message SID");
  return request("GET", "/" + encodeURIComponent(sid) + ".json");
}

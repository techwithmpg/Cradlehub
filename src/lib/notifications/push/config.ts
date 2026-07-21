import "server-only";

import { z } from "zod";

const vapidSubjectSchema = z.string().refine(
  (value) => {
    if (value.startsWith("mailto:")) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.slice("mailto:".length));
    }
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  },
  "WEB_PUSH_VAPID_SUBJECT must be a mailto address or HTTPS URL."
);

const webPushConfigurationSchema = z.object({
  publicKey: z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
  privateKey: z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
  subject: vapidSubjectSchema,
});

export type WebPushConfiguration = z.infer<typeof webPushConfigurationSchema>;

export function getWebPushConfiguration(): WebPushConfiguration {
  return webPushConfigurationSchema.parse({
    publicKey: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
    privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
    subject: process.env.WEB_PUSH_VAPID_SUBJECT,
  });
}

export function isWebPushConfigured(): boolean {
  return webPushConfigurationSchema.safeParse({
    publicKey: process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
    privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
    subject: process.env.WEB_PUSH_VAPID_SUBJECT,
  }).success;
}

import { z } from "zod";

const base64Url = z.string().min(8).max(512).regex(/^[A-Za-z0-9_-]+$/);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096).refine((value) => value.startsWith("https://")),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: base64Url,
    auth: base64Url.max(256),
  }),
  deviceLabel: z.string().trim().min(1).max(100).optional(),
});

export const pushEndpointSchema = z.object({
  endpoint: z.string().url().max(4096).refine((value) => value.startsWith("https://")),
});

export const ownerBookingPreferenceSchema = z.enum([
  "all",
  "home_service_and_urgent",
  "urgent_only",
  "disabled",
]);

export type OwnerBookingPreference = z.infer<typeof ownerBookingPreferenceSchema>;

export const notificationPreferencePatchSchema = z.object({
  ownerBookingPreference: ownerBookingPreferenceSchema,
});

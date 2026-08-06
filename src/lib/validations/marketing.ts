import { z } from "zod";
import { publicSiteSectionKeySchema } from "@/lib/validations/public-site";

export const MARKETING_CONTENT_TYPES = ["section", "asset", "brand", "seo", "service"] as const;

export const MARKETING_DRAFT_STATUSES = [
  "draft",
  "submitted",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;

export const MARKETING_MUTABLE_DRAFT_STATUSES = [
  "draft",
  "submitted",
  "changes_requested",
] as const;

const uuid = z.guid("Invalid draft ID");

function isSafeHref(value: string | null | undefined): boolean {
  if (!value) return true;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  if (value.startsWith("tel:") || value.startsWith("mailto:")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isSafeImageUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const optionalHref = z
  .string()
  .trim()
  .max(500, "Link is too long")
  .refine(isSafeHref, "Use a safe URL, relative path, phone, email, or anchor link")
  .optional()
  .nullable();

const optionalImageUrl = z
  .string()
  .trim()
  .max(1000, "Image URL is too long")
  .refine(isSafeImageUrl, "Use a local path or http(s) image URL")
  .optional()
  .nullable();

const jsonObject = z.record(z.string(), z.unknown()).default({});

export const marketingContentDraftInputSchema = z.object({
  id: uuid.optional().nullable(),
  contentType: z.enum(MARKETING_CONTENT_TYPES).default("section"),
  contentKey: publicSiteSectionKeySchema,
  title: optionalText(180),
  subtitle: optionalText(320),
  body: optionalText(3000),
  ctaLabel: optionalText(80),
  ctaHref: optionalHref,
  imageUrl: optionalImageUrl,
  secondaryImageUrl: optionalImageUrl,
  altText: optionalText(220),
  linkHref: optionalHref,
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  isEnabled: z.boolean().default(true),
  metadata: jsonObject,
});

export type MarketingContentDraftInput = z.infer<typeof marketingContentDraftInputSchema>;

export const marketingContentDraftIdSchema = z.object({
  id: uuid,
});

export const marketingDraftReviewSchema = marketingContentDraftIdSchema.extend({
  reviewNote: z.string().trim().max(1000, "Review note is too long").optional().nullable(),
});

export const marketingDraftScheduleSchema = marketingDraftReviewSchema.extend({
  scheduledFor: z.string().trim().min(1, "Choose a publish date and time"),
});

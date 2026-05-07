import { z } from "zod";

export const PUBLIC_SITE_SECTION_KEYS = [
  "hero",
  "about",
  "experience",
  "choose_setting",
  "signature_services",
  "quote_banner",
  "gallery",
  "why_choose_cradle",
  "wellness_team",
  "reasons_guests_visit",
  "before_you_book",
  "contact",
  "promotion_banner",
] as const;

const uuid = z.guid("Invalid ID");

export const publicSiteSectionKeySchema = z
  .string()
  .trim()
  .min(2, "Section key is required")
  .max(80, "Section key is too long")
  .regex(/^[a-z0-9_:-]+$/, "Use lowercase letters, numbers, underscore, colon, or dash only");

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

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable();

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

const requiredImageUrl = z
  .string()
  .trim()
  .min(1, "Image URL is required")
  .max(1000, "Image URL is too long")
  .refine(isSafeImageUrl, "Use a local path or http(s) image URL");

const jsonObject = z.record(z.string(), z.unknown()).default({});

export const publicSiteSectionSchema = z.object({
  sectionKey: publicSiteSectionKeySchema,
  title: optionalText(180),
  subtitle: optionalText(320),
  body: optionalText(3000),
  ctaLabel: optionalText(80),
  ctaHref: optionalHref,
  imageUrl: optionalImageUrl,
  secondaryImageUrl: optionalImageUrl,
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  isEnabled: z.boolean().default(true),
  metadata: jsonObject,
});
export type PublicSiteSectionInput = z.infer<typeof publicSiteSectionSchema>;

export const publicSiteAssetSchema = z.object({
  id: uuid.optional(),
  sectionKey: publicSiteSectionKeySchema.optional().nullable(),
  title: optionalText(160),
  altText: z.string().trim().min(3, "Alt text is required").max(220),
  imageUrl: requiredImageUrl,
  linkHref: optionalHref,
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  isEnabled: z.boolean().default(true),
  metadata: jsonObject,
});
export type PublicSiteAssetInput = z.infer<typeof publicSiteAssetSchema>;

export const updatePublicSiteAssetSchema = publicSiteAssetSchema.extend({
  id: uuid,
});
export type UpdatePublicSiteAssetInput = z.infer<
  typeof updatePublicSiteAssetSchema
>;

export const publicSiteAssetIdSchema = z.object({
  id: uuid,
});

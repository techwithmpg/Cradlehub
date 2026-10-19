import { z } from "zod";
import { publicSiteSectionKeySchema } from "@/lib/validations/public-site";
import {
  MANAGED_SITE_IMAGE_SLOT_KEYS,
  isRenderableManagedSiteImageUrl,
} from "@/lib/marketing/website-images-inventory";
import { PUBLIC_CATALOG_CATEGORY_NAMES } from "@/lib/public/service-catalog-config";

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

export const marketingContentDraftInputSchema = z
  .object({
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
  })
  .superRefine((input, context) => {
    if (
      input.contentType === "section" &&
      ["hero", "about", "quote_banner"].includes(input.contentKey)
    ) {
      const fields =
        input.contentKey === "quote_banner"
          ? (["imageUrl"] as const)
          : (["imageUrl", "secondaryImageUrl"] as const);
      for (const field of fields) {
        const value = input[field];
        if (value && !isRenderableManagedSiteImageUrl(value)) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Use a supported public image URL.",
          });
        }
      }
    }

    if (input.contentType === "section" && input.contentKey === "site_images") {
      const slots = input.metadata.slots;
      if (!slots || typeof slots !== "object" || Array.isArray(slots)) {
        context.addIssue({
          code: "custom",
          path: ["metadata", "slots"],
          message: "Image slots must be an object.",
        });
      } else {
        for (const [key, value] of Object.entries(slots)) {
          if (!MANAGED_SITE_IMAGE_SLOT_KEYS.has(key)) {
            context.addIssue({
              code: "custom",
              path: ["metadata", "slots", key],
              message: "Unknown website image slot.",
            });
          } else if (!isRenderableManagedSiteImageUrl(value)) {
            context.addIssue({
              code: "custom",
              path: ["metadata", "slots", key],
              message: "Use a supported public image URL.",
            });
          }
        }
      }
    }

    if (input.contentType === "section" && input.contentKey === "signature_services") {
      const categoryImages = input.metadata.categoryImages;
      if (categoryImages !== undefined) {
        if (
          !categoryImages ||
          typeof categoryImages !== "object" ||
          Array.isArray(categoryImages)
        ) {
          context.addIssue({
            code: "custom",
            path: ["metadata", "categoryImages"],
            message: "Category images must be an object.",
          });
        } else {
          for (const [key, value] of Object.entries(categoryImages)) {
            if (!PUBLIC_CATALOG_CATEGORY_NAMES.some((category) => category === key)) {
              context.addIssue({
                code: "custom",
                path: ["metadata", "categoryImages", key],
                message: "Unknown service category.",
              });
            } else if (!isRenderableManagedSiteImageUrl(value)) {
              context.addIssue({
                code: "custom",
                path: ["metadata", "categoryImages", key],
                message: "Use a supported public image URL.",
              });
            }
          }
        }
      }
    }

    if (input.contentType !== "section" || input.contentKey !== "hero") return;

    const mobileImageUrl = input.metadata.mobileImageUrl;
    if (
      mobileImageUrl !== undefined &&
      (typeof mobileImageUrl !== "string" ||
        mobileImageUrl.length > 1000 ||
        (mobileImageUrl !== "" && !isRenderableManagedSiteImageUrl(mobileImageUrl)))
    ) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "mobileImageUrl"],
        message: "Use a supported public mobile image URL.",
      });
    }

    for (const key of ["desktopFocalX", "desktopFocalY", "mobileFocalX", "mobileFocalY"]) {
      const value = input.metadata[key];
      if (
        value !== undefined &&
        (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)
      ) {
        context.addIssue({
          code: "custom",
          path: ["metadata", key],
          message: "Focal coordinates must be from 0 to 100.",
        });
      }
    }

    for (const key of ["imageAltText", "mobileImageAltText"]) {
      const value = input.metadata[key];
      if (value !== undefined && (typeof value !== "string" || value.length > 220)) {
        context.addIssue({
          code: "custom",
          path: ["metadata", key],
          message: "Image description is too long.",
        });
      }
    }
  });

export type MarketingContentDraftInput = z.infer<typeof marketingContentDraftInputSchema>;

type PublishedSectionImages = {
  image_url?: string | null;
  secondary_image_url?: string | null;
  metadata?: unknown;
};

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Keep an unsupported legacy image only when it is byte-for-byte unchanged from
 * the current published row. New unsupported values still fail the draft schema.
 */
export function parseMarketingDraftWithPublishedImages(
  rawInput: unknown,
  published: PublishedSectionImages | null
): ReturnType<typeof marketingContentDraftInputSchema.safeParse> {
  const strict = marketingContentDraftInputSchema.safeParse(rawInput);
  if (strict.success || !published || !rawInput || typeof rawInput !== "object") return strict;

  const raw = rawInput as Record<string, unknown>;
  if (raw.contentType !== "section") return strict;

  const sanitized: Record<string, unknown> = { ...raw };
  const originalMeta = recordOrEmpty(raw.metadata);
  const publishedMeta = recordOrEmpty(published.metadata);
  const sanitizedMeta = { ...originalMeta };
  const preservedFields: Array<"imageUrl" | "secondaryImageUrl"> = [];
  let preservedMetadata = false;

  if (["hero", "about", "quote_banner"].includes(String(raw.contentKey))) {
    for (const [field, publishedValue] of [
      ["imageUrl", published.image_url],
      ["secondaryImageUrl", published.secondary_image_url],
    ] as const) {
      const value = raw[field];
      if (
        typeof value === "string" &&
        value === publishedValue &&
        !isRenderableManagedSiteImageUrl(value)
      ) {
        sanitized[field] = "";
        preservedFields.push(field);
      }
    }
  }

  if (
    raw.contentKey === "hero" &&
    originalMeta.mobileImageUrl !== undefined &&
    originalMeta.mobileImageUrl === publishedMeta.mobileImageUrl &&
    !isRenderableManagedSiteImageUrl(originalMeta.mobileImageUrl)
  ) {
    delete sanitizedMeta.mobileImageUrl;
    preservedMetadata = true;
  }

  if (raw.contentKey === "signature_services") {
    const rawCategories = recordOrEmpty(originalMeta.categoryImages);
    const publishedCategories = recordOrEmpty(publishedMeta.categoryImages);
    const sanitizedCategories = { ...rawCategories };
    for (const [key, value] of Object.entries(rawCategories)) {
      if (
        key in publishedCategories &&
        value === publishedCategories[key] &&
        (!PUBLIC_CATALOG_CATEGORY_NAMES.some((category) => category === key) ||
          !isRenderableManagedSiteImageUrl(value))
      ) {
        delete sanitizedCategories[key];
        preservedMetadata = true;
      }
    }
    if (preservedMetadata) sanitizedMeta.categoryImages = sanitizedCategories;
  }

  if (preservedFields.length === 0 && !preservedMetadata) return strict;
  sanitized.metadata = sanitizedMeta;
  const retry = marketingContentDraftInputSchema.safeParse(sanitized);
  if (!retry.success) return strict;

  const data = { ...retry.data };
  for (const field of preservedFields) data[field] = raw[field] as string;
  if (preservedMetadata) data.metadata = originalMeta;
  return { success: true, data };
}

export const marketingContentDraftIdSchema = z.object({
  id: uuid,
});

export const marketingDraftReviewSchema = marketingContentDraftIdSchema.extend({
  reviewNote: z.string().trim().max(1000, "Review note is too long").optional().nullable(),
});

export const marketingDraftScheduleSchema = marketingDraftReviewSchema.extend({
  scheduledFor: z.string().trim().min(1, "Choose a publish date and time"),
});

export const MARKETING_MEDIA_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "published",
  "archived",
] as const;

export type MarketingMediaStatus = (typeof MARKETING_MEDIA_STATUSES)[number];

const bucketPathRegex = /^[a-z0-9][a-z0-9_./-]*$/;

export const marketingMediaAssetInputSchema = z.object({
  id: uuid.optional().nullable(),
  title: optionalText(180),
  altText: z
    .string()
    .trim()
    .min(3, "Alt text must be at least 3 characters")
    .max(220, "Alt text is too long"),
  sectionKey: optionalText(100),
  contentKey: optionalText(100),
  bucketPath: z
    .string()
    .trim()
    .max(500, "Bucket path is too long")
    .regex(
      bucketPathRegex,
      "Bucket path must use lowercase alphanumeric, dash, underscore, dot, or slash"
    )
    .optional()
    .nullable(),
  publicUrl: optionalImageUrl,
  metadata: jsonObject,
});

export type MarketingMediaAssetInput = z.infer<typeof marketingMediaAssetInputSchema>;

export const marketingMediaAssetIdSchema = z.object({
  id: uuid,
});

export const marketingMediaStatusUpdateSchema = marketingMediaAssetIdSchema.extend({
  status: z.enum(MARKETING_MEDIA_STATUSES),
  reviewNote: optionalText(1000),
});

export const marketingMediaArchiveSchema = marketingMediaAssetIdSchema.extend({
  reviewNote: optionalText(1000),
});

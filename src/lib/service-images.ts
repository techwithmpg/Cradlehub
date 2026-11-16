import serviceImageManifest from "@/data/service-images.json";
import {
  resolveHybridImage,
  type HybridImageCandidate,
} from "@/lib/public/public-image-resolver";

export type ServiceImageManifestEntry = {
  id: string;
  name: string;
  slug: string;
  category: string;
  categoryId: string;
  filename: string;
  localPath: string;
  imageUrl: string;
  imageAlt: string;
  batch: number;
};

export type ServiceImageInput = {
  id?: string | null;
  name?: string | null;
  branchImageUrl?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export type ResolveServiceImageOptions = {
  isAvailable?: (url: string, tier: HybridImageCandidate["tier"]) => boolean;
};

export const DEFAULT_SERVICE_IMAGE_URL = "/images/services/default-service.webp";
export const DEFAULT_SERVICE_IMAGE_ALT = "Premium spa service at Cradle Massage and Wellness Spa";

export const serviceImages = serviceImageManifest as ServiceImageManifestEntry[];

const serviceImagesById = new Map(serviceImages.map((service) => [service.id, service]));

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Looks up the static fallback manifest strictly by canonical service ID (never by name). */
export function getServiceImageManifestEntry(
  serviceId: string | null | undefined
): ServiceImageManifestEntry | null {
  if (!serviceId) return null;
  return serviceImagesById.get(serviceId) ?? null;
}

/**
 * Unified service image resolver:
 * 1. Valid branch-specific override (`branchImageUrl` / `custom_image_url`)
 * 2. Authoritative service catalog URL (`imageUrl` / `services.image_url`)
 * 3. Approved static manifest entry matched by `service.id`
 * 4. Standard Category A fallback (`/images/services/default-service.webp`)
 */
export function resolveServiceImage(
  service: ServiceImageInput,
  options?: ResolveServiceImageOptions
) {
  const manifestEntry = getServiceImageManifestEntry(service.id);
  const { url: imageUrl } = resolveHybridImage(
    [
      { value: service.branchImageUrl, tier: "override" },
      { value: service.imageUrl, tier: "database" },
      { value: manifestEntry?.imageUrl, tier: "manifest_fallback" },
    ],
    DEFAULT_SERVICE_IMAGE_URL,
    options?.isAvailable
  );
  const imageAlt =
    cleanText(service.imageAlt) ??
    manifestEntry?.imageAlt ??
    (cleanText(service.name)
      ? `${cleanText(service.name)} service at Cradle Massage and Wellness Spa`
      : DEFAULT_SERVICE_IMAGE_ALT);

  return { imageUrl, imageAlt };
}

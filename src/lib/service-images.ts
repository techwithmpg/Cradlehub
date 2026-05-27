import serviceImageManifest from "@/data/service-images.json";

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
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export const DEFAULT_SERVICE_IMAGE_URL = "/images/services/default-service.webp";
export const DEFAULT_SERVICE_IMAGE_ALT = "Premium spa service at Cradle Massage and Wellness Spa";

export const serviceImages = serviceImageManifest as ServiceImageManifestEntry[];

const serviceImagesById = new Map(serviceImages.map((service) => [service.id, service]));

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function getServiceImageManifestEntry(
  serviceId: string | null | undefined
): ServiceImageManifestEntry | null {
  if (!serviceId) return null;
  return serviceImagesById.get(serviceId) ?? null;
}

export function resolveServiceImage(service: ServiceImageInput) {
  const manifestEntry = getServiceImageManifestEntry(service.id);
  const imageUrl =
    cleanText(service.imageUrl) ??
    manifestEntry?.imageUrl ??
    DEFAULT_SERVICE_IMAGE_URL;
  const imageAlt =
    cleanText(service.imageAlt) ??
    manifestEntry?.imageAlt ??
    (cleanText(service.name)
      ? `${service.name} service at Cradle Massage and Wellness Spa`
      : DEFAULT_SERVICE_IMAGE_ALT);

  return { imageUrl, imageAlt };
}

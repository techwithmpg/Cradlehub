"use client";

import { useState, type SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";
import { normalizeSafeImageUrl } from "@/lib/public/public-image-resolver";
import { DEFAULT_SERVICE_IMAGE_URL } from "@/lib/service-images";

type ServiceImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
  category?: string;
};

export function ServiceImage({
  src,
  alt,
  fallbackSrc = DEFAULT_SERVICE_IMAGE_URL,
  category,
  onError,
  ...props
}: ServiceImageProps) {
  void category;
  const resolvedFallback =
    normalizeSafeImageUrl(fallbackSrc) ?? DEFAULT_SERVICE_IMAGE_URL;
  const initialSrc = normalizeSafeImageUrl(src) ?? resolvedFallback;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const currentSrc = failedSrc === initialSrc ? resolvedFallback : initialSrc;

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    if (currentSrc !== resolvedFallback) {
      setFailedSrc(initialSrc);
    }
    onError?.(event);
  }

  const hasExplicitDimensions =
    props.width !== undefined || props.height !== undefined || props.fill !== undefined;
  const fallbackFillProps = hasExplicitDimensions
    ? {}
    : {
        fill: true as const,
        sizes: props.sizes ?? "100vw",
        className: props.className ? `object-cover ${props.className}` : "object-cover",
      };

  return (
    <Image
      {...props}
      {...fallbackFillProps}
      src={currentSrc}
      alt={alt}
      onError={handleError}
    />
  );
}

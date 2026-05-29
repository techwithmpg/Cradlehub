"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import Image, { type ImageProps } from "next/image";
import { DEFAULT_SERVICE_IMAGE_URL } from "@/lib/service-images";

type ServiceImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  alt: string;
  fallbackSrc?: string;
};

function cleanSrc(src: string | null | undefined) {
  const trimmed = src?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_SERVICE_IMAGE_URL;
}

export function ServiceImage({
  src,
  alt,
  fallbackSrc = DEFAULT_SERVICE_IMAGE_URL,
  onError,
  ...props
}: ServiceImageProps) {
  const initialSrc = cleanSrc(src);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrentSrc(cleanSrc(src)); }, [src]);

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
    onError?.(event);
  }

  return <Image {...props} src={currentSrc} alt={alt} onError={handleError} />;
}

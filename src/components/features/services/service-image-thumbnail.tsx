"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

function resolveServiceImage(serviceName: string): string | null {
  const lower = serviceName.toLowerCase();
  if (lower.includes("swedish")) return SPA_IMAGES.swedish;
  if (lower.includes("deep tissue")) return SPA_IMAGES.deepTissue;
  if (lower.includes("aroma")) return SPA_IMAGES.aromatherapy;
  if (lower.includes("hot stone")) return SPA_IMAGES.hotStone;
  if (lower.includes("reflexology") || lower.includes("foot")) return SPA_IMAGES.reflexology;
  if (lower.includes("couple")) return SPA_IMAGES.couples;
  return null;
}

type Props = {
  serviceName: string;
};

export function ServiceImageThumbnail({ serviceName }: Props) {
  const imageUrl = resolveServiceImage(serviceName);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        backgroundColor: "var(--cs-surface-warm)",
      }}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={serviceName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: "100%",
            color: "var(--cs-text-subtle)",
          }}
        >
          <ImageIcon className="h-8 w-8" style={{ opacity: 0.5 }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>No image</span>
          <span style={{ fontSize: "0.6875rem", opacity: 0.7 }}>Add a service photo</span>
        </div>
      )}
    </div>
  );
}

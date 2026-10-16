"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { resolveServiceImage } from "@/lib/service-images";

type Props = {
  serviceId?: string;
  serviceName: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

export function ServiceImageThumbnail({ serviceId, serviceName, imageUrl, imageAlt }: Props) {
  const image = resolveServiceImage({ id: serviceId, name: serviceName, imageUrl, imageAlt });

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
      {image.imageUrl ? (
        <Image
          src={image.imageUrl}
          alt={image.imageAlt}
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

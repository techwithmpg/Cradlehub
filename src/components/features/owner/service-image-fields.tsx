"use client";

import { useState } from "react";
import { MarketingMediaField } from "@/components/features/marketing/shared/marketing-media-field";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";

export function ServiceImageFields({
  imageUrl,
  imageAlt,
  mediaAssets,
}: {
  imageUrl: string;
  imageAlt: string;
  mediaAssets: MarketingMediaAssetRow[];
}) {
  const [url, setUrl] = useState(imageUrl);
  const [alt, setAlt] = useState(imageAlt);

  return (
    <div className="space-y-3">
      <MarketingMediaField
        label="Service Image"
        intent="SERVICE_PHOTO"
        value={url}
        altValue={alt}
        onChange={(nextUrl, nextAlt) => {
          setUrl(nextUrl);
          setAlt(nextAlt ?? "");
        }}
        availableAssets={mediaAssets}
      />
      <input type="hidden" name="imageUrl" value={url} />
      <label htmlFor="owner-service-image-alt" className="block text-xs font-semibold text-[var(--cs-text)]">
        Image Alt Text
      </label>
      <input
        id="owner-service-image-alt"
        type="text"
        name="imageAlt"
        value={alt}
        onChange={(event) => setAlt(event.target.value)}
        maxLength={220}
        className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2 text-sm text-[var(--cs-text)]"
      />
    </div>
  );
}

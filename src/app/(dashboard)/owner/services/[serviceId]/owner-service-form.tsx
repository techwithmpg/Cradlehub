"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { MarketingMediaField } from "@/components/features/marketing/shared/marketing-media-field";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";

type SaveState = { success: boolean; error?: string };

export function OwnerServiceForm({
  action,
  children,
}: {
  action: (state: SaveState, formData: FormData) => Promise<SaveState>;
  children: ReactNode;
}) {
  const [state, setState] = useState<SaveState>({ success: false });
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        setState(await action(state, formData));
      } catch {
        setState({ success: false, error: "Service save failed. Please try again." });
      }
    });
  }
  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {state.error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error} Your edits are still here; review them and retry.
        </p>
      )}
      {children}
      {pending && <p role="status" className="text-sm text-[var(--cs-text-muted)]">Saving service…</p>}
    </form>
  );
}

export function OwnerServiceImageField({
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
        label="Service Photo (4:3)"
        intent="SERVICE_PHOTO"
        value={url}
        altValue={alt}
        availableAssets={mediaAssets}
        onChange={(nextUrl, nextAlt) => {
          setUrl(nextUrl);
          if (nextAlt !== undefined) setAlt(nextAlt);
        }}
      />
      <input type="hidden" name="imageUrl" value={url} />
      <label htmlFor="owner-service-image-alt" className="block text-sm font-semibold text-[var(--cs-text)]">
        Image Alt Text
      </label>
      <input
        id="owner-service-image-alt"
        name="imageAlt"
        type="text"
        maxLength={300}
        value={alt}
        onChange={(event) => setAlt(event.target.value)}
        className="h-10 w-full rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm text-[var(--cs-text)]"
      />
    </div>
  );
}

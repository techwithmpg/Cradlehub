"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createMarketingAssetAction,
  disableMarketingAssetAction,
  saveMarketingSectionAction,
  updateMarketingAssetAction,
  type MarketingActionState,
} from "./actions";
import type {
  PublicSiteAssetRow,
  PublicSiteSectionRow,
} from "@/lib/queries/public-site";

type SectionDefault = {
  sectionKey: string;
  label: string;
  description: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  secondaryImageUrl: string;
  sortOrder: number;
  isEnabled: boolean;
  metadata: Record<string, unknown>;
};

type MarketingStudioProps = {
  sectionDefaults: readonly SectionDefault[];
  sections: PublicSiteSectionRow[];
  galleryAssets: PublicSiteAssetRow[];
};

const tabs = [
  { id: "hero", label: "Hero" },
  { id: "about", label: "About" },
  { id: "gallery", label: "Gallery" },
  { id: "quote_banner", label: "Promotion" },
  { id: "before_you_book", label: "Before You Book" },
] as const;

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--cs-border)",
  borderRadius: 8,
  background: "var(--cs-surface)",
  color: "var(--cs-text)",
  padding: "0.625rem 0.75rem",
  fontSize: "0.875rem",
  outline: "none",
};

function metadataObject(value: PublicSiteSectionRow["metadata"] | Record<string, unknown>) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sectionValue(
  section: PublicSiteSectionRow | undefined,
  fallback: SectionDefault,
  field: keyof Pick<
    PublicSiteSectionRow,
    | "title"
    | "subtitle"
    | "body"
    | "cta_label"
    | "cta_href"
    | "image_url"
    | "secondary_image_url"
  >
): string {
  const fallbackMap = {
    title: fallback.title,
    subtitle: fallback.subtitle,
    body: fallback.body,
    cta_label: fallback.ctaLabel,
    cta_href: fallback.ctaHref,
    image_url: fallback.imageUrl,
    secondary_image_url: fallback.secondaryImageUrl,
  } satisfies Record<typeof field, string>;

  return section?.[field] ?? fallbackMap[field] ?? "";
}

function itemsText(section: PublicSiteSectionRow | undefined, fallback: SectionDefault) {
  const sectionItems = metadataObject(section?.metadata ?? {}).items;
  if (Array.isArray(sectionItems)) {
    return sectionItems.filter((item): item is string => typeof item === "string").join("\n");
  }

  const fallbackItems = metadataObject(fallback.metadata).items;
  if (Array.isArray(fallbackItems)) {
    return fallbackItems.filter((item): item is string => typeof item === "string").join("\n");
  }

  return "";
}

function RefreshOnSuccess({ state }: { state: MarketingActionState }) {
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return null;
}

export function MarketingStudio({
  sectionDefaults,
  sections,
  galleryAssets,
}: MarketingStudioProps) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("hero");
  const sectionsByKey = useMemo(
    () => new Map(sections.map((section) => [section.section_key, section])),
    [sections]
  );

  const activeSection = sectionDefaults.find(
    (section) => section.sectionKey === activeTab
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: "1px solid var(--cs-border)",
              borderRadius: 8,
              padding: "0.625rem 0.875rem",
              whiteSpace: "nowrap",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color:
                activeTab === tab.id ? "var(--cs-text-inverse)" : "var(--cs-text)",
              background:
                activeTab === tab.id ? "var(--cs-sidebar)" : "var(--cs-surface)",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "gallery" ? (
        <GalleryManager assets={galleryAssets} />
      ) : activeSection ? (
        <SectionEditor
          key={activeSection.sectionKey}
          fallback={activeSection}
          section={sectionsByKey.get(activeSection.sectionKey)}
        />
      ) : null}
    </div>
  );
}

function SectionEditor({
  fallback,
  section,
}: {
  fallback: SectionDefault;
  section?: PublicSiteSectionRow;
}) {
  const [state, formAction, pending] = useActionState(
    saveMarketingSectionAction,
    {}
  );
  const metadata = metadataObject(section?.metadata ?? fallback.metadata);
  const secondaryCtaLabel =
    textValue(metadata.secondaryCtaLabel) ||
    textValue(fallback.metadata.secondaryCtaLabel);
  const secondaryCtaHref =
    textValue(metadata.secondaryCtaHref) ||
    textValue(fallback.metadata.secondaryCtaHref);
  const imageUrl = sectionValue(section, fallback, "image_url");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
        gap: "1rem",
        alignItems: "start",
      }}
      className="max-lg:!grid-cols-1"
    >
      <form
        action={formAction}
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <RefreshOnSuccess state={state} />
        <input type="hidden" name="sectionKey" value={fallback.sectionKey} />
        <input type="hidden" name="sortOrder" value={section?.sort_order ?? fallback.sortOrder} />

        <div>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              color: "var(--cs-text)",
            }}
          >
            {fallback.label}
          </div>
          <p
            style={{
              margin: "0.25rem 0 0",
              color: "var(--cs-text-muted)",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
            }}
          >
            {fallback.description}
          </p>
        </div>

        <ActionNotice state={state} />

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            name="isEnabled"
            defaultChecked={section?.is_enabled ?? fallback.isEnabled}
          />
          <span style={{ fontSize: "0.875rem", color: "var(--cs-text)" }}>
            Published
          </span>
        </label>

        <InputField
          label="Title / Headline"
          name="title"
          defaultValue={sectionValue(section, fallback, "title")}
        />
        <InputField
          label="Subtitle / Eyebrow"
          name="subtitle"
          defaultValue={sectionValue(section, fallback, "subtitle")}
        />
        <TextAreaField
          label="Body copy"
          name="body"
          defaultValue={sectionValue(section, fallback, "body")}
          rows={fallback.sectionKey === "before_you_book" ? 4 : 6}
        />

        {fallback.sectionKey === "before_you_book" && (
          <TextAreaField
            label="Bullet list, one item per line"
            name="items"
            defaultValue={itemsText(section, fallback)}
            rows={7}
          />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "0.875rem",
          }}
          className="max-sm:!grid-cols-1"
        >
          <InputField
            label="CTA label"
            name="ctaLabel"
            defaultValue={sectionValue(section, fallback, "cta_label")}
          />
          <InputField
            label="CTA link"
            name="ctaHref"
            defaultValue={sectionValue(section, fallback, "cta_href")}
            placeholder="/book"
          />
        </div>

        {fallback.sectionKey === "hero" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.875rem",
            }}
            className="max-sm:!grid-cols-1"
          >
            <InputField
              label="Secondary CTA label"
              name="secondaryCtaLabel"
              defaultValue={secondaryCtaLabel}
            />
            <InputField
              label="Secondary CTA link"
              name="secondaryCtaHref"
              defaultValue={secondaryCtaHref}
              placeholder="#plan-your-visit"
            />
          </div>
        )}

        <InputField
          label="Image URL"
          name="imageUrl"
          defaultValue={imageUrl}
          placeholder="/images/spa/hero.jpg or https://..."
        />
        <InputField
          label="Secondary image URL"
          name="secondaryImageUrl"
          defaultValue={sectionValue(section, fallback, "secondary_image_url")}
          placeholder="/images/spa/about-secondary.jpg"
        />

        <button
          type="submit"
          disabled={pending}
          className="cs-btn cs-btn-primary"
          style={{ alignSelf: "flex-start", opacity: pending ? 0.65 : 1 }}
        >
          {pending ? "Saving..." : "Save Section"}
        </button>
      </form>

      <PreviewCard
        title={sectionValue(section, fallback, "title")}
        subtitle={sectionValue(section, fallback, "subtitle")}
        body={sectionValue(section, fallback, "body")}
        imageUrl={imageUrl}
      />
    </div>
  );
}

function GalleryManager({ assets }: { assets: PublicSiteAssetRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          borderRadius: 10,
          padding: "1rem",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "var(--cs-text)",
          }}
        >
          Add Gallery Image
        </h3>
        <p
          style={{
            margin: "0.25rem 0 1rem",
            color: "var(--cs-text-muted)",
            fontSize: "0.8125rem",
          }}
        >
          Upload support is not configured yet. Add a local public path or safe image URL.
        </p>
        <AssetCreateForm />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "1rem",
        }}
        className="max-lg:!grid-cols-1"
      >
        {assets.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              border: "1px dashed var(--cs-border-strong)",
              borderRadius: 10,
              padding: "1.5rem",
              color: "var(--cs-text-muted)",
              background: "var(--cs-surface-warm)",
              fontSize: "0.875rem",
            }}
          >
            No managed gallery assets yet. The public homepage will use local fallback gallery cards.
          </div>
        ) : (
          assets.map((asset) => <AssetEditor key={asset.id} asset={asset} />)
        )}
      </div>
    </div>
  );
}

function AssetCreateForm() {
  const [state, formAction, pending] = useActionState(
    createMarketingAssetAction,
    {}
  );

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.875rem" }}>
      <RefreshOnSuccess state={state} />
      <ActionNotice state={state} />
      <input type="hidden" name="sectionKey" value="gallery" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "0.875rem",
        }}
        className="max-sm:!grid-cols-1"
      >
        <InputField label="Title" name="title" defaultValue="" />
        <InputField label="Sort order" name="sortOrder" defaultValue="0" type="number" />
      </div>
      <InputField
        label="Image URL"
        name="imageUrl"
        defaultValue=""
        placeholder="/images/spa/about.jpg or https://..."
      />
      <InputField label="Alt text" name="altText" defaultValue="" />
      <InputField label="Optional link" name="linkHref" defaultValue="" placeholder="/book" />
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input type="checkbox" name="isEnabled" defaultChecked />
        <span style={{ fontSize: "0.875rem" }}>Published</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="cs-btn cs-btn-primary"
        style={{ justifySelf: "start", opacity: pending ? 0.65 : 1 }}
      >
        {pending ? "Adding..." : "Add Image"}
      </button>
    </form>
  );
}

function AssetEditor({ asset }: { asset: PublicSiteAssetRow }) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateMarketingAssetAction,
    {}
  );
  const [disableState, disableAction, disablePending] = useActionState(
    disableMarketingAssetAction,
    {}
  );

  return (
    <div
      style={{
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        background: "var(--cs-surface)",
        overflow: "hidden",
      }}
    >
      {asset.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.image_url}
          alt={asset.alt_text ?? "Public site gallery asset"}
          style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
        />
      )}
      <div style={{ padding: "1rem" }}>
        <form action={updateAction} style={{ display: "grid", gap: "0.75rem" }}>
          <RefreshOnSuccess state={updateState} />
          <ActionNotice state={updateState} />
          <input type="hidden" name="id" value={asset.id} />
          <input type="hidden" name="sectionKey" value={asset.section_key ?? "gallery"} />
          <InputField label="Title" name="title" defaultValue={asset.title ?? ""} />
          <InputField label="Image URL" name="imageUrl" defaultValue={asset.image_url} />
          <InputField label="Alt text" name="altText" defaultValue={asset.alt_text ?? ""} />
          <InputField label="Optional link" name="linkHref" defaultValue={asset.link_href ?? ""} />
          <InputField
            label="Sort order"
            name="sortOrder"
            defaultValue={String(asset.sort_order)}
            type="number"
          />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" name="isEnabled" defaultChecked={asset.is_enabled} />
            <span style={{ fontSize: "0.875rem" }}>Published</span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="submit"
              disabled={updatePending}
              className="cs-btn cs-btn-primary"
              style={{ opacity: updatePending ? 0.65 : 1 }}
            >
              {updatePending ? "Saving..." : "Save Image"}
            </button>
          </div>
        </form>

        <form action={disableAction} style={{ marginTop: "0.5rem" }}>
          <RefreshOnSuccess state={disableState} />
          <input type="hidden" name="id" value={asset.id} />
          <button
            type="submit"
            disabled={disablePending}
            className="cs-btn cs-btn-secondary"
            style={{ opacity: disablePending ? 0.65 : 1 }}
          >
            {disablePending ? "Disabling..." : "Disable Image"}
          </button>
          <ActionNotice state={disableState} />
        </form>
      </div>
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
  body,
  imageUrl,
}: {
  title: string;
  subtitle: string;
  body: string;
  imageUrl: string;
}) {
  return (
    <aside
      style={{
        background: "var(--cs-surface)",
        border: "1px solid var(--cs-border)",
        borderRadius: 10,
        overflow: "hidden",
        position: "sticky",
        top: 20,
      }}
      className="max-lg:!static"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }}
        />
      ) : null}
      <div style={{ padding: "1rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: "var(--cs-sand)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
          }}
        >
          Preview
        </p>
        <h3
          style={{
            margin: "0.5rem 0 0",
            fontSize: "1.125rem",
            color: "var(--cs-text)",
            fontFamily: "var(--cs-font-display)",
            lineHeight: 1.25,
          }}
        >
          {title || "Untitled section"}
        </h3>
        {subtitle && (
          <p
            style={{
              margin: "0.5rem 0 0",
              fontSize: "0.8125rem",
              color: "var(--cs-text-muted)",
            }}
          >
            {subtitle}
          </p>
        )}
        {body && (
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.8125rem",
              color: "var(--cs-text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {body}
          </p>
        )}
      </div>
    </aside>
  );
}

function ActionNotice({ state }: { state: MarketingActionState }) {
  if (!state.error && !state.message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        borderRadius: 8,
        padding: "0.625rem 0.75rem",
        fontSize: "0.8125rem",
        border: state.error ? "1px solid #FECACA" : "1px solid #BBF7D0",
        background: state.error ? "#FEF2F2" : "#F0FDF4",
        color: state.error ? "#991B1B" : "#15803D",
      }}
    >
      {state.error ?? state.message}
    </div>
  );
}

function InputField({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={{ color: "var(--cs-text-muted)", fontSize: "0.8125rem" }}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={fieldStyle}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows: number;
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={{ color: "var(--cs-text-muted)", fontSize: "0.8125rem" }}>
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
      />
    </label>
  );
}

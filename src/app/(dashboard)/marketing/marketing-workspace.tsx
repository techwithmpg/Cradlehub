"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileText, Image as ImageIcon, Save, Send } from "lucide-react";
import type { MarketingSectionDefault } from "@/lib/marketing/public-section-defaults";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import { UniversalMediaPicker } from "@/components/features/marketing/media/universal-media-picker";
import {
  saveMarketingDraftAction,
  submitMarketingDraftAction,
  type MarketingDraftActionState,
} from "./actions";

type MarketingWorkspaceProps = {
  sectionDefaults: readonly MarketingSectionDefault[];
  publishedSections: PublicSiteSectionRow[];
  galleryAssets: PublicSiteAssetRow[];
  drafts: MarketingContentDraftRow[];
  revisions: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
};

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

function metadataObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function prettyJson(value: unknown): string {
  return JSON.stringify(metadataObject(value), null, 2);
}

function draftStatusLabel(status?: string | null): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "changes_requested":
      return "Changes Requested";
    case "approved":
      return "Approved";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

function statusColor(status?: string | null): {
  color: string;
  background: string;
  border: string;
} {
  switch (status) {
    case "submitted":
      return { color: "#075985", background: "#E0F2FE", border: "#BAE6FD" };
    case "changes_requested":
      return { color: "#92400E", background: "#FEF3C7", border: "#FDE68A" };
    case "approved":
    case "scheduled":
      return { color: "#166534", background: "#DCFCE7", border: "#BBF7D0" };
    case "published":
      return { color: "#14532D", background: "#DCFCE7", border: "#86EFAC" };
    case "archived":
      return { color: "#57534E", background: "#F5F5F4", border: "#E7E5E4" };
    default:
      return {
        color: "var(--cs-text-secondary)",
        background: "var(--cs-surface-warm)",
        border: "var(--cs-border-soft)",
      };
  }
}

function valueFor(
  draft: MarketingContentDraftRow | undefined,
  published: PublicSiteSectionRow | undefined,
  fallback: MarketingSectionDefault,
  field: keyof Pick<
    PublicSiteSectionRow,
    "title" | "subtitle" | "body" | "cta_label" | "cta_href" | "image_url" | "secondary_image_url"
  >
): string {
  const draftMap = {
    title: draft?.title,
    subtitle: draft?.subtitle,
    body: draft?.body,
    cta_label: draft?.cta_label,
    cta_href: draft?.cta_href,
    image_url: draft?.image_url,
    secondary_image_url: draft?.secondary_image_url,
  } satisfies Record<typeof field, string | null | undefined>;
  const fallbackMap = {
    title: fallback.title,
    subtitle: fallback.subtitle,
    body: fallback.body,
    cta_label: fallback.ctaLabel,
    cta_href: fallback.ctaHref,
    image_url: fallback.imageUrl,
    secondary_image_url: fallback.secondaryImageUrl,
  } satisfies Record<typeof field, string>;

  return draftMap[field] ?? published?.[field] ?? fallbackMap[field] ?? "";
}

function ApplyDraftResult({
  state,
  onSaved,
}: {
  state: MarketingDraftActionState;
  onSaved: (draft: MarketingContentDraftRow) => void;
}) {
  useEffect(() => {
    if (state.draft) onSaved(state.draft);
  }, [onSaved, state.draft]);

  return null;
}

export function MarketingWorkspace({
  sectionDefaults,
  publishedSections,
  galleryAssets,
  drafts,
  revisions,
  mediaAssets = [],
}: MarketingWorkspaceProps) {
  const [activeKey, setActiveKey] = useState(sectionDefaults[0]?.sectionKey ?? "hero");
  const [workspaceDrafts, setWorkspaceDrafts] = useState(drafts);
  const draftsByKey = useMemo(
    () =>
      new Map(
        workspaceDrafts
          .filter((draft) => draft.content_type === "section")
          .map((draft) => [draft.content_key, draft])
      ),
    [workspaceDrafts]
  );
  const publishedByKey = useMemo(
    () => new Map(publishedSections.map((section) => [section.section_key, section])),
    [publishedSections]
  );
  const activeDefault =
    sectionDefaults.find((section) => section.sectionKey === activeKey) ?? sectionDefaults[0];
  const activeDraft = activeDefault ? draftsByKey.get(activeDefault.sectionKey) : undefined;
  const activePublished = activeDefault ? publishedByKey.get(activeDefault.sectionKey) : undefined;

  const saveDraft = useCallback((saved: MarketingContentDraftRow) => {
    setWorkspaceDrafts((current) => {
      const remaining = current.filter((draft) => draft.id !== saved.id);
      return [saved, ...remaining].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, []);

  if (!activeDefault) return null;

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "1rem" }}
      className="max-lg:!grid-cols-1"
    >
      <aside style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div
          style={{
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            background: "var(--cs-surface)",
            overflow: "hidden",
          }}
        >
          {sectionDefaults.map((section) => {
            const draft = draftsByKey.get(section.sectionKey);
            const active = activeKey === section.sectionKey;
            const colors = statusColor(draft?.status);
            return (
              <button
                key={section.sectionKey}
                type="button"
                onClick={() => setActiveKey(section.sectionKey)}
                style={{
                  width: "100%",
                  border: 0,
                  borderBottom: "1px solid var(--cs-border-soft)",
                  background: active ? "var(--cs-surface-warm)" : "transparent",
                  color: "var(--cs-text)",
                  cursor: "pointer",
                  padding: "0.875rem",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText className="size-4" />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 650 }}>{section.label}</span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    marginTop: 8,
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.background,
                    color: colors.color,
                    padding: "0.125rem 0.45rem",
                    fontSize: 11,
                    fontWeight: 650,
                  }}
                >
                  {draftStatusLabel(draft?.status)}
                </span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            background: "var(--cs-surface)",
            padding: "0.875rem",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cs-text)" }}>
            Gallery Assets
          </div>
          <div style={{ marginTop: 6, color: "var(--cs-text-muted)", fontSize: 12 }}>
            {galleryAssets.length} managed image{galleryAssets.length === 1 ? "" : "s"}
          </div>
        </div>
      </aside>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
        <MarketingDraftEditor
          key={`${activeDefault.sectionKey}:${activeDraft?.id ?? "new"}:${activeDraft?.updated_at ?? activePublished?.updated_at ?? "fallback"}`}
          draft={activeDraft}
          fallback={activeDefault}
          onSaved={saveDraft}
          published={activePublished}
          mediaAssets={mediaAssets}
        />

        <RevisionList revisions={revisions} />
      </div>
    </div>
  );
}

function MarketingDraftEditor({
  draft,
  fallback,
  onSaved,
  published,
  mediaAssets = [],
}: {
  draft?: MarketingContentDraftRow;
  fallback: MarketingSectionDefault;
  onSaved: (draft: MarketingContentDraftRow) => void;
  published?: PublicSiteSectionRow;
  mediaAssets?: MarketingMediaAssetRow[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveMarketingDraftAction, {});
  const [submitState, submitAction, submitPending] = useActionState(submitMarketingDraftAction, {});
  const currentDraft = saveState.draft ?? submitState.draft ?? draft;
  const metadata = currentDraft?.metadata ?? published?.metadata ?? fallback.metadata;
  const colors = statusColor(currentDraft?.status);
  const title = valueFor(currentDraft, published, fallback, "title");
  const subtitle = valueFor(currentDraft, published, fallback, "subtitle");
  const body = valueFor(currentDraft, published, fallback, "body");
  const imageUrl = valueFor(currentDraft, published, fallback, "image_url");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 340px",
        gap: "1rem",
        alignItems: "start",
      }}
      className="max-xl:!grid-cols-1"
    >
      <form
        action={saveAction}
        style={{
          border: "1px solid var(--cs-border)",
          borderRadius: 8,
          background: "var(--cs-surface)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        <ApplyDraftResult state={saveState} onSaved={onSaved} />
        <ApplyDraftResult state={submitState} onSaved={onSaved} />
        <input type="hidden" name="id" value={currentDraft?.id ?? ""} />
        <input type="hidden" name="contentType" value="section" />
        <input type="hidden" name="contentKey" value={fallback.sectionKey} />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 750, color: "var(--cs-text)" }}>
              {fallback.label}
            </div>
            <p
              style={{
                margin: "0.25rem 0 0",
                color: "var(--cs-text-muted)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {fallback.description}
            </p>
          </div>
          <span
            style={{
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.background,
              color: colors.color,
              padding: "0.25rem 0.55rem",
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {draftStatusLabel(currentDraft?.status)}
          </span>
        </div>

        <ActionNotice state={saveState} />
        <ActionNotice state={submitState} />

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            name="isEnabled"
            defaultChecked={currentDraft?.is_enabled ?? published?.is_enabled ?? fallback.isEnabled}
          />
          <span style={{ fontSize: "0.875rem", color: "var(--cs-text)" }}>
            Target public visibility
          </span>
        </label>

        <InputField label="Title / Headline" name="title" defaultValue={title} />
        <InputField label="Subtitle / Eyebrow" name="subtitle" defaultValue={subtitle} />
        <TextAreaField label="Body copy" name="body" defaultValue={body} rows={6} />

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
            defaultValue={valueFor(currentDraft, published, fallback, "cta_label")}
          />
          <InputField
            label="CTA link"
            name="ctaHref"
            defaultValue={valueFor(currentDraft, published, fallback, "cta_href")}
            placeholder="/book"
          />
        </div>

        <ImagePickerField
          label="Image URL"
          name="imageUrl"
          defaultValue={imageUrl}
          placeholder="/images/spa/hero.jpg or https://..."
          mediaAssets={mediaAssets}
          sectionKey={fallback.sectionKey}
        />
        <ImagePickerField
          label="Secondary image URL"
          name="secondaryImageUrl"
          defaultValue={valueFor(currentDraft, published, fallback, "secondary_image_url")}
          placeholder="/images/spa/about-secondary.jpg"
          mediaAssets={mediaAssets}
          sectionKey={fallback.sectionKey}
        />

        <input type="hidden" name="altText" value="" />
        <input type="hidden" name="linkHref" value="" />
        <input
          type="hidden"
          name="sortOrder"
          value={String(currentDraft?.sort_order ?? published?.sort_order ?? fallback.sortOrder)}
        />
        <TextAreaField
          label="Metadata JSON"
          name="metadataJson"
          defaultValue={prettyJson(metadata)}
          rows={7}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
          <button
            type="submit"
            disabled={savePending}
            className="cs-btn cs-btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: savePending ? 0.65 : 1,
            }}
          >
            <Save className="size-4" />
            {savePending ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </form>

      <aside style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <PreviewCard title={title} subtitle={subtitle} body={body} imageUrl={imageUrl} />

        <form
          action={submitAction}
          style={{
            border: "1px solid var(--cs-border)",
            borderRadius: 8,
            background: "var(--cs-surface)",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <input type="hidden" name="id" value={currentDraft?.id ?? ""} />
          <button
            type="submit"
            disabled={!currentDraft?.id || submitPending}
            className="cs-btn cs-btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: !currentDraft?.id || submitPending ? 0.55 : 1,
            }}
          >
            <Send className="size-4" />
            {submitPending ? "Submitting..." : "Submit For Review"}
          </button>
          <div style={{ color: "var(--cs-text-muted)", fontSize: 12, lineHeight: 1.5 }}>
            Owner publishing still happens from the approved live content path.
          </div>
        </form>
      </aside>
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
    <div
      style={{
        border: "1px solid var(--cs-border)",
        borderRadius: 8,
        background: "var(--cs-surface)",
        overflow: "hidden",
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }}
        />
      ) : null}
      <div style={{ padding: "1rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--cs-sand)",
            fontSize: 12,
            fontWeight: 750,
          }}
        >
          <Eye className="size-4" />
          Preview
        </div>
        <h3
          style={{
            margin: "0.625rem 0 0",
            color: "var(--cs-text)",
            fontFamily: "var(--cs-font-display)",
            fontSize: "1.125rem",
            lineHeight: 1.25,
          }}
        >
          {title || "Untitled section"}
        </h3>
        {subtitle ? (
          <p style={{ margin: "0.5rem 0 0", color: "var(--cs-text-muted)", fontSize: 13 }}>
            {subtitle}
          </p>
        ) : null}
        {body ? (
          <p
            style={{
              margin: "0.75rem 0 0",
              color: "var(--cs-text-secondary)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RevisionList({ revisions }: { revisions: MarketingContentRevisionRow[] }) {
  return (
    <section
      style={{
        border: "1px solid var(--cs-border)",
        borderRadius: 8,
        background: "var(--cs-surface)",
        padding: "1rem",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 750, color: "var(--cs-text)" }}>Recent Revisions</div>
      {revisions.length === 0 ? (
        <div style={{ marginTop: 10, color: "var(--cs-text-muted)", fontSize: 13 }}>
          No draft revision history yet.
        </div>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {revisions.map((revision) => {
            const snapshot = metadataObject(revision.snapshot);
            return (
              <div
                key={revision.id}
                style={{
                  border: "1px solid var(--cs-border-soft)",
                  borderRadius: 8,
                  padding: "0.75rem",
                  display: "grid",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ color: "var(--cs-text)", fontSize: 13, fontWeight: 700 }}>
                    {String(snapshot.contentKey ?? "marketing")}
                  </span>
                  <span style={{ color: "var(--cs-text-muted)", fontSize: 12 }}>
                    {revision.action.replace(/_/g, " ")} #{revision.revision_no}
                  </span>
                </div>
                <div style={{ color: "var(--cs-text-muted)", fontSize: 12 }}>
                  {new Date(revision.created_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActionNotice({ state }: { state: MarketingDraftActionState }) {
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
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "0.375rem" }}>
      <span style={{ color: "var(--cs-text-muted)", fontSize: "0.8125rem" }}>{label}</span>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={fieldStyle}
      />
    </label>
  );
}

function ImagePickerField({
  label,
  name,
  defaultValue,
  placeholder,
  mediaAssets = [],
  sectionKey,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  mediaAssets?: MarketingMediaAssetRow[];
  sectionKey?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  return (
    <div style={{ display: "grid", gap: "0.375rem" }}>
      <span style={{ color: "var(--cs-text-muted)", fontSize: "0.8125rem" }}>{label}</span>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          name={name}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          style={{ ...fieldStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={() => setIsPickerOpen(true)}
          className="cs-btn cs-btn-secondary"
          style={{
            minHeight: 44,
            padding: "0 0.875rem",
            fontSize: 12,
            fontWeight: 650,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <ImageIcon className="size-3.5" />
          Choose Image
        </button>
      </div>

      <UniversalMediaPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(selected) => {
          setValue(selected.publicUrl);
        }}
        currentUrl={value}
        availableAssets={mediaAssets}
        filterSectionKey={sectionKey}
      />
    </div>
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
      <span style={{ color: "var(--cs-text-muted)", fontSize: "0.8125rem" }}>{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
      />
    </label>
  );
}

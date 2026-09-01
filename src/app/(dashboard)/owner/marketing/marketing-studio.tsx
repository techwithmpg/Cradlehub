"use client";

import { useActionState } from "react";
import type { MarketingSectionDefault } from "@/lib/marketing/public-section-defaults";
import type {
  MarketingContentDraftRow,
  MarketingContentRevisionRow,
} from "@/lib/queries/marketing-content";
import type { MarketingMediaAssetRow } from "@/lib/queries/marketing-media";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { PublicSiteAssetRow, PublicSiteSectionRow } from "@/lib/queries/public-site";
import type { Database } from "@/types/supabase";
import { WebsiteStudioView } from "@/components/features/marketing/website/website-studio-view";
import {
  approveMarketingDraftAction,
  archiveMarketingDraftAction,
  publishMarketingDraftAction,
  requestMarketingDraftChangesAction,
  scheduleMarketingDraftAction,
  type MarketingActionState,
} from "./actions";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export type MarketingStudioProps = {
  sectionDefaults: readonly MarketingSectionDefault[];
  sections: PublicSiteSectionRow[];
  galleryAssets: PublicSiteAssetRow[];
  drafts: MarketingContentDraftRow[];
  revisions: MarketingContentRevisionRow[];
  mediaAssets?: MarketingMediaAssetRow[];
  branches?: BranchRow[];
  services?: PublicCatalogService[];
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ActionNotice({ state }: { state: MarketingActionState }) {
  if (!state.error && !state.message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border px-3 py-2 text-xs ${
        state.error
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          : "border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300"
      }`}
    >
      {state.error ?? state.message}
    </div>
  );
}

function DraftReviewItem({ draft }: { draft: MarketingContentDraftRow }) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveMarketingDraftAction,
    {}
  );
  const [changesState, changesAction, changesPending] = useActionState(
    requestMarketingDraftChangesAction,
    {}
  );
  const [scheduleState, scheduleAction, schedulePending] = useActionState(
    scheduleMarketingDraftAction,
    {}
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishMarketingDraftAction,
    {}
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveMarketingDraftAction,
    {}
  );

  const currentDraft =
    approveState.draft ??
    changesState.draft ??
    scheduleState.draft ??
    publishState.draft ??
    archiveState.draft ??
    draft;

  const busy =
    approvePending || changesPending || schedulePending || publishPending || archivePending;
  const canPublish = ["submitted", "approved", "scheduled"].includes(currentDraft.status);

  return (
    <article className="grid gap-3 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[var(--cs-text)]">
            {currentDraft.title || currentDraft.content_key}
          </div>
          <div className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
            {currentDraft.content_type} / {currentDraft.content_key}
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-md border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2 py-0.5 text-xs font-semibold text-[var(--cs-text-secondary)]">
          {statusLabel(currentDraft.status)}
        </span>
      </div>

      {currentDraft.body && (
        <p className="text-xs leading-relaxed text-[var(--cs-text-secondary)]">
          {currentDraft.body}
        </p>
      )}

      {currentDraft.review_note && (
        <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Review note: {currentDraft.review_note}
        </div>
      )}

      <ActionNotice state={approveState} />
      <ActionNotice state={changesState} />
      <ActionNotice state={scheduleState} />
      <ActionNotice state={publishState} />
      <ActionNotice state={archiveState} />

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <form action={changesAction} className="grid gap-2">
          <input type="hidden" name="id" value={currentDraft.id} />
          <textarea
            name="reviewNote"
            rows={2}
            placeholder="Owner review note..."
            className="w-full rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 text-xs text-[var(--cs-text)] outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-8 items-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
            >
              {changesPending ? "Sending..." : "Request Changes"}
            </button>
          </div>
        </form>

        <div className="grid gap-2">
          <form action={approveAction}>
            <input type="hidden" name="id" value={currentDraft.id} />
            <input type="hidden" name="reviewNote" value="" />
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
            >
              {approvePending ? "Approving..." : "Approve"}
            </button>
          </form>

          <form action={publishAction}>
            <input type="hidden" name="id" value={currentDraft.id} />
            <button
              type="submit"
              disabled={busy || !canPublish}
              className="w-full inline-flex min-h-8 items-center justify-center rounded-lg bg-[var(--cs-primary)] px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {publishPending ? "Publishing..." : "Publish to Live"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <form action={scheduleAction} className="flex gap-2">
          <input type="hidden" name="id" value={currentDraft.id} />
          <input type="hidden" name="reviewNote" value="" />
          <input
            type="datetime-local"
            name="scheduledFor"
            disabled={busy}
            className="flex-1 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 py-1 text-xs text-[var(--cs-text)] outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-8 items-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)] disabled:opacity-50"
          >
            {schedulePending ? "Scheduling..." : "Schedule"}
          </button>
        </form>

        <form action={archiveAction}>
          <input type="hidden" name="id" value={currentDraft.id} />
          <input type="hidden" name="reviewNote" value="" />
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex min-h-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {archivePending ? "Archiving..." : "Archive"}
          </button>
        </form>
      </div>
    </article>
  );
}

function DraftReviewQueue({
  drafts,
  revisions,
}: {
  drafts: MarketingContentDraftRow[];
  revisions: MarketingContentRevisionRow[];
}) {
  const visibleDrafts = drafts.filter((draft) => draft.status !== "archived").slice(0, 12);

  return (
    <section className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--cs-text)]">Draft Review Queue & History</h2>
          <p className="mt-0.5 text-xs text-[var(--cs-text-secondary)]">
            Review workspace drafts and audit history before they affect the live site.
          </p>
        </div>
        <span className="text-xs text-[var(--cs-text-secondary)]">
          {revisions.length} recent revision{revisions.length === 1 ? "" : "s"}
        </span>
      </div>

      {visibleDrafts.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--cs-border)] bg-[var(--cs-surface-warm)] p-4 text-center text-xs text-[var(--cs-text-secondary)]">
          No draft reviews are waiting in the queue.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleDrafts.map((draft) => (
            <DraftReviewItem key={`${draft.id}:${draft.updated_at}`} draft={draft} />
          ))}
        </div>
      )}
    </section>
  );
}

export function MarketingStudio({
  sectionDefaults,
  sections,
  galleryAssets,
  drafts,
  revisions,
  mediaAssets = [],
  branches = [],
  services = [],
}: MarketingStudioProps) {
  return (
    <div className="space-y-6">
      <WebsiteStudioView
        role="owner"
        sectionDefaults={sectionDefaults}
        publishedSections={sections}
        galleryAssets={galleryAssets}
        drafts={drafts}
        revisions={revisions}
        mediaAssets={mediaAssets}
        branches={branches}
        services={services}
      />

      <DraftReviewQueue drafts={drafts} revisions={revisions} />
    </div>
  );
}

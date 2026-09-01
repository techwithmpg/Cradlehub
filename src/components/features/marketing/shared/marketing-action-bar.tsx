"use client";

import React from "react";
import { CheckCircle, Clock, RotateCcw, Save, Send } from "lucide-react";

export type MarketingActionBarProps = {
  role: "digital_marketer" | "owner";
  draftStatus?: "draft" | "submitted" | "changes_requested" | "approved" | "published" | null;
  isDirty?: boolean;
  isSaving?: boolean;
  isSubmitting?: boolean;
  isPublishing?: boolean;
  onSave?: () => void;
  onSubmit?: () => void;
  onPublish?: () => void;
  onRevert?: () => void;
  publishLabel?: string;
  customActions?: React.ReactNode;
  className?: string;
};

export function MarketingActionBar({
  role,
  draftStatus,
  isDirty = false,
  isSaving = false,
  isSubmitting = false,
  isPublishing = false,
  onSave,
  onSubmit,
  onPublish,
  onRevert,
  publishLabel = "Publish to Live",
  customActions,
  className = "",
}: MarketingActionBarProps) {
  const getStatusPill = () => {
    switch (draftStatus) {
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            <Clock className="h-3 w-3" />
            Submitted for Review
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        );
      case "changes_requested":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Changes Requested
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cs-text-secondary)]">
            Draft
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        {getStatusPill()}
        {isDirty && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Unsaved Changes
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onRevert && isDirty && (
          <button
            type="button"
            onClick={onRevert}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-3 py-2 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Revert
          </button>
        )}

        {onSave && (
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-4 py-2 text-xs font-semibold text-[var(--cs-text)] shadow-xs transition hover:bg-[var(--cs-surface)] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5 text-[#C8A96B]" />
            {isSaving ? "Saving..." : "Save Draft"}
          </button>
        )}

        {onSubmit && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-4 py-2 text-xs font-semibold text-[#10261D] shadow-xs transition hover:bg-[#D4B57A] disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? "Submitting..." : "Submit for Review"}
          </button>
        )}

        {role === "owner" && onPublish && (
          <button
            type="button"
            disabled={isPublishing}
            onClick={onPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#163A2B] px-4 py-2 text-xs font-semibold text-[#F6EBD6] shadow-xs transition hover:bg-[#1D4A35] disabled:opacity-50"
          >
            <CheckCircle className="h-3.5 w-3.5 text-[#C8A96B]" />
            {isPublishing ? "Publishing..." : publishLabel}
          </button>
        )}

        {customActions}
      </div>
    </div>
  );
}

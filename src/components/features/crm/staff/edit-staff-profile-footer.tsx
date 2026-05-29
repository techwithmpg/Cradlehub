"use client";

import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditStaffProfileFooter({
  changeCount,
  isSaving,
  saveDisabled,
  onCancel,
}: {
  changeCount: number;
  isSaving: boolean;
  saveDisabled: boolean;
  onCancel: () => void;
}) {
  const hasChanges = changeCount > 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        className={cn(
          "min-h-9 text-xs transition-opacity",
          hasChanges ? "opacity-100" : "opacity-75"
        )}
      >
        {hasChanges ? (
          <div className="flex items-start gap-2 text-amber-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Unsaved changes</p>
              <p>
                {changeCount} {changeCount === 1 ? "change" : "changes"}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-[var(--cs-text-muted)]">No unsaved changes</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--cs-border)] bg-white px-5 text-sm font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="crm-staff-edit-form"
          disabled={saveDisabled}
          className={cn(
            "inline-flex h-10 items-center justify-center rounded-xl bg-[var(--cs-sand)] px-5 text-sm font-bold text-white shadow-[var(--cs-shadow-xs)] transition",
            saveDisabled
              ? "cursor-not-allowed opacity-60"
              : "hover:bg-[var(--cs-sand-dark)]"
          )}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

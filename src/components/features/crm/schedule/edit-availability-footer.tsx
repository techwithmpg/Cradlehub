"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditAvailabilityFooter({
  dirty,
  changeCount,
  isSaving,
  saveDisabled,
  onCancel,
  onSave,
}: {
  dirty: boolean;
  changeCount: number;
  isSaving: boolean;
  saveDisabled: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-h-6 text-sm">
        {dirty ? (
          <div className="flex items-center gap-2 text-[var(--cs-warning)]">
            <AlertTriangle className="size-4" />
            <span className="font-semibold">
              {changeCount > 0
                ? `${changeCount} unsaved change${changeCount !== 1 ? "s" : ""}`
                : "You have unsaved changes"}
            </span>
          </div>
        ) : (
          <span className="text-[var(--cs-text-muted)]">No unsaved changes</span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-xl px-4"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-9 rounded-xl bg-[var(--cs-sand)] px-4 text-white hover:bg-[var(--cs-sand-dark)]"
          onClick={onSave}
          disabled={saveDisabled || isSaving}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

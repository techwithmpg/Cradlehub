"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type UnsavedChangesDialogProps = {
  isOpen: boolean;
  onStay: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
  stayLabel?: string;
  discardLabel?: string;
};

export function UnsavedChangesDialog({
  isOpen,
  onStay,
  onDiscard,
  title = "Unsaved Changes",
  message = "You have unsaved edits in this section. If you leave now, your changes will not be saved.",
  stayLabel = "Stay and Keep Editing",
  discardLabel = "Discard Changes",
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onStay()}>
      <DialogContent className="max-w-md rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-2xl">
        <DialogHeader className="flex flex-row items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold text-[var(--cs-text)]">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {discardLabel}
          </button>
          <button
            type="button"
            onClick={onStay}
            autoFocus
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--cs-primary)] px-4 text-xs font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--cs-primary)]"
          >
            {stayLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type RevertToLiveDialogProps = {
  isOpen: boolean;
  sectionName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RevertToLiveDialog({
  isOpen,
  sectionName,
  onCancel,
  onConfirm,
}: RevertToLiveDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-2xl">
        <DialogHeader className="flex flex-row items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold text-[var(--cs-text)]">
              Revert {sectionName} to Live Values?
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              This resets your in-memory editor to match the published live version. Any unsaved
              edits will be discarded.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-xs font-semibold text-[var(--cs-text)] transition hover:bg-[var(--cs-surface-warm)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--cs-primary)] px-4 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Revert to Live
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

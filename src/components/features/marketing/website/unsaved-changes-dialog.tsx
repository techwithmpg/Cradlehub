"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    stayButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onStay();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onStay]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="unsaved-dialog-title" className="text-base font-semibold text-[var(--cs-text)]">
              {title}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onStay}
            className="rounded-lg p-1 text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)] focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {discardLabel}
          </button>
          <button
            ref={stayButtonRef}
            type="button"
            onClick={onStay}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--cs-primary)] px-4 text-xs font-semibold text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--cs-primary)]"
          >
            {stayLabel}
          </button>
        </div>
      </div>
    </div>
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
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revert-dialog-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="revert-dialog-title" className="text-base font-semibold text-[var(--cs-text)]">
              Revert {sectionName} to Live Values?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--cs-text-secondary)]">
              This resets your in-memory editor to match the published live version. Any unsaved
              edits will be discarded.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
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
      </div>
    </div>
  );
}

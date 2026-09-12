"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { StaffPrimaryAction } from "./primary-action";

type StaffConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function StaffConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: StaffConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={loading ? undefined : onCancel}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#EAE4DC] bg-white p-6 shadow-2xl transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            {isDestructive ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDEBEC] text-[#9B1C20]">
                <AlertTriangle size={18} aria-hidden="true" />
              </span>
            ) : null}
            <h2
              id="staff-dialog-title"
              className="text-lg font-bold text-[#1E293B]"
            >
              {title}
            </h2>
          </div>

          {!loading ? (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close dialog"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="text-xs text-[#475569] leading-relaxed mb-6">
          {description}
        </div>

        <div className="flex flex-col gap-2">
          <StaffPrimaryAction
            variant={isDestructive ? "destructive" : "primary"}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </StaffPrimaryAction>

          {!loading ? (
            <StaffPrimaryAction
              variant="secondary"
              onClick={onCancel}
            >
              {cancelLabel}
            </StaffPrimaryAction>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type StaffActionSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function StaffActionSheet({
  open,
  title,
  onClose,
  children,
}: StaffActionSheetProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content Container */}
      <div
        className="relative z-10 max-h-[85vh] w-full rounded-t-3xl border-t border-[#EAE4DC] bg-white p-5 shadow-2xl overflow-y-auto"
        style={{
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Grab Handle */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#CBD5E1]" aria-hidden="true" />

        <div className="flex items-center justify-between mb-4 border-b border-[#EAE4DC] pb-3">
          <h2 className="text-base font-bold text-[#1E293B]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sheet"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] hover:bg-black/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163A2B]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}

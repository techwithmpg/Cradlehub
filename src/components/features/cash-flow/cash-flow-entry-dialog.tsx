"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import type { CashFlowEntry } from "@/lib/cash-flow/read-model";
import { cn } from "@/lib/utils";
import { CashFlowCreateEntryForm } from "./cash-flow-create-entry-form";
import { CashFlowCorrectionForm } from "./cash-flow-correction-form";
import type { CashFlowEntryType } from "./cash-flow-entry-type-selector";

export type CashFlowModalMode = "create" | "correct";

export interface CashFlowEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: CashFlowModalMode;
  defaultEntryType?: CashFlowEntryType;
  transaction?: CashFlowEntry | null;
  branchName?: string;
}

export function CashFlowEntryDialog({
  open,
  onOpenChange,
  mode = "create",
  defaultEntryType = "expense",
  transaction,
  branchName = "Cradle Wellness Living Main Spa",
}: CashFlowEntryDialogProps) {
  const isCreate = mode === "create";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Dimmed backdrop overlay */}
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />

        {/* Modal Popup Window */}
        <DialogPrimitive.Popup
          role="dialog"
          aria-modal="true"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl -translate-x-1/2 -translate-y-1/2",
            "max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          )}
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 pb-4">
            <div className="space-y-1">
              <DialogPrimitive.Title className="text-xl font-bold tracking-tight text-[var(--cs-text)] sm:text-2xl">
                {isCreate ? "New Cash Flow Entry" : "Correct Cash Flow Entry"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-xs text-[var(--cs-text-secondary)] sm:text-sm">
                {isCreate
                  ? "Record a manual financial movement into the centralized cash ledger."
                  : "Create a linked correction entry to fix or adjust a financial transaction."}
              </DialogPrimitive.Description>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status Pill */}
              {isCreate ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <Plus className="size-3 stroke-[3]" />
                  Create
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <span className="size-1.5 rounded-full bg-amber-600" />
                  Correction mode
                </span>
              )}

              {/* Close Button */}
              <DialogPrimitive.Close
                aria-label="Close dialog"
                className="flex size-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Form Content */}
          <div className="pt-1">
            {isCreate ? (
              <CashFlowCreateEntryForm
                defaultEntryType={defaultEntryType}
                branchName={branchName}
                onCancel={() => onOpenChange(false)}
              />
            ) : (
              <CashFlowCorrectionForm
                transaction={transaction}
                onCancel={() => onOpenChange(false)}
              />
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

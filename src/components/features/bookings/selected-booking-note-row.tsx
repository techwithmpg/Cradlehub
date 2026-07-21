"use client";

import { useEffect, useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import type { WorkspaceBookingRow } from "./booking-workspace-types";
import { SelectedBookingOverviewRow, overviewActionClass } from "./selected-booking-overview-row";
import { editBookingAction } from "@/app/(dashboard)/manager/bookings/actions";
import { useWorkspaceModuleLifecycle } from "@/components/features/dashboard/use-workspace-visibility";

function readNote(booking: WorkspaceBookingRow): string {
  const value = booking.metadata?.customer_notes;
  return typeof value === "string" ? value : "";
}

export function SelectedBookingNoteRow({
  booking,
  canEdit,
  onChanged,
}: {
  booking: WorkspaceBookingRow;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const [savedNote, setSavedNote] = useState(() => readNote(booking));
  const [draft, setDraft] = useState(savedNote);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { setUnsavedChanges } = useWorkspaceModuleLifecycle();

  useEffect(() => {
    setUnsavedChanges(editing && draft.trim() !== savedNote.trim());
    // Intentionally no cleanup: React Activity cleans effects while hidden,
    // but a hidden draft must remain protected from LRU eviction.
  }, [draft, editing, savedNote, setUnsavedChanges]);

  function save() {
    startTransition(async () => {
      const nextNote = draft.trim();
      const result = await editBookingAction({ bookingId: booking.id, notes: nextNote });
      if (!result.success) {
        toast.error(result.error ?? "Could not save note.");
        return;
      }
      setSavedNote(nextNote);
      setEditing(false);
      setUnsavedChanges(false);
      toast.success(nextNote ? "Booking note saved." : "Booking note cleared.");
      onChanged?.();
    });
  }

  return (
    <SelectedBookingOverviewRow
      icon={<FileText className="size-4" />}
      label="Note"
      summary={savedNote || "No note added."}
      action={canEdit ? <button type="button" onClick={() => { setDraft(savedNote); setEditing(!editing); setUnsavedChanges(false); }} className={overviewActionClass}>{editing ? "Close" : savedNote ? "Edit" : "Add note"}</button> : undefined}
    >
      {editing ? (
        <div className="grid gap-2">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} rows={3} aria-label="Booking note" className="min-h-20 resize-y rounded-lg border border-[var(--cs-border)] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-800" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setUnsavedChanges(false); }} className={overviewActionClass}>Cancel</button>
            <button type="button" onClick={save} disabled={isPending} className="h-8 rounded-lg bg-emerald-900 px-3 text-xs font-semibold text-white disabled:opacity-50">{isPending ? "Saving…" : "Save note"}</button>
          </div>
        </div>
      ) : null}
    </SelectedBookingOverviewRow>
  );
}

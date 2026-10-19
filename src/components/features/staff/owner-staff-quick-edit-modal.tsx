"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayHeader,
  ConfirmUnsavedChangesDialog,
} from "@/components/shared/overlays";
import { getOwnerStaffEditContextAction } from "@/app/(dashboard)/owner/staff/owner-edit-context-actions";
import type { Database } from "@/types/supabase";
import { StaffEditForm } from "./staff-edit-form";
import { getStaffInternalName, type StaffMember } from "./staff-management-utils";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"] & {
  service_categories: { id: string; name: string } | null;
};
type EditContext = Extract<
  Awaited<ReturnType<typeof getOwnerStaffEditContextAction>>,
  { ok: true }
>;

export type OwnerStaffEditMode = "profile" | "services" | "work";

export function OwnerStaffQuickEditModal({
  staffMember,
  mode,
  onClose,
}: {
  staffMember: StaffMember;
  mode: OwnerStaffEditMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const [context, setContext] = useState<EditContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    void getOwnerStaffEditContextAction(staffMember.id)
      .then((result) => {
        if (!current) return;
        if (result.ok) setContext(result);
        else setLoadError(result.error);
      })
      .catch(() => {
        if (current) setLoadError("Could not open the editor. Please try again.");
      });
    return () => { current = false; };
  }, [staffMember.id]);

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  const handleSaved = useCallback(() => {
    setDirty(false);
    onClose();
    router.refresh();
  }, [onClose, router]);

  const heading =
    mode === "services"
      ? "Manage Service Capabilities"
      : mode === "work"
        ? "Edit Staff Work Setup"
        : "Edit Staff Profile";

  return (
    <>
      <AdminDialog
        open
        onOpenChange={(open) => { if (!open) requestClose(); }}
        size="xl"
        placement="center"
        className="bg-[var(--cs-surface)]"
      >
        <AdminOverlayHeader
          title={heading}
          description={getStaffInternalName(staffMember) + " · Owner Workspace"}
          className="px-5 py-4"
        />
        <AdminOverlayBody className="bg-[var(--cs-surface-warm)] px-4 py-4 sm:px-6" padded={false}>
          {loadError ? (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--cs-error-bg)] bg-[var(--cs-error-bg)] p-4 text-sm text-[var(--cs-error-text)]">
              <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
              {loadError}
            </div>
          ) : !context ? (
            <div role="status" className="py-12 text-center text-sm text-[var(--cs-text-muted)]">
              Loading staff profile and authorized editing options…
            </div>
          ) : (
            <div ref={contentRef} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 py-2.5">
                <span className="text-xs text-[var(--cs-text-secondary)]">
                  Existing professional tier and permissions are preserved until you save.
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => contentRef.current?.querySelector("fieldset")?.scrollIntoView({ block: "center", behavior: "smooth" })}
                    className="border-[var(--cs-border)]"
                  >
                    <Layers3 className="size-3.5" aria-hidden="true" />
                    Services
                  </Button>
                  <Button asChild size="sm" variant="outline" className="border-[var(--cs-border)]">
                    <Link href={"/owner/staff/" + staffMember.id}>
                      Full profile
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
              <StaffEditForm
                key={staffMember.id}
                staffMember={staffMember}
                branches={context.branches}
                services={context.services as ServiceRow[]}
                staffServiceIds={context.staffServiceIds}
                workspaceContext="owner"
                onDirtyChange={setDirty}
                onSuccess={handleSaved}
              />
            </div>
          )}
        </AdminOverlayBody>
      </AdminDialog>
      <ConfirmUnsavedChangesDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        onConfirm={() => {
          setDirty(false);
          onClose();
        }}
        title="Discard staff edits?"
        description="Changes to this staff profile have not been saved."
      />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import {
  AdminDialog,
  AdminOverlayBody,
  AdminOverlayFooter,
  AdminOverlayHeader,
} from "@/components/shared/overlays";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
import {
  assignBookingRoomAction,
  getRoomAssignmentOptionsAction,
  type RoomAssignmentOptionsResult,
  type RoomAssignmentResourceOption,
} from "@/app/(dashboard)/crm/bookings/actions";
import { formatTime } from "@/lib/utils";
import type { WorkspaceBookingRow } from "./bookings-workspace";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";

type RoomAssignmentModalProps = {
  open: boolean;
  booking: WorkspaceBookingRow | null;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
};

type RoomOptionsKey = readonly [string, string];

async function fetchOptions(
  scopedKey: WorkspaceScopedSWRKey<RoomOptionsKey>
): Promise<RoomAssignmentOptionsResult> {
  const [, bookingId] = unwrapWorkspaceSWRKey(scopedKey);
  return getRoomAssignmentOptionsAction({ bookingId });
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

export function RoomAssignmentModal({
  open,
  booking,
  onOpenChange,
  onAssigned,
}: RoomAssignmentModalProps) {
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const bookingId = booking?.id ?? "";
  const roomOptionsKey = useWorkspaceSWRKey(
    ["room-assignment-options", bookingId] as const
  );
  const { data, isLoading, mutate } = useSWR(
    open && bookingId ? roomOptionsKey : null,
    fetchOptions,
    { revalidateOnFocus: false }
  );

  if (!booking) return null;
  const currentBooking = booking;

  const isChanging = Boolean(currentBooking.resource_id);
  const title = isChanging ? "Change Room" : "Assign Room";
  const options = data?.success && !data.notApplicable ? data : null;
  const notApplicable = data?.success && data.notApplicable ? data : null;
  const errorMessage = data && !data.success ? data.error : null;
  const effectiveResourceId =
    selectedResourceId || options?.currentResourceId || options?.recommendedResourceId || "";
  const selectedOption = options?.resources.find((resource) => resource.id === effectiveResourceId) ?? null;
  const recommended = options?.resources.find((resource) => resource.isRecommended) ?? null;
  const hasAvailableRoom = options?.resources.some((resource) => resource.isAvailable) ?? false;

  function handleAssign() {
    if (!effectiveResourceId) {
      setFeedback("Choose a room before saving.");
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await assignBookingRoomAction({
        bookingId: currentBooking.id,
        resourceId: effectiveResourceId,
      });
      if (!result.success) {
        setFeedback(result.error ?? "Could not assign room.");
        void mutate();
        return;
      }
      toast.success("Room assigned successfully.");
      onAssigned();
      onOpenChange(false);
    });
  }

  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      placement="center"
      ariaLabel={title}
    >
      <AdminOverlayHeader
        title={title}
        description="Choose the best available room for this customer."
      />
      <AdminOverlayBody className="bg-[var(--cs-surface-warm)]">
        <div className="space-y-4">
          {isLoading ? (
            <WorkspaceNotice tone="info">
              Loading room options...
            </WorkspaceNotice>
          ) : null}

          {errorMessage ? (
            <WorkspaceNotice tone="error">
              {errorMessage}
            </WorkspaceNotice>
          ) : null}

          {notApplicable ? (
            <WorkspaceNotice tone="info">
              {notApplicable.message}
            </WorkspaceNotice>
          ) : null}

          {options ? (
            <>
              <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem label="Customer" value={options.booking.customerName} />
                  <SummaryItem label="Service" value={options.booking.serviceName} />
                  <SummaryItem
                    label="Date / Time"
                    value={`${formatDate(options.booking.bookingDate)} at ${formatTime(options.booking.startTime)}`}
                  />
                  <SummaryItem label="Branch" value={options.booking.branchName} />
                </div>
              </div>

              <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                  Recommended Room
                </div>
                {recommended ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--cs-text)]">{recommended.name}</span>
                    <span className="rounded-full bg-[var(--cs-sand-mist)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cs-sand)]">
                      {recommended.reason}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--cs-text-muted)]">
                    No room is available right now. You can keep the customer waiting or adjust room setup.
                  </p>
                )}
              </div>

              {options.setupWarning ? (
                <WorkspaceNotice tone="warning">
                  {options.setupWarning}{" "}
                  <Link href="/crm/spaces-rules" className="font-semibold underline">
                    Review spaces and rules
                  </Link>
                </WorkspaceNotice>
              ) : null}

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">
                  Room selector
                </div>
                {options.resources.length === 0 ? (
                  <WorkspaceNotice tone="info">
                    No active rooms are available for this branch.
                  </WorkspaceNotice>
                ) : (
                  <div className="grid gap-2">
                    {options.resources.map((resource) => (
                      <RoomOptionButton
                        key={resource.id}
                        resource={resource}
                        selected={effectiveResourceId === resource.id}
                        onSelect={() => setSelectedResourceId(resource.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {!hasAvailableRoom ? (
                <WorkspaceNotice tone="warning">
                  No room is available right now. You can keep the customer waiting or adjust room setup.
                </WorkspaceNotice>
              ) : null}

              {feedback ? (
                <WorkspaceNotice tone="error">
                  {feedback}
                </WorkspaceNotice>
              ) : null}
            </>
          ) : null}
        </div>
      </AdminOverlayBody>
      <AdminOverlayFooter className="flex flex-col gap-2 bg-[var(--cs-surface)] sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => onOpenChange(false)}>
            Keep Waiting
          </Button>
          <Button
            type="button"
            disabled={isPending || !options || !selectedOption?.isAvailable}
            onClick={handleAssign}
          >
            {isPending ? "Saving..." : isChanging ? "Save Room Change" : "Assign Room"}
          </Button>
        </div>
      </AdminOverlayFooter>
    </AdminDialog>
  );
}

function RoomOptionButton({
  resource,
  selected,
  onSelect,
}: {
  resource: RoomAssignmentResourceOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!resource.isAvailable}
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-[var(--cs-sand)] bg-[var(--cs-sand-mist)]"
          : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-border-strong)]",
        !resource.isAvailable ? "cursor-not-allowed opacity-55" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[var(--cs-text)]">{resource.name}</span>
        {resource.isCurrent ? <Badge label="Current" /> : null}
        {resource.isRecommended ? <Badge label="Recommended" /> : null}
      </div>
      <div className="mt-1 text-xs leading-5 text-[var(--cs-text-muted)]">
        {[resource.type, resource.capacity != null ? `Capacity ${resource.capacity}` : null, resource.reason]
          .filter(Boolean)
          .join(" / ")}
      </div>
    </button>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[var(--cs-sand-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cs-sand)]">
      {label}
    </span>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--cs-text-muted)]">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-[var(--cs-text)]" title={value}>
        {value}
      </div>
    </div>
  );
}

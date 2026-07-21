"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  getOwnerWorkspaceBookingsAction,
  ownerUpdateBookingPaymentAction,
  ownerUpdateBookingStatusAction,
} from "@/app/(dashboard)/owner/bookings/actions";
import { BOOKINGS_CHANGED_EVENT } from "@/lib/bookings/bookings-client-events";
import {
  unwrapWorkspaceSWRKey,
  useWorkspaceSWRKey,
  type WorkspaceScopedSWRKey,
} from "@/components/features/dashboard/workspace-swr-cache";
import { BookingsWorkspace } from "./bookings-workspace";
import type { Branch, WorkspaceBookingRow } from "./booking-workspace-types";
import { useWorkspaceReactivationRefresh } from "@/components/features/dashboard/use-workspace-visibility";

type OwnerBookingsViewProps = {
  initialBookings: WorkspaceBookingRow[];
  initialDate: string;
  initialBranch?: string;
  initialStatus?: string;
  initialType?: string;
  initialSearch?: string;
  branches: Branch[];
};

export function OwnerBookingsView({
  initialBookings,
  initialDate,
  initialBranch,
  initialStatus,
  initialType,
  initialSearch,
  branches,
}: OwnerBookingsViewProps) {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? initialDate;
  const branch = searchParams.get("branch") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const key = useMemo(
    () => ["owner-bookings", date, branch ?? "", status ?? "", type ?? ""] as const,
    [branch, date, status, type]
  );
  const initialKey = [
    "owner-bookings",
    initialDate,
    initialBranch ?? "",
    initialStatus ?? "",
    initialType ?? "",
  ] as const;
  const isInitialKey = key.every((part, index) => part === initialKey[index]);
  const swrKey = useWorkspaceSWRKey(key);
  const { data, mutate } = useSWR(
    swrKey,
    async (scopedKey: WorkspaceScopedSWRKey<typeof key>) => {
      const [, nextDate, nextBranch, nextStatus, nextType] =
        unwrapWorkspaceSWRKey(scopedKey);
      const result = await getOwnerWorkspaceBookingsAction({
        date: nextDate,
        branchId: nextBranch || undefined,
        status: nextStatus || undefined,
        type: nextType || undefined,
      });
      if ("error" in result) throw new Error(result.error);
      return result.bookings as WorkspaceBookingRow[];
    },
    {
      fallbackData: isInitialKey ? initialBookings : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnMount: !isInitialKey,
    }
  );
  const refreshBookings = useWorkspaceReactivationRefresh(async () => {
    await mutate();
  });

  useEffect(() => {
    const refresh = () => { void refreshBookings().catch(() => undefined); };
    window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh);
  }, [refreshBookings]);

  return (
    <BookingsWorkspace
      workspaceContext="owner"
      viewerRole="owner"
      branches={branches}
      date={date}
      statusFilter={status}
      typeFilter={type}
      branchFilter={branch}
      search={search ?? initialSearch}
      bookings={data ?? initialBookings}
      cashSummary={null}
      statusAction={ownerUpdateBookingStatusAction}
      paymentAction={ownerUpdateBookingPaymentAction}
      onBookingsChanged={() => { void refreshBookings().catch(() => undefined); }}
    />
  );
}

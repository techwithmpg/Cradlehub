"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  getOwnerWorkspaceBookingsAction,
  ownerUpdateBookingPaymentAction,
  ownerUpdateBookingStatusAction,
} from "@/app/(dashboard)/owner/bookings/actions";
import { BOOKINGS_CHANGED_EVENT, notifyBookingsChanged } from "@/lib/bookings/bookings-client-events";
import { useWorkspaceSWRKey } from "@/components/features/dashboard/workspace-swr-cache";
import {
  useGenerationAwareWorkspaceSWR,
  useWorkspaceGeneration,
} from "@/components/features/dashboard/use-workspace-generation";
import { useWorkspaceModuleLifecycle } from "@/components/features/dashboard/use-workspace-visibility";
import { BookingsWorkspace, type BookingWorkspaceTab } from "./bookings-workspace";
import type { Branch, WorkspaceBookingRow } from "./booking-workspace-types";
import {
  isOwnerBookingsBranchParamInvalid,
  ownerBookingsInitialRead,
  ownerBookingsRequestKey,
  type OwnerBookingsInitialRead,
} from "@/lib/owner/owner-bookings-query";

type OwnerBookingsViewProps = {
  initialRead: OwnerBookingsInitialRead;
  initialDate: string;
  initialBranch?: string;
  initialStatus?: string;
  initialType?: string;
  initialSearch?: string;
  branches: Branch[];
};

function parseTab(value: string | null): BookingWorkspaceTab | undefined {
  if (value === "needs-action" || value === "upcoming" || value === "active" || value === "completed") {
    return value;
  }
  return undefined;
}

export function OwnerBookingsView({
  initialRead,
  initialDate,
  initialBranch,
  initialStatus,
  initialType,
  branches,
}: OwnerBookingsViewProps) {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? initialDate;
  const branch = searchParams.get("branch") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const tab = parseTab(searchParams.get("tab"));
  const selectedBookingId = searchParams.get("bookingId") ?? undefined;
  const invalidBranch = isOwnerBookingsBranchParamInvalid(searchParams);

  const query = useMemo(() => ({ date, branch, status, type }), [date, branch, status, type]);
  const requestKey = ownerBookingsRequestKey(query);
  const initialKey = ownerBookingsRequestKey({
    date: initialDate,
    branch: initialBranch,
    status: initialStatus,
    type: initialType,
  });
  const isInitialKey = requestKey === initialKey && !invalidBranch;
  const initialPayload = isInitialKey ? initialRead : undefined;
  const scopedKey = useWorkspaceSWRKey(["owner-bookings", requestKey] as const);
  const { store } = useWorkspaceGeneration("owner-bookings");
  const lifecycle = useWorkspaceModuleLifecycle();

  const fetcher = useCallback(async (): Promise<OwnerBookingsInitialRead> => {
    // Duplicated branch values are unavailable, never take the first valid one.
    if (invalidBranch) {
      return { status: "error", message: "The selected branch is not available from this workspace." };
    }
    const result = await getOwnerWorkspaceBookingsAction({
      date: query.date,
      branchId: query.branch,
      status: query.status,
      type: query.type,
    });
    return ownerBookingsInitialRead("error" in result ? result : { bookings: result.bookings as WorkspaceBookingRow[] });
  }, [invalidBranch, query]);

  // PERF-9B: the accepted generation adapter is active only under the
  // separately gated Owner retention provider. The normal SWR route must
  // still function while NEXT_PUBLIC_RETAINED_WORKSPACES=crm.
  const retained = useGenerationAwareWorkspaceSWR<OwnerBookingsInitialRead>(
    "owner-bookings",
    requestKey,
    fetcher,
    initialPayload
  );
  const ordinary = useSWR<OwnerBookingsInitialRead>(
    !store && !invalidBranch ? scopedKey : null,
    fetcher,
    {
      fallbackData: initialPayload,
      revalidateOnMount: !isInitialKey,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      keepPreviousData: false,
    }
  );

  const revalidate = retained.revalidate;
  const { isDirty, isRefreshing } = retained.generation;
  const staleRefreshActivation = useRef<number | null>(null);

  useEffect(() => {
    if (
      !store ||
      !lifecycle.isActive ||
      !lifecycle.isRetained ||
      !lifecycle.isStale ||
      isDirty ||
      isRefreshing ||
      lifecycle.becameActiveAt === null ||
      staleRefreshActivation.current === lifecycle.becameActiveAt
    ) return;

    staleRefreshActivation.current = lifecycle.becameActiveAt;
    void revalidate().catch(() => {
      // Keep the previous validated payload in the same scoped cache.
    });
  }, [
    store, lifecycle.isActive, lifecycle.isRetained, lifecycle.isStale,
    lifecycle.becameActiveAt, isDirty, isRefreshing, revalidate,
  ]);

  // A successful booking workflow broadcasts the existing legacy event.
  // The retention provider translates it into a generation invalidation;
  // do not simultaneously call ordinary mutate in retained mode.
  const { mutate: ordinaryMutate } = ordinary;
  useEffect(() => {
    if (store) return;
    const refresh = () => { void ordinaryMutate().catch(() => undefined); };
    window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh);
  }, [store, ordinaryMutate]);

  const refreshNow = useCallback(() => {
    if (store) {
      void revalidate().catch(() => undefined);
    } else if (!invalidBranch) {
      void ordinaryMutate().catch(() => undefined);
    }
  }, [store, revalidate, invalidBranch, ordinaryMutate]);

  const read = invalidBranch
    ? ({ status: "error", message: "The selected branch is not available from this workspace." } as const)
    : store ? retained.data : ordinary.data;
  const failure = store ? retained.error : ordinary.error;
  const refreshing = store ? isRefreshing : ordinary.isValidating;

  if (!read) {
    return (
      <div role="status" aria-busy="true" className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading bookings for the selected filters…
      </div>
    );
  }

  if (read.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Bookings are unavailable for the selected scope.</p>
        <p className="mt-1">{read.message}</p>
        <div className="mt-3 flex gap-3">
          <a className="font-semibold underline" href="/owner/bookings">All branches</a>
          {!invalidBranch ? (
            <button type="button" onClick={refreshNow} className="font-semibold underline">Retry</button>
          ) : null}
        </div>
      </div>
    );
  }

  const bookings: WorkspaceBookingRow[] = read.bookings;

  return (
    <>
      {failure ? (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>Bookings could not refresh. Showing the last validated list for these filters.</span>
          <button type="button" onClick={refreshNow} className="font-semibold underline">Retry</button>
        </div>
      ) : null}
      <BookingsWorkspace
        key={JSON.stringify([requestKey, search ?? "", tab ?? "", selectedBookingId ?? ""])}
        workspaceContext="owner"
        viewerRole="owner"
        branches={branches}
        date={date}
        statusFilter={status}
        typeFilter={type}
        branchFilter={branch}
        search={search}
        initialTab={tab}
        initialSelectedId={selectedBookingId}
        bookings={bookings}
        cashSummary={null}
        statusAction={ownerUpdateBookingStatusAction}
        paymentAction={ownerUpdateBookingPaymentAction}
        isRefreshing={refreshing}
        onRefresh={refreshNow}
        onBookingsChanged={notifyBookingsChanged}
      />
    </>
  );
}

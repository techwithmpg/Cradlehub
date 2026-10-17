"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { OpenAdministrativeBookingButton } from "@/components/features/bookings/administrative-booking-modal-provider";
import { CrmMotionSection } from "@/components/features/crm/premium/crm-motion-section";
import { CustomerSegmentTabs } from "./customer-segment-tabs";
import { CustomerKpiRow } from "./customer-kpi-row";
import { CustomerToolbar } from "./customer-toolbar";
import { CustomerPreviewRail } from "./customer-preview-rail";
import { AllCustomersTable } from "./all-customers-table";
import { RepeatClientsTable } from "./repeat-clients-table";
import { LapsedClientsTable } from "./lapsed-clients-table";
import { WaitlistFollowupTable } from "./waitlist-followup-table";
import type { CustomerListItem } from "./lib/customer-segments";
import {
  customerWorkspaceUrl,
  normalizeCustomerPage,
  normalizeCustomerSearch,
  normalizeCustomerTab,
  type CrmCustomersWorkspaceData,
  type CrmCustomersWorkspaceRequest,
} from "./customer-workspace-data";
import { useLiveCrmCustomersData } from "./use-live-crm-customers-data";
import { ChevronLeft, ChevronRight, UserSearch } from "lucide-react";

interface CustomersWorkspaceProps {
  initialData: CrmCustomersWorkspaceData;
}

function dataMatchesRequest(
  data: CrmCustomersWorkspaceData | undefined,
  request: CrmCustomersWorkspaceRequest
): data is CrmCustomersWorkspaceData {
  return Boolean(
    data &&
      data.tab === request.tab &&
      data.page === request.page &&
      (data.search ?? "") === (request.search ?? "")
  );
}

function SegmentLoadingState() {
  return (
    <div role="status" aria-label="Loading customer segment" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)]" />
    </div>
  );
}

export function CustomersWorkspace({ initialData }: CustomersWorkspaceProps) {
  const searchParams = useSearchParams();
  const request = useMemo<CrmCustomersWorkspaceRequest>(
    () => ({
      tab: normalizeCustomerTab(searchParams.get("tab")),
      page: normalizeCustomerPage(searchParams.get("page")),
      search: normalizeCustomerSearch(searchParams.get("q")),
    }),
    [searchParams]
  );
  const live = useLiveCrmCustomersData({ request, fallbackData: initialData });
  const data = dataMatchesRequest(live.data, request) ? live.data : undefined;
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);

  const visibleCustomerIds = useMemo(() => {
    if (!data) return new Set<string>();
    const rows =
      data.tab === "all"
        ? data.allCustomers
        : data.tab === "repeat"
          ? data.repeatCustomers
          : data.tab === "lapsed"
            ? data.lapsedCustomers
            : [];
    return new Set(rows.map((customer) => customer.id));
  }, [data]);

  useEffect(() => {
    if (!selectedCustomer || visibleCustomerIds.has(selectedCustomer.id)) return;
    setSelectedCustomer(null);
    setIsMobileRailOpen(false);
  }, [selectedCustomer, visibleCustomerIds]);

  function pushRequest(next: CrmCustomersWorkspaceRequest) {
    window.history.pushState(null, "", customerWorkspaceUrl(next));
  }

  function handleSelect(customer: CustomerListItem) {
    setSelectedCustomer(customer);
    setIsMobileRailOpen(true);
  }

  function handleCloseRail() {
    setSelectedCustomer(null);
    setIsMobileRailOpen(false);
  }

  function handleTabSelect(tab: CrmCustomersWorkspaceRequest["tab"]) {
    if (tab === request.tab && request.page === 1 && !request.search) return;
    pushRequest({ tab, page: 1 });
  }

  function handleSearch(search: string | undefined) {
    pushRequest({ tab: request.tab, page: 1, search });
  }

  function handlePage(page: number) {
    pushRequest({ ...request, page });
  }

  function handleWaitlistChanged() {
    live.generation.store?.invalidate("crm-customers");
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Search, view, and manage guest records."
        action={
          <OpenAdministrativeBookingButton
            mode="standard_future"
            className="cs-btn cs-btn-primary inline-flex items-center gap-1.5"
          >
            <UserSearch size={14} />
            New Booking
          </OpenAdministrativeBookingButton>
        }
      />

      <CustomerSegmentTabs activeTab={request.tab} onSelect={handleTabSelect} />

      {live.error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>Customers could not refresh. The last validated view is preserved.</span>
          <button
            type="button"
            className="cs-btn cs-btn-secondary cs-btn-sm"
            onClick={() => void live.revalidate()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <CustomerToolbar
        tab={request.tab}
        search={request.search}
        onSearch={handleSearch}
        onClear={() => handleSearch(undefined)}
      />

      {!data ? (
        <SegmentLoadingState />
      ) : (
        <>
          <CustomerKpiRow tab={data.tab} data={data.kpiData} />

          <CrmMotionSection delay={80} className="flex gap-5">
            <div className="min-w-0 flex-1">
              {data.tab === "all" && (
                <AllCustomersTable
                  rows={data.allCustomers}
                  selectedId={selectedCustomer?.id}
                  onSelect={handleSelect}
                />
              )}
              {data.tab === "repeat" && (
                <RepeatClientsTable
                  rows={data.repeatCustomers}
                  selectedId={selectedCustomer?.id}
                  onSelect={handleSelect}
                />
              )}
              {data.tab === "lapsed" && (
                <LapsedClientsTable
                  rows={data.lapsedCustomers}
                  selectedId={selectedCustomer?.id}
                  onSelect={handleSelect}
                />
              )}
              {data.tab === "followup" && (
                <WaitlistFollowupTable
                  rows={data.waitlistRows}
                  onChanged={handleWaitlistChanged}
                />
              )}

              {data.tab !== "followup" && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {data.page > 1 && (
                    <button
                      type="button"
                      onClick={() => handlePage(data.page - 1)}
                      className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1"
                    >
                      <ChevronLeft size={14} />
                      Prev
                    </button>
                  )}
                  <span className="px-2 text-xs text-[var(--cs-text-muted)]">
                    Page {data.page} of {data.totalPages}
                  </span>
                  {data.page < data.totalPages && (
                    <button
                      type="button"
                      onClick={() => handlePage(data.page + 1)}
                      className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1"
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <CustomerPreviewRail
              customer={selectedCustomer}
              onClose={handleCloseRail}
              isMobileOpen={isMobileRailOpen}
              setIsMobileOpen={setIsMobileRailOpen}
            />
          </CrmMotionSection>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { CrmMotionSection } from "@/components/features/crm/premium/crm-motion-section";
import { CustomerSegmentTabs, type CustomerTab } from "./customer-segment-tabs";
import { CustomerKpiRow, type KpiData } from "./customer-kpi-row";
import { CustomerToolbar } from "./customer-toolbar";
import { CustomerPreviewRail } from "./customer-preview-rail";
import { AllCustomersTable } from "./all-customers-table";
import { RepeatClientsTable } from "./repeat-clients-table";
import { LapsedClientsTable } from "./lapsed-clients-table";
import { WaitlistFollowupTable, type WaitlistRow } from "./waitlist-followup-table";
import type { CustomerListItem } from "./lib/customer-segments";
import { ChevronLeft, ChevronRight, UserSearch } from "lucide-react";

interface CustomersWorkspaceProps {
  tab: CustomerTab;
  allCustomers: CustomerListItem[];
  repeatCustomers: CustomerListItem[];
  lapsedCustomers: CustomerListItem[];
  waitlistRows: WaitlistRow[];
  kpiData: KpiData;
  page: number;
  totalPages: number;
  search?: string;
}

export function CustomersWorkspace({
  tab,
  allCustomers,
  repeatCustomers,
  lapsedCustomers,
  waitlistRows,
  kpiData,
  page,
  totalPages,
  search,
}: CustomersWorkspaceProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);

  function handleSelect(customer: CustomerListItem) {
    setSelectedCustomer(customer);
    setIsMobileRailOpen(true);
  }

  function handleCloseRail() {
    setSelectedCustomer(null);
    setIsMobileRailOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Search, view, and manage guest records."
        action={
          <Link
            href="/crm/bookings/new"
            className="cs-btn cs-btn-primary inline-flex items-center gap-1.5"
          >
            <UserSearch size={14} />
            + New Booking
          </Link>
        }
      />

      {/* Tabs – no additional motion wrapper; CustomerSegmentTabs renders immediately */}
      <CustomerSegmentTabs activeTab={tab} />

      {/* KPI row – wrapped internally in CrmMotionSection */}
      <CustomerKpiRow tab={tab} data={kpiData} />

      <CustomerToolbar tab={tab} search={search} />

      {/* Main content: table + preview rail with entrance delay */}
      <CrmMotionSection delay={80} className="flex gap-5">
        {/* Table area */}
        <div className="min-w-0 flex-1">
          {tab === "all" && (
            <AllCustomersTable
              rows={allCustomers}
              selectedId={selectedCustomer?.id}
              onSelect={handleSelect}
            />
          )}
          {tab === "repeat" && (
            <RepeatClientsTable
              rows={repeatCustomers}
              selectedId={selectedCustomer?.id}
              onSelect={handleSelect}
            />
          )}
          {tab === "lapsed" && (
            <LapsedClientsTable
              rows={lapsedCustomers}
              selectedId={selectedCustomer?.id}
              onSelect={handleSelect}
            />
          )}
          {tab === "followup" && (
            <WaitlistFollowupTable rows={waitlistRows} />
          )}

          {/* Pagination */}
          {tab !== "followup" && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={`/crm/customers?tab=${tab}&page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                  className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Prev
                </Link>
              )}
              <span className="px-2 text-xs text-[var(--cs-text-muted)]">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/crm/customers?tab=${tab}&page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                  className="cs-btn cs-btn-secondary cs-btn-sm inline-flex items-center gap-1"
                >
                  Next
                  <ChevronRight size={14} />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right preview rail (desktop aside + mobile sheet via CrmPreviewRailShell) */}
        <CustomerPreviewRail
          customer={selectedCustomer}
          onClose={handleCloseRail}
          isMobileOpen={isMobileRailOpen}
          setIsMobileOpen={setIsMobileRailOpen}
        />
      </CrmMotionSection>
    </div>
  );
}

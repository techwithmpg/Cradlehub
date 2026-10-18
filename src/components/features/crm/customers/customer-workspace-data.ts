import type { CustomerTab } from "./customer-segment-tabs";
import type { KpiData } from "./customer-kpi-row";
import type { CustomerListItem } from "./lib/customer-segments";
import type { WaitlistRow } from "./waitlist-followup-table";

export type CrmCustomersWorkspaceRequest = {
  tab: CustomerTab;
  page: number;
  search?: string;
};

export type CrmCustomersWorkspaceData = CrmCustomersWorkspaceRequest & {
  allCustomers: CustomerListItem[];
  repeatCustomers: CustomerListItem[];
  lapsedCustomers: CustomerListItem[];
  waitlistRows: WaitlistRow[];
  kpiData: KpiData;
  totalPages: number;
};

const VALID_TABS: readonly CustomerTab[] = ["all", "repeat", "lapsed", "followup"];

export function normalizeCustomerTab(value: string | null | undefined): CustomerTab {
  return value && VALID_TABS.includes(value as CustomerTab)
    ? (value as CustomerTab)
    : "all";
}

export function normalizeCustomerPage(value: string | null | undefined): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function normalizeCustomerSearch(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function customerWorkspaceRequestKey(request: CrmCustomersWorkspaceRequest): string {
  const params = new URLSearchParams();
  params.set("tab", request.tab);
  if (request.page > 1) params.set("page", String(request.page));
  if (request.search) params.set("q", request.search);
  return `/crm/customers?${params.toString()}`;
}

export function customerWorkspaceUrl(request: CrmCustomersWorkspaceRequest): string {
  return customerWorkspaceRequestKey(request);
}

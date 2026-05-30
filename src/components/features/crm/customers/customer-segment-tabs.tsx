"use client";

import { CrmSegmentTabs } from "@/components/features/crm/premium/crm-segment-tabs";

export type CustomerTab = "all" | "repeat" | "lapsed" | "followup";

const TABS = [
  { key: "all" as CustomerTab,      label: "All Customers",     href: "/crm/customers?tab=all" },
  { key: "repeat" as CustomerTab,   label: "Repeat Clients",    href: "/crm/customers?tab=repeat" },
  { key: "lapsed" as CustomerTab,   label: "Lapsed Clients",    href: "/crm/customers?tab=lapsed" },
  { key: "followup" as CustomerTab, label: "Waitlist / Follow-up", href: "/crm/customers?tab=followup" },
];

/**
 * Customer workspace tab navigation.
 * Delegates to CrmSegmentTabs for consistent underline tab styling.
 * External API unchanged: accepts activeTab: CustomerTab.
 */
export function CustomerSegmentTabs({ activeTab }: { activeTab: CustomerTab }) {
  return (
    <CrmSegmentTabs
      tabs={TABS}
      activeKey={activeTab}
      variant="underline"
      className="mb-5"
    />
  );
}

"use client";

import { CrmSegmentTabs } from "@/components/features/crm/premium/crm-segment-tabs";

export type CustomerTab = "all" | "repeat" | "lapsed" | "followup";

const TABS = [
  { key: "all" as CustomerTab, label: "All Customers" },
  { key: "repeat" as CustomerTab, label: "Repeat Clients" },
  { key: "lapsed" as CustomerTab, label: "Lapsed Clients" },
  { key: "followup" as CustomerTab, label: "Waitlist / Follow-up" },
];

export function CustomerSegmentTabs({
  activeTab,
  onSelect,
}: {
  activeTab: CustomerTab;
  onSelect?: (tab: CustomerTab) => void;
}) {
  return (
    <CrmSegmentTabs
      tabs={TABS}
      activeKey={activeTab}
      onSelect={(key) => onSelect?.(key as CustomerTab)}
      variant="underline"
      className="mb-5"
    />
  );
}

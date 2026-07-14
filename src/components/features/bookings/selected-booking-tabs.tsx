import { cn } from "@/lib/utils";

export type SelectedBookingTab = "overview" | "activity" | "details";

const TABS: Array<{ id: SelectedBookingTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "details", label: "Details" },
];

export function SelectedBookingTabs({
  activeTab,
  onChange,
}: {
  activeTab: SelectedBookingTab;
  onChange: (tab: SelectedBookingTab) => void;
}) {
  return (
    <div className="grid grid-cols-3 border-b border-[var(--cs-border-soft)]" role="tablist" aria-label="Selected booking information">
      {TABS.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <button key={tab.id} type="button" role="tab" id={`selected-booking-tab-${tab.id}`} aria-selected={selected} aria-controls={`selected-booking-panel-${tab.id}`} tabIndex={selected ? 0 : -1} onClick={() => onChange(tab.id)} className={cn("relative h-12 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-800", selected ? "text-emerald-950 after:absolute after:inset-x-5 after:bottom-0 after:h-0.5 after:bg-emerald-800" : "text-[var(--cs-text-secondary)] hover:text-[var(--cs-text)]")}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

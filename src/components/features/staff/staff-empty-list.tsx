import type { StaffTab } from "./staff-management-utils";

export function StaffEmptyList({
  activeTab,
  hasFilters,
}: {
  activeTab: StaffTab;
  hasFilters: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--cs-border-strong)] bg-[var(--cs-surface-warm)] px-6 py-12 text-center">
      <h2 className="m-0 text-base font-semibold text-[var(--cs-text)]">
        {hasFilters ? "No staff match those filters" : activeTab === "active" ? "No active staff yet" : "No pending staff"}
      </h2>
      <p className="mx-auto mt-2 mb-0 max-w-md text-sm text-[var(--cs-text-muted)]">
        {hasFilters
          ? "Clear the filters or adjust your search to see more team members."
          : activeTab === "active"
            ? "Invite your first team member to start building the roster."
            : "Generate an invite link or review onboarding requests when new staff apply."}
      </p>
    </div>
  );
}

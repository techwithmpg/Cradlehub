"use client";

import { ChevronRight } from "lucide-react";
import { StaffTableRow } from "./staff-table-row";
import { type StaffBranchGroup, type StaffMember, type StaffTab } from "./staff-management-utils";

const MAX_COLLAPSED_ROWS = 8;

type StaffBranchSectionProps = {
  group: StaffBranchGroup;
  activeTab: StaffTab;
  selectedStaffId: string | null;
  isExpanded: boolean;
  onSelectStaff: (staff: StaffMember) => void;
  onToggleExpanded: (branchId: string) => void;
  workspaceContext?: "owner" | "manager" | "crm";
};

export function StaffBranchSection({
  group,
  activeTab,
  selectedStaffId,
  isExpanded,
  onSelectStaff,
  onToggleExpanded,
  workspaceContext = "owner",
}: StaffBranchSectionProps) {
  const visibleStaff = isExpanded ? group.staff : group.staff.slice(0, MAX_COLLAPSED_ROWS);
  const isTruncated = group.staff.length > MAX_COLLAPSED_ROWS;

  return (
    <section className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-4 py-3">
        <div>
          <h2 className="m-0 text-sm font-semibold text-[var(--cs-text)]">{group.branchName}</h2>
          <p className="mt-1 text-xs text-[var(--cs-text-muted)]">{group.branchShortName} team roster</p>
        </div>
        <span className="rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
          {group.staff.length} staff
        </span>
      </div>

      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] text-xs font-semibold text-[var(--cs-text-muted)]">
              <th className="w-10 px-4 py-2.5">
                <span className="sr-only">Selected</span>
              </th>
              <th className="w-[31%] px-3 py-2.5">Staff</th>
              <th className="w-[22%] px-3 py-2.5">Staff Function</th>
              <th className="w-[16%] px-3 py-2.5">Phone</th>
              <th className="w-[15%] px-3 py-2.5">Status</th>
              <th className="w-[14%] px-3 py-2.5">Workspace Access</th>
              <th className="w-12 px-3 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleStaff.map((member) => (
              <StaffTableRow
                key={member.id}
                member={member}
                activeTab={activeTab}
                isSelected={selectedStaffId === member.id}
                onSelectStaff={onSelectStaff}
                workspaceContext={workspaceContext}
              />
            ))}
          </tbody>
        </table>
      </div>

      {isTruncated && (
        <button
          type="button"
          onClick={() => onToggleExpanded(group.branchId)}
          className="flex w-full items-center justify-center gap-2 border-t border-[var(--cs-border-soft)] px-4 py-3 text-sm font-medium text-[var(--cs-sand-dark)] transition hover:bg-[var(--cs-sand-tint)]"
        >
          {isExpanded
            ? `Show fewer staff in ${group.branchShortName}`
            : `View all ${group.staff.length} staff in ${group.branchShortName}`}
          <ChevronRight
            className={["size-4 transition", isExpanded ? "-rotate-90" : "rotate-90"].join(" ")}
            aria-hidden="true"
          />
        </button>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LinkIcon, UserPlus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffBranchSection } from "./staff-branch-section";
import { StaffEmptyList } from "./staff-empty-list";
import { StaffFilterBar } from "./staff-filter-bar";
import { StaffPreviewPanel } from "./staff-preview-panel";
import { StaffStatsCards } from "./staff-stats-cards";
import { StaffTabs } from "./staff-tabs";
import {
  getStaffStatus,
  getSystemRoleLabel,
  groupStaffByBranch,
  staffMatchesFilters,
  UNASSIGNED_BRANCH_ID,
  type StaffFilters,
  type StaffMember,
  type StaffTab,
} from "./staff-management-utils";

type StaffManagementWorkspaceProps = {
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
  initialTab: StaffTab;
  workspaceContext?: "owner" | "manager" | "crm";
  /** CRM-only: callback to open inline staff edit sheet */
  onEditStaff?: (staff: StaffMember) => void;
  /** CRM-only: callback to open inline service capability editor */
  onManageServices?: (staff: StaffMember) => void;
  /** CRM-only: callback to toggle staff active/inactive */
  onToggleActive?: (staff: StaffMember) => void;
};

const initialFilters: StaffFilters = {
  search: "",
  branchId: "all",
  role: "all",
  status: "all",
};

export function StaffManagementWorkspace({
  allStaff,
  pendingStaff,
  initialTab,
  workspaceContext = "owner",
  onEditStaff,
  onManageServices,
  onToggleActive,
}: StaffManagementWorkspaceProps) {
  const isOwner = workspaceContext === "owner";
  const isCrm = workspaceContext === "crm";
  const basePath = isCrm ? "#" : `/${workspaceContext}/staff`;

  const [activeTab, setActiveTab] = useState<StaffTab>(initialTab);
  const [filters, setFilters] = useState<StaffFilters>(initialFilters);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(() => new Set());

  const activeStaff = useMemo(() => allStaff.filter((member) => member.is_active), [allStaff]);
  const staffForCurrentTab = activeTab === "active" ? activeStaff : pendingStaff;
  const filteredStaff = useMemo(
    () => staffForCurrentTab.filter((member) => staffMatchesFilters(member, filters)),
    [filters, staffForCurrentTab]
  );
  const groupedStaff = useMemo(() => groupStaffByBranch(filteredStaff), [filteredStaff]);
  const visibleStaff = useMemo(() => groupedStaff.flatMap((group) => group.staff), [groupedStaff]);
  const selectedStaff =
    selectedStaffId === ""
      ? null
      : selectedStaffId
        ? visibleStaff.find((member) => member.id === selectedStaffId) ?? visibleStaff[0] ?? null
        : visibleStaff[0] ?? null;

  const awaitingCount = pendingStaff.filter((member) => getStaffStatus(member) === "awaiting").length;
  const invitedCount = pendingStaff.filter((member) => getStaffStatus(member) === "invited").length;
  const branchCount = getKnownBranchCount([...activeStaff, ...pendingStaff]);

  const branchOptions = useMemo(() => {
    const groups = groupStaffByBranch([...activeStaff, ...pendingStaff]);
    return [
      { value: "all", label: "All branches" },
      ...groups.map((group) => ({
        value: group.branchId,
        label: group.branchName,
      })),
    ];
  }, [activeStaff, pendingStaff]);

  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set([...activeStaff, ...pendingStaff].map((member) => member.system_role))).sort(
      (a, b) => getSystemRoleLabel(a).localeCompare(getSystemRoleLabel(b))
    );

    return [
      { value: "all", label: "All access roles" },
      ...roles.map((role) => ({ value: role, label: getSystemRoleLabel(role) })),
    ];
  }, [activeStaff, pendingStaff]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All statuses" },
      { value: "active", label: "Active" },
      { value: "awaiting", label: "Awaiting approval" },
      { value: "invited", label: "Invite sent" },
    ],
    []
  );

  function toggleExpanded(branchId: string) {
    setExpandedBranches((current) => {
      const next = new Set(current);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-5 py-5 shadow-[var(--cs-shadow-xs)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-tight text-[var(--cs-text)]">Staff</h1>
          <p className="mt-1 mb-0 text-sm text-[var(--cs-text-muted)]">
            {activeStaff.length} active · {awaitingCount} awaiting approval · {invitedCount} invites sent
          </p>
        </div>

        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text-secondary)] hover:bg-[var(--cs-surface-warm)]"
            >
              <Link href={`${basePath}/invite`}>
                <LinkIcon className="size-4" aria-hidden="true" />
                Invite Link
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-[var(--cs-text)] text-[var(--cs-text-inverse)] hover:bg-[var(--cs-sand-dark)]"
            >
              <Link href={`${basePath}/new`}>
                <UserPlus className="size-4" aria-hidden="true" />
                Direct Invite
              </Link>
            </Button>
          </div>
        )}
      </header>

      <StaffStatsCards
        activeCount={activeStaff.length}
        pendingCount={awaitingCount}
        branchCount={branchCount}
        invitesCount={invitedCount}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
        <section
          aria-label="Staff directory"
          className="min-w-0 overflow-hidden rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] shadow-[var(--cs-shadow-xs)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cs-border-soft)] px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cs-success-bg)] text-[var(--cs-success-text)]">
                <UsersRound className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="m-0 text-base font-semibold text-[var(--cs-text)]">Team directory</h2>
                <p className="m-0 mt-0.5 text-xs text-[var(--cs-text-muted)]">
                  {isOwner ? "Across authorized branches" : "Your branch team"}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)] px-3 py-1 text-xs font-semibold text-[var(--cs-text-secondary)]">
              {filteredStaff.length} shown
            </span>
          </div>

          <div className="space-y-3 border-b border-[var(--cs-border-soft)] p-3 sm:p-4">
            <StaffFilterBar
              filters={filters}
              branchOptions={branchOptions}
              roleOptions={roleOptions}
              statusOptions={statusOptions}
              onFiltersChange={setFilters}
              onClear={() => setFilters(initialFilters)}
              hideBranchFilter={!isOwner}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StaffTabs
                activeTab={activeTab}
                activeCount={activeStaff.length}
                pendingCount={pendingStaff.length}
                onTabChange={setActiveTab}
              />
              <p className="m-0 text-xs text-[var(--cs-text-muted)]">
                {filteredStaff.length} of {staffForCurrentTab.length}
              </p>
            </div>
          </div>

          <div className="max-h-[min(68vh,900px)] space-y-3 overflow-y-auto p-3 sm:p-4">
            {groupedStaff.length > 0 ? (
              groupedStaff.map((group) => (
                <StaffBranchSection
                  key={group.branchId}
                  group={group}
                  activeTab={activeTab}
                  selectedStaffId={selectedStaff?.id ?? null}
                  isExpanded={expandedBranches.has(group.branchId)}
                  onSelectStaff={(member) => setSelectedStaffId(member.id)}
                  onEditStaff={onEditStaff}
                  onToggleExpanded={toggleExpanded}
                  workspaceContext={workspaceContext}
                />
              ))
            ) : (
              <StaffEmptyList activeTab={activeTab} hasFilters={hasActiveFilters(filters)} />
            )}
          </div>
        </section>

        <div className="min-w-0">
          <StaffPreviewPanel
            staff={selectedStaff}
            onClearSelection={() => setSelectedStaffId("")}
            workspaceContext={workspaceContext}
            onEditStaff={onEditStaff}
            onManageServices={onManageServices}
            onToggleActive={onToggleActive}
          />
        </div>
      </div>
    </div>
  );
}

function getKnownBranchCount(staff: StaffMember[]): number {
  return new Set(
    staff
      .map((member) => member.branch_id ?? UNASSIGNED_BRANCH_ID)
      .filter((branchId) => branchId !== UNASSIGNED_BRANCH_ID)
  ).size;
}

function hasActiveFilters(filters: StaffFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.branchId !== "all" ||
    filters.role !== "all" ||
    filters.status !== "all"
  );
}

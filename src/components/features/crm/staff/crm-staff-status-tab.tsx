"use client";

import { useMemo } from "react";
import {
  Building2,
  Clock3,
  Send,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import {
  CrmSectionCard,
  CrmStatCard,
  type CrmCardTone,
} from "@/components/features/crm/shared/crm-cards";
import {
  getStaffStatus,
  type StaffMember,
} from "@/components/features/staff/staff-management-utils";

type Props = {
  allStaff: StaffMember[];
  pendingStaff: StaffMember[];
};

export function CrmStaffStatusTab({ allStaff, pendingStaff }: Props) {
  const stats = useMemo(() => {
    const nonArchivedAll = allStaff.filter(
      (s) => !s.archived_at && !s.merged_into_staff_id
    );
    const nonArchivedPending = pendingStaff.filter(
      (s) => !s.archived_at && !s.merged_into_staff_id
    );
    const combined = [...nonArchivedAll, ...nonArchivedPending];
    const seen = new Set<string>();
    const uniqueCombined = combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    const active = nonArchivedAll.filter((s) => s.is_active);
    const awaiting = nonArchivedPending.filter((s) => getStaffStatus(s) === "awaiting");
    const invited = nonArchivedPending.filter((s) => getStaffStatus(s) === "invited");
    const inactive = uniqueCombined.filter((s) => getStaffStatus(s) === "inactive");

    const roleCounts = new Map<string, number>();
    for (const s of uniqueCombined) {
      roleCounts.set(s.system_role, (roleCounts.get(s.system_role) ?? 0) + 1);
    }

    const typeCounts = new Map<string, number>();
    for (const s of uniqueCombined) {
      if (s.staff_type) {
        typeCounts.set(s.staff_type, (typeCounts.get(s.staff_type) ?? 0) + 1);
      }
    }

    const headCount = uniqueCombined.filter((s) => s.is_head).length;

    return {
      total: uniqueCombined.length,
      activeCount: active.length,
      awaitingCount: awaiting.length,
      invitedCount: invited.length,
      inactiveCount: inactive.length,
      headCount,
      roleCounts: Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1]),
      typeCounts: Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [allStaff, pendingStaff]);

  const statusCards: Array<{
    label: string;
    value: number;
    icon: typeof UsersRound;
    tone: CrmCardTone;
  }> = [
    {
      label: "Total Staff",
      value: stats.total,
      icon: UsersRound,
      tone: "neutral",
    },
    {
      label: "Active",
      value: stats.activeCount,
      icon: UserCheck,
      tone: "success",
    },
    {
      label: "Awaiting Approval",
      value: stats.awaitingCount,
      icon: Clock3,
      tone: "warning",
    },
    {
      label: "Invites Sent",
      value: stats.invitedCount,
      icon: Send,
      tone: "info",
    },
    {
      label: "Inactive",
      value: stats.inactiveCount,
      icon: UserRoundX,
      tone: "neutral",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Status KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <CrmStatCard
              key={card.label}
              compact
              title={card.label}
              value={card.value}
              tone={card.tone}
              icon={<Icon className="size-4" aria-hidden="true" />}
            />
          );
        })}
      </div>

      {/* Breakdown grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CrmSectionCard title="Workspace Access Distribution">
          {stats.roleCounts.length === 0 ? (
            <p className="m-0 text-sm text-[var(--cs-text-muted)]">No staff data.</p>
          ) : (
            <div className="space-y-3">
              {stats.roleCounts.map(([role, count]) => (
                <div key={role} className="flex items-center gap-3">
                  <span className="inline-flex min-w-[120px] items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
                    {role}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--cs-border-soft)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                        background: "var(--cs-sand)",
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-[var(--cs-text)]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CrmSectionCard>

        <CrmSectionCard title="Staff Type Distribution">
          {stats.typeCounts.length === 0 ? (
            <p className="m-0 text-sm text-[var(--cs-text-muted)]">No staff type data.</p>
          ) : (
            <div className="space-y-3">
              {stats.typeCounts.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="inline-flex min-w-[120px] items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface-warm)] px-2.5 py-1 text-xs font-medium text-[var(--cs-text-secondary)]">
                    {type}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--cs-border-soft)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                        background: "#5A8A6A",
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-[var(--cs-text)]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CrmSectionCard>
      </div>

      {/* Head count + branches summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <CrmStatCard
          title="Head / Supervisors"
          value={stats.headCount}
          tone="info"
          icon={<ShieldCheck className="size-4.5" aria-hidden="true" />}
        />
        <CrmStatCard
          title="Branch Coverage"
          value={`${new Set(allStaff.map((s) => s.branch_id).filter(Boolean)).size} branch(es)`}
          tone="success"
          icon={<Building2 className="size-4.5" aria-hidden="true" />}
        />
      </div>
    </div>
  );
}

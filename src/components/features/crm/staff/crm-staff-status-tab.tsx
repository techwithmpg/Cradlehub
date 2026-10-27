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

  const statusCards = [
    {
      label: "Total Staff",
      value: stats.total,
      icon: UsersRound,
      color: "var(--cs-text)",
      bg: "var(--cs-sand-mist)",
    },
    {
      label: "Active",
      value: stats.activeCount,
      icon: UserCheck,
      color: "var(--cs-success-text)",
      bg: "var(--cs-success-bg)",
    },
    {
      label: "Awaiting Approval",
      value: stats.awaitingCount,
      icon: Clock3,
      color: "var(--cs-warning-text)",
      bg: "var(--cs-warning-bg)",
    },
    {
      label: "Invites Sent",
      value: stats.invitedCount,
      icon: Send,
      color: "var(--cs-info-text)",
      bg: "var(--cs-info-bg)",
    },
    {
      label: "Inactive",
      value: stats.inactiveCount,
      icon: UserRoundX,
      color: "var(--cs-text-muted)",
      bg: "var(--cs-neutral-bg)",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Status KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statusCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-medium text-[var(--cs-text-muted)]">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold leading-none" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
              <div
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ background: card.bg, color: card.color }}
              >
                <card.icon className="size-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Breakdown grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Role distribution */}
        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-[var(--cs-shadow-xs)]">
          <h3 className="m-0 mb-4 text-sm font-semibold text-[var(--cs-text)]">
            Workspace Access Distribution
          </h3>
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
        </div>

        {/* Staff type distribution */}
        <div className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 shadow-[var(--cs-shadow-xs)]">
          <h3 className="m-0 mb-4 text-sm font-semibold text-[var(--cs-text)]">
            Staff Type Distribution
          </h3>
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
        </div>
      </div>

      {/* Head count + branches summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="m-0 text-xs font-medium text-[var(--cs-text-muted)]">Head / Supervisors</p>
            <p className="m-0 text-2xl font-semibold text-[var(--cs-text)]">{stats.headCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
            <Building2 className="size-5" />
          </div>
          <div>
            <p className="m-0 text-xs font-medium text-[var(--cs-text-muted)]">Branch Coverage</p>
            <p className="m-0 text-2xl font-semibold text-[var(--cs-text)]">
              {new Set(allStaff.map((s) => s.branch_id).filter(Boolean)).size} branch(es)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

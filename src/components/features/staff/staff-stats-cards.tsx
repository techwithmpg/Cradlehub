import { Building2, Clock3, Send, UsersRound } from "lucide-react";

type StaffStatsCardsProps = {
  activeCount: number;
  pendingCount: number;
  branchCount: number;
  invitesCount: number;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function StaffStatsCards({
  activeCount,
  pendingCount,
  branchCount,
  invitesCount,
}: StaffStatsCardsProps) {
  const cards = [
    {
      label: "Active Staff",
      value: activeCount,
      helper: `Across ${pluralize(branchCount, "branch", "branches")}`,
      Icon: UsersRound,
    },
    {
      label: "Pending Approval",
      value: pendingCount,
      helper: "Awaiting review",
      Icon: Clock3,
    },
    {
      label: "Branches",
      value: branchCount,
      helper: "Active branches",
      Icon: Building2,
    },
    {
      label: "Invites Sent",
      value: invitesCount,
      helper: "Not yet accepted",
      Icon: Send,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Staff metrics">
      {cards.map(({ label, value, helper, Icon }) => (
        <div
          key={label}
          className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-[var(--cs-shadow-xs)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-medium text-[var(--cs-text-muted)]">{label}</p>
              <p className="mt-2 text-3xl font-semibold leading-none text-[var(--cs-text)]">{value}</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--cs-sand-mist)] text-[var(--cs-sand-dark)]">
              <Icon className="size-4" aria-hidden="true" />
            </div>
          </div>
          <p className="mb-0 mt-3 text-xs text-[var(--cs-text-secondary)]">{helper}</p>
        </div>
      ))}
    </section>
  );
}

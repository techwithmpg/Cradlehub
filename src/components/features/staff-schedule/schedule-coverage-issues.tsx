import type { StaffScheduleItem } from "./staff-schedule-list";

type Props = { items: StaffScheduleItem[] };

export function ScheduleCoverageIssues({ items }: Props) {
  const today = new Date().toISOString().split("T")[0]!;
  const todayDow = new Date().getDay();

  const noSchedule = items.filter((i) => !i.schedules.some((s) => s.is_active));
  const noOpeningToday = items.filter(
    (i) =>
      i.schedules.some((s) => s.day_of_week === todayDow && s.is_active) &&
      !i.schedules.some((s) => s.day_of_week === todayDow && s.is_active && s.shift_type === "opening")
  );
  const onLeaveToday = items.filter((i) =>
    i.overrides.some((o) => o.override_date === today && o.is_day_off)
  );

  const totalIssues = noSchedule.length;

  if (totalIssues === 0 && noOpeningToday.length === 0) {
    return (
      <div
        style={{
          padding: "40px 16px",
          textAlign: "center",
          color: "var(--cs-text-muted)",
          fontSize: 13,
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border-soft)",
          borderRadius: "var(--cs-r-lg)",
        }}
      >
        ✅ No coverage issues found. All staff have a weekly schedule set.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      {/* No schedule */}
      {noSchedule.length > 0 && (
        <IssueSection
          title={`No weekly schedule (${noSchedule.length})`}
          description="These staff will not appear in the booking engine until a schedule is set."
          color="var(--cs-warning)"
          badge={noSchedule.length}
        >
          {noSchedule.map((item) => (
            <IssueCard key={item.staff.id} item={item} tag="No schedule" tagColor="var(--cs-warning)" />
          ))}
        </IssueSection>
      )}

      {/* No opening shift today */}
      {noOpeningToday.length > 0 && (
        <IssueSection
          title={`No opening shift today (${noOpeningToday.length})`}
          description="Scheduled today but no opening shift assigned — may affect opening coverage."
          color="var(--cs-info)"
          badge={noOpeningToday.length}
        >
          {noOpeningToday.map((item) => (
            <IssueCard key={item.staff.id} item={item} tag="No opening" tagColor="var(--cs-info)" />
          ))}
        </IssueSection>
      )}

      {/* On leave today */}
      {onLeaveToday.length > 0 && (
        <IssueSection
          title={`On leave today (${onLeaveToday.length})`}
          description="Staff with a day-off override for today."
          color="var(--cs-text-muted)"
          badge={onLeaveToday.length}
        >
          {onLeaveToday.map((item) => (
            <IssueCard key={item.staff.id} item={item} tag="Day off" tagColor="var(--cs-text-muted)" />
          ))}
        </IssueSection>
      )}

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function IssueSection({
  title,
  description,
  badge,
  color,
  children,
}: {
  title: string;
  description: string;
  badge: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cs-text)" }}>{title}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: 20, height: 20, borderRadius: 10,
          background: color, color: "#fff", fontSize: 10, fontWeight: 600, padding: "0 5px",
        }}>{badge}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--cs-text-muted)", marginBottom: 10 }}>{description}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.625rem" }}>
        {children}
      </div>
    </div>
  );
}

function IssueCard({
  item,
  tag,
  tagColor,
}: {
  item: StaffScheduleItem;
  tag: string;
  tagColor: string;
}) {
  return (
    <div style={{
      background: "var(--cs-surface)",
      border: "1px solid var(--cs-border-soft)",
      borderRadius: "var(--cs-r-md)",
      padding: "11px 13px",
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--cs-text)" }}>{item.staff.full_name}</div>
      <div style={{ fontSize: 10, color: "var(--cs-text-muted)", marginTop: 2, textTransform: "capitalize" }}>
        {(item.staff.staff_type ?? "staff").replace("_", " ")}
        {item.staff.tier ? ` · ${item.staff.tier}` : ""}
      </div>
      <div style={{ marginTop: 7 }}>
        <span style={{
          display: "inline-block", padding: "2px 7px", borderRadius: 10,
          fontSize: 10, fontWeight: 500, background: `${tagColor}20`, color: tagColor,
        }}>{tag}</span>
      </div>
    </div>
  );
}

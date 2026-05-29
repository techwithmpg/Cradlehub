"use client";

export function ScheduleContentGrid({
  main,
  rightRail,
}: {
  main: React.ReactNode;
  rightRail: React.ReactNode;
}) {
  return (
    <div
      style={{ display: "grid", gap: "1.25rem", alignItems: "start" }}
      className="grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <main style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
        {main}
      </main>
      <aside
        style={{ display: "flex", flexDirection: "column", gap: "0.875rem", minWidth: 0 }}
        className="lg:sticky lg:top-5 lg:self-start"
      >
        {rightRail}
      </aside>
    </div>
  );
}

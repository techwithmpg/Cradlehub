import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { DailyScheduleBoard } from "@/components/features/schedule/daily-schedule-board";
import { getDailySchedule } from "@/lib/queries/schedule";
import { getAllBranches } from "@/lib/queries/branches";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Building2 } from "lucide-react";

async function getOwnerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("staff")
    .select("system_role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!me || me.system_role !== "owner") redirect("/login");
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

export default async function OwnerSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; date?: string }>;
}) {
  await getOwnerContext();

  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0]!;

  const [branches] = await Promise.all([getAllBranches()]);

  const selectedBranchId =
    params.branchId && branches.some((b) => b.id === params.branchId)
      ? params.branchId
      : branches[0]?.id ?? "";

  const selectedDate = params.date ?? today;
  const isToday = selectedDate === today;

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const supabase = await createClient();

  const [scheduleRows, resourcesResult] = await Promise.all([
    selectedBranchId
      ? getDailySchedule({ branchId: selectedBranchId, date: selectedDate })
      : Promise.resolve([]),
    selectedBranchId
      ? supabase
          .from("branch_resources")
          .select("*")
          .eq("branch_id", selectedBranchId)
          .eq("is_active", true)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
  ]);

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Daily Staff Schedule"
        description={`${selectedBranch?.name ?? "Select a branch"} · ${formattedDate}`}
      />

      {/* Branch selector */}
      {branches.length > 0 && (
        <div
          className="cs-card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 0.875rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <Building2 className="h-4 w-4" style={{ color: "var(--cs-sand)", flexShrink: 0 }} />
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={`/owner/schedule?branchId=${branch.id}&date=${selectedDate}`}
              className={`cs-btn cs-btn-sm ${
                branch.id === selectedBranchId ? "cs-btn-primary" : "cs-btn-ghost"
              }`}
            >
              {branch.name}
            </Link>
          ))}
        </div>
      )}

      {/* Date navigator */}
      <div
        className="cs-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem 0.875rem",
          marginBottom: "1.25rem",
        }}
      >
        <Link
          href={`/owner/schedule?branchId=${selectedBranchId}&date=${shiftDate(selectedDate, -1)}`}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--cs-text)",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <CalendarDays className="h-4 w-4" style={{ color: "var(--cs-sand)" }} />
          {formattedDate}
          {isToday && (
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: 100,
                background: "var(--cs-success-bg)",
                color: "var(--cs-success)",
              }}
            >
              Today
            </span>
          )}
        </div>

        {!isToday && (
          <Link
            href={`/owner/schedule?branchId=${selectedBranchId}`}
            className="cs-btn cs-btn-ghost cs-btn-sm"
          >
            Today
          </Link>
        )}

        <Link
          href={`/owner/schedule?branchId=${selectedBranchId}&date=${shiftDate(selectedDate, 1)}`}
          className="cs-btn cs-btn-ghost cs-btn-sm"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Schedule board */}
      {branches.length === 0 ? (
        <div
          className="cs-card"
          style={{
            padding: "3rem 1.5rem",
            textAlign: "center",
            color: "var(--cs-text-muted)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>🏢</div>
          <div style={{ fontWeight: 600, color: "var(--cs-text)", marginBottom: 4 }}>
            No branches configured
          </div>
          <div>Create a branch first to view schedules.</div>
        </div>
      ) : (
        <DailyScheduleBoard
          branchId={selectedBranchId}
          date={selectedDate}
          staffRows={scheduleRows}
          branchResources={resourcesResult.data ?? []}
        />
      )}
    </div>
  );
}

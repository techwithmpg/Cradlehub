import { createClient } from "@/lib/supabase/server";

function readPricePaid(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") return 0;
  const value = (metadata as Record<string, unknown>)["price_paid"];
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

// -- Owner dashboard: cross-branch today overview ----------------------------
export async function getOwnerDashboardStats(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("branch_id, status, metadata, branches ( id, name )")
    .eq("booking_date", date);
  if (error) throw new Error(error.message);

  const rows = data ?? [];

  // Group by branch
  const byBranch = rows.reduce<
    Record<string, { name: string; total: number; completed: number; revenue: number }>
  >((acc, r) => {
    const bid = r.branch_id ?? "unassigned";
    const branch = Array.isArray(r.branches) ? r.branches[0] : r.branches;
    const bname = (branch as { name?: string } | null)?.name ?? bid;
    if (!acc[bid]) acc[bid] = { name: bname, total: 0, completed: 0, revenue: 0 };
    acc[bid].total++;
    if (r.status === "completed") {
      acc[bid].completed++;
      acc[bid].revenue += readPricePaid(r.metadata);
    }
    return acc;
  }, {});

  return {
    date,
    total_bookings: rows.length,
    total_completed: rows.filter((r) => r.status === "completed").length,
    total_cancelled: rows.filter((r) => r.status === "cancelled").length,
    total_revenue: rows
      .filter((r) => r.status === "completed")
      .reduce((s, r) => s + readPricePaid(r.metadata), 0),
    by_branch: Object.values(byBranch),
  };
}

// -- Revenue by branch (date range) -----------------------------------------
export async function getRevenueByBranch(fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("branch_id, metadata, status, branches ( id, name )")
    .eq("status", "completed")
    .gte("booking_date", fromDate)
    .lte("booking_date", toDate);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const byBranch = rows.reduce<Record<string, { name: string; revenue: number; count: number }>>(
    (acc, r) => {
      const bid = r.branch_id ?? "unassigned";
      const branch = Array.isArray(r.branches) ? r.branches[0] : r.branches;
      const bname = (branch as { name?: string } | null)?.name ?? bid;
      if (!acc[bid]) acc[bid] = { name: bname, revenue: 0, count: 0 };
      acc[bid].revenue += readPricePaid(r.metadata);
      acc[bid].count++;
      return acc;
    },
    {}
  );
  return Object.values(byBranch).sort((a, b) => b.revenue - a.revenue);
}

// -- Bookings per therapist (staff productivity) ----------------------------
export async function getBookingsPerTherapist(fromDate: string, toDate: string, branchId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("bookings")
    .select("staff_id, status, metadata, staff ( id, full_name, tier, branch_id )")
    .gte("booking_date", fromDate)
    .lte("booking_date", toDate);
  if (branchId) q = q.eq("branch_id", branchId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const byStaff = rows.reduce<
    Record<
      string,
      { staffId: string; name: string; tier: string; total: number; completed: number; revenue: number }
    >
  >((acc, r) => {
    const sid = r.staff_id ?? "unassigned";
    const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    if (!acc[sid]) {
      acc[sid] = {
        staffId: sid,
        name: (staff as { full_name?: string } | null)?.full_name ?? sid,
        tier: (staff as { tier?: string } | null)?.tier ?? "-",
        total: 0,
        completed: 0,
        revenue: 0,
      };
    }
    acc[sid].total++;
    if (r.status === "completed") {
      acc[sid].completed++;
      acc[sid].revenue += readPricePaid(r.metadata);
    }
    return acc;
  }, {});

  return Object.values(byStaff).sort((a, b) => b.completed - a.completed);
}

// -- Booking trend: daily count for last N days (owner chart) ---------------
export async function getBookingTrend(days = 30) {
  const supabase = await createClient();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString().split("T")[0]!;
  const to = new Date().toISOString().split("T")[0]!;

  const { data, error } = await supabase
    .from("bookings")
    .select("booking_date, status")
    .gte("booking_date", from)
    .lte("booking_date", to)
    .not("status", "in", '("cancelled","no_show")');
  if (error) throw new Error(error.message);

  // Build day-by-day counts
  const counts: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    counts[r.booking_date] = (counts[r.booking_date] ?? 0) + 1;
  });

  // Fill in zero days
  const result: { date: string; count: number }[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0]!;
    result.push({ date: key, count: counts[key] ?? 0 });
  }
  return result;
}

import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getRepeatCustomers } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type RepeatCustomerItem = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "full_name" | "phone" | "total_bookings" | "last_booking_date" | "first_booking_date"
>;

export default async function RepeatsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageParam = Number(resolvedSearchParams.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const { customers, total } = await getRepeatCustomers(3, page, 25);
  const rows = customers as RepeatCustomerItem[];
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <PageHeader title="Repeat Clients" description={`${total} customers with 3 or more visits`} />

      {rows.length === 0 ? (
        <EmptyState
          title="No repeat clients yet"
          description="Customers who have booked 3 or more times will appear here."
        />
      ) : (
        <>
          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {rows.map((customer, i) => (
              <Link
                key={customer.id}
                href={`/crm/${customer.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--ch-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "var(--ch-accent-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--ch-accent)",
                    flexShrink: 0,
                  }}
                >
                  {customer.total_bookings}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ch-text)" }}>
                    {customer.full_name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                    {customer.phone}
                    {customer.first_booking_date && (
                      <span style={{ marginLeft: 8 }}>Since {formatDate(customer.first_booking_date)}</span>
                    )}
                  </div>
                </div>

                {customer.last_booking_date && (
                  <span style={{ fontSize: "0.75rem", color: "var(--ch-text-subtle)", flexShrink: 0 }}>
                    Last: {formatDate(customer.last_booking_date)}
                  </span>
                )}
                <span style={{ color: "var(--ch-text-subtle)", fontSize: 16 }}>›</span>
              </Link>
            ))}
          </div>

          {total > 25 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              {page > 1 && (
                <Link
                  href={`/crm/repeats?page=${page - 1}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--ch-border)",
                    backgroundColor: "var(--ch-surface)",
                    color: "var(--ch-text-muted)",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                  }}
                >
                  ← Prev
                </Link>
              )}
              <span
                style={{
                  padding: "5px 12px",
                  fontSize: "0.8125rem",
                  color: "var(--ch-text-muted)",
                }}
              >
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/crm/repeats?page=${page + 1}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--ch-border)",
                    backgroundColor: "var(--ch-surface)",
                    color: "var(--ch-text-muted)",
                    fontSize: "0.8125rem",
                    textDecoration: "none",
                  }}
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

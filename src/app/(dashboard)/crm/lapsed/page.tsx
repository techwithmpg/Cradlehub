import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { getLapsedCustomers } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type LapsedCustomerItem = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "full_name" | "phone" | "total_bookings" | "last_booking_date"
>;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default async function LapsedPage() {
  const customers = (await getLapsedCustomers(30, 50)) as LapsedCustomerItem[];

  return (
    <div>
      <PageHeader
        title="Lapsed Clients"
        description="Customers who haven't visited in 30 or more days"
      />

      {customers.length === 0 ? (
        <EmptyState
          title="No lapsed clients"
          description="All recent customers have visited within the last 30 days."
        />
      ) : (
        <>
          <div
            style={{
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              backgroundColor: "#FEFCE8",
              border: "1px solid #FEF08A",
              borderRadius: 8,
              fontSize: "0.8125rem",
              color: "#713F12",
            }}
          >
            {customers.length} customer{customers.length !== 1 ? "s" : ""} haven't visited in 30+ days.
            Consider reaching out via Facebook Messenger to re-engage them.
          </div>

          <div
            style={{
              backgroundColor: "var(--ch-surface)",
              border: "1px solid var(--ch-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {customers.map((customer, i) => {
              const days = daysSince(customer.last_booking_date);
              return (
                <Link
                  key={customer.id}
                  href={`/crm/${customer.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.875rem",
                    padding: "0.875rem 1rem",
                    borderBottom: i < customers.length - 1 ? "1px solid var(--ch-border)" : "none",
                    textDecoration: "none",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color:
                          days > 90 ? "#DC2626" : days > 60 ? "#D97706" : "var(--ch-text-muted)",
                      }}
                    >
                      {days}
                    </div>
                    <div style={{ fontSize: "0.625rem", color: "var(--ch-text-subtle)" }}>days</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ch-text)" }}>
                      {customer.full_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--ch-text-muted)" }}>
                      {customer.phone} · {customer.total_bookings} visit
                      {customer.total_bookings !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {customer.last_booking_date && (
                    <span style={{ fontSize: "0.75rem", color: "var(--ch-text-subtle)", flexShrink: 0 }}>
                      Last: {formatDate(customer.last_booking_date)}
                    </span>
                  )}
                  <span style={{ color: "var(--ch-text-subtle)", fontSize: 16 }}>›</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

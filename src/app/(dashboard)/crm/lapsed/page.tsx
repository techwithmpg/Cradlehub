import Link from "next/link";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { EmptyState } from "@/components/features/dashboard/empty-state";
import { CustomerSegmentBadge } from "@/components/features/crm/customer-segment-badge";
import { getLapsedCustomers } from "@/lib/queries/customers";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/supabase";

type LapsedCustomerItem = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "full_name" | "phone" | "email" | "total_bookings" | "last_booking_date"
>;

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const TAB_ITEMS = [
  { href: "/crm", label: "All Customers" },
  { href: "/crm/repeats", label: "Repeat Clients" },
  { href: "/crm/lapsed", label: "Lapsed Clients" },
];

export default async function LapsedPage() {
  const customers = (await getLapsedCustomers(30, 50)) as LapsedCustomerItem[];

  return (
    <div>
      <PageHeader
        title="Lapsed Clients"
        description="Guests who haven't visited in 30 or more days. Re-engage them before they forget about you."
        icon="🔔"
      />

      {customers.length > 0 && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "#FEF3C7",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            fontSize: "0.8125rem",
            color: "#92400E",
          }}
        >
          {customers.length} customer{customers.length !== 1 ? "s" : ""} haven&apos;t visited in 30+ days.
          Consider reaching out via Facebook Messenger or SMS to re-engage them.
          <span
            style={{
              marginLeft: 8,
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            (Follow-up tools coming soon)
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {TAB_ITEMS.map((tab) => {
          const isActive = tab.href === "/crm/lapsed";
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "1px solid var(--cs-border)",
                backgroundColor: isActive ? "var(--cs-sand-lighter)" : "var(--cs-surface)",
                color: isActive ? "var(--cs-sand)" : "var(--cs-text-muted)",
                fontSize: "0.8125rem",
                textDecoration: "none",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="No lapsed clients"
          description="All customers have visited within the last 30 days. Great job keeping them engaged!"
          icon="🎉"
        />
      ) : (
        <div
          style={{
            backgroundColor: "var(--cs-surface)",
            border: "1px solid var(--cs-border)",
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
                  borderBottom: i < customers.length - 1 ? "1px solid var(--cs-border)" : "none",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 48,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color:
                        days > 90 ? "#DC2626" : days > 60 ? "#D97706" : "var(--cs-text-muted)",
                    }}
                  >
                    {days}
                  </div>
                  <div style={{ fontSize: "0.625rem", color: "var(--cs-text-muted)" }}>days</div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--cs-text)" }}>
                      {customer.full_name}
                    </div>
                    <CustomerSegmentBadge segment="lapsed" />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)" }}>
                    {customer.phone}
                    {customer.email && <span style={{ marginLeft: 8 }}>{customer.email}</span>}
                    <span style={{ marginLeft: 8 }}>
                      {customer.total_bookings} visit{customer.total_bookings !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {customer.last_booking_date && (
                  <span style={{ fontSize: "0.75rem", color: "var(--cs-text-muted)", flexShrink: 0 }}>
                    Last: {formatDate(customer.last_booking_date)}
                  </span>
                )}
                <span style={{ color: "var(--cs-text-muted)", fontSize: 16 }}>&rsaquo;</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

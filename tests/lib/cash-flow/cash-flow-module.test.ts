import { describe, expect, it } from "vitest";

import { NAV_CONFIG } from "@/components/features/dashboard/nav-config";
import { buildCashFlowTransactions, paymentMethodLabel } from "@/lib/queries/cash-flow";

describe("Cash Flow module", () => {
  it("appears exactly once in primary CRM navigation", () => {
    const items = NAV_CONFIG.crm?.items?.filter((item) => item.href === "/crm/cash-flow") ?? [];

    expect(items).toEqual([
      {
        label: "Cash Flow",
        href: "/crm/cash-flow",
        icon: "DollarSign",
      },
    ]);
  });

  it("preserves the existing Close Day destination", () => {
    const items =
      NAV_CONFIG.crm?.systemItems?.filter((item) => item.href === "/crm/reconciliation") ?? [];

    expect(items).toHaveLength(1);
  });

  it("normalizes known payment method labels", () => {
    expect(paymentMethodLabel("cash")).toBe("Cash");
    expect(paymentMethodLabel("gcash")).toBe("GCash");
    expect(paymentMethodLabel("pay_on_site")).toBe("Pay on Site");
  });

  it("includes collected active bookings and excludes cancelled money", () => {
    const rows = buildCashFlowTransactions([
      {
        id: "paid",
        booking_date: "2026-09-25",
        start_time: "10:00:00",
        type: "online",
        delivery_type: "in_spa",
        status: "confirmed",
        payment_method: "gcash",
        payment_status: "paid",
        payment_reference: "TEST",
        amount_paid: 1500,
        services: { name: "Massage" },
        customers: { full_name: "Customer A" },
      },
      {
        id: "cancelled",
        booking_date: "2026-09-25",
        start_time: "11:00:00",
        type: "online",
        delivery_type: "in_spa",
        status: "cancelled",
        payment_method: "cash",
        payment_status: "paid",
        payment_reference: null,
        amount_paid: 500,
        services: { name: "Massage" },
        customers: { full_name: "Customer B" },
      },
      {
        id: "unpaid",
        booking_date: "2026-09-25",
        start_time: "12:00:00",
        type: "online",
        delivery_type: "in_spa",
        status: "confirmed",
        payment_method: "cash",
        payment_status: "unpaid",
        payment_reference: null,
        amount_paid: 0,
        services: { name: "Massage" },
        customers: { full_name: "Customer C" },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "paid",
      paymentMethod: "gcash",
      amount: 1500,
    });
  });

  it("identifies Home Service without changing booking ownership", () => {
    const rows = buildCashFlowTransactions([
      {
        id: "home",
        booking_date: "2026-09-25",
        start_time: "14:00:00",
        type: "home_service",
        delivery_type: "home_service",
        status: "confirmed",
        payment_method: "cash",
        payment_status: "paid",
        payment_reference: null,
        amount_paid: 2000,
        services: { name: "Home Massage" },
        customers: { full_name: "Customer D" },
      },
    ]);

    expect(rows[0]?.bookingSource).toBe("Home Service");
  });
});

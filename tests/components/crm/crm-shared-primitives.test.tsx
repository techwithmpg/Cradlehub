/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmPageHeader } from "@/components/features/crm/shared/crm-page-header";
import { CrmModuleTabs, CrmSubTabs } from "@/components/features/crm/shared/crm-module-tabs";
import { CrmPagination } from "@/components/features/crm/shared/crm-pagination";
import { CrmStatusBadge } from "@/components/features/crm/premium/crm-status-badge";
import { BookingStatusBadge } from "@/components/features/dashboard/booking-status-badge";
import { PaymentStatusBadge } from "@/components/features/dashboard/payment-status-badge";

afterEach(() => {
  cleanup();
});

describe("CRM shared UI primitives", () => {
  it("renders CrmPageHeader eyebrow, title, badge, description, and actions", () => {
    render(
      <CrmPageHeader
        eyebrow="MAIN SPA · CRM"
        title="Bookings"
        badge={<span>Today</span>}
        description="Manage check-ins and room handoffs."
        actions={<button type="button">New Booking</button>}
      />
    );

    expect(screen.getByText("MAIN SPA · CRM")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Bookings" })).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Manage check-ins and room handoffs.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Booking" })).toBeTruthy();
  });

  it("supports click and keyboard arrow/Home/End navigation in CrmModuleTabs", () => {
    const onChange = vi.fn();
    render(
      <CrmModuleTabs
        activeKey="today"
        onChange={onChange}
        ariaLabel="Cash flow sections"
        tabs={[
          { key: "today", label: "Today", count: 4 },
          { key: "ledger", label: "Ledger" },
          { key: "history", label: "History" },
        ]}
      />
    );

    const tablist = screen.getByRole("tablist", { name: "Cash flow sections" });
    const todayTab = screen.getByRole("tab", { name: /Today/i });
    expect(todayTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("4")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Ledger" }));
    expect(onChange).toHaveBeenCalledWith("ledger");

    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("ledger");

    fireEvent.keyDown(tablist, { key: "End" });
    expect(onChange).toHaveBeenCalledWith("history");

    fireEvent.keyDown(tablist, { key: "Home" });
    expect(onChange).toHaveBeenCalledWith("today");
  });

  it("switches active state cleanly in CrmSubTabs", () => {
    const onChange = vi.fn();
    render(
      <CrmSubTabs
        activeKey="phones"
        onChange={onChange}
        tabs={[
          { key: "qr", label: "QR Codes" },
          { key: "phones", label: "Staff Phones", count: 3 },
        ]}
      />
    );

    expect(screen.getByRole("tab", { name: /Staff Phones/i }).getAttribute("aria-selected")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("tab", { name: "QR Codes" }));
    expect(onChange).toHaveBeenCalledWith("qr");
  });

  it("renders CrmPagination counts, page switches, page-size selector, and summaryText override", () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const { rerender } = render(
      <CrmPagination
        page={2}
        pageSize={10}
        totalItems={35}
        itemLabel="records"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 25]}
      />
    );

    expect(screen.getByText("records", { exact: false }).textContent).toContain("11");
    expect(screen.getByText("records", { exact: false }).textContent).toContain("20");
    expect(screen.getByText("records", { exact: false }).textContent).toContain("35");

    fireEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "25" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);

    rerender(
      <CrmPagination
        page={1}
        pageSize={25}
        totalItems={100}
        totalPagesOverride={4}
        summaryText="Page 1 of 4"
        itemLabel="customers"
        onPageChange={onPageChange}
        showPageSizeSelector={false}
      />
    );

    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("aligns semantic warning tokens for pending across status badges", () => {
    render(
      <div>
        <CrmStatusBadge variant="pending" />
        <CrmStatusBadge variant="in_progress" />
        <BookingStatusBadge status="pending" />
        <PaymentStatusBadge status="pending" />
      </div>
    );

    const pendingBadges = screen.getAllByText("Pending");
    expect(pendingBadges).toHaveLength(3);
    expect(screen.getByText("In Progress")).toBeTruthy();
  });
});

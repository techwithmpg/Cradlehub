/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AlertTriangle, CheckCircle2, Settings, ShieldAlert, Sparkles } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CrmActionCard,
  CrmAlertCard,
  CrmInfoCard,
  CrmSectionCard,
  CrmStatCard,
  type CrmCardTone,
} from "@/components/features/crm/shared/crm-cards";

afterEach(() => {
  cleanup();
});

describe("Canonical CRM card system (crm-cards.tsx)", () => {
  it("renders CrmStatCard across all 5 semantic tones with pastel surface and swoosh", () => {
    const tones: CrmCardTone[] = ["success", "warning", "danger", "info", "neutral"];

    render(
      <div>
        {tones.map((tone, idx) => (
          <CrmStatCard
            key={tone}
            title={`Metric ${tone}`}
            value={idx + 1}
            subtitle={`Subtitle ${tone}`}
            icon={<CheckCircle2 className="size-4" />}
            tone={tone}
            badge={<span>75%</span>}
            footer={<span>Footer note</span>}
          />
        ))}
      </div>
    );

    tones.forEach((tone, idx) => {
      expect(screen.getByText(`Metric ${tone}`)).toBeTruthy();
      expect(screen.getByText(String(idx + 1))).toBeTruthy();
      expect(screen.getByText(`Subtitle ${tone}`)).toBeTruthy();
    });
    expect(screen.getAllByText("75%")).toHaveLength(5);
    expect(screen.getAllByText("Footer note")).toHaveLength(5);
  });

  it("supports interactive button and link modes plus loading state on CrmStatCard", () => {
    const onClick = vi.fn();
    const { container } = render(
      <div>
        <CrmStatCard
          title="Connected"
          value={28}
          subtitle="Active staff phones"
          tone="success"
          active
          ariaPressed
          onClick={onClick}
        />
        <CrmStatCard
          title="Pending"
          value={3}
          tone="warning"
          href="/crm/attendance/setup"
          surface="flat"
        />
        <CrmStatCard title="Loading metric" value={0} loading />
      </div>
    );

    const button = screen.getByRole("button", { name: /Connected/i });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    const link = screen.getByRole("link", { name: /Pending/i });
    expect(link.getAttribute("href")).toBe("/crm/attendance/setup");

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("renders CrmSectionCard with title, description, badge, actions, footer, and loading skeleton", () => {
    const { container, rerender } = render(
      <CrmSectionCard
        title="Booking History"
        description="Recent client appointments"
        icon={<Sparkles className="size-4" />}
        badge={<span>12</span>}
        actions={<button type="button">Export</button>}
        footer={<span>End of list</span>}
      >
        <p>Table body</p>
      </CrmSectionCard>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Booking History" })).toBeTruthy();
    expect(screen.getByText("Recent client appointments")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.getByText("Table body")).toBeTruthy();
    expect(screen.getByText("End of list")).toBeTruthy();

    rerender(
      <CrmSectionCard title="Booking History" loading>
        <p>Hidden while loading</p>
      </CrmSectionCard>
    );
    expect(screen.queryByText("Hidden while loading")).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("renders CrmInfoCard in static and interactive button modes", () => {
    const onSelect = vi.fn();
    render(
      <div>
        <CrmInfoCard
          title="Maria Santos"
          subtitle="0917 000 0001"
          badge={<span>Waiting</span>}
          tone="warning"
          footer={<span>Preferred: Fri 2:00 PM</span>}
        >
          <p>60m Relaxation Massage</p>
        </CrmInfoCard>
        <CrmInfoCard
          title="Interactive Customer"
          subtitle="Click to preview"
          active
          onClick={onSelect}
        />
      </div>
    );

    expect(screen.getByText("Maria Santos")).toBeTruthy();
    expect(screen.getByText("Waiting")).toBeTruthy();
    expect(screen.getByText("60m Relaxation Massage")).toBeTruthy();
    expect(screen.getByText("Preferred: Fri 2:00 PM")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Interactive Customer/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders CrmActionCard in link, primary button, and disabled button modes", () => {
    const onTrigger = vi.fn();
    render(
      <div>
        <CrmActionCard
          title="Fix Services"
          description="Assign therapists to active services."
          icon={<Settings className="size-4" />}
          href="/crm/services"
          trailing={<span>Open</span>}
        />
        <CrmActionCard
          title="Record payment"
          description="Collect booking balance."
          tone="primary"
          onClick={onTrigger}
        />
        <CrmActionCard
          title="Locked action"
          description="Requires owner access."
          disabled
          onClick={onTrigger}
        />
      </div>
    );

    const link = screen.getByRole("link", { name: /Fix Services/i });
    expect(link.getAttribute("href")).toBe("/crm/services");

    const primaryBtn = screen.getByRole("button", { name: /Record payment/i });
    expect(primaryBtn.className).toContain("from-[#1F4E33]");
    fireEvent.click(primaryBtn);
    expect(onTrigger).toHaveBeenCalledTimes(1);

    const disabledBtn = screen.getByRole("button", { name: /Locked action/i });
    expect((disabledBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("assigns alert role automatically for danger/warning CrmAlertCard and omits it for info unless provided", () => {
    render(
      <div>
        <CrmAlertCard
          tone="danger"
          icon={<ShieldAlert className="size-4" />}
          title="Previous attendance still open"
          description="No clock-out recorded for Nov 14."
          meta={<span>Detected: 2:14 PM</span>}
          actions={<button type="button">Review & Fix</button>}
        >
          <p>Recommended correction: Record clock-out.</p>
        </CrmAlertCard>
        <CrmAlertCard
          tone="info"
          icon={<AlertTriangle className="size-4" />}
          title="Optional setup review"
        />
      </div>
    );

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(screen.getByText("Previous attendance still open")).toBeTruthy();
    expect(screen.getByText("Detected: 2:14 PM")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review & Fix" })).toBeTruthy();
    expect(screen.getByText("Optional setup review")).toBeTruthy();
  });
});

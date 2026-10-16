/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingServicePicker, type BookingWizardService } from "@/components/public/booking-service-picker";
import type { ServiceLineQuote } from "@/lib/services/service-line-quote";

vi.mock("@/components/public/service-image", () => ({
  ServiceImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));

const branchId = "11111111-1111-4111-8111-111111111111";
const massage: BookingWizardService = {
  id: "22222222-2222-4222-8222-222222222222", name: "Angels Massage",
  durationMinutes: 60, price: 500, durationPolicy: "extendable",
  quoteVersion: "a".repeat(64), categoryName: "Massage Services",
};
const aroma: BookingWizardService = {
  id: "33333333-3333-4333-8333-333333333333", name: "Aromatherapy",
  durationMinutes: 60, price: 550, durationPolicy: "extendable",
  quoteVersion: "b".repeat(64), categoryName: "Massage Services",
};
const fixed: BookingWizardService = {
  id: "44444444-4444-4444-8444-444444444444", name: "Sports Massage",
  durationMinutes: 60, price: 800, durationPolicy: "fixed", categoryName: "Massage Services",
};

function quote(service: BookingWizardService, minutes: number, price: number, index: number): ServiceLineQuote {
  return { serviceId: service.id, durationPolicy: "extendable", baseDurationMinutes: 60,
    selectedDurationMinutes: minutes, basePrice: service.price,
    extensionIncrementMinutes: 30, extensionPrice: 350,
    maximumDurationMinutes: 180, extensionUnits: index, calculatedPrice: price,
    quoteVersion: index === 0 ? service.quoteVersion : String(index).repeat(64) };
}
const massageOptions = [500, 850, 1200, 1550, 1900].map((price, index) => quote(massage, 60 + index * 30, price, index));
const aromaOptions = [550, 900, 1250, 1600, 1950].map((price, index) => quote(aroma, 60 + index * 30, price, index));

function setupFetch(options = new Map([[massage.id, massageOptions], [aroma.id, aromaOptions]])) {
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { serviceId: string };
    return { ok: true, json: async () => ({ options: options.get(body.serviceId) }) };
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function picker(selected: BookingWizardService[], extra: Partial<React.ComponentProps<typeof BookingServicePicker>> = {}) {
  return <BookingServicePicker services={[massage, aroma, fixed]} loading={false}
    selected={selected} onToggle={vi.fn()} inlineDuration branchId={branchId}
    attendeeId="att-1" totalDuration={selected.reduce((sum, service) => sum + service.durationMinutes, 0)}
    totalPrice={selected.reduce((sum, service) => sum + service.price, 0)}
    visitType="in_spa" {...extra} />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("public inline duration control", () => {
  it("leaves a fixed-only selected card unchanged", () => {
    const view = render(picker([fixed]));
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByText(/Adjust duration/)).toBeNull();
    expect(screen.queryByText(/Apply duration/)).toBeNull();
    expect(view.container.textContent).toContain("Sports Massage");
  });

  it("loads exact server stops at base and changes duration and price without a modal", async () => {
    const fetcher = setupFetch();
    const onSelectQuote = vi.fn();
    const view = render(picker([massage], { onSelectQuote }));
    const slider = await screen.findByRole("slider", { name: "Angels Massage duration" });
    await waitFor(() => expect(slider).not.toHaveProperty("disabled", true));
    expect(slider.getAttribute("aria-valuetext")).toContain("60 minutes");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Apply duration/)).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1].body))).toMatchObject({
      branchId, serviceId: massage.id, audience: "public", deliveryMode: "in_spa",
    });
    fireEvent.change(slider, { target: { value: "1" } });
    expect(onSelectQuote).toHaveBeenLastCalledWith(massage, massageOptions[1]);
    fireEvent.change(slider, { target: { value: "2" } });
    expect(onSelectQuote).toHaveBeenLastCalledWith(massage, massageOptions[2]);
    view.rerender(picker([{ ...massage, durationMinutes: 120, price: 1200 }], {
      onSelectQuote, lineQuotes: { [`att-1:${massage.id}`]: massageOptions[2]! },
    }));
    expect(slider.getAttribute("aria-valuetext")).toContain("120 minutes");
    expect(view.container.textContent).toContain("1,200");
    fireEvent.keyDown(slider, { key: "End" });
    expect(onSelectQuote).toHaveBeenLastCalledWith(expect.objectContaining({ id: massage.id }), massageOptions[4]);
    fireEvent.keyDown(slider, { key: "Home" });
    expect(onSelectQuote).toHaveBeenLastCalledWith(expect.objectContaining({ id: massage.id }), massageOptions[0]);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSelectQuote).toHaveBeenLastCalledWith(expect.objectContaining({ id: massage.id }), massageOptions[3]);
  });

  it("keeps each service and guest control independent", async () => {
    setupFetch();
    const onSelectQuote = vi.fn();
    const view = render(picker([massage, aroma, fixed], { onSelectQuote }));
    await waitFor(() => expect(screen.getAllByRole("slider")).toHaveLength(2));
    expect(screen.queryByRole("slider", { name: "Sports Massage duration" })).toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "Aromatherapy duration" }), { target: { value: "1" } });
    expect(onSelectQuote).toHaveBeenCalledWith(aroma, aromaOptions[1]);
    expect(onSelectQuote).not.toHaveBeenCalledWith(massage, expect.anything());
    view.rerender(picker([massage], { attendeeId: "att-2", onSelectQuote }));
    await waitFor(() => expect(screen.getByRole("slider", { name: "Angels Massage duration" })).toBeTruthy());
    expect(screen.getByRole("slider", { name: "Angels Massage duration" }).getAttribute("aria-valuetext")).toContain("60 minutes");
  });

  it("keeps base information visible and disables changes when quote loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const onSelectQuote = vi.fn();
    const view = render(picker([massage], { onSelectQuote }));
    await screen.findByRole("alert");
    const slider = screen.getByRole("slider");
    expect((slider as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(slider, { target: { value: "2" } });
    expect(onSelectQuote).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain("Angels Massage");
    expect(view.container.textContent).toContain("500");
  });
});

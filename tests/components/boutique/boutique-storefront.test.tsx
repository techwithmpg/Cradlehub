/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BoutiqueStorefront } from "@/components/public/boutique/boutique-storefront";
import { BOUTIQUE_PREVIEW_PRODUCTS } from "@/lib/boutique/catalogue-preview";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

afterEach(() => cleanup());

describe("Boutique B1 public preview UI", () => {
  it("labels the page as a demo and does not offer payable checkout", () => {
    render(<BoutiqueStorefront products={BOUTIQUE_PREVIEW_PRODUCTS} />);
    expect(screen.getByText(/no orders or payments are accepted/i)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /add to preview bag/i })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /open preview shopping bag/i }));
    expect(screen.getByRole("button", { name: /checkout unavailable in B1 preview/i }).hasAttribute("disabled")).toBe(true);
  });

  it("filters category and search and keeps cart separate from purchase flow", () => {
    render(<BoutiqueStorefront products={BOUTIQUE_PREVIEW_PRODUCTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Home Rituals" }));
    expect(screen.getAllByRole("button", { name: /add to preview bag/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /add to preview bag/i }));
    const viewCartButtons = screen.getAllByRole("button", { name: /view cart/i });
    expect(viewCartButtons.length).toBeGreaterThan(0);
    fireEvent.click(viewCartButtons[0]!);
    const dialog = screen.getByRole("dialog", { name: /preview shopping bag/i });
    expect(within(dialog).getByText(/250/)).toBeTruthy();
    expect(within(dialog).getByText(/quantities are not reserved/i)).toBeTruthy();
  });

  it("shows no matching examples for an unknown search", () => {
    render(<BoutiqueStorefront products={BOUTIQUE_PREVIEW_PRODUCTS} />);
    fireEvent.change(screen.getByPlaceholderText("Search wellness essentials"), {
      target: { value: "unlisted-candle" },
    });
    expect(screen.getByText(/No examples match that search/i)).toBeTruthy();
  });
});

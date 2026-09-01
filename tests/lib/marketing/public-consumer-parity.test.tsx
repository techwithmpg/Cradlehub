/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import {
  resolvePublicSiteSections,
  type PublicSiteSectionRow,
} from "@/lib/public/normalized-sections";
import { MobileHomeHeroCarousel } from "@/components/public/mobile/mobile-home-hero-carousel";
import { MobileFinalCta } from "@/components/public/mobile/mobile-final-cta";
import { SPA_IMAGES } from "@/constants/spa-images";

describe("C5.1 Public Consumer Parity & Component Grounding", () => {
  afterEach(cleanup);
  describe("resolvePublicSiteSections", () => {
    it("resolves canonical default public sections when input is empty or null", () => {
      const normalized = resolvePublicSiteSections(null);

      expect(normalized.hero.title).toBe("Restore Your Body. Quiet Your Mind.");
      expect(normalized.hero.subtitle).toContain(
        "Cradle Massage & Wellness Spa offers calming in-spa and home-service"
      );
      expect(normalized.hero.ctaLabel).toBe("Book Appointment");
      expect(normalized.hero.ctaHref).toBe("/book");
      expect(normalized.hero.imageUrl).toBe(SPA_IMAGES.hero);
      expect(normalized.hero.isEnabled).toBe(true);

      expect(normalized.about.title).toBe("A calming wellness space for Bacolod guests.");
      expect(normalized.about.subtitle).toBe("Spa Philosophy");
      expect(normalized.about.isEnabled).toBe(true);

      expect(normalized.quoteBanner.title).toBe("Give yourself permission to pause.");
      expect(normalized.quoteBanner.isEnabled).toBe(true);

      expect(normalized.beforeYouBook.title).toBe("Plan your visit with clear expectations.");
      expect(normalized.beforeYouBook.items.length).toBeGreaterThan(0);
      expect(normalized.beforeYouBook.isEnabled).toBe(true);

      expect(normalized.signatureServices.isVisible).toBe(true);
      expect(normalized.gallery.isVisible).toBe(true);
    });

    it("extracts customized database rows and normalizes fields accurately", () => {
      const customRows: PublicSiteSectionRow[] = [
        {
          id: "sec-1",
          section_key: "hero",
          title: "Customized Bacolod Calm",
          subtitle: "Experience tranquil body renewal tailored for you.",
          body: null,
          cta_label: "Reserve Now",
          cta_href: "/book?service=custom",
          image_url: "https://example.com/custom-hero.jpg",
          secondary_image_url: "https://example.com/custom-portrait.jpg",
          sort_order: 0,
          is_enabled: true,
          metadata: {
            secondaryCtaLabel: "Explore Menu",
            secondaryCtaHref: "/services",
          },
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
        {
          id: "sec-2",
          section_key: "quote_banner",
          title: "Summer Pause Promotion",
          subtitle: "Seasonal Special",
          body: "Enjoy 20% off all renewal packages this month.",
          cta_label: "Book Special",
          cta_href: "/book?promo=summer",
          image_url: "https://example.com/summer-banner.jpg",
          secondary_image_url: null,
          sort_order: 50,
          is_enabled: true,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ];

      const normalized = resolvePublicSiteSections(customRows);

      expect(normalized.hero.title).toBe("Customized Bacolod Calm");
      expect(normalized.hero.subtitle).toBe("Experience tranquil body renewal tailored for you.");
      expect(normalized.hero.ctaLabel).toBe("Reserve Now");
      expect(normalized.hero.ctaHref).toBe("/book?service=custom");
      expect(normalized.hero.imageUrl).toBe("https://example.com/custom-hero.jpg");
      expect(normalized.hero.secondaryImageUrl).toBe("https://example.com/custom-portrait.jpg");
      expect(normalized.hero.secondaryCtaLabel).toBe("Explore Menu");
      expect(normalized.hero.secondaryCtaHref).toBe("/services");

      expect(normalized.quoteBanner.title).toBe("Summer Pause Promotion");
      expect(normalized.quoteBanner.subtitle).toBe("Seasonal Special");
      expect(normalized.quoteBanner.body).toBe("Enjoy 20% off all renewal packages this month.");
      expect(normalized.quoteBanner.ctaLabel).toBe("Book Special");
    });

    it("respects is_enabled: false across sections", () => {
      const disabledRows: PublicSiteSectionRow[] = [
        {
          id: "sec-1",
          section_key: "hero",
          title: "Hidden Hero",
          subtitle: "Hidden Subtitle",
          body: null,
          cta_label: "Book",
          cta_href: "/book",
          image_url: null,
          secondary_image_url: null,
          sort_order: 0,
          is_enabled: false,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
        {
          id: "sec-2",
          section_key: "quote_banner",
          title: "Hidden Quote",
          subtitle: "Hidden Eyebrow",
          body: null,
          cta_label: "Book",
          cta_href: "/book",
          image_url: null,
          secondary_image_url: null,
          sort_order: 50,
          is_enabled: false,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ];

      const normalized = resolvePublicSiteSections(disabledRows);
      expect(normalized.hero.isEnabled).toBe(false);
      expect(normalized.quoteBanner.isEnabled).toBe(false);
    });
  });

  describe("MobileHomeHeroCarousel presentation grounding", () => {
    it("renders custom hero copy and CTAs when normalized hero is supplied", () => {
      const normalized = resolvePublicSiteSections([
        {
          id: "sec-1",
          section_key: "hero",
          title: "Customized Bacolod Calm",
          subtitle: "Experience tranquil body renewal tailored for you.",
          body: null,
          cta_label: "Reserve Now",
          cta_href: "/book?promo=c5",
          image_url: "https://example.com/custom-hero.jpg",
          secondary_image_url: null,
          sort_order: 0,
          is_enabled: true,
          metadata: {
            secondaryCtaLabel: "Explore Menu",
            secondaryCtaHref: "/services#menu",
          },
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ]);

      render(<MobileHomeHeroCarousel hero={normalized.hero} />);

      expect(screen.getByText("Customized Bacolod Calm")).toBeDefined();
      expect(screen.getByText("Experience tranquil body renewal tailored for you.")).toBeDefined();

      const primaryCta = screen.getByRole("link", { name: "Reserve Now" });
      expect(primaryCta.getAttribute("href")).toBe("/book?promo=c5");

      const secondaryCta = screen.getByRole("link", { name: "Explore Menu" });
      expect(secondaryCta.getAttribute("href")).toBe("/services#menu");
    });

    it("returns null when hero section is disabled", () => {
      const normalized = resolvePublicSiteSections([
        {
          id: "sec-1",
          section_key: "hero",
          title: "Disabled Hero",
          subtitle: "Disabled Subtitle",
          body: null,
          cta_label: "Book",
          cta_href: "/book",
          image_url: null,
          secondary_image_url: null,
          sort_order: 0,
          is_enabled: false,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ]);

      const { container } = render(<MobileHomeHeroCarousel hero={normalized.hero} />);
      expect(container.firstChild).toBeNull();
    });

    it("falls back gracefully when hero is omitted or empty", () => {
      render(<MobileHomeHeroCarousel />);

      expect(screen.getByText(/Where calm/i)).toBeDefined();
      expect(screen.getByRole("link", { name: "Book Appointment" })).toBeDefined();
      expect(screen.getByRole("link", { name: "View Services" })).toBeDefined();
    });
  });

  describe("MobileFinalCta presentation grounding", () => {
    it("renders custom quote banner copy and link when quoteBanner is supplied", () => {
      const normalized = resolvePublicSiteSections([
        {
          id: "sec-2",
          section_key: "quote_banner",
          title: "Special Anniversary Offer",
          subtitle: "Limited Time",
          body: "Book your restorative treatment during our anniversary week.",
          cta_label: "Claim Offer",
          cta_href: "/book?promo=anniversary",
          image_url: "https://example.com/anniversary.jpg",
          secondary_image_url: null,
          sort_order: 50,
          is_enabled: true,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ]);

      render(<MobileFinalCta quoteBanner={normalized.quoteBanner} />);

      expect(screen.getByRole("heading", { name: "Special Anniversary Offer" })).toBeDefined();
      expect(screen.getByText("Limited Time")).toBeDefined();
      expect(
        screen.getByText("Book your restorative treatment during our anniversary week.")
      ).toBeDefined();
      const cta = screen.getByRole("link", { name: /Claim Offer/i });
      expect(cta.getAttribute("href")).toBe("/book?promo=anniversary");
    });

    it("returns null when quote banner is disabled", () => {
      const normalized = resolvePublicSiteSections([
        {
          id: "sec-2",
          section_key: "quote_banner",
          title: "Hidden Quote",
          subtitle: "Hidden Eyebrow",
          body: null,
          cta_label: "Book",
          cta_href: "/book",
          image_url: null,
          secondary_image_url: null,
          sort_order: 50,
          is_enabled: false,
          metadata: {},
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        },
      ]);

      const { container } = render(<MobileFinalCta quoteBanner={normalized.quoteBanner} />);
      expect(container.firstChild).toBeNull();
    });
  });
});

"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Clock,
  Flower2,
  Heart,
  Home,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import type { PublicCatalogService } from "@/lib/queries/services";
import { getPublicHomeCategoryImage } from "@/lib/public/service-catalog-config";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ServiceImage } from "@/components/public/service-image";
import { ServiceDetailDialog } from "@/components/public/service-detail-dialog";
import { useBoutiqueCart } from "@/components/public/boutique-cart-context";

type PublicMobileServicesProps = {
  services: PublicCatalogService[];
  bannerImage?: string;
  initialCategory?: string;
};

const MOBILE_CATEGORIES = [
  {
    id: "Massage Services",
    label: "Massage",
    image: getPublicHomeCategoryImage("Massage Services"),
  },
  {
    id: "Skin Care Services",
    label: "Facials",
    image: getPublicHomeCategoryImage("Skin Care Services"),
  },
  {
    id: "Divine Renewal Packages",
    label: "Packages",
    image: SPA_IMAGES.aromatherapy,
  },
  {
    id: "Salon Services",
    label: "Salon & Nail",
    image: getPublicHomeCategoryImage("Salon Services"),
  },
  {
    id: "home_only",
    label: "Home Service",
    image: SPA_IMAGES.heroPortrait,
  },
];

export function PublicMobileServices({
  services,
  bannerImage,
  initialCategory = "all",
}: PublicMobileServicesProps) {
  const safeServices = useMemo(
    () =>
      services.filter(
        (s) => s.isPublicBookable && !s.isCsrOnly && !s.isVip,
      ),
    [services],
  );

  const { wishlistIds, toggleWishlist } = useBoutiqueCart();
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategory || "all",
  );
  const [experienceChoice, setExperienceChoice] = useState<
    "in_spa" | "home_service"
  >(initialCategory === "home_only" ? "home_service" : "in_spa");
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "duration">(
    "popular",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [detailService, setDetailService] = useState<PublicCatalogService | null>(
    null,
  );

  const visibleServices = useMemo(() => {
    const filtered = safeServices.filter((s) => {
      if (selectedCategory === "home_only") {
        return s.availableHomeService;
      }
      if (selectedCategory !== "all" && s.categoryName !== selectedCategory) {
        return false;
      }
      if (experienceChoice === "home_service" && !s.availableHomeService) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "price_asc") sorted.sort((a, b) => a.price - b.price);
    else if (sortBy === "duration")
      sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
    return sorted;
  }, [safeServices, selectedCategory, experienceChoice, sortBy]);

  const featured = visibleServices[0] || safeServices[0] || null;

  return (
    <div className="w-full bg-[#071A12] text-[#FAF5E9] md:hidden">
      {/* Dark Forest Mobile Header & Category Scroller */}
      <section className="relative overflow-hidden border-b border-[#D4B57A]/20 bg-[#05140E] px-4 pt-6 pb-8 text-[#FAF5E9]">
        {bannerImage && (
          <Image
            src={bannerImage}
            alt="Our Spa Services"
            fill
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
            className="eg-hero-photo pointer-events-none object-cover opacity-25"
          />
        )}
        <div className="relative z-10 mx-auto max-w-md">
          <h1 className="font-serif text-3xl font-medium text-[#E8D5A3] [font-family:var(--sp-font-display)]">
            Our Services
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#CBD6CD]">
            Expert care, premium treatments, and a peaceful escape — crafted for
            your total well-being.
          </p>

          {/* Horizontal Category Circles */}
          <div className="mt-5 flex gap-3.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="flex shrink-0 flex-col items-center text-center"
            >
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  selectedCategory === "all"
                    ? "border-[#D4B57A] bg-[#D4B57A] text-[#071A12]"
                    : "border-[#D4B57A]/30 bg-[#0D2E20] text-[#FAF5E9]"
                }`}
              >
                All
              </span>
              <span className="mt-1.5 text-[11px] font-medium text-[#FAF5E9]">
                All Menu
              </span>
            </button>
            {MOBILE_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex shrink-0 flex-col items-center text-center"
                >
                  <div
                    className={`relative h-14 w-14 overflow-hidden rounded-full border-2 ${
                      active ? "border-[#D4B57A] ring-2 ring-[#D4B57A]/40" : "border-[#D4B57A]/30"
                    }`}
                  >
                    <Image
                      src={cat.image}
                      alt={cat.label}
                      fill
                      sizes="56px"
                      loading="lazy"
                      className="object-cover"
                    />
                  </div>
                  <span
                    className={`mt-1.5 text-[11px] font-medium ${
                      active ? "text-[#E8D5A3]" : "text-[#CBD6CD]"
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter & Sort Controls Row */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter category"
              className="rounded-full border border-[#D4B57A]/35 bg-[#0C291D] px-3 py-2 text-[11px] text-[#FAF5E9]"
            >
              <option value="all">All Services</option>
              <option value="Massage Services">Massage</option>
              <option value="Skin Care Services">Facials</option>
              <option value="Salon Services">Salon &amp; Nail</option>
              <option value="Divine Renewal Packages">Packages</option>
              <option value="Spa Party Packages">Spa Parties</option>
              <option value="home_only">Home Service</option>
            </select>

            <button
              type="button"
              onClick={() => setShowFilters((p) => !p)}
              className="eg-glass-pill inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-[11px] text-[#FAF5E9]"
            >
              <SlidersHorizontal className="h-3 w-3 text-[#E5C98B]" aria-hidden="true" />
              <span>Filter</span>
            </button>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "popular" | "price_asc" | "duration")
              }
              aria-label="Sort treatments"
              className="rounded-full border border-[#D4B57A]/35 bg-[#0C291D] px-3 py-2 text-[11px] text-[#FAF5E9]"
            >
              <option value="popular">Sort: Popular</option>
              <option value="price_asc">Price ↑</option>
              <option value="duration">Duration</option>
            </select>
          </div>

          {/* Optional Quick Mode Drawer */}
          {showFilters && (
            <div className="eg-glass-card mt-3 flex gap-2 rounded-2xl p-2.5 text-xs">
              <button
                type="button"
                onClick={() => setExperienceChoice("in_spa")}
                className={`flex-1 rounded-xl py-2 font-medium ${
                  experienceChoice === "in_spa"
                    ? "bg-[#D4B57A] text-[#071A12]"
                    : "text-[#FAF5E9]"
                }`}
              >
                In-Spa Only
              </button>
              <button
                type="button"
                onClick={() => setExperienceChoice("home_service")}
                className={`flex-1 rounded-xl py-2 font-medium ${
                  experienceChoice === "home_service"
                    ? "bg-[#D4B57A] text-[#071A12]"
                    : "text-[#FAF5E9]"
                }`}
              >
                Home Service
              </button>
            </div>
          )}

          {/* Featured Treatment Spotlight Card */}
          {featured && (
            <div className="eg-glass-card mt-5 overflow-hidden rounded-2xl p-3.5">
              <div className="flex items-start gap-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#0A251B]">
                  <ServiceImage
                    src={featured.imageUrl}
                    alt={featured.imageAlt || featured.name}
                    category={featured.categoryName}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#D4B57A] px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-[#071A12] uppercase">
                    <Star className="h-2.5 w-2.5" aria-hidden="true" />
                    Featured Treatment
                  </span>
                  <h2 className="mt-1.5 truncate font-serif text-lg font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                    {featured.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#CBD6CD]">
                    <span>{featured.durationText}</span>
                    <span>|</span>
                    <span className="font-semibold text-[#E8D5A3] tabular-nums">
                      {featured.priceLabel}
                    </span>
                  </div>
                  <Link
                    href={`/book?serviceId=${encodeURIComponent(featured.id)}&visitType=${experienceChoice}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#D4B57A] px-4 py-1.5 text-xs font-semibold text-[#071A12]"
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Book Now →</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Emerald Glass Treatment Cards */}
      <section className="mx-auto max-w-md space-y-3 px-4 py-6">
        {visibleServices.map((service) => {
          const liked = wishlistIds.includes(service.id);
          return (
            <div
              key={service.id}
              className="eg-glass-card rounded-2xl p-3.5"
            >
              <div className="flex gap-3">
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#0A251B]">
                  <ServiceImage
                    src={service.imageUrl}
                    alt={service.imageAlt || service.name}
                    category={service.categoryName}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-serif text-base font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
                      {service.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(service.id)}
                      aria-label={liked ? `Remove ${service.name} from saved` : `Save ${service.name}`}
                      className="shrink-0 text-[#E5C98B]"
                    >
                      <Heart
                        className={`h-4 w-4 ${liked ? "fill-[#D4B57A] text-[#D4B57A]" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#CBD6CD]">
                    {service.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-[#CBD6CD]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#E5C98B]" aria-hidden="true" />
                        <span>{service.durationText}</span>
                      </span>
                      <span className="font-bold text-[#E8D5A3] tabular-nums">
                        {service.priceLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailService(service)}
                        className="text-[11px] font-semibold text-[#E8D5A3] underline-offset-2 hover:underline"
                      >
                        View Details
                      </button>
                      <Link
                        href={`/book?serviceId=${encodeURIComponent(service.id)}&visitType=${experienceChoice}`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#D4B57A] px-3 py-1.5 text-[11px] font-semibold text-[#071A12]"
                      >
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        <span>Book</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Choose Your Service Experience Selector */}
        <div className="pt-4">
          <h2 className="font-serif text-lg font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
            Choose Your Service Experience
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setExperienceChoice("in_spa")}
              className={`rounded-2xl border p-3.5 text-left transition ${
                experienceChoice === "in_spa"
                  ? "border-[#D4B57A] bg-[#14422F] text-[#FAF5E9]"
                  : "eg-glass-card text-[#FAF5E9]"
              }`}
            >
              <Flower2
                className="h-4 w-4 text-[#E5C98B]"
                aria-hidden="true"
              />
              <p className="mt-2 text-xs font-semibold">In-Spa Experience</p>
              <p className="mt-0.5 text-[10px] text-[#CBD6CD]">
                Visit SM Bacolod or Lacson suite
              </p>
            </button>

            <button
              type="button"
              onClick={() => setExperienceChoice("home_service")}
              className={`rounded-2xl border p-3.5 text-left transition ${
                experienceChoice === "home_service"
                  ? "border-[#D4B57A] bg-[#14422F] text-[#FAF5E9]"
                  : "eg-glass-card text-[#FAF5E9]"
              }`}
            >
              <Home
                className="h-4 w-4 text-[#E5C98B]"
                aria-hidden="true"
              />
              <p className="mt-2 text-xs font-semibold">Home Service</p>
              <p className="mt-0.5 text-[10px] text-[#CBD6CD]">
                Spa comfort at your door
              </p>
            </button>
          </div>

          <Link
            href={`/book?visitType=${experienceChoice}`}
            className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-5 py-3 text-sm font-semibold text-[#071A12] shadow-sm"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>Book an Appointment</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <ServiceDetailDialog
        service={detailService}
        bookingHref={
          detailService
            ? `/book?serviceId=${encodeURIComponent(detailService.id)}&visitType=${experienceChoice}`
            : `/book?visitType=${experienceChoice}`
        }
        onClose={() => setDetailService(null)}
      />
    </div>
  );
}

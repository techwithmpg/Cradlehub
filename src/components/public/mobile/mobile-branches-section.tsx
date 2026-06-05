import Image from "next/image";
import Link from "next/link";
import { MapPin, Navigation, Phone } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";
import type { Database } from "@/types/supabase";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

type MobileBranchesSectionProps = {
  branches: BranchRow[];
};

function mapHref(address: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/\s/g, "")}`;
}

export function MobileBranchesSection({ branches }: MobileBranchesSectionProps) {
  if (branches.length === 0) return null;

  return (
    <section className="px-4 pt-12">
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
          Bacolod locations
        </p>
        <MobileScrollFloatHeading text="Find Your Cradle" />
      </div>

      <div className="space-y-4">
        {branches.map((branch, index) => (
          <MobileFadeUp key={branch.id}>
            <article className="overflow-hidden rounded-[30px] border border-[#C8A96A]/20 bg-[#F3E9D2] shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
              <div className="relative h-[128px] overflow-hidden">
                <Image
                  src={index % 2 === 0 ? SPA_IMAGES.heroWide : SPA_IMAGES.heroAmbience}
                  alt={branch.name}
                  fill
                  className="object-cover"
                  sizes="calc(100vw - 32px)"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,17,12,0.76)_0%,rgba(4,17,12,0.12)_72%)]" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-[25px] font-medium leading-none text-[#F3E9D2] [font-family:var(--sp-font-accent)]">
                    {branch.name}
                  </h3>
                  {branch.opening_hours ? (
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96A]">
                      {branch.opening_hours}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="p-5">
                <p className="flex gap-2 text-[12px] leading-6 text-[#405448]">
                  <MapPin
                    className="mt-1 h-4 w-4 shrink-0 text-[#9A6A1F]"
                    aria-hidden="true"
                  />
                  <span>{branch.address}</span>
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {branch.phone ? (
                    <Link
                      href={phoneHref(branch.phone)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#C8A96A]/26 bg-[#0D2B20]/88 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F3E9D2] shadow-[0_10px_24px_rgba(13,43,32,0.22)] backdrop-blur-md"
                    >
                      <Phone className="h-3.5 w-3.5 text-[#C8A96A]" aria-hidden="true" />
                      Call
                    </Link>
                  ) : null}
                  <Link
                    href={mapHref(branch.address)}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#C8A96A]/26 bg-[#0D2B20]/88 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F3E9D2] shadow-[0_10px_24px_rgba(13,43,32,0.22)] backdrop-blur-md ${
                      branch.phone ? "" : "col-span-2"
                    }`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation className="h-3.5 w-3.5 text-[#C8A96A]" aria-hidden="true" />
                    Directions
                  </Link>
                </div>
              </div>
            </article>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}

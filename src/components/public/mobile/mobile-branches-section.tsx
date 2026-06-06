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
          Find Your Cradle
        </p>
        <MobileScrollFloatHeading text="Our Branches" />
      </div>

      <div className="space-y-4">
        {branches.map((branch, index) => (
          <MobileFadeUp key={branch.id}>
            <article className="relative min-h-[440px] overflow-hidden rounded-[30px] border border-[#C8A96A]/24 bg-[#05241D] shadow-[0_24px_64px_rgba(0,0,0,0.34)]">
              <Image
                src={index % 2 === 0 ? SPA_IMAGES.heroWide : SPA_IMAGES.heroAmbience}
                alt={branch.name}
                fill
                className="object-cover"
                sizes="calc(100vw - 32px)"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_18%,rgba(200,169,106,0.14)_0%,transparent_42%),linear-gradient(to_bottom,rgba(3,27,22,0.18)_0%,rgba(3,27,22,0.34)_42%,rgba(3,27,22,0.94)_100%)]" />
              <div className="relative flex min-h-[440px] flex-col justify-end p-4">
                <div className="rounded-[26px] border border-[#C8A96A]/22 bg-[#0D2B20]/66 p-4 shadow-[0_20px_56px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                  <h3 className="text-[28px] font-medium leading-none text-[#F5ECDD] [font-family:var(--sp-font-accent)]">
                    {branch.name}
                  </h3>
                  {branch.opening_hours ? (
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4B57A]">
                      {branch.opening_hours}
                    </p>
                  ) : null}
                  <p className="mt-4 flex gap-2 text-[12px] leading-6 text-[#EFE3CF]/78">
                    <MapPin
                      className="mt-1 h-4 w-4 shrink-0 text-[#C8A96A]"
                      aria-hidden="true"
                    />
                    <span>{branch.address}</span>
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                  {branch.phone ? (
                    <Link
                      href={phoneHref(branch.phone)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#C8A96A]/42 bg-[#061912]/42 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F5ECDD] shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur-md"
                    >
                      <Phone className="h-3.5 w-3.5 text-[#C8A96A]" aria-hidden="true" />
                      Call
                    </Link>
                  ) : null}
                  <Link
                    href={mapHref(branch.address)}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#C8A96A]/42 bg-[#061912]/42 px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F5ECDD] shadow-[0_10px_24px_rgba(0,0,0,0.24)] backdrop-blur-md ${
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
              </div>
            </article>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}

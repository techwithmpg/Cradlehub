import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Flower2, Leaf, MapPin, Navigation, Phone, Sparkles } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

type MobileBranch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  opening_hours?: string | null;
  location_metadata?: unknown;
};

function mapHref(branch: MobileBranch) {
  return `https://maps.google.com/?q=${encodeURIComponent(branch.address || branch.name)}`;
}

const BRANCH_PILLARS = [
  { label: "Massage", Icon: Leaf },
  { label: "Body Treatment", Icon: Flower2 },
  { label: "Nails & Beauty", Icon: Sparkles },
] as const;

export function PublicMobileBranches({
  branches,
  fallbackImage,
}: {
  branches: MobileBranch[];
  fallbackImage?: string;
}) {
  return (
    <div className="md:hidden bg-[#071A12] pb-24 pt-16 text-[#FAF5E9]">
      <section className="relative overflow-hidden border-b border-[#D4B57A]/15 bg-[#05140E] px-5 pb-12 pt-8 text-[#FAF5E9]">
        <Image
          src={fallbackImage || SPA_IMAGES.contact}
          alt=""
          fill
          preload
          fetchPriority="high"
          sizes="100vw"
          className="eg-hero-photo object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05140E]/75 via-[#05140E]/70 to-[#071A12]" aria-hidden="true" />
        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#E5C98B]">
            Our Branches
          </p>
          <h1
            className="mt-2 text-[30px] font-medium leading-tight text-[#FAF5E9]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Visit Our Branches
          </h1>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#CBD6CD]">
            Experience Cradle Wellness Living at our convenient locations in Bacolod
            City.
          </p>
        </div>
      </section>

      <section className="relative z-10 -mt-6 space-y-5 px-4">
        {branches.map((branch, index) => {
          const metaImg =
            branch.location_metadata &&
            typeof branch.location_metadata === "object" &&
            "image_url" in branch.location_metadata &&
            typeof branch.location_metadata.image_url === "string" &&
            branch.location_metadata.image_url.trim().length > 0
              ? branch.location_metadata.image_url.trim()
              : null;
          const imgSrc =
            metaImg ||
            fallbackImage ||
            (index % 2 === 0 ? SPA_IMAGES.branchMain : SPA_IMAGES.branchSm);
          const shortLabel = /sm/i.test(branch.name)
            ? "SM Branch"
            : index === 0
              ? "Main Spa"
              : branch.name;

          return (
            <article
              key={branch.id}
              className="eg-glass-card overflow-hidden rounded-2xl p-3.5"
            >
              <div className="relative h-44 w-full overflow-hidden rounded-xl bg-[#0A251A]">
                <Image
                  src={imgSrc}
                  alt={branch.name}
                  fill
                  loading="lazy"
                  className="object-cover"
                  sizes="100vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071A12]/65 via-transparent to-transparent" />
                <div className="eg-glass-pill absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#071D15]/90 px-3 py-1.5 text-[12px] font-semibold text-[#FAF5E9]">
                  <MapPin className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
                  <span>{branch.name}</span>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 px-1">
                {branch.address ? (
                  <p className="flex items-start gap-2 text-[12px] leading-snug text-[#CBD6CD]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E5C98B]" aria-hidden="true" />
                    <span>{branch.address}</span>
                  </p>
                ) : null}
                {branch.opening_hours ? (
                  <p className="flex items-center gap-2 text-[12px] text-[#CBD6CD]">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#E5C98B]" aria-hidden="true" />
                    <span>{branch.opening_hours}</span>
                  </p>
                ) : null}
                {branch.phone ? (
                  <p className="flex items-center gap-2 text-[12px] text-[#CBD6CD]">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-[#E5C98B]" aria-hidden="true" />
                    <a
                      href={`tel:${branch.phone.replace(/\s/g, "")}`}
                      className="font-medium text-[#FAF5E9] underline decoration-[#D4B57A]/60"
                    >
                      {branch.phone}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2">
                {BRANCH_PILLARS.map(({ label, Icon }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center justify-center rounded-xl border border-[#D4B57A]/20 bg-[#0A251A]/75 px-2 py-2.5 text-center"
                  >
                    <Icon className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                    <span className="mt-1 text-[11px] font-medium leading-tight text-[#FAF5E9]">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={`/book?branchId=${encodeURIComponent(branch.id)}`}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-4 text-[13px] font-semibold text-[#071A12] shadow-[0_8px_20px_-8px_rgba(212,181,122,0.5)] transition hover:brightness-105"
                >
                  Book at {shortLabel}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <a
                  href={mapHref(branch)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-4 text-[12px] font-semibold text-[#FAF5E9] backdrop-blur-sm transition hover:border-[#E8D5A3]/75 hover:bg-[#14402E]"
                >
                  <Navigation className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
                  Get Directions
                </a>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

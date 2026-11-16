import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, Flower2, Gem, Leaf, ShieldCheck } from "lucide-react";
import { SPA_IMAGES } from "@/constants/spa-images";

const pillars = [
  { label: "Rest & Relaxation", Icon: Flower2 },
  { label: "Professional Care", Icon: Leaf },
  { label: "Safe & Hygienic", Icon: ShieldCheck },
  { label: "Premium Experience", Icon: Gem },
] as const;

type PublicMobileAboutProps = {
  headerImage?: string;
};

export function PublicMobileAbout({ headerImage }: PublicMobileAboutProps = {}) {
  const effectiveHeaderImage = headerImage || SPA_IMAGES.aboutSecondary;

  return (
    <div className="md:hidden bg-[#071A12] pb-24 pt-16 text-[#FAF5E9]">
      <section className="relative overflow-hidden border-b border-[#D4B57A]/15 bg-[#05140E] px-5 pb-12 pt-8 text-[#FAF5E9]">
        <Image
          src={effectiveHeaderImage}
          alt=""
          fill
          preload
          fetchPriority="high"
          className="eg-hero-photo object-cover opacity-35"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05140E]/92 via-[#05140E]/72 to-[#071A12]/45" />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#E5C98B]">
              About Us
            </p>
            <span className="h-px w-6 bg-[#D4B57A]/60" aria-hidden="true" />
          </div>
          <h1
            className="mt-2 text-[32px] font-medium leading-tight text-[#FAF5E9]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            Our Story
          </h1>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[#CBD6CD]">
            Experience Cradle Wellness Living at our convenient locations in Bacolod
            City.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <Link
              href="/book"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4B57A] via-[#E4C98E] to-[#D4B57A] px-5 text-[13px] font-semibold text-[#071A12] shadow-[0_8px_20px_-8px_rgba(212,181,122,0.5)]"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Book an Experience
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/services"
              className="flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#D4B57A]/40 bg-[#0D2E20]/70 px-5 text-[13px] font-semibold text-[#FAF5E9] backdrop-blur-sm"
            >
              <Leaf className="h-3.5 w-3.5 text-[#E5C98B]" aria-hidden="true" />
              Our Services
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-5 px-4">
        <div className="eg-glass-card rounded-2xl p-4">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-[#0A251A]">
            <Image
              src={SPA_IMAGES.about}
              alt="Cradle Wellness Living spa treatment sanctuary"
              fill
              loading="lazy"
              sizes="100vw"
              className="object-cover"
            />
          </div>

          <h2
            className="mt-4 text-[21px] font-semibold leading-snug text-[#FAF5E9]"
            style={{ fontFamily: "var(--sp-font-display)" }}
          >
            The Cradle Wellness Living Experience
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#CBD6CD]">
            A calm wellness and spa brand in Bacolod City, dedicated to providing
            professional massage, beauty, and holistic care that restores balance to your
            body, mind, and lifestyle.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {pillars.map(({ label, Icon }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center rounded-xl border border-[#D4B57A]/20 bg-[#0A251A]/75 px-3 py-3.5 text-center"
              >
                <Icon className="h-5 w-5 text-[#E5C98B]" aria-hidden="true" />
                <p className="mt-2 text-[12px] font-semibold leading-tight text-[#FAF5E9]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pt-4">
        <Link
          href="/services"
          className="eg-glass-card flex items-center justify-between rounded-2xl px-5 py-4"
        >
          <div>
            <p
              className="text-[16px] font-semibold text-[#FAF5E9]"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Our Commitment
            </p>
            <p className="mt-0.5 text-[12px] text-[#CBD6CD]">
              Personalized, hygienic, and thoughtful wellness care.
            </p>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4B57A]/35 bg-[#0A251A] text-[#E5C98B]">
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      </section>
    </div>
  );
}

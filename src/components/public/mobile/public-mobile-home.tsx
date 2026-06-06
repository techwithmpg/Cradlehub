import { getPublicServiceCatalog } from "@/lib/queries/services";
import type { PublicCatalogService } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { CradleBreathReveal } from "./cradle-breath-reveal";
import { MobileHomeHeroCarousel } from "./mobile-home-hero-carousel";
import { MobileCalmCategories } from "./mobile-calm-categories";
import { MobileMostLovedTreatments } from "./mobile-most-loved-treatments";
import { MobileSignatureRituals } from "./mobile-signature-rituals";
import { MobileGuestImpressions } from "./mobile-guest-impressions";
import { MobileBranchesSection } from "./mobile-branches-section";
import { MobileFinalCta } from "./mobile-final-cta";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";
import { FaqAccordion } from "../faq-accordion";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

// ── Static data ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  { text: "The service felt calm, careful, and professional from start to finish.", name: "A. Guest" },
  { text: "The space is clean, peaceful, and easy to relax in.", name: "Cradle Client" },
  { text: "A refreshing experience that makes self-care feel simple.", name: "Regular Guest" },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

type PublicMobileHomeProps = {
  branches?: BranchRow[];
};

export async function PublicMobileHome({ branches = [] }: PublicMobileHomeProps) {
  let services: PublicCatalogService[] = [];
  try {
    const all = await getPublicServiceCatalog();
    services = all.filter((s) => s.isPublicBookable && !s.isCsrOnly && !s.isVip);
  } catch {
    // non-fatal — section hidden when data unavailable
  }

  const featured = services.slice(0, 4);
  const branchNames = branches.map((b) => b.name).filter(Boolean);
  const branchAddresses = branches.map((b) => b.address).filter(Boolean);
  const branchListText =
    branchNames.length >= 2
      ? `${branchNames.slice(0, -1).join(", ")} and ${branchNames[branchNames.length - 1]}`
      : branchNames[0] ?? "our Bacolod branches";
  const branchAddressText =
    branchAddresses.length >= 2
      ? `${branchAddresses.slice(0, -1).join(" and ")}`
      : branchAddresses[0] ?? "";

  return (
    <div className="bg-[#061912] pb-0 text-[#F3E9D2] md:hidden">
      <CradleBreathReveal />

      {/* ── Hero Carousel ─────────────────────────────────────────────────── */}
      <MobileHomeHeroCarousel />

      {/* ── Calm mobile journey ───────────────────────────────────────────── */}
      <div className="-mt-5 rounded-t-[30px] bg-[#061912] pt-2 shadow-[0_-18px_44px_rgba(0,0,0,0.24)]">
        {/* ── Choose Your Calm / Service Categories ───────────────────────── */}
        <MobileCalmCategories services={services} />

        {/* ── Most-Loved Treatments ───────────────────────────────────────── */}
        <MobileMostLovedTreatments services={featured} />

        {/* ── Signature Rituals ───────────────────────────────────────────── */}
        <MobileSignatureRituals services={services} />

        {/* ── Guest Impressions ───────────────────────────────────────────── */}
        <MobileGuestImpressions testimonials={TESTIMONIALS} />

        {/* ── Branches ────────────────────────────────────────────────────── */}
        <MobileBranchesSection branches={branches} />

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="px-4 pt-12">
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
              Frequently Asked
            </p>
            <MobileScrollFloatHeading text="Questions" />
          </div>
          <MobileFadeUp>
            <div className="rounded-[28px] border border-[#C8A96A]/22 bg-[#0D2B20]/65 px-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <FaqAccordion
                revealItems
                variant="dark"
                items={[
                  {
                    question: "How do I book a massage?",
                    answer:
                      "Book online at cradlewellnessliving.com/book. Choose in-spa or home service, select your treatment, and confirm your schedule.",
                  },
                  {
                    question: "Do you offer home service massage in Bacolod?",
                    answer:
                      "Yes. Select Home Service when booking and provide your address. Our therapist will come to your location.",
                  },
                  {
                    question: "Where are your branches?",
                    answer:
                      branchNames.length > 0
                        ? `${branchListText}${branchAddressText ? `. ${branchAddressText}` : ""}`
                        : "We have branches in Bacolod City. Please contact us for the latest location information.",
                  },
                  {
                    question: "What services do you offer?",
                    answer:
                      "Massage, foot spa, body scrub, skin care, salon services, spa packages, and home service massage.",
                  },
                ]}
              />
            </div>
          </MobileFadeUp>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <MobileFinalCta />
      </div>
    </div>
  );
}

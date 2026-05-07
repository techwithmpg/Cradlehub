import { PageHeader } from "@/components/features/dashboard/page-header";
import { SPA_IMAGES } from "@/constants/spa-images";
import {
  getPublicSiteAssets,
  getPublicSiteSections,
} from "@/lib/queries/public-site";
import { MarketingStudio } from "./marketing-studio";

const sectionDefaults = [
  {
    sectionKey: "hero",
    label: "Hero",
    description: "Main homepage headline, subtitle, CTA, and background image.",
    title: "Restore Your Body. Quiet Your Mind.",
    subtitle:
      "Cradle Massage & Wellness Spa offers calming in-spa and home-service treatments in Bacolod for rest, recovery, and everyday renewal.",
    body: "",
    ctaLabel: "Book Appointment",
    ctaHref: "/book",
    imageUrl: SPA_IMAGES.hero,
    secondaryImageUrl: SPA_IMAGES.heroPortrait,
    sortOrder: 0,
    isEnabled: true,
    metadata: {
      secondaryCtaLabel: "Plan Your Visit",
      secondaryCtaHref: "#plan-your-visit",
    },
  },
  {
    sectionKey: "about",
    label: "About",
    description: "Spa philosophy and introduction copy.",
    title: "A calming wellness space for Bacolod guests.",
    subtitle: "Spa Philosophy",
    body:
      "Cradle is designed for the moments when your body asks for quiet and your schedule needs something simple. Guests can visit the spa or request home service when comfort at home is the better setting.",
    ctaLabel: "",
    ctaHref: "",
    imageUrl: SPA_IMAGES.about,
    secondaryImageUrl: SPA_IMAGES.aboutSecondary,
    sortOrder: 10,
    isEnabled: true,
    metadata: {},
  },
  {
    sectionKey: "quote_banner",
    label: "Promotion / Banner",
    description: "A full-width public banner for seasonal copy or a calming message.",
    title: "Give yourself permission to pause.",
    subtitle: "Pause Here",
    body: "",
    ctaLabel: "",
    ctaHref: "",
    imageUrl: SPA_IMAGES.ctaBanner,
    secondaryImageUrl: "",
    sortOrder: 50,
    isEnabled: true,
    metadata: {},
  },
  {
    sectionKey: "before_you_book",
    label: "Before You Book",
    description: "Practical public notes before a guest starts booking.",
    title: "Plan your visit with clear expectations.",
    subtitle: "Before You Book",
    body:
      "Booking is designed to be calm and transparent. Choose the setting first so the system can guide you toward the right service and schedule.",
    ctaLabel: "",
    ctaHref: "",
    imageUrl: "",
    secondaryImageUrl: "",
    sortOrder: 90,
    isEnabled: true,
    metadata: {
      items: [
        "Choose In-spa or Home Service before selecting your treatment.",
        "Home Service requires a complete address and helpful landmark details.",
        "The CRM or front desk team may follow up for payment confirmation.",
        "Payment is manually confirmed for now until the official payment integration is ready.",
        "Keep your phone reachable after booking in case the team needs to confirm details.",
      ],
    },
  },
] as const;

export default async function MarketingStudioPage() {
  const [sections, galleryAssets] = await Promise.all([
    getPublicSiteSections({ includeDisabled: true }),
    getPublicSiteAssets("gallery", { includeDisabled: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="Marketing Studio"
        description="Manage public homepage copy, imagery, gallery items, and promotional sections."
      />

      <MarketingStudio
        sectionDefaults={sectionDefaults}
        sections={sections}
        galleryAssets={galleryAssets}
      />
    </div>
  );
}

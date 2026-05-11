import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { HomePageSections } from "@/components/public/home-page-sections";
import { PublicMobileHome } from "@/components/public/mobile/public-mobile-home";
import { buildMetadata } from "@/lib/seo/metadata";
import { LocalBusinessJsonLd, FAQPageJsonLd } from "@/components/seo/structured-data";

export const metadata: Metadata = buildMetadata({
  title: "Cradle Wellness Living | Massage, Spa & Home Service Wellness in Bacolod",
  description:
    "Book relaxing massage, spa, and wellness services with Cradle Wellness Living in Bacolod. Visit our branches or schedule a convenient home service appointment.",
  path: "/",
});

const homepageFaqs = [
  {
    question: "How do I book a massage at Cradle Wellness Living?",
    answer:
      "You can book online through our website at cradlewellnessliving.com/book. Choose your setting (in-spa or home service), select your treatment, pick a date and time, and confirm your appointment. Our front desk may follow up for payment confirmation.",
  },
  {
    question: "Do you offer home service massage in Bacolod?",
    answer:
      "Yes. Cradle Wellness Living offers home service massage in Bacolod. When booking, select Home Service and provide your complete address and a nearby landmark. Availability may differ from in-spa hours, and our team may call to confirm details.",
  },
  {
    question: "Can I choose a therapist when I book?",
    answer:
      "Yes. Our booking system lets you pick from available therapists based on your selected branch, date, and time. If you have no preference, we will assign a qualified therapist for you.",
  },
  {
    question: "Where are your branches located?",
    answer:
      "We have two branches in Bacolod City: SM City Bacolod (3rd Floor, North Wing) and La Luz Branch (3rd Floor, La Luz Building, Lacson National Highway). Both offer the same calm experience and skilled team.",
  },
  {
    question: "What services does Cradle Wellness Living offer?",
    answer:
      "We offer massage services, foot spa, body scrub, skin care treatments, salon services, Divine Renewal packages, and spa party packages. Browse our full menu at cradlewellnessliving.com/services.",
  },
  {
    question: "Can I book online?",
    answer:
      "Absolutely. Online booking is available 24/7 at cradlewellnessliving.com/book. The guided flow helps you choose your branch, service, schedule, and therapist in under two minutes.",
  },
];

export default function HomePage() {
  return (
    <div className="sp-public">
      <SiteHeader />
      <main>
        <PublicMobileHome />
        <div className="hidden md:block">
          <HomePageSections />
        </div>
      </main>
      <SiteFooter />
      <LocalBusinessJsonLd />
      <FAQPageJsonLd faqs={homepageFaqs} />
    </div>
  );
}

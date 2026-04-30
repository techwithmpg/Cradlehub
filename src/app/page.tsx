import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { HeroSection } from "@/components/public/hero-section";
import { AboutSection } from "@/components/public/about-section";
import { ServicesSection } from "@/components/public/services-section";
import { CtaBannerSection } from "@/components/public/cta-banner-section";
import { TestimonialsSection } from "@/components/public/testimonials-section";
import { BookingCtaSection } from "@/components/public/booking-cta-section";

export default function HomePage() {
  return (
    <div className="sp-public">
      <SiteHeader />
      <main>
        <HeroSection />
        <AboutSection />
        <ServicesSection />
        <CtaBannerSection />
        <div id="testimonials">
          <TestimonialsSection />
        </div>
        <BookingCtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}

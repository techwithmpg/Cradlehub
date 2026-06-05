import { SERVICE_SHOWCASE_SLIDES } from "@/constants/service-showcase";
import { ServiceShowcaseCarousel } from "@/components/public/service-showcase-carousel";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

export function MobileInsideCradleSection() {
  return (
    <section className="pt-12">
      <div className="px-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
          A quiet look inside
        </p>
        <MobileScrollFloatHeading text="Inside Cradle" />
        <MobileFadeUp>
          <p className="mt-3 max-w-[310px] text-[12px] leading-6 text-[#D8CCB3]/82">
            From soothing treatments to thoughtful details, every part of Cradle
            is created to help you feel cared for.
          </p>
        </MobileFadeUp>
      </div>

      <div className="mt-6">
        <ServiceShowcaseCarousel
          slides={SERVICE_SHOWCASE_SLIDES}
          autoPlayInterval={10000}
          preloadFirstImage={false}
        />
      </div>
    </section>
  );
}

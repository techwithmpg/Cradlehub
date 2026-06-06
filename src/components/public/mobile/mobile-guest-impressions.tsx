import { Star } from "lucide-react";
import { MobileFadeUp, MobileScrollFloatHeading } from "./mobile-scroll-effects";

export type MobileGuestImpression = {
  text: string;
  name: string;
};

type MobileGuestImpressionsProps = {
  testimonials: readonly MobileGuestImpression[];
};

export function MobileGuestImpressions({
  testimonials,
}: MobileGuestImpressionsProps) {
  return (
    <section className="px-4 pt-12">
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/90">
          Guest Impressions
        </p>
        <MobileScrollFloatHeading text="What Our Guests Are Saying" />
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {testimonials.map(({ text, name }) => (
          <MobileFadeUp key={name} className="w-[250px] shrink-0">
            <figure className="min-h-[260px] rounded-[26px] border border-[#C8A96A]/24 bg-[#0D2B20]/65 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className="h-3.5 w-3.5 fill-[#C8A96A] text-[#C8A96A]"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <blockquote className="text-[17px] italic leading-8 text-[#F5ECDD] [font-family:var(--sp-font-accent)]">
                &ldquo;{text}&rdquo;
              </blockquote>
              <figcaption className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4B57A]">
                {name}
              </figcaption>
            </figure>
          </MobileFadeUp>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {testimonials.map((testimonial, index) => (
          <span
            key={testimonial.name}
            className={`h-1.5 rounded-full ${
              index === 0 ? "w-5 bg-[#C8A96A]" : "w-1.5 bg-[#C8A96A]/28"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

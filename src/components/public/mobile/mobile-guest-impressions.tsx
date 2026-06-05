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
        <MobileScrollFloatHeading text="Guest Impressions" />
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {testimonials.map(({ text, name }) => (
          <MobileFadeUp key={name} className="w-[250px] shrink-0">
            <figure className="rounded-[26px] border border-[#C8A96A]/18 bg-[#F3E9D2] p-5 shadow-[0_16px_38px_rgba(0,0,0,0.16)]">
              <div className="mb-4 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className="h-3.5 w-3.5 fill-[#C8A96A] text-[#C8A96A]"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <blockquote className="text-[15px] italic leading-7 text-[#0D2B20] [font-family:var(--sp-font-accent)]">
                &ldquo;{text}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9A6A1F]">
                {name}
              </figcaption>
            </figure>
          </MobileFadeUp>
        ))}
      </div>
    </section>
  );
}

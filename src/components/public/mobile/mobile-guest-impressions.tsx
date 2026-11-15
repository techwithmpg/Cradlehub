import React from "react";

type TestimonialItem = {
  quote: string;
  author: string;
  detail?: string;
};

type MobileGuestImpressionsProps = {
  testimonials?: TestimonialItem[];
};

export function MobileGuestImpressions({
  testimonials = [],
}: MobileGuestImpressionsProps) {
  if (!testimonials.length) return null;

  return (
    <section className="bg-[#F7F3EB] px-4 py-6 text-[#10261D]">
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
          Why Guests Return
        </p>
        <div className="space-y-2.5">
          {testimonials.slice(0, 2).map((item, idx) => (
            <blockquote
              key={idx}
              className="rounded-2xl border border-[#E5DEC9] bg-white p-4 shadow-xs"
            >
              <p className="font-serif text-sm leading-relaxed text-[#24342B] [font-family:var(--sp-font-display)]">
                &ldquo;{item.quote}&rdquo;
              </p>
              <footer className="mt-2 text-[11px] font-medium text-[#7A6B4F]">
                — {item.author}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

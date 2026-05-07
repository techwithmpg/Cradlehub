import { guestReasons } from "@/lib/public/public-site-data";
import { ScrollReveal } from "./scroll-reveal";

export function TestimonialsSection() {
  return (
    <section className="bg-[#F7F3EB] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <ScrollReveal>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#B68A3C]">
              Reasons Guests Visit
            </p>
            <h2
              className="text-3xl font-medium leading-tight text-[#163A2B] sm:text-4xl"
              style={{ fontFamily: "var(--sp-font-display)" }}
            >
              Everyday reasons to make space for care.
            </h2>
          </ScrollReveal>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guestReasons.map((reason, index) => (
            <ScrollReveal key={reason} delay={index * 70}>
              <div className="rounded-[8px] border border-[#EDE4D3] bg-white px-5 py-4 text-[14px] font-medium text-[#163A2B]">
                {reason}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

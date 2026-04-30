import { ScrollReveal } from "./scroll-reveal";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Maria Clara R.",
    role: "Regular Client",
    text: "The deep tissue massage at Cradle completely changed how I feel after long work weeks. The therapists truly listen to your body and adjust pressure perfectly. I leave feeling light and renewed every single time.",
    rating: 5,
    initials: "MC",
  },
  {
    name: "James Patrick L.",
    role: "First-time Visitor",
    text: "I was amazed by the ambience the moment I walked in. The hot stone therapy was unlike anything I have experienced — warm, deeply relaxing, and genuinely therapeutic. This is now my go-to spa in Bacolod.",
    rating: 5,
    initials: "JP",
  },
  {
    name: "Anna Marie S.",
    role: "Monthly Member",
    text: "My husband and I booked the couples massage for our anniversary, and it was absolutely perfect. The private suite, the calming music, and the skilled hands of the therapists made it a memory we will cherish.",
    rating: 5,
    initials: "AM",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32" style={{ background: "#F7F3EB" }}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <ScrollReveal>
            <p
              className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: "#C8A96B" }}
            >
              Testimonials
            </p>
            <h2
              className="text-3xl sm:text-4xl font-medium leading-tight"
              style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
            >
              What Our Clients Say
            </h2>
          </ScrollReveal>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 120} variant="scale">
              <div className="h-full bg-white rounded-2xl p-8 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 flex flex-col">
                {/* Quote icon */}
                <div className="mb-5">
                  <Quote className="h-7 w-7" style={{ color: "#C8A96B", opacity: 0.5 }} />
                </div>

                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} className="h-3.5 w-3.5 fill-[#C8A96B] text-[#C8A96B]" />
                  ))}
                </div>

                <p
                  className="text-[14px] leading-relaxed flex-1 mb-8"
                  style={{ color: "#6B7A6F" }}
                >
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="flex items-center gap-3 pt-6 border-t" style={{ borderColor: "#F0ECE5" }}>
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ring-2 ring-offset-2 ring-[#C8A96B]"
                    style={{ background: "#163A2B", color: "#C8A96B" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                    >
                      {t.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "#9AA89A" }}>
                      {t.role}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

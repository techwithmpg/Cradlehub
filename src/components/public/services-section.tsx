import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "./scroll-reveal";

const services = [
  {
    category: "Relaxation",
    name: "Swedish Massage",
    description:
      "A gentle, flowing full-body massage designed to improve circulation, ease muscle tension, and promote deep relaxation.",
    duration: "60 / 90 min",
    price: "From ₱800",
    image: SPA_IMAGES.swedish,
  },
  {
    category: "Therapeutic",
    name: "Deep Tissue Massage",
    description:
      "Targeted pressure on chronic tension areas and deeper muscle layers to release knots and restore mobility.",
    duration: "60 / 90 min",
    price: "From ₱1,000",
    image: SPA_IMAGES.deepTissue,
  },
  {
    category: "Sensory",
    name: "Aromatherapy Massage",
    description:
      "Essential oil-infused massage that engages your senses while soothing muscles and calming the mind.",
    duration: "60 / 90 min",
    price: "From ₱950",
    image: SPA_IMAGES.aromatherapy,
  },
  {
    category: "Therapeutic",
    name: "Hot Stone Therapy",
    description:
      "Warm volcanic stones are placed and glided across the body to melt tension and improve energy flow.",
    duration: "75 min",
    price: "From ₱1,200",
    image: SPA_IMAGES.hotStone,
  },
  {
    category: "Reflexology",
    name: "Foot Reflexology",
    description:
      "Ancient pressure-point technique applied to the feet to stimulate healing and relaxation throughout the body.",
    duration: "45 / 60 min",
    price: "From ₱500",
    image: SPA_IMAGES.reflexology,
  },
  {
    category: "Couples",
    name: "Couples Massage",
    description:
      "Share a serene wellness experience side-by-side with a partner in our intimate couples suite.",
    duration: "60 / 90 min",
    price: "From ₱1,800",
    image: SPA_IMAGES.couples,
  },
];

export function ServicesSection() {
  return (
    <section style={{ background: "#FCFAF5" }}>
      {/* Section header */}
      <div className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <ScrollReveal>
              <p
                className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
                style={{ color: "#C8A96B" }}
              >
                Our Treatments
              </p>
              <h2
                className="text-3xl sm:text-4xl font-medium leading-tight mb-5"
                style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
              >
                Signature Services
              </h2>
              <p className="text-[15px] leading-relaxed" style={{ color: "#6B7A6F" }}>
                Each treatment is designed to restore your body and calm your mind — crafted by skilled
                hands in a space made for stillness.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* Alternating full-width panels */}
      <div>
        {services.map((service, i) => {
          const isEven = i % 2 === 0;
          return (
            <ScrollReveal key={service.name} delay={i * 80}>
              <div className="grid md:grid-cols-2 min-h-120">
                {/* Image */}
                <div
                  className={`relative min-h-75 md:min-h-0 ${!isEven ? "md:order-2" : ""}`}
                >
                  <Image
                    src={service.image}
                    alt={service.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>

                {/* Content */}
                <div
                  className={`flex flex-col justify-center px-10 py-14 lg:px-16 lg:py-20 ${
                    !isEven ? "md:order-1" : ""
                  }`}
                  style={{ background: "#163A2B" }}
                >
                  <p
                    className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3"
                    style={{ color: "#C8A96B" }}
                  >
                    {service.category}
                  </p>
                  <h3
                    className="text-2xl lg:text-3xl font-medium mb-5"
                    style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
                  >
                    {service.name}
                  </h3>
                  <p
                    className="text-[14px] leading-relaxed mb-8 max-w-sm"
                    style={{ color: "rgba(247,243,235,0.7)" }}
                  >
                    {service.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-5">
                    <Link
                      href="/book"
                      className="inline-flex items-center rounded-full border px-7 py-3 text-[11px] font-semibold tracking-widest uppercase transition-all duration-300 hover:bg-white/10"
                      style={{
                        borderColor: "rgba(247,243,235,0.3)",
                        color: "#FCFAF5",
                      }}
                    >
                      Book Now
                    </Link>
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: "#C8A96B" }}
                    >
                      {service.price}
                    </span>
                  </div>

                  <p
                    className="mt-5 text-[10px] font-medium uppercase tracking-widest"
                    style={{ color: "rgba(247,243,235,0.35)" }}
                  >
                    {service.duration}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}

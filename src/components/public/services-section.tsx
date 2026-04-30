import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "./scroll-reveal";

const services = [
  {
    name: "Swedish Massage",
    description:
      "A gentle, flowing full-body massage designed to improve circulation, ease muscle tension, and promote deep relaxation.",
    duration: "60 / 90 min",
    price: "From ₱800",
    image: SPA_IMAGES.swedish,
  },
  {
    name: "Deep Tissue Massage",
    description:
      "Targeted pressure on chronic tension areas and deeper muscle layers to release knots and restore mobility.",
    duration: "60 / 90 min",
    price: "From ₱1,000",
    image: SPA_IMAGES.deepTissue,
  },
  {
    name: "Aromatherapy Massage",
    description:
      "Essential oil-infused massage that engages your senses while soothing muscles and calming the mind.",
    duration: "60 / 90 min",
    price: "From ₱950",
    image: SPA_IMAGES.aromatherapy,
  },
  {
    name: "Hot Stone Therapy",
    description:
      "Warm volcanic stones are placed and glided across the body to melt tension and improve energy flow.",
    duration: "75 min",
    price: "From ₱1,200",
    image: SPA_IMAGES.hotStone,
  },
  {
    name: "Foot Reflexology",
    description:
      "Ancient pressure-point technique applied to the feet to stimulate healing and relaxation throughout the body.",
    duration: "45 / 60 min",
    price: "From ₱500",
    image: SPA_IMAGES.reflexology,
  },
  {
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
    <section className="py-24 lg:py-32" style={{ background: "#FCFAF5" }}>
      <div className="mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
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

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, i) => (
            <ScrollReveal key={service.name} delay={i * 100} variant="scale">
              <div className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(22,58,43,0.06)] hover:shadow-[0_16px_48px_rgba(22,58,43,0.12)] transition-all duration-500 hover:-translate-y-1">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={service.image}
                    alt={service.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: "linear-gradient(to top, rgba(16,38,29,0.5), transparent)",
                    }}
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3
                      className="text-[16px] font-semibold"
                      style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                    >
                      {service.name}
                    </h3>
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: "#C8A96B" }}
                    >
                      {service.price}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#6B7A6F" }}>
                    {service.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium tracking-wide uppercase" style={{ color: "#9AA89A" }}>
                      {service.duration}
                    </span>
                    <Link
                      href="/book"
                      className="text-[12px] font-semibold tracking-wide transition-colors hover:underline"
                      style={{ color: "#163A2B" }}
                    >
                      Book Now
                    </Link>
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

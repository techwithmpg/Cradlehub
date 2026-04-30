import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { Check } from "lucide-react";

const services = [
  {
    name: "Swedish Massage",
    description:
      "A gentle, flowing full-body massage designed to improve circulation, ease muscle tension, and promote deep relaxation. Ideal for first-time visitors and those seeking stress relief.",
    duration: "60 / 90 min",
    price: "From ₱800",
    image: SPA_IMAGES.swedish,
    benefits: ["Improved circulation", "Stress relief", "Muscle relaxation"],
  },
  {
    name: "Deep Tissue Massage",
    description:
      "Targeted pressure on chronic tension areas and deeper muscle layers to release knots and restore mobility. Perfect for athletes and those with persistent muscle tightness.",
    duration: "60 / 90 min",
    price: "From ₱1,000",
    image: SPA_IMAGES.deepTissue,
    benefits: ["Knot release", "Chronic pain relief", "Improved mobility"],
  },
  {
    name: "Aromatherapy Massage",
    description:
      "Essential oil-infused massage that engages your senses while soothing muscles and calming the mind. Each oil blend is chosen to match your mood and wellness goals.",
    duration: "60 / 90 min",
    price: "From ₱950",
    image: SPA_IMAGES.aromatherapy,
    benefits: ["Sensory balance", "Emotional calm", "Natural healing"],
  },
  {
    name: "Hot Stone Therapy",
    description:
      "Warm volcanic stones are placed and glided across the body to melt tension and improve energy flow. The heat penetrates deeply for lasting relief.",
    duration: "75 min",
    price: "From ₱1,200",
    image: SPA_IMAGES.hotStone,
    benefits: ["Deep heat penetration", "Energy flow", "Lasting relaxation"],
  },
  {
    name: "Foot Reflexology",
    description:
      "Ancient pressure-point technique applied to the feet to stimulate healing and relaxation throughout the body. A focused treatment that feels surprisingly full-body.",
    duration: "45 / 60 min",
    price: "From ₱500",
    image: SPA_IMAGES.reflexology,
    benefits: ["Pressure-point therapy", "Full-body stimulation", "Energy rebalance"],
  },
  {
    name: "Couples Massage",
    description:
      "Share a serene wellness experience side-by-side with a partner in our intimate couples suite. Includes champagne and chocolates for a truly romantic escape.",
    duration: "60 / 90 min",
    price: "From ₱1,800",
    image: SPA_IMAGES.couples,
    benefits: ["Shared experience", "Private suite", "Romantic ambiance"],
  },
];

export default function ServicesPage() {
  return (
    <div className="sp-public">
      {/* Page Header */}
      <div className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: "#F7F3EB" }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            Our Menu
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-5"
            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
          >
            Signature Treatments
          </h1>
          <p className="text-[15px] max-w-xl mx-auto" style={{ color: "#6B7A6F" }}>
            Each treatment is thoughtfully designed to restore your body and calm your mind.
            Choose the experience that speaks to your needs.
          </p>
        </div>
      </div>

      {/* Services List */}
      <section className="py-20 lg:py-28" style={{ background: "#FCFAF5" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-16">
            {services.map((service, i) => (
              <ScrollReveal key={service.name}>
                <div
                  className={`grid lg:grid-cols-2 gap-10 items-center ${
                    i % 2 === 1 ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
                      <Image
                        src={service.image}
                        alt={service.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    </div>
                  </div>
                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className="text-[12px] font-semibold tracking-widest uppercase"
                        style={{ color: "#C8A96B" }}
                      >
                        {service.duration}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[#EDE4D3]" />
                      <span
                        className="text-[12px] font-semibold tracking-widest uppercase"
                        style={{ color: "#163A2B" }}
                      >
                        {service.price}
                      </span>
                    </div>
                    <h2
                      className="text-2xl sm:text-3xl font-medium mb-4"
                      style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                    >
                      {service.name}
                    </h2>
                    <p className="text-[15px] leading-relaxed mb-6" style={{ color: "#6B7A6F" }}>
                      {service.description}
                    </p>
                    <ul className="flex flex-col gap-2 mb-8">
                      {service.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-[13px]" style={{ color: "#6B7A6F" }}>
                          <Check className="h-4 w-4 text-[#C8A96B] shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/book"
                      className="inline-flex items-center rounded-full px-8 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-lg"
                      style={{
                        background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                        color: "#10261D",
                      }}
                    >
                      Book This Treatment
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

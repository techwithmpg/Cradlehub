import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getAllServices } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { Check } from "lucide-react";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Pick<
  Database["public"]["Tables"]["service_categories"]["Row"],
  "id" | "name" | "display_order"
>;
type CategoryRelation = CategoryRow | CategoryRow[] | null;
type ServiceWithCategory = ServiceRow & {
  service_categories?: CategoryRelation;
};

const DEFAULT_DESCRIPTION =
  "A premium treatment designed to ease tension, improve circulation, and support deeper recovery.";

const DEFAULT_BENEFITS = ["Stress relief", "Muscle recovery", "Improved circulation"];

const IMAGE_CYCLE = [
  SPA_IMAGES.swedish,
  SPA_IMAGES.deepTissue,
  SPA_IMAGES.aromatherapy,
  SPA_IMAGES.hotStone,
  SPA_IMAGES.reflexology,
  SPA_IMAGES.couples,
] as const;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  }).format(amount);
}

function firstCategory(value: CategoryRelation | undefined): CategoryRow | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function resolveServiceImage(name: string, index: number) {
  const key = name.toLowerCase();
  if (key.includes("swedish")) return SPA_IMAGES.swedish;
  if (key.includes("deep")) return SPA_IMAGES.deepTissue;
  if (key.includes("aroma")) return SPA_IMAGES.aromatherapy;
  if (key.includes("stone")) return SPA_IMAGES.hotStone;
  if (key.includes("reflex")) return SPA_IMAGES.reflexology;
  if (key.includes("couple")) return SPA_IMAGES.couples;
  return IMAGE_CYCLE[index % IMAGE_CYCLE.length]!;
}

function buildBenefits(serviceName: string, categoryName: string) {
  const key = serviceName.toLowerCase();
  if (key.includes("swedish")) return ["Improved circulation", "Stress relief", "Muscle relaxation"];
  if (key.includes("deep")) return ["Knot release", "Chronic pain relief", "Improved mobility"];
  if (key.includes("aroma")) return ["Sensory balance", "Emotional calm", "Natural healing"];
  if (key.includes("stone")) return ["Deep heat penetration", "Energy flow", "Lasting relaxation"];
  if (key.includes("reflex")) return ["Pressure-point therapy", "Full-body stimulation", "Energy rebalance"];
  if (key.includes("couple")) return ["Shared experience", "Private suite", "Romantic ambiance"];
  return [`${categoryName} treatment`, ...DEFAULT_BENEFITS.slice(1)];
}

export default async function ServicesPage() {
  const services = (await getAllServices()) as ServiceWithCategory[];
  const displayServices = services.map((service, index) => {
    const categoryName = firstCategory(service.service_categories)?.name ?? "Wellness";
    return {
      id: service.id,
      name: service.name,
      description: service.description ?? DEFAULT_DESCRIPTION,
      duration: `${service.duration_minutes} min`,
      price: `From ${formatCurrency(Number(service.price))}`,
      image: resolveServiceImage(service.name, index),
      benefits: buildBenefits(service.name, categoryName),
    };
  });

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
            {displayServices.length === 0 ? (
              <div
                className="rounded-2xl border px-8 py-12 text-center"
                style={{ borderColor: "#EDE4D3", background: "#F7F3EB" }}
              >
                <p className="text-[15px] font-medium" style={{ color: "#163A2B" }}>
                  No services published yet.
                </p>
                <p className="text-[13px] mt-2" style={{ color: "#6B7A6F" }}>
                  Add services in the dashboard to show them here.
                </p>
              </div>
            ) : (
              displayServices.map((service, i) => (
                <ScrollReveal key={service.id}>
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
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

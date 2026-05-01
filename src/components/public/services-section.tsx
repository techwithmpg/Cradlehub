import Image from "next/image";
import Link from "next/link";
import { SPA_IMAGES } from "@/constants/spa-images";
import { getAllServices } from "@/lib/queries/services";
import type { Database } from "@/types/supabase";
import { ScrollReveal } from "./scroll-reveal";

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
  "A restorative wellness treatment designed to reduce stress, ease tension, and support full-body relaxation.";

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

export async function ServicesSection() {
  const services = (await getAllServices()) as ServiceWithCategory[];
  const displayServices = services.map((service, index) => ({
    id: service.id,
    category: firstCategory(service.service_categories)?.name ?? "Wellness",
    name: service.name,
    description: service.description ?? DEFAULT_DESCRIPTION,
    duration: `${service.duration_minutes} min`,
    price: `From ${formatCurrency(Number(service.price))}`,
    image: resolveServiceImage(service.name, index),
  }));

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
        {displayServices.length === 0 ? (
          <div className="mx-auto max-w-7xl px-6 pb-20">
            <div
              className="rounded-2xl border px-8 py-12 text-center"
              style={{ borderColor: "#EDE4D3", background: "#F7F3EB" }}
            >
              <p className="text-[14px] font-medium" style={{ color: "#163A2B" }}>
                No services published yet.
              </p>
              <p className="mt-2 text-[13px]" style={{ color: "#6B7A6F" }}>
                Add services in the dashboard to show them here.
              </p>
            </div>
          </div>
        ) : (
          displayServices.map((service, i) => {
            const isEven = i % 2 === 0;
            return (
              <ScrollReveal key={service.id} delay={i * 80}>
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
          })
        )}
      </div>
    </section>
  );
}

import Link from "next/link";
import { publicServices } from "@/lib/public/public-site-data";
import { ServiceCard } from "@/components/public/service-card";

type FeaturedServicesProps = {
  title?: string;
  description?: string;
};

export function FeaturedServices({
  title = "Featured Services",
  description = "Therapeutic treatments designed for recovery, relaxation, and premium wellness.",
}: FeaturedServicesProps) {
  return (
    <section id="services" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-[#fff6df] md:text-3xl">{title}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-[#f8ecd1]/80 md:text-base">{description}</p>
        </div>
        <Link
          href="/services"
          className="hidden text-sm text-[#f6e3a1] underline-offset-4 hover:text-[#fff6de] hover:underline md:inline"
        >
          View full menu
        </Link>
      </div>
      <div className="spa-fade-up md:hidden">
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          {publicServices.slice(0, 6).map((service) => (
            <div key={service.id} className="min-w-[86%] snap-start">
              <ServiceCard service={service} />
            </div>
          ))}
        </div>
      </div>
      <div className="spa-fade-up hidden gap-4 md:grid md:grid-cols-3">
        {publicServices.slice(0, 6).map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>
    </section>
  );
}

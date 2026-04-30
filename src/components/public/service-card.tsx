import { Clock3, Sparkles, House, Building2 } from "lucide-react";
import { BookNowButton } from "@/components/public/book-now-button";
import type { PublicService } from "@/lib/public/public-site-data";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SpaVisual } from "@/components/public/spa-visual";

type ServiceCardProps = {
  service: PublicService;
};

export function ServiceCard({ service }: ServiceCardProps) {
  const serviceModeLabel =
    service.serviceMode === "both"
      ? "Both"
      : service.serviceMode === "home_service"
        ? "Home service"
        : "In-spa";

  const ServiceModeIcon =
    service.serviceMode === "both" ? Sparkles : service.serviceMode === "home_service" ? House : Building2;

  return (
    <article className="group rounded-2xl border border-[#f6e3a1]/18 bg-[linear-gradient(180deg,rgba(34,23,15,0.78),rgba(20,14,10,0.82))] p-3 shadow-[0_12px_32px_rgba(11,8,6,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-[#e7c873]/45">
      <div className="mb-3">
        <SpaVisual
          title={service.name}
          caption={service.imageAlt}
          compact
          className="border-[#f6e3a1]/25"
        />
      </div>
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-heading text-xl font-semibold text-[#fff7e5]">{service.name}</h3>
          <span className="rounded-full border border-[#f6e3a1]/35 bg-[#f6e3a1]/12 px-2 py-0.5 text-xs text-[#f6e3a1]">
            {formatCurrency(service.priceFrom)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-[#f8ecd1]/78">{service.benefit}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#f8ecd1]/80">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f6e3a1]/18 bg-[#1f140d]/55 px-2 py-1">
            <Clock3 className="h-3.5 w-3.5 text-[#e7c873]" />
            {service.durationMinutes} mins
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
              service.serviceMode === "both"
                ? "border border-[#e7c873]/40 bg-[#e7c873]/14 text-[#f7e4a5]"
                : service.serviceMode === "home_service"
                  ? "border border-[#f6e3a1]/28 bg-[#f6e3a1]/10 text-[#f6e3a1]"
                  : "border border-[#f9f2df]/24 bg-[#f9f2df]/8 text-[#f9f2df]/85"
            )}
          >
            <ServiceModeIcon className="h-3.5 w-3.5" />
            {serviceModeLabel}
          </span>
        </div>
        <BookNowButton
          serviceId={service.id}
          className="h-9 w-full rounded-lg bg-[#d6a84f] text-sm font-semibold text-[#1f130c] hover:bg-[#e7c873]"
        >
          Book Now
        </BookNowButton>
      </div>
    </article>
  );
}

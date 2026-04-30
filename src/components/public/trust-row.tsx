import { ShieldCheck, Sparkles, UserCheck, CalendarClock } from "lucide-react";
import { trustPoints } from "@/lib/public/public-site-data";

const iconMap = [ShieldCheck, Sparkles, UserCheck, CalendarClock] as const;

export function TrustRow() {
  return (
    <section aria-label="Why clients trust Cradle Massage & Wellness Spa">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {trustPoints.map((point, index) => {
          const Icon = iconMap[index] ?? ShieldCheck;
          return (
            <article
              key={point.id}
              className="rounded-2xl border border-[#f6e3a1]/16 bg-[linear-gradient(180deg,rgba(39,26,18,0.8),rgba(27,19,14,0.78))] p-3.5 shadow-[0_10px_20px_rgba(8,6,4,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f6e3a1]/34"
            >
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f6e3a1]/30 bg-[#f6e3a1]/12 text-[#e7c873]">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#fff6e1]">{point.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#f8ecd1]/76">{point.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

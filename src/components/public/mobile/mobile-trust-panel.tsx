import { ShieldCheck, Sparkles, Star, Users } from "lucide-react";

const ITEMS = [
  { Icon: Users,       label: "Professional", sub: "Therapists" },
  { Icon: Sparkles,    label: "Premium",      sub: "Care" },
  { Icon: ShieldCheck, label: "Clean &",      sub: "Safe" },
  { Icon: Star,        label: "Trusted",      sub: "Clients" },
] as const;

export function MobileTrustPanel() {
  return (
    <section className="px-4">
      <div className="rounded-[16px] bg-[#FCFAF5] p-4 shadow-[0_4px_18px_rgba(16,38,29,0.07)] ring-1 ring-[#E8D5A3]">
        <div className="grid grid-cols-4 divide-x divide-[#E8D5A3]">
          {ITEMS.map(({ Icon, label, sub }) => (
            <div key={label} className="flex flex-col items-center px-1 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#022316]">
                <Icon className="h-4 w-4 text-[#E0B84B]" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[10px] font-bold leading-tight text-[#022316]">
                {label}
              </p>
              <p className="text-[10px] leading-tight text-[#022316]">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { Flower2, Leaf, ShieldCheck } from "lucide-react";

const PILLARS = [
  {
    icon: Flower2,
    title: "Expert Care",
    copy: "Trained & welcoming therapists",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Hygienic",
    copy: "Fresh linens & sanitized suites",
  },
  {
    icon: Leaf,
    title: "Holistic Wellness",
    copy: "Mind, body & beauty in one place",
  },
];

export function MobileTrustPanel() {
  return (
    <section className="border-y border-[#E5DEC9] bg-[#FCFAF5] px-4 py-6 text-[#10261D]">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-center">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className="rounded-xl border border-[#E5DEC9] bg-white px-2 py-3 shadow-xs"
            >
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#F5EFE3] text-[#B68A3C]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#10261D]">
                {p.title}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[#58665E]">
                {p.copy}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

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
    <section className="border-y border-[#D4B57A]/15 bg-[#061810]/60 px-4 py-6 text-[#FAF5E9]">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-center">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className="eg-glass-card rounded-xl px-2 py-3"
            >
              <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#D4B57A]/30 bg-[#0D3223] text-[#E5C98B]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[#FAF5E9]">
                {p.title}
              </p>
              <p className="mt-0.5 text-[10px] leading-tight text-[#CBD6CD]">
                {p.copy}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

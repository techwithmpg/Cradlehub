import { experienceCards } from "@/lib/public/public-site-data";
import { HeartHandshake, Home, ShieldCheck, Sparkles } from "lucide-react";

const experienceIcons = [Sparkles, ShieldCheck, Home, HeartHandshake] as const;

export function PremiumExperienceSection() {
  return (
    <section id="experience" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-12">
      <div className="mb-5">
        <h2 className="font-heading text-2xl font-semibold text-[#fff6df] md:text-3xl">Premium Experience</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[#f8ecd1]/78 md:text-base">
          Built for clients who value professional care, quiet atmosphere, and reliable booking
          support.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {experienceCards.map((card, index) => {
          const Icon = experienceIcons[index] ?? Sparkles;
          return (
          <article
            key={card.id}
            className="rounded-2xl border border-[#f6e3a1]/16 bg-[linear-gradient(160deg,rgba(41,28,19,0.78),rgba(28,19,13,0.72))] p-4 shadow-[0_10px_26px_rgba(9,6,4,0.22)] transition-all duration-300 hover:border-[#f6e3a1]/34 hover:-translate-y-0.5"
          >
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#f6e3a1]/35 bg-[#f6e3a1]/12 text-[#e7c873]">
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="font-heading text-xl font-semibold text-[#fff6de]">{card.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#f8ecd1]/76">{card.detail}</p>
          </article>
          );
        })}
      </div>
    </section>
  );
}

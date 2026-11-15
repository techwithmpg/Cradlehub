import React from "react";
import Link from "next/link";
import { ArrowRight, Flower2, Home } from "lucide-react";

type MobileExperienceGridProps = {
  siteImages?: Record<string, string>;
};

export function MobileExperienceGrid({
  siteImages: _siteImages,
}: MobileExperienceGridProps = {}) {
  return (
    <section className="bg-[#FCFAF5] px-4 py-6 text-[#10261D]">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-[#E5DEC9] bg-white p-4 shadow-xs">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
            The Cradle Experience
          </p>
          <h2 className="mt-1 font-serif text-lg font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
            Relax · Rebalance · Rejuvenate
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Link
              href="/book?visitType=in_spa"
              className="flex flex-col justify-between rounded-xl border border-[#E5DEC9] bg-[#F7F3EB] p-3 transition hover:border-[#C8A96B]"
            >
              <div>
                <Flower2 className="h-4 w-4 text-[#B68A3C]" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-[#10261D]">
                  In-Spa Experience
                </p>
                <p className="mt-0.5 text-[11px] text-[#58665E]">
                  SM Bacolod &amp; Lacson suites
                </p>
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#163A2B]">
                Book Branch <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>

            <Link
              href="/book?visitType=home_service"
              className="flex flex-col justify-between rounded-xl border border-[#E5DEC9] bg-[#F7F3EB] p-3 transition hover:border-[#C8A96B]"
            >
              <div>
                <Home className="h-4 w-4 text-[#B68A3C]" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-[#10261D]">
                  Home Service
                </p>
                <p className="mt-0.5 text-[11px] text-[#58665E]">
                  Care brought to your door
                </p>
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#163A2B]">
                Book Home <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

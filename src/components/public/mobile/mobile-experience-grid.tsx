import React from "react";
import Link from "next/link";
import { ArrowRight, Flower2, Home } from "lucide-react";

type MobileExperienceGridProps = {
  siteImages?: Record<string, string>;
};

export function MobileExperienceGrid(props: MobileExperienceGridProps = {}) {
  void props;
  return (
    <section className="px-4 py-6 text-[#FAF5E9]">
      <div className="mx-auto max-w-md">
        <div className="eg-glass-card rounded-2xl p-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-[#E5C98B] uppercase">
            The Cradle Experience
          </p>
          <h2 className="mt-1 font-serif text-lg font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
            Relax · Rebalance · Rejuvenate
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Link
              href="/book?visitType=in_spa"
              className="flex flex-col justify-between rounded-xl border border-[#D4B57A]/25 bg-[#0A271C]/80 p-3 transition hover:border-[#E8D5A3]"
            >
              <div>
                <Flower2 className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-[#FAF5E9]">
                  In-Spa Experience
                </p>
                <p className="mt-0.5 text-[11px] text-[#CBD6CD]">
                  SM Bacolod &amp; Lacson suites
                </p>
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#E8D5A3]">
                Book Branch <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>

            <Link
              href="/book?visitType=home_service"
              className="flex flex-col justify-between rounded-xl border border-[#D4B57A]/25 bg-[#0A271C]/80 p-3 transition hover:border-[#E8D5A3]"
            >
              <div>
                <Home className="h-4 w-4 text-[#E5C98B]" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-[#FAF5E9]">
                  Home Service
                </p>
                <p className="mt-0.5 text-[11px] text-[#CBD6CD]">
                  Care brought to your door
                </p>
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#E8D5A3]">
                Book Home <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import {
  resolvePublicBranchImage,
  type PublicBranch,
} from "@/lib/public/public-site-data";
import { SPA_IMAGES } from "@/constants/spa-images";

type MobileBranchesSectionProps = {
  branches: PublicBranch[];
  siteImages?: Record<string, string>;
};

export function MobileBranchesSection({
  branches,
  siteImages,
}: MobileBranchesSectionProps) {
  return (
    <section className="bg-[#FCFAF5] px-4 py-7 text-[#10261D]">
      <div className="mx-auto max-w-md">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#8A6D3B] uppercase">
              Visit Us
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium text-[#10261D] [font-family:var(--sp-font-display)]">
              Our Bacolod Branches
            </h2>
          </div>
          <Link
            href="/branches"
            className="text-xs font-semibold text-[#163A2B]"
          >
            Details →
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {branches.map((branch, idx) => {
            const img = resolvePublicBranchImage(
              branch,
              idx === 0
                ? siteImages?.mobile_branch_main || SPA_IMAGES.branchMain
                : siteImages?.mobile_branch_sm || SPA_IMAGES.branchSm,
            );
            return (
              <div
                key={branch.id}
                className="overflow-hidden rounded-2xl border border-[#E5DEC9] bg-white shadow-xs"
              >
                <div className="relative h-36 w-full bg-[#EDE4D3]">
                  <img
                    src={img}
                    alt={branch.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#B68A3C]"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-[#10261D]">
                        {branch.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#55635B]">
                        {branch.address}
                      </p>
                    </div>
                  </div>

                  {branch.phone && (
                    <a
                      href={`tel:${branch.phone.replace(/[^+\d]/g, "")}`}
                      className="mt-2 inline-flex items-center gap-1.5 pl-6 text-xs font-medium text-[#163A2B]"
                    >
                      <Phone className="h-3.5 w-3.5 text-[#8A6D3B]" aria-hidden="true" />
                      <span>{branch.phone}</span>
                    </a>
                  )}

                  <div className="mt-3 flex gap-2 pl-6">
                    <Link
                      href={`/book?branchId=${encodeURIComponent(branch.id)}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#163A2B] px-4 py-1.5 text-xs font-semibold text-[#FAF5E9]"
                    >
                      <span>Book Branch</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                    <Link
                      href="/branches"
                      className="inline-flex items-center rounded-full border border-[#D7CEBC] px-3.5 py-1.5 text-xs font-medium text-[#10261D]"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

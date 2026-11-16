import React from "react";
import Image from "next/image";
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
    <section className="px-4 py-7 text-[#FAF5E9]">
      <div className="mx-auto max-w-md">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-[#E5C98B] uppercase">
              Visit Us
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-medium text-[#FAF5E9] [font-family:var(--sp-font-display)]">
              Our Bacolod Branches
            </h2>
          </div>
          <Link
            href="/branches"
            className="text-xs font-semibold text-[#E8D5A3]"
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
                className="eg-glass-card overflow-hidden rounded-2xl"
              >
                <div className="relative h-36 w-full bg-[#0A251B]">
                  <Image
                    src={img}
                    alt={branch.name}
                    fill
                    sizes="(max-width: 768px) 92vw, 420px"
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#E5C98B]"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-[#FAF5E9]">
                        {branch.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#CBD6CD]">
                        {branch.address}
                      </p>
                    </div>
                  </div>

                  {branch.phone && (
                    <a
                      href={`tel:${branch.phone.replace(/[^+\d]/g, "")}`}
                      className="mt-2 inline-flex items-center gap-1.5 pl-6 text-xs font-medium text-[#E8D5A3]"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{branch.phone}</span>
                    </a>
                  )}

                  <div className="mt-3 flex gap-2 pl-6">
                    <Link
                      href={`/book?branchId=${encodeURIComponent(branch.id)}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#D4B57A] px-4 py-1.5 text-xs font-semibold text-[#071A12]"
                    >
                      <span>Book Branch</span>
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                    <Link
                      href="/branches"
                      className="eg-glass-pill inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium text-[#FAF5E9]"
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

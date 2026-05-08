import { getAllBranches } from "@/lib/queries/branches";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { MapPin, Phone, Mail, Clock, ArrowRight, Navigation } from "lucide-react";
import Link from "next/link";

export default async function BranchesPage() {
  const branches = await getAllBranches();

  return (
    <div className="sp-public">
      {/* Dark hero — matches mobile header */}
      <div
        className="pt-28 pb-14 lg:pt-36 lg:pb-20"
        style={{ background: "#10261D" }}
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            Our Branches
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-4"
            style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
          >
            Find a Branch Near You
          </h1>
          <p className="text-[15px] max-w-xl mx-auto" style={{ color: "rgba(252,250,245,0.65)" }}>
            Two locations in Bacolod. Each branch offers the same calm experience
            and skilled team.
          </p>
        </div>
      </div>

      {/* Branches */}
      <section className="py-20 lg:py-28" style={{ background: "#FCFAF5" }}>
        <div className="mx-auto max-w-5xl px-6">
          {branches.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[15px] font-medium" style={{ color: "#163A2B" }}>
                No branches available at the moment.
              </p>
              <p className="text-[13px] mt-2" style={{ color: "#6B7A6F" }}>
                Please check back soon or contact us directly.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {branches.map((branch, i) => (
                <ScrollReveal key={branch.id} delay={i * 100}>
                  <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500">
                    <div className="flex flex-col gap-5">
                      {/* Branch name + meta */}
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#163A2B] text-[#C8A96B] shrink-0">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <h2
                            className="text-xl sm:text-2xl font-medium"
                            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                          >
                            {branch.name}
                          </h2>
                        </div>
                        {branch.address && (
                          <p className="text-[14px] mb-3 pl-13" style={{ color: "#6B7A6F" }}>
                            {branch.address}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-5 gap-y-2 pl-13">
                          {branch.phone && (
                            <div className="flex items-center gap-2 text-[13px]" style={{ color: "#6B7A6F" }}>
                              <Phone className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                              {branch.phone}
                            </div>
                          )}
                          {branch.email && (
                            <div className="flex items-center gap-2 text-[13px]" style={{ color: "#6B7A6F" }}>
                              <Mail className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                              {branch.email}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-[13px]" style={{ color: "#6B7A6F" }}>
                            <Clock className="h-3.5 w-3.5 text-[#C8A96B] shrink-0" />
                            Daily · 9:00 AM – 9:00 PM
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {branch.phone && (
                          <a
                            href={`tel:${branch.phone.replace(/\s/g, "")}`}
                            className="inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[12px] font-medium tracking-wide transition-all duration-300 hover:bg-[#163A2B]/5"
                            style={{ borderColor: "rgba(22,58,43,0.2)", color: "#163A2B" }}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call
                          </a>
                        )}
                        <Link
                          href="/book"
                          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                          style={{
                            background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                            color: "#10261D",
                          }}
                        >
                          Book Now
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

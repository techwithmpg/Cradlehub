import { getAllBranches } from "@/lib/queries/branches";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { MapPin, Phone, Mail, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function BranchesPage() {
  const branches = await getAllBranches();

  return (
    <div className="sp-public">
      {/* Page Header */}
      <div className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: "#F7F3EB" }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            Our Locations
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-5"
            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
          >
            Visit Us in Bacolod
          </h1>
          <p className="text-[15px] max-w-xl mx-auto" style={{ color: "#6B7A6F" }}>
            Choose the location most convenient for you. Each branch offers the same
            premium experience and skilled therapists.
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
                    <div className="grid lg:grid-cols-3 gap-8 items-start">
                      <div className="lg:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#163A2B] text-[#C8A96B]">
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
                          <p className="text-[14px] mb-6" style={{ color: "#6B7A6F" }}>
                            {branch.address}
                          </p>
                        )}
                        <div className="grid sm:grid-cols-2 gap-4">
                          {branch.phone && (
                            <div className="flex items-center gap-3 text-[13px]" style={{ color: "#6B7A6F" }}>
                              <Phone className="h-4 w-4 text-[#C8A96B] shrink-0" />
                              {branch.phone}
                            </div>
                          )}
                          {branch.email && (
                            <div className="flex items-center gap-3 text-[13px]" style={{ color: "#6B7A6F" }}>
                              <Mail className="h-4 w-4 text-[#C8A96B] shrink-0" />
                              {branch.email}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[13px]" style={{ color: "#6B7A6F" }}>
                            <Clock className="h-4 w-4 text-[#C8A96B] shrink-0" />
                            Daily · 9:00 AM – 9:00 PM
                          </div>
                        </div>
                      </div>
                      <div className="flex lg:justify-end">
                        <Link
                          href="/book"
                          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-lg"
                          style={{
                            background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                            color: "#10261D",
                          }}
                        >
                          Book Here
                          <ArrowRight className="h-4 w-4" />
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

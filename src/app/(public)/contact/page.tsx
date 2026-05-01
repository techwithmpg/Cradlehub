import Link from "next/link";
import { ScrollReveal } from "@/components/public/scroll-reveal";
import { Phone, MapPin, Clock } from "lucide-react";

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className="sp-public">
      {/* Page Header */}
      <div className="pt-32 pb-16 lg:pt-40 lg:pb-20" style={{ background: "#F7F3EB" }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: "#C8A96B" }}
          >
            Get in Touch
          </p>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight mb-5"
            style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
          >
            We Would Love to Hear From You
          </h1>
          <p className="text-[15px] max-w-xl mx-auto" style={{ color: "#6B7A6F" }}>
            Have questions about our services, availability, or special requests?
            Reach out and our team will respond with care.
          </p>
        </div>
      </div>

      {/* Contact Info Cards */}
      <section className="py-20 lg:py-28" style={{ background: "#FCFAF5" }}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* Hours */}
            <ScrollReveal delay={0}>
              <div className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 h-full text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                  <Clock className="h-6 w-6" />
                </div>
                <h3
                  className="text-[16px] font-semibold mb-3"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                >
                  Hours
                </h3>
                <p className="text-[13px] font-medium" style={{ color: "#163A2B" }}>Open Daily</p>
                <p className="text-[13px] mt-1" style={{ color: "#6B7A6F" }}>10:00 AM – 10:00 PM</p>
              </div>
            </ScrollReveal>

            {/* Phone */}
            <ScrollReveal delay={100}>
              <div className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 h-full text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                  <Phone className="h-6 w-6" />
                </div>
                <h3
                  className="text-[16px] font-semibold mb-3"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                >
                  Phone
                </h3>
                <a
                  href="tel:+639177077070"
                  className="block text-[13px] transition-colors hover:text-[#C8A96B]"
                  style={{ color: "#6B7A6F" }}
                >
                  0917 707 7070
                </a>
                <a
                  href="tel:+639090087815"
                  className="block text-[13px] mt-1 transition-colors hover:text-[#C8A96B]"
                  style={{ color: "#6B7A6F" }}
                >
                  0909 008 7815
                </a>
              </div>
            </ScrollReveal>

            {/* SM City Branch */}
            <ScrollReveal delay={200}>
              <div className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 h-full text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3
                  className="text-[16px] font-semibold mb-3"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                >
                  SM City Branch
                </h3>
                <a
                  href="https://maps.google.com/?q=3rd+Floor+North+Wing+SM+City+Bacolod"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] leading-relaxed transition-colors hover:text-[#C8A96B]"
                  style={{ color: "#6B7A6F" }}
                >
                  3rd Floor, North Wing,<br />SM City Bacolod
                </a>
              </div>
            </ScrollReveal>

            {/* La Luz Branch */}
            <ScrollReveal delay={300}>
              <div className="bg-white rounded-2xl p-7 shadow-[0_2px_12px_rgba(22,58,43,0.05)] hover:shadow-[0_8px_32px_rgba(22,58,43,0.09)] transition-shadow duration-500 h-full text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#163A2B] text-[#C8A96B] mx-auto mb-5">
                  <MapPin className="h-6 w-6" />
                </div>
                <h3
                  className="text-[16px] font-semibold mb-3"
                  style={{ fontFamily: "var(--sp-font-display)", color: "#163A2B" }}
                >
                  La Luz Branch
                </h3>
                <a
                  href="https://maps.google.com/?q=PX26+XQ+Bacolod+Negros+Occidental"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] leading-relaxed transition-colors hover:text-[#C8A96B]"
                  style={{ color: "#6B7A6F" }}
                >
                  3rd Floor, La Luz Bldg Lacson,<br />National Highway, Bacolod,<br />6100 Negros Occidental
                </a>
              </div>
            </ScrollReveal>
          </div>

          {/* Social + Quick Actions */}
          <ScrollReveal>
            <div
              className="mt-16 rounded-2xl p-10 lg:p-14 text-center"
              style={{ background: "#163A2B" }}
            >
              <h2
                className="text-2xl sm:text-3xl font-medium mb-4"
                style={{ fontFamily: "var(--sp-font-display)", color: "#FCFAF5" }}
              >
                Follow Us &amp; Book Online
              </h2>
              <p
                className="text-[15px] max-w-lg mx-auto mb-8"
                style={{ color: "rgba(247,243,235,0.7)" }}
              >
                Stay updated on promotions and availability — or book directly through our online system in under two minutes.
              </p>

              {/* Social links */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                <a
                  href="https://www.facebook.com/518084738045813?ref=NONE_xav_ig_profile_page_web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide border transition-all duration-300 hover:bg-white/10"
                  style={{ borderColor: "rgba(247,243,235,0.25)", color: "rgba(247,243,235,0.9)" }}
                >
                  <IconFacebook className="h-4 w-4" />
                  Facebook
                </a>
                <a
                  href="https://www.instagram.com/cradlewellnessliving.smbacolod"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide border transition-all duration-300 hover:bg-white/10"
                  style={{ borderColor: "rgba(247,243,235,0.25)", color: "rgba(247,243,235,0.9)" }}
                >
                  <IconInstagram className="h-4 w-4" />
                  IG · SM Bacolod
                </a>
                <a
                  href="https://www.instagram.com/cradlewellnessliving"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-medium tracking-wide border transition-all duration-300 hover:bg-white/10"
                  style={{ borderColor: "rgba(247,243,235,0.25)", color: "rgba(247,243,235,0.9)" }}
                >
                  <IconInstagram className="h-4 w-4" />
                  Instagram
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/book"
                  className="inline-flex items-center rounded-full px-8 py-3.5 text-[12px] font-semibold tracking-widest uppercase transition-all duration-300 hover:shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, #C8A96B, #B68A3C)",
                    color: "#10261D",
                  }}
                >
                  Book Online
                </Link>
                <a
                  href="tel:+639177077070"
                  className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[12px] font-medium tracking-widest uppercase border transition-all duration-300 hover:bg-white/10"
                  style={{
                    borderColor: "rgba(247,243,235,0.25)",
                    color: "rgba(247,243,235,0.9)",
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Call Us
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}

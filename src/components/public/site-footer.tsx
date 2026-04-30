import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#f6e3a1]/16 bg-[linear-gradient(180deg,rgba(20,14,10,0.84),rgba(13,9,7,0.94))]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 text-sm sm:px-6 md:grid-cols-3">
        <section>
          <h2 className="font-heading text-xs tracking-[0.2em] text-[#f6e3a1] uppercase">Cradle Spa</h2>
          <p className="mt-2 text-[#f8ecd1]/72">
            Premium massage and wellness booking for Bacolod clients who value calm, quality, and
            reliability.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-xs tracking-[0.2em] text-[#f6e3a1] uppercase">Explore</h2>
          <ul className="mt-2 space-y-1.5 text-[#f8ecd1]/76">
            <li><Link href="/services" className="hover:text-[#fff6de]">Services</Link></li>
            <li><Link href="/contact" className="hover:text-[#fff6de]">Contact</Link></li>
            <li><Link href="/book" className="hover:text-[#fff6de]">Book Appointment</Link></li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-xs tracking-[0.2em] text-[#f6e3a1] uppercase">Operations</h2>
          <ul className="mt-2 space-y-1.5 text-[#f8ecd1]/76">
            <li><Link href="/login" className="hover:text-[#fff6de]">Staff Login</Link></li>
            <li><span>Bookings are auto-confirmed online</span></li>
            <li><span>Public cancellation is not available</span></li>
          </ul>
        </section>
      </div>
      <div className="border-t border-[#f6e3a1]/12 px-4 py-4 text-center text-xs text-[#f6e3a1]/58 sm:px-6">
        © {new Date().getFullYear()} Cradle Massage & Wellness Spa. All rights reserved.
      </div>
    </footer>
  );
}

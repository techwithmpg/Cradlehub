import Link from "next/link";
import { BookNowButton } from "@/components/public/book-now-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#f6e3a1]/20 bg-[linear-gradient(180deg,rgba(27,18,12,0.92),rgba(24,16,11,0.82))] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="min-w-0">
          <p className="font-heading truncate text-sm font-semibold tracking-[0.16em] text-[#f6e3a1] uppercase">
            Cradle Massage &amp; Wellness Spa
          </p>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[#f9f2df]/85 md:flex">
          <Link href="/services" className="hover:text-[#fff6dd]">
            Services
          </Link>
          <Link href="/#experience" className="hover:text-[#fff6dd]">
            Experience
          </Link>
          <Link href="/contact" className="hover:text-[#fff6dd]">
            Contact
          </Link>
          <Link href="/login" className="text-[#f6e3a1]/70 hover:text-[#fff6dd]">
            Staff Login
          </Link>
        </nav>
        <BookNowButton
          size="sm"
          className="h-9 rounded-full bg-[#d6a84f] px-4 text-sm font-semibold text-[#1e140e] shadow-[0_10px_24px_rgba(214,168,79,0.3)] hover:bg-[#e7c873]"
        >
          Book Now
        </BookNowButton>
      </div>
    </header>
  );
}

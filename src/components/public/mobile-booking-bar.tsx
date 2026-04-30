import { BookNowButton } from "@/components/public/book-now-button";

export function MobileBookingBar() {
  return (
    <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-[#f6e3a1]/20 bg-[linear-gradient(180deg,rgba(30,20,13,0.95),rgba(20,14,10,0.98))] p-3 backdrop-blur md:hidden">
      <BookNowButton className="h-11 w-full rounded-full bg-[#d6a84f] text-base font-semibold text-[#1f130c] hover:bg-[#e7c873]">
        Book Now
      </BookNowButton>
    </div>
  );
}

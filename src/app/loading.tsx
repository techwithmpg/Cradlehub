import { BrandLogo } from "@/components/shared/brand-logo";

export default function Loading() {
  return (
    <div
      aria-label="Loading Cradle Wellness Living"
      aria-live="polite"
      className="relative min-h-screen overflow-hidden bg-[#061912] text-[#F3E9D2]"
      role="status"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(200,169,106,0.22)_0%,rgba(200,169,106,0.08)_34%,rgba(6,25,18,0)_64%)]" />
      <div className="absolute inset-x-8 bottom-12 top-14 rounded-[32px] border border-[#C8A96A]/18 opacity-45 md:hidden" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <BrandLogo mode="mark" variant="dark" className="w-16 opacity-90" />
        <p className="mt-7 text-[22px] italic leading-8 text-[#F3E9D2]/90 [font-family:var(--sp-font-accent)]">
          Breathe in...
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96A]/85 [font-family:var(--sp-font-body)]">
          Cradle Wellness Living
        </p>
      </div>
    </div>
  );
}

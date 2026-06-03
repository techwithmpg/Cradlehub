import { BrandLogo } from "@/components/shared/brand-logo";
import { CrmPremiumLoader } from "@/components/features/crm/premium/crm-premium-loader";
import { cn } from "@/lib/utils";

type WorkspaceSwitchingLoaderProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

export function WorkspaceSwitchingLoader({
  title = "Switching workspace...",
  subtitle = "Preparing your workspace...",
  className,
}: WorkspaceSwitchingLoaderProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(34,29,24,0.36)] px-4 backdrop-blur-md",
        className
      )}
      role="status"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface)] px-6 py-7 text-center shadow-2xl shadow-black/15">
        <div className="mb-3 flex justify-center">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-[var(--cs-border-soft)] bg-[var(--cs-surface-warm)]">
            <BrandLogo mode="mark" size="sm" className="w-8" />
          </span>
        </div>
        <CrmPremiumLoader
          className="gap-4 p-0"
          size="sm"
          subtitle={subtitle}
          title={title}
        />
      </div>
    </div>
  );
}

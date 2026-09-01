import Image from "next/image";
import { cn } from "@/lib/utils";
import CradleLogoHorizontal from "@/assets/brand/cradle-logo-horizontal.svg";
import CradleLogoMark from "@/assets/brand/cradle-logo-mark.svg";

type BrandLogoProps = {
  mode?: "horizontal" | "mark";
  /** "light" = natural colours on light backgrounds; "dark" = white version on dark backgrounds */
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  customUrl?: string | null;
  customAlt?: string | null;
};

const sizeClasses: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-28 md:w-32",
  md: "w-40 md:w-52",
  lg: "w-52 md:w-64 lg:w-72",
};

export function BrandLogo({
  mode = "horizontal",
  variant = "light",
  size = "md",
  className,
  customUrl,
  customAlt,
}: BrandLogoProps) {
  if (customUrl && typeof customUrl === "string" && customUrl.trim().length > 0) {
    return (
      <div className={cn("relative shrink-0 flex items-center", sizeClasses[size], className)}>
        <Image
          src={customUrl}
          alt={customAlt || (mode === "mark" ? "Cradle Brand Mark" : "Cradle Wellness Living")}
          width={mode === "mark" ? 48 : 200}
          height={mode === "mark" ? 48 : 60}
          className={cn(
            "h-auto max-h-12 w-auto object-contain transition-all duration-300",
            variant === "dark" && "brightness-0 invert opacity-90"
          )}
        />
      </div>
    );
  }

  const LogoComponent = mode === "mark" ? CradleLogoMark : CradleLogoHorizontal;

  return (
    <LogoComponent
      role="img"
      aria-label="Cradle Wellness Living"
      className={cn(
        "h-auto shrink-0 object-contain transition-all duration-500",
        sizeClasses[size],
        variant === "dark" && "brightness-0 invert opacity-90",
        className
      )}
    />
  );
}

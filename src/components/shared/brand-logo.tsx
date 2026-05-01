import { cn } from "@/lib/utils";
import CradleLogoHorizontal from "@/assets/brand/cradle-logo-horizontal.svg";
import CradleLogoMark from "@/assets/brand/cradle-logo-mark.svg";

type BrandLogoProps = {
  mode?: "horizontal" | "mark";
  /** "light" = natural colours on light backgrounds; "dark" = white version on dark backgrounds */
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
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
}: BrandLogoProps) {
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

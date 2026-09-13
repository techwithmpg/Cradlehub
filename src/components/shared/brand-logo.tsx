import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  mode?: "horizontal" | "mark";
  /** "light" provides a forest brand surface; "dark" uses the existing dark surface. */
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

const markSizeClasses: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "w-12",
  md: "w-20",
  lg: "w-24",
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

  return (
    <Image
      src={mode === "mark"
        ? "/images/brand/cradle-wellness-living-mark.png"
        : "/images/brand/cradle-wellness-living-logo.png"}
      alt={customAlt ?? "Cradle Wellness Living"}
      width={mode === "mark" ? 860 : 1536}
      height={mode === "mark" ? 736 : 1024}
      sizes={mode === "mark" ? "128px" : "(min-width: 768px) 288px, 256px"}
      loading="eager"
      className={cn(
        "h-auto shrink-0 object-contain",
        mode === "mark" ? markSizeClasses[size] : sizeClasses[size],
        variant === "light" && "bg-[#163A2B]",
        className
      )}
    />
  );
}

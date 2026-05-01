import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:animate-[shimmer_1.8s_ease-in-out_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

import { cn } from "@/lib/utils";

export function SetupShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-5", className)}>
      {children}
    </section>
  );
}

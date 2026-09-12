import { Loader2 } from "lucide-react";

type StaffLoadingStateProps = {
  message?: string;
  variant?: "spinner" | "card_skeleton";
};

export function StaffLoadingState({
  message = "Loading operational workspace...",
  variant = "spinner",
}: StaffLoadingStateProps) {
  if (variant === "card_skeleton") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={message}
        className="flex flex-col gap-3 p-4 animate-pulse"
      >
        <div className="h-6 w-1/3 rounded-md bg-[#EAE4DC]/70" />
        <div className="h-28 w-full rounded-2xl bg-[#EAE4DC]/50" />
        <div className="h-20 w-full rounded-2xl bg-[#EAE4DC]/40" />
        <span className="sr-only">{message}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <Loader2 size={28} className="animate-spin text-[#163A2B] mb-2" aria-hidden="true" />
      <span className="text-xs font-medium text-[#64748B]">{message}</span>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "lucide-react";
import { updateBookingProgressAction } from "@/app/(dashboard)/staff-portal/actions";

type DriverStartTravelButtonProps = {
  bookingId: string;
  navigationUrl: string | null;
};

export function DriverStartTravelButton({
  bookingId,
  navigationUrl,
}: DriverStartTravelButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startTravel() {
    if (pending) return;

    startTransition(async () => {
      setError(null);

      try {
      const result = await updateBookingProgressAction({
        bookingId,
        nextStatus: "travel_started",
      });

      if (!result.ok) {
        setError(result.message ?? "Travel could not be started.");
        return;
      }

      /*
       * Server authority succeeded first.
       * Now hand off to the operating system / Google Maps.
       *
       * Android normally opens the Maps app when associated.
       * Browser directions remain the fallback.
       */
      if (navigationUrl) {
        window.location.assign(navigationUrl);
        return;
      }

      router.refresh();
      } catch {
        setError("Travel could not be confirmed. Refresh before retrying.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={startTravel}
        className={
          pending
            ? "flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#DCE3DF] px-4 text-[13px] font-bold text-[#69736E]"
            : "flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#0D6548] px-4 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(13,101,72,0.22)] active:scale-[0.99]"
        }
      >
        <Navigation size={17} />
        {pending ? "Starting travel…" : navigationUrl ? "Start Travel & Navigate" : "Start Travel"}
      </button>

      {error ? (
        <div className="mt-2 rounded-[10px] bg-[#FFF0F0] px-3 py-2 text-[10.5px] font-medium text-[#AD3E3E]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

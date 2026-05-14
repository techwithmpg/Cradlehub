"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function StaffPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold">This workspace could not load</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading the staff portal. Please try again.
        </p>
        <Button className="mt-4" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}

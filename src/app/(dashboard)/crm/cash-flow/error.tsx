"use client";
import { WorkspaceNotice } from "@/components/features/attendance/attendance-ui";
import { Button } from "@/components/ui/button";
export default function CashFlowError({ reset }: { reset: () => void }) {
  return (
    <WorkspaceNotice tone="error" title="Cash Flow is unavailable">
      <p>Financial records could not be loaded. No totals are shown until the read succeeds.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </WorkspaceNotice>
  );
}

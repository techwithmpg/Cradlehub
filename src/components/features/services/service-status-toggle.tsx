"use client";

import { useState, useTransition } from "react";
import { toggleServiceActiveAction } from "@/app/(dashboard)/owner/services/actions";

type Props = {
  serviceId: string;
  serviceName: string;
  isActive: boolean;
  onToggle?: (serviceId: string, nextValue: boolean) => void;
};

export function ServiceStatusToggle({ serviceId, serviceName, isActive, onToggle }: Props) {
  const [checked, setChecked] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !checked;
    setChecked(next);

    startTransition(async () => {
      const result = await toggleServiceActiveAction({
        serviceId,
        isActive: next,
      });

      if (!result.ok) {
        // Revert on failure
        setChecked(!next);
        console.error("[TOGGLE_SERVICE_FAILED]", result.message);
        return;
      }

      onToggle?.(serviceId, next);
    });
  }

  const label = checked
    ? `Set ${serviceName} inactive`
    : `Set ${serviceName} active`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={isPending}
      onClick={handleToggle}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        padding: 2,
        cursor: isPending ? "not-allowed" : "pointer",
        transition: "background-color 200ms ease",
        backgroundColor: checked ? "#4A7C59" : "var(--cs-border)",
        opacity: isPending ? 0.7 : 1,
      }}
    >
      <span
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "transform 200ms ease",
          transform: checked ? "translateX(20px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

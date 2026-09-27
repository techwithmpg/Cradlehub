import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";

type StaffEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  action?: ReactNode;
};

export function StaffEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: StaffEmptyStateProps) {
  return (
    <div
      role="region"
      aria-label={title}
      className="flex flex-col items-center justify-center rounded-2xl border border-[#EAE4DC] bg-[#FAF8F5] p-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAE4DC]/50 text-[#64748B] mb-3">
        <Icon size={24} aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-[#1E293B] mb-1">
        {title}
      </h3>

      {description ? (
        <p className="max-w-xs text-xs text-[#64748B] mb-4 leading-relaxed">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-2 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}

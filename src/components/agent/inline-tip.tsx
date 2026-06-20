"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Lightbulb, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAgentCoachContext } from "@/components/agent/agent-context-provider";
import type { CoachResponse, AgentMessage, AgentSessionContext } from "@/lib/agents/types";

const fetchCoachTip = async (context: AgentSessionContext): Promise<AgentMessage | null> => {
  const res = await fetch("/api/agent/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context, history: [] }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as CoachResponse;
  return data.reply ?? null;
};

export function InlineTip() {
  const pathname = usePathname();
  const { context, isIdle } = useAgentCoachContext();
  const [dismissedByPage, setDismissedByPage] = React.useState<Record<string, boolean>>({});

  const dismissed = dismissedByPage[pathname] ?? false;

  const cacheKey = React.useMemo(() => {
    if (!isIdle || dismissed) return null;
    return ["agent-inline-tip", context.page, context.pageState];
  }, [isIdle, context.page, context.pageState, dismissed]);

  const { data: tip, isLoading } = useSWR<AgentMessage | null, Error>(
    cacheKey,
    () => fetchCoachTip(context),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      revalidateOnMount: true,
    }
  );

  if (!isIdle || dismissed || isLoading || !tip) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-20 right-5 z-40 max-w-xs rounded-xl border bg-popover p-3 shadow-lg md:bottom-24 md:right-8 md:max-w-sm",
        "animate-in slide-in-from-bottom-3 fade-in duration-200"
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lightbulb className="size-3" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-popover-foreground">{tip.content}</p>
          {tip.actions && tip.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tip.actions.slice(0, 2).map((action) =>
                action.href ? (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="xs"
                    asChild
                    className="h-auto rounded-full px-2 py-0.5 text-[10px]"
                  >
                    <a href={action.href}>{action.label}</a>
                  </Button>
                ) : null
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="-mr-1 -mt-1 shrink-0"
          onClick={() =>
            setDismissedByPage((prev) => ({ ...prev, [pathname]: true }))
          }
          aria-label="Dismiss tip"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
}

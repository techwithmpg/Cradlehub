import {
  AlertTriangle,
  CheckSquare,
  List,
  Map,
  Route,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DispatchTabId } from "../types";

const dispatchTabs: Array<{
  id: DispatchTabId;
  label: string;
  icon: typeof List;
}> = [
  { id: "queue", label: "Queue", icon: List },
  { id: "city-map", label: "City Map", icon: Map },
  { id: "live-tracking", label: "Live Tracking", icon: Route },
  { id: "delays-alerts", label: "Delays & Alerts", icon: AlertTriangle },
  { id: "completed", label: "Completed", icon: CheckSquare },
];

export function DispatchTabs() {
  return (
    <div className="overflow-x-auto">
      <TabsList
        variant="line"
        className="h-10 w-full min-w-max justify-start rounded-none border-b border-[var(--cs-border-soft)] p-0"
      >
        {dispatchTabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="h-10 flex-none rounded-none px-4 text-xs font-semibold text-[var(--cs-text-muted)] after:bg-[#6d28d9] data-active:text-[#6d28d9]"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}

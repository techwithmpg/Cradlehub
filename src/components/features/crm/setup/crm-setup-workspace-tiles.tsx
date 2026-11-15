import type { ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  Car,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { CrmActionCard } from "@/components/features/crm/shared/crm-cards";

type ShortcutTile = {
  icon: ReactNode;
  label: string;
  description: string;
  href: string;
};

const TILES: ShortcutTile[] = [
  {
    icon: <Sparkles className="size-4" />,
    label: "Fix Services",
    description: "Assign providers to active services so customers can book.",
    href: "/crm/services",
  },
  {
    icon: <CalendarClock className="size-4" />,
    label: "Fix Schedules",
    description: "Add weekly schedules, day-offs, and blocked time.",
    href: "/crm/schedule?tab=setup",
  },
  {
    icon: <Building2 className="size-4" />,
    label: "Fix Rooms & Rules",
    description: "Review rooms, resources, booking hours, and home-service windows.",
    href: "/crm/spaces-rules",
  },
  {
    icon: <ClipboardList className="size-4" />,
    label: "Review Bookings",
    description: "Process pending requests and assign today’s bookings.",
    href: "/crm/today?filter=exceptions",
  },
  {
    icon: <Car className="size-4" />,
    label: "Open Dispatch",
    description: "Review home-service trips and driver assignment.",
    href: "/crm/dispatch",
  },
  {
    icon: <BarChart3 className="size-4" />,
    label: "Cradle Flow",
    description: "Return to today’s front-desk command center.",
    href: "/crm/today",
  },
];

export function CrmSetupWorkspaceTiles() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TILES.map((tile) => (
        <CrmActionCard
          key={tile.href}
          title={tile.label}
          description={tile.description}
          icon={tile.icon}
          href={tile.href}
          trailing={
            <ArrowRight className="size-4 text-[var(--cs-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#1F4E33]" />
          }
        />
      ))}
    </div>
  );
}

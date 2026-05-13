import { DispatchMockMap } from "./DispatchMockMap";

export type DispatchPin = {
  dispatchNumber: string;
  customerLat?: number;
  customerLng?: number;
  driverLat?: number;
  driverLng?: number;
  therapistLat?: number;
  therapistLng?: number;
  status?: "queued" | "en_route" | "arrived" | "in_progress" | "completed" | "delayed";
  etaMinutes?: number | null;
  distanceKm?: number | null;
};

export type DispatchMapPanelProps = {
  pins?: DispatchPin[];
  className?: string;
  variant?: "city" | "route";
};

export function DispatchMapPanel({
  className,
  variant = "city",
}: DispatchMapPanelProps) {
  return <DispatchMockMap variant={variant} className={className} />;
}

import type { DispatchItem, DispatchRole } from "../types";
import { DispatchDetailsPanel } from "./DispatchDetailsPanel";
import { DispatchMockMap } from "./DispatchMockMap";

export function DispatchCityMapTab({
  role,
  items,
  selectedNumber,
  onSelectNumber,
}: {
  role: DispatchRole;
  items: DispatchItem[];
  selectedNumber: string;
  onSelectNumber: (dispatchNumber: string) => void;
}) {
  const selectedItem =
    items.find((item) => item.number === selectedNumber) ??
    items.find((item) => item.number === "#002") ??
    items[0];

  if (!selectedItem) {
    return null;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <DispatchMockMap
        variant="city"
        selectedNumber={selectedItem.number}
        onPinSelect={onSelectNumber}
      />
      <DispatchDetailsPanel
        item={selectedItem}
        role={role}
        title={`Dispatch ${selectedItem.number}`}
      />
    </div>
  );
}

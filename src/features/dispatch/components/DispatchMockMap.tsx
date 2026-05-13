import { cn } from "@/lib/utils";

type DispatchMockMapVariant = "city" | "route";

type MapPinConfig = {
  number: string;
  x: number;
  y: number;
  color: string;
};

const cityPins: MapPinConfig[] = [
  { number: "#001", x: 150, y: 74, color: "#6d28d9" },
  { number: "#002", x: 590, y: 132, color: "#2563eb" },
  { number: "#003", x: 190, y: 286, color: "#16a34a" },
  { number: "#004", x: 602, y: 330, color: "#f59e0b" },
];

export function DispatchMockMap({
  variant,
  selectedNumber,
  onPinSelect,
  className,
}: {
  variant: DispatchMockMapVariant;
  selectedNumber?: string;
  onPinSelect?: (dispatchNumber: string) => void;
  className?: string;
}) {
  if (variant === "route") {
    return <RoutePreviewMap className={className} />;
  }

  return (
    <div
      aria-label="Dispatch route map preview"
      className={cn(
        "relative min-h-[340px] overflow-hidden rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[#f4f6f8]",
        className
      )}
      role="img"
    >
      <svg
        viewBox="0 0 720 420"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect width="720" height="420" fill="#f5f7f9" />
        <path d="M0 82 C150 30 250 140 392 78 C520 26 610 54 720 18" fill="none" stroke="#ffffff" strokeWidth="18" />
        <path d="M-20 230 C92 182 196 228 306 205 C448 175 566 210 742 162" fill="none" stroke="#ffffff" strokeWidth="18" />
        <path d="M72 0 L410 420" stroke="#ffffff" strokeWidth="16" />
        <path d="M300 -20 L208 420" stroke="#ffffff" strokeWidth="13" />
        <path d="M492 -20 L450 420" stroke="#ffffff" strokeWidth="12" />
        <path d="M-8 366 C156 334 206 394 350 352 C514 304 610 372 730 300" fill="none" stroke="#ffffff" strokeWidth="14" />
        <path d="M0 260 C120 220 210 270 340 234 C495 192 596 245 720 198" fill="none" stroke="#cfe3f4" strokeWidth="18" opacity="0.95" />
        <path d="M558 0 C624 40 664 80 720 92 L720 0 Z" fill="#dff2df" />
        <path d="M0 76 C46 92 68 132 86 178 L0 188 Z" fill="#dff2df" />
        <path d="M250 420 C304 374 360 366 428 420 Z" fill="#dff2df" />
        <path d="M150 94 L150 132 L305 132 L322 235" fill="none" stroke="#6d28d9" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M322 235 L498 242 L506 172 L590 152" fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M190 306 L298 326 L382 388 L510 374" fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M506 244 L502 326 L602 350" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        {[78, 128, 178, 228, 278, 328].map((x) => (
          <path key={`minor-v-${x}`} d={`M${x} 0 L${x + 120} 420`} stroke="#e5e7eb" strokeWidth="3" opacity="0.75" />
        ))}
        {[48, 118, 188, 258, 328, 398].map((y) => (
          <path key={`minor-h-${y}`} d={`M0 ${y} L720 ${y - 40}`} stroke="#e5e7eb" strokeWidth="3" opacity="0.75" />
        ))}
      </svg>

      <svg
        viewBox="0 0 720 420"
        className="absolute inset-0 h-full w-full"
        aria-hidden="false"
      >
        {cityPins.map((pin) => {
          const isSelected = selectedNumber === pin.number;

          return (
            <g
              key={pin.number}
              role={onPinSelect ? "button" : undefined}
              tabIndex={onPinSelect ? 0 : undefined}
              aria-label={`Select dispatch ${pin.number}`}
              onClick={() => onPinSelect?.(pin.number)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPinSelect?.(pin.number);
                }
              }}
              className={onPinSelect ? "cursor-pointer outline-none" : undefined}
            >
              <circle
                cx={pin.x}
                cy={pin.y}
                r={isSelected ? 24 : 21}
                fill={pin.color}
                opacity={isSelected ? 1 : 0.96}
              />
              <circle cx={pin.x} cy={pin.y + 34} r="6" fill={pin.color} />
              <path d={`M${pin.x} ${pin.y + 19} L${pin.x} ${pin.y + 34}`} stroke={pin.color} strokeWidth="4" strokeLinecap="round" />
              <text
                x={pin.x}
                y={pin.y + 5}
                fill="#ffffff"
                textAnchor="middle"
                fontSize="18"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                {pin.number}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-4 left-4 rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-white/95 p-3 text-xs shadow-[var(--cs-shadow-xs)]">
        <LegendDot color="#6d28d9" label="In Route" />
        <LegendDot color="#2563eb" label="En Route" />
        <LegendDot color="#16a34a" label="Arrived" />
        <LegendDot color="#f59e0b" label="Awaiting" />
      </div>
    </div>
  );
}

function RoutePreviewMap({ className }: { className?: string }) {
  return (
    <div
      aria-label="Dispatch route map preview"
      className={cn(
        "relative min-h-[246px] overflow-hidden rounded-[var(--cs-r-md)] border border-[var(--cs-border-soft)] bg-[#f4f6f8]",
        className
      )}
      role="img"
    >
      <svg viewBox="0 0 540 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect width="540" height="300" fill="#f5f7f9" />
        <path d="M-20 68 C108 28 220 104 336 52 C426 14 486 26 560 4" fill="none" stroke="#ffffff" strokeWidth="16" />
        <path d="M-20 188 C90 146 176 192 286 166 C392 142 448 178 560 136" fill="none" stroke="#ffffff" strokeWidth="16" />
        <path d="M58 -20 L276 320" stroke="#ffffff" strokeWidth="14" />
        <path d="M318 -20 L292 320" stroke="#ffffff" strokeWidth="12" />
        <path d="M390 0 C438 30 488 42 540 38 L540 0 Z" fill="#dff2df" />
        <path d="M0 226 C90 210 124 252 214 226 C324 192 406 226 540 196" fill="none" stroke="#cfe3f4" strokeWidth="15" opacity="0.95" />
        <path d="M142 78 L184 116 L196 196 L274 220 L316 206 L326 156 L404 168" fill="none" stroke="#6d28d9" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M326 156 L404 168 L420 220" fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="142" cy="78" r="15" fill="#6d28d9" />
        <circle cx="420" cy="220" r="15" fill="#2563eb" />
        <circle cx="142" cy="78" r="6" fill="#ffffff" />
        <path d="M420 211 L428 220 L420 229 L412 220 Z" fill="#ffffff" />
      </svg>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[11px] font-medium text-[var(--cs-text-secondary)]">
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

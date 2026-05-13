// Mock SVG map — no Google Maps API required.
// Variant "city" shows multi-dispatch pins; "route" shows a single route line.
// Replace internals with @vis.gl/react-google-maps when key is available.

const ACCENT = "#6D28D9";

interface DispatchMockMapProps {
  variant: "city" | "route";
  height?: number | string;
}

function CityMap() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 560 380"
      preserveAspectRatio="xMidYMid slice"
      aria-label="Dispatch city map preview"
      role="img"
    >
      {/* Background */}
      <rect width="560" height="380" fill="#F1F5F6" />

      {/* City blocks */}
      <rect x="20"  y="20"  width="120" height="80"  fill="#E2E8EC" rx="2" />
      <rect x="160" y="20"  width="80"  height="60"  fill="#E2E8EC" rx="2" />
      <rect x="260" y="20"  width="140" height="90"  fill="#E2E8EC" rx="2" />
      <rect x="420" y="20"  width="120" height="60"  fill="#E2E8EC" rx="2" />
      <rect x="20"  y="140" width="100" height="100" fill="#E2E8EC" rx="2" />
      <rect x="160" y="120" width="120" height="80"  fill="#E2E8EC" rx="2" />
      <rect x="300" y="140" width="80"  height="60"  fill="#D9E8D9" rx="2" />
      <rect x="400" y="120" width="140" height="100" fill="#E2E8EC" rx="2" />
      <rect x="20"  y="280" width="160" height="80"  fill="#E2E8EC" rx="2" />
      <rect x="200" y="260" width="100" height="100" fill="#E2E8EC" rx="2" />
      <rect x="320" y="270" width="100" height="90"  fill="#D9E8D9" rx="2" />
      <rect x="440" y="260" width="100" height="100" fill="#E2E8EC" rx="2" />

      {/* Roads */}
      <line x1="0" y1="120" x2="560" y2="120" stroke="#fff" strokeWidth="10" />
      <line x1="0" y1="240" x2="560" y2="240" stroke="#fff" strokeWidth="10" />
      <line x1="140" y1="0" x2="140" y2="380" stroke="#fff" strokeWidth="10" />
      <line x1="290" y1="0" x2="290" y2="380" stroke="#fff" strokeWidth="10" />
      <line x1="410" y1="0" x2="410" y2="380" stroke="#fff" strokeWidth="10" />

      {/* Route lines */}
      <polyline points="80,80 80,120 200,120 200,160" stroke="#6D28D9" strokeWidth="2.5" fill="none" strokeDasharray="5,3" strokeLinecap="round" />
      <polyline points="340,65 340,120 350,120 350,160" stroke="#2563EB" strokeWidth="2.5" fill="none" strokeDasharray="5,3" strokeLinecap="round" />
      <polyline points="200,200 200,240 360,240 360,200" stroke="#16A34A" strokeWidth="2.5" fill="none" strokeDasharray="5,3" strokeLinecap="round" />
      <polyline points="470,70 470,120 460,120 460,160" stroke="#D97706" strokeWidth="2.5" fill="none" strokeDasharray="5,3" strokeLinecap="round" />

      {/* Dispatch pins */}
      <Pin x={80} y={80} label="#001" color="#6D28D9" />
      <Pin x={340} y={65} label="#002" color="#2563EB" />
      <Pin x={360} y={200} label="#003" color="#16A34A" />
      <Pin x={470} y={160} label="#004" color="#D97706" />

      {/* Legend */}
      <rect x="10" y="340" width="200" height="32" fill="white" fillOpacity="0.85" rx="4" />
      <circle cx="24" cy="356" r="5" fill="#6D28D9" />
      <text x="32" y="360" fontSize="9" fill="#374151">In Route</text>
      <circle cx="72" cy="356" r="5" fill="#2563EB" />
      <text x="80" y="360" fontSize="9" fill="#374151">En Route</text>
      <circle cx="122" cy="356" r="5" fill="#16A34A" />
      <text x="130" y="360" fontSize="9" fill="#374151">Arrived</text>
      <circle cx="168" cy="356" r="5" fill="#D97706" />
      <text x="176" y="360" fontSize="9" fill="#374151">Awaiting</text>
    </svg>
  );
}

function Pin({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill={color} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
        {label}
      </text>
    </g>
  );
}

function RouteMap() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 420 240"
      preserveAspectRatio="xMidYMid slice"
      aria-label="Dispatch route map preview"
      role="img"
    >
      {/* Background */}
      <rect width="420" height="240" fill="#F1F5F6" />

      {/* Blocks */}
      <rect x="20"  y="20"  width="100" height="60" fill="#E2E8EC" rx="2" />
      <rect x="140" y="20"  width="80"  height="60" fill="#E2E8EC" rx="2" />
      <rect x="240" y="20"  width="160" height="60" fill="#E2E8EC" rx="2" />
      <rect x="20"  y="160" width="120" height="60" fill="#E2E8EC" rx="2" />
      <rect x="160" y="150" width="80"  height="70" fill="#E2E8EC" rx="2" />
      <rect x="260" y="160" width="140" height="60" fill="#D9E8D9" rx="2" />

      {/* Roads */}
      <line x1="0" y1="100" x2="420" y2="100" stroke="#fff" strokeWidth="10" />
      <line x1="130" y1="0" x2="130" y2="240" stroke="#fff" strokeWidth="10" />
      <line x1="260" y1="0" x2="260" y2="240" stroke="#fff" strokeWidth="10" />

      {/* Route line */}
      <polyline
        points="60,60 60,100 200,100 200,150 330,150 330,165"
        stroke={ACCENT}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Start pin */}
      <circle cx={60} cy={60} r={10} fill={ACCENT} />
      <text x={60} y={64} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">S</text>

      {/* Destination pin */}
      <circle cx={330} cy={165} r={10} fill="#16A34A" />
      <text x={330} y={169} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">D</text>
    </svg>
  );
}

export function DispatchMockMap({ variant, height = 340 }: DispatchMockMapProps) {
  return (
    <div
      style={{
        width:        "100%",
        height:       height,
        borderRadius: "var(--cs-r-md)",
        overflow:     "hidden",
        border:       "1px solid var(--cs-border-soft)",
        background:   "#F1F5F6",
      }}
      aria-label="Dispatch map preview"
    >
      {variant === "city" ? <CityMap /> : <RouteMap />}
    </div>
  );
}

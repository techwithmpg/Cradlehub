import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div style={{ paddingBottom: "3rem" }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: "2rem" }}>
        <Skeleton style={{ height: 32, width: 200, marginBottom: 8 }} />
        <Skeleton style={{ height: 20, width: 400 }} />
      </div>

      {/* Filter Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton style={{ height: 36, width: 80, borderRadius: 18 }} />
          <Skeleton style={{ height: 36, width: 80, borderRadius: 18 }} />
          <Skeleton style={{ height: 36, width: 80, borderRadius: 18 }} />
        </div>
        <Skeleton style={{ height: 36, width: 120 }} />
      </div>

      {/* KPI Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Skeleton style={{ height: 120, borderRadius: "var(--cs-r-md)" }} />
        <Skeleton style={{ height: 120, borderRadius: "var(--cs-r-md)" }} />
        <Skeleton style={{ height: 120, borderRadius: "var(--cs-r-md)" }} />
        <Skeleton style={{ height: 120, borderRadius: "var(--cs-r-md)" }} />
      </div>

      {/* Content Skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <Skeleton style={{ height: 300, borderRadius: "var(--cs-r-lg)" }} />
        <Skeleton style={{ height: 300, borderRadius: "var(--cs-r-lg)" }} />
      </div>
      <Skeleton style={{ height: 400, borderRadius: "var(--cs-r-lg)" }} />
    </div>
  );
}

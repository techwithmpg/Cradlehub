export function AttendanceRecordReadout({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

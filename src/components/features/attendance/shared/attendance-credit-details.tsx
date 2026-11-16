import { readAttendanceCredit } from "@/lib/attendance/v2-policy";

export function AttendanceCreditDetails({
  snapshot,
  timezone,
}: {
  snapshot: unknown;
  timezone: string;
}) {
  const credit = readAttendanceCredit(snapshot);
  if (!credit) return null;
  const time = (instant: string | null) =>
    instant
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(instant))
      : "Not recorded";
  return (
    <dl className="my-3 grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Credited from</dt>
        <dd>{time(credit.creditedStartAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Credited through</dt>
        <dd>{time(credit.creditedEndAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Actual clock-out</dt>
        <dd>{time(credit.actualClockOutAt)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Working-time status</dt>
        <dd>
          {credit.state === "final"
            ? "Finalized"
            : credit.state === "review"
              ? "Requires review"
              : "Preliminary"}
        </dd>
      </div>
    </dl>
  );
}

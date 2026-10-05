import type { SheetBookingReference } from "@/lib/integrations/google-sheets/sheet-native-types";

function Badges() {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-900">
        Master Sheet
      </span>
      <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-slate-700">
        Read only
      </span>
    </span>
  );
}

function timeLabel(reference: SheetBookingReference): string {
  return reference.sortMinute === null ? "Time unknown" : (reference.timeText ?? "Time unknown");
}

export function SheetBookingReferenceRow({
  reference,
  selected,
  onSelect,
}: {
  reference: SheetBookingReference;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      tabIndex={0}
      aria-selected={selected}
      aria-label={`Read only Master Sheet reference for ${reference.customerDisplay ?? "unknown customer"} at ${timeLabel(reference)}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className="cursor-pointer bg-amber-50/30 outline-none hover:bg-amber-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-800"
    >
      <td className="border-b border-[var(--cs-border-soft)] py-4 pr-2 pl-4 text-sm font-bold text-[var(--cs-text)]">
        {timeLabel(reference)}
      </td>
      <td className="min-w-0 border-b border-[var(--cs-border-soft)] px-2 py-4">
        <div className="truncate text-sm font-semibold text-[var(--cs-text)]">
          {reference.customerDisplay ?? "Customer unknown"}
        </div>
        <div className="mt-1 truncate text-xs text-[var(--cs-text-muted)]">
          {reference.services.map((service) => service.name).join(", ") || "Service unknown"}
        </div>
      </td>
      <td className="border-b border-[var(--cs-border-soft)] px-2 py-4">
        <Badges />
      </td>
    </tr>
  );
}

export function SheetBookingReferenceCard({ reference }: { reference: SheetBookingReference }) {
  return (
    <article className="rounded-xl border border-[var(--cs-border-soft)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-[var(--cs-text)]">
            {timeLabel(reference)} · {reference.customerDisplay ?? "Customer unknown"}
          </p>
          <p className="mt-1 text-xs text-[var(--cs-text-muted)]">
            {reference.services.map((service) => service.name).join(", ") || "Service unknown"}
          </p>
        </div>
        <Badges />
      </div>
      <p className="mt-3 text-xs text-[var(--cs-text-muted)]">
        {reference.branchLabel} · {reference.attendantDisplay ?? "Attendant unknown"}
      </p>
      {reference.possibleMatch ? (
        <p className="mt-2 text-xs font-semibold text-amber-900">
          {reference.possibleMatch === "POSSIBLE_MATCH" ? "Possible match" : "Needs review"}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--cs-text-muted)]">
        {reference.source.sheetName}, rows {reference.source.startRow}–{reference.source.endRow}
      </p>
    </article>
  );
}

export function SheetBookingReferenceDetail({
  reference,
  onClose,
}: {
  reference: SheetBookingReference;
  onClose: () => void;
}) {
  return (
    <aside className="sticky top-4 h-[calc(100vh-78px)] min-h-[690px] overflow-y-auto rounded-xl border border-[var(--cs-border-soft)] bg-white p-6 shadow-[var(--cs-shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--cs-text)]">
            {reference.customerDisplay ?? "Customer unknown"}
          </h2>
          <p className="mt-1 text-sm text-[var(--cs-text-muted)]">External booking reference</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border px-3 py-1 text-sm">
          Close
        </button>
      </div>
      <div className="mt-4">
        <Badges />
      </div>
      <dl className="mt-6 grid gap-3 text-sm">
        <div>
          <dt className="font-semibold">Date and time</dt>
          <dd>
            {reference.businessDate} · {timeLabel(reference)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Branch</dt>
          <dd>{reference.branchLabel} (provisional workbook mapping)</dd>
        </div>
        <div>
          <dt className="font-semibold">Attendant evidence</dt>
          <dd>{reference.attendantDisplay ?? "Unknown"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Services</dt>
          <dd>
            {reference.services
              .map(
                (service) =>
                  `${service.name}${service.hours === null ? "" : ` · ${service.hours} hr`}`
              )
              .join(", ") || "Unknown"}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Source</dt>
          <dd>
            {reference.source.sheetName}, rows {reference.source.startRow}–{reference.source.endRow}
          </dd>
        </div>
      </dl>
      {reference.possibleMatch === "POSSIBLE_MATCH" ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          This Sheet reference may describe the same visit as a CradleHub booking; no records are
          linked.
        </p>
      ) : null}
      {reference.possibleMatch === "NEEDS_REVIEW" ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Multiple possible CradleHub visits need review. No records are linked.
        </p>
      ) : null}
      {reference.reviewWarnings.length > 0 ? (
        <p className="mt-4 text-xs text-amber-900">
          Review warnings: {reference.reviewWarnings.join(", ")}
        </p>
      ) : null}
      <p className="mt-6 text-xs text-[var(--cs-text-muted)]">
        Observed {new Date(reference.observedAt).toLocaleString("en-PH")}. This reference cannot
        change a CradleHub booking.
      </p>
    </aside>
  );
}

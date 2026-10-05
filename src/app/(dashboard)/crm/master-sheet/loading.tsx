export default function MasterSheetReviewLoading() {
  return (
    <section className="space-y-4" role="status" aria-live="polite">
      <div className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] px-5 py-4">
        <h1 className="text-2xl font-bold text-[var(--cs-text)]">Master Sheet Review</h1>
        <p className="mt-1 text-sm text-[var(--cs-text-secondary)]">External source · Read only</p>
      </div>
      <p className="rounded-lg border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 text-sm text-[var(--cs-text-secondary)]">
        Loading Master Sheet references…
      </p>
    </section>
  );
}

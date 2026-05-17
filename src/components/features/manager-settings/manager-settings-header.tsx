export function ManagerSettingsHeader() {
  return (
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cs-text-muted)]">
        Manager Workspace &gt; Branch Settings
      </p>
      <div className="max-w-3xl space-y-1">
        <h1 className="font-display text-3xl font-semibold leading-tight text-[var(--cs-text)]">
          Branch Settings
        </h1>
        <p className="text-sm leading-6 text-[var(--cs-text-secondary)]">
          Control booking hours, offered services, and scheduling automation for
          this branch.
        </p>
      </div>
    </header>
  );
}

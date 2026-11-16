export default function DriverLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading driver assignments"
      className="mx-auto max-w-md space-y-4 p-5"
    >
      <h1 className="text-xl font-bold">Loading your trips…</h1>
      <p className="text-sm text-[#65746b]">Checking assignments and journey status.</p>
      <div className="h-48 animate-pulse rounded-2xl bg-[#e7ecdf]" />
    </main>
  );
}

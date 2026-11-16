"use client";
export default function DriverError({ reset }: { reset: () => void }) {
  return (
    <main role="alert" className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold">Trips could not be refreshed</h1>
      <p className="my-4 text-sm">
        Your assignments have not been confirmed. Check your connection and try again.
      </p>
      <button
        onClick={reset}
        className="min-h-12 rounded-xl bg-[#163a2b] px-5 font-semibold text-white"
      >
        Try again
      </button>
    </main>
  );
}

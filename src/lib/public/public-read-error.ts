/** Supabase's PostgREST client reports a failed fetch as an error result. */
export function isPublicReadTransportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    (error instanceof TypeError && error.message === "fetch failed") ||
    error.message === "TypeError: fetch failed"
  );
}

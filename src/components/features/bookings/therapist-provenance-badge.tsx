import { therapistProvenanceBadge } from "@/lib/bookings/therapist-provenance";

export function TherapistProvenanceBadge({
  booking,
}: {
  booking: {
    staff_id?: string | null;
    requested_staff_id?: string | null;
    therapist_selection_source?: string | null;
  };
}) {
  const badge = therapistProvenanceBadge(booking);
  if (!badge) return null;
  return badge === "customer_choice" ? (
    <span className="ml-1 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
      ★ Customer choice
    </span>
  ) : (
    <span className="ml-1 inline-flex rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
      Auto assigned
    </span>
  );
}

/**
 * Operational identity only: distinguishes a service recipient from the person
 * who booked it. This never infers group membership, payment liability, or
 * settlement from a matching customer ID.
 */
export function resolveBookingPartyIdentity(input: {
  bookedBy?: string | null;
  serviceRecipient?: string | null;
}) {
  const bookedBy = input.bookedBy?.trim() || null;
  const serviceFor = input.serviceRecipient?.trim() || bookedBy || "Unnamed guest";
  const isGuest = Boolean(
    bookedBy && serviceFor.toLocaleLowerCase("en-PH") !== bookedBy.toLocaleLowerCase("en-PH")
  );
  return {
    bookedBy,
    serviceFor,
    isGuest,
    roleLabel: isGuest ? "Guest" : "Booker & recipient",
  };
}

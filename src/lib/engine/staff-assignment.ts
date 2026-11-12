/**
 * Bipartite matching for concurrent group bookings.
 *
 * Uses Minimum Remaining Values (MRV — most constrained guest first) combined
 * with Kuhn's augmenting-path algorithm so specialized services never get
 * starved by general services, while strictly preserving the caller's
 * First-Come, First-Served (FCFS) candidate ordering for each guest.
 */
export function findDistinctStaffAssignment(candidateStaffPerAttendee: string[][]): string[] | null {
  const attendeeCount = candidateStaffPerAttendee.length;
  if (attendeeCount === 0) return [];

  const uniqueStaff = new Set(candidateStaffPerAttendee.flat());
  if (uniqueStaff.size < attendeeCount) return null;

  // Order attendees by fewest available candidates first (MRV), breaking ties by original guest order
  const attendeeOrder = Array.from({ length: attendeeCount }, (_, index) => index).sort(
    (a, b) =>
      candidateStaffPerAttendee[a]!.length - candidateStaffPerAttendee[b]!.length || a - b
  );

  const assignedAttendeeByStaff = new Map<string, number>();

  function assign(attendeeIndex: number, visitedStaff: Set<string>): boolean {
    const candidates = candidateStaffPerAttendee[attendeeIndex]!;
    for (const staffId of candidates) {
      if (visitedStaff.has(staffId)) continue;
      visitedStaff.add(staffId);

      const currentHolder = assignedAttendeeByStaff.get(staffId);
      if (currentHolder === undefined || assign(currentHolder, visitedStaff)) {
        assignedAttendeeByStaff.set(staffId, attendeeIndex);
        return true;
      }
    }
    return false;
  }

  // Process in reverse MRV order so the most constrained & earliest guests retain final priority
  for (let i = attendeeOrder.length - 1; i >= 0; i--) {
    const attendeeIndex = attendeeOrder[i]!;
    if (!assign(attendeeIndex, new Set())) {
      return null;
    }
  }

  const result: string[] = Array(attendeeCount);
  for (const [staffId, attendeeIndex] of assignedAttendeeByStaff) {
    result[attendeeIndex] = staffId;
  }
  return result;
}
